-- User-approved optional content review. NULL retains historical category policy.
-- No backfill or alteration of documents, numbers, approval/signature plans or audit history.
begin;
alter table public.letters add column review_requested boolean;

alter function public.save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_pre_optional_review;
revoke all on function public.save_letter_draft_pre_optional_review(uuid,jsonb,jsonb) from public,anon,authenticated;
create function public.save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid; wanted boolean; category text;
begin
 if not (p_data ? 'reviewRequested') then
   return save_letter_draft_pre_optional_review(p_actor,p_data,p_document);
 end if;
 if jsonb_typeof(p_data->'reviewRequested') is distinct from 'boolean' then raise exception 'Pilihan pemeriksaan tidak valid.';end if;
 wanted:=(p_data->>'reviewRequested')::boolean;
 if not wanted and nullif(p_data->>'reviewerId','') is not null then raise exception 'Pilih Ya untuk menggunakan pemeriksa.';end if;
 category:=nullif(p_data->>'categoryCode','');
 if category is null and nullif(p_data->>'id','') is not null then
   select c.code into category from letters l join document_categories c on c.id=l.category_id where l.id=(p_data->>'id')::uuid;
 end if;
 -- Internal compatibility metadata only; explicit review choice controls new submissions.
 p_data:=jsonb_set(p_data,'{categoryCode}',to_jsonb(coalesce(category,'PEMBERITAHUAN')));
 v_id:=save_letter_draft_pre_optional_review(p_actor,p_data,p_document);
 update letters set review_requested=wanted,review_status=case when wanted then 'NOT_STARTED' else 'NOT_REQUIRED' end where id=v_id;
 return v_id;
end $$;
revoke all on function public.save_letter_draft(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_letter_draft(uuid,jsonb,jsonb) to service_role;

create or replace function submit_letter_for_approval(p_actor uuid,p_letter uuid,p_revision integer,p_confirm_self boolean default false) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; p review_policies; v letter_versions; s review_steps; seq integer;
begin
 select * into l from letters where id=p_letter for update;
 if l.resubmission_required_version=l.current_version_id then raise exception 'Simpan koreksi sebagai versi baru sebelum mengajukan ulang.';end if;
 if true then
   if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null
   or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null
   or l.revision is distinct from p_revision or l.previewed_revision is distinct from l.revision then raise exception 'Simpan dan pratinjau versi terkini sebelum mengajukan.'; end if;
   p:=app.review_policy(l.category_id,l.letter_type_id);
   if p.id is null then raise exception 'Pilih kategori dan aturan pemeriksaan sebelum pengajuan.'; end if;
   if coalesce(l.review_requested,p.requires_review) or l.reviewer_id is not null then
     if l.reviewer_id is null or l.reviewer_id=p_actor or not app.authorized_reviewer(l.reviewer_id,l.creator_unit_id,l.letter_type_id) then raise exception 'Pemeriksa berwenang wajib dipilih sebelum pengajuan.'; end if;
     if not app.review_passed(l.id) then
       select * into v from letter_versions where id=l.current_version_id and letter_id=l.id;
       if v.id is null or nullif(v.file_hash,'') is null then raise exception 'Versi dokumen belum tersedia.'; end if;
       if exists(select 1 from review_steps where letter_id=l.id and version_id=v.id and status='REVISION_REQUESTED') then raise exception 'Simpan revisi sebagai versi baru sebelum mengajukan kembali.'; end if;
       select * into s from review_steps where letter_id=l.id and version_id=v.id and reviewer_id=l.reviewer_id
         and policy_id=p.id and policy_revision=p.revision and status='PENDING';
       if s.id is not null then return 'WAITING_REVIEW'; end if;
       select coalesce(max(cycle),0)+1 into seq from review_steps where letter_id=l.id;
       insert into review_steps(letter_id,version_id,file_hash,reviewer_id,cycle,policy_id,policy_revision)
       values(l.id,v.id,v.file_hash,l.reviewer_id,seq,p.id,p.revision);
       update letters set review_status='WAITING',revision=revision+1,previewed_revision=revision+1 where id=l.id;
       insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id) values(p_actor,l.id,'REVIEW_REQUESTED','letters',l.id::text,v.id);
       insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.reviewer_id,l.id,'REVIEW_REQUESTED','Surat menunggu pemeriksaan Anda.',false);
       return 'WAITING_REVIEW';
     end if;
   end if;
 end if;
 return app.submit_approval_plan(p_actor,p_letter,p_confirm_self);
end $$;

create or replace function issue_letter_number(p_letter_id uuid,p_actor uuid,p_idempotency_key text) returns number_issuances
language plpgsql security invoker set search_path=public as $$
declare l letters; p review_policies;
begin
 select * into l from letters where id=p_letter_id for update;
 -- Retry nomor yang sudah sah tetap idempoten; tidak mewajibkan ulang review historis.
 if l.official_number is null then
   p:=app.review_policy(l.category_id,l.letter_type_id);
   if p.id is null or ((coalesce(l.review_requested,p.requires_review) or l.reviewer_id is not null) and not app.review_passed(l.id)) then raise exception 'Pemeriksaan versi terkini belum selesai atau kewenangan berubah.'; end if;
 end if;
 return issue_letter_number_pre_review(p_letter_id,p_actor,p_idempotency_key);
end $$;

create or replace function app.guard_review_fields() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then raise exception 'Simpan draft melalui aplikasi yang berwenang.' using errcode='42501';end if;
  if new.category_id is distinct from old.category_id or new.reviewer_id is distinct from old.reviewer_id or new.review_status is distinct from old.review_status or new.review_requested is distinct from old.review_requested then
   raise exception 'Pemeriksaan hanya dapat diubah melalui alur resmi.' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function app.guard_review_fields() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
