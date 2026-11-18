-- PR-02: aditif, tanpa UPDATE/backfill surat atau audit lama.
begin;
insert into document_categories(code,name,is_active) values
 ('PERMOHONAN','Permohonan',true),('LAPORAN','Laporan',true),('PEMBERITAHUAN','Pemberitahuan',true)
on conflict(code) do nothing;
create table review_policies (
 id uuid primary key default gen_random_uuid(), category_code text not null check(category_code in ('PERMOHONAN','LAPORAN','PEMBERITAHUAN')),
 letter_type_id uuid references letter_types(id), requires_review boolean not null,
 revision integer not null default 1, validation_status text not null default 'INITIAL' check(validation_status in ('INITIAL','VALIDATED')),
 validated_by uuid references profiles(id), updated_at timestamptz not null default now()
);
create unique index review_policies_scope on review_policies(category_code,coalesce(letter_type_id,'00000000-0000-0000-0000-000000000000'::uuid));
insert into review_policies(category_code,requires_review) values ('PERMOHONAN',true),('LAPORAN',true),('PEMBERITAHUAN',false);
-- Tidak ada grant pejabat perusahaan secara otomatis. Pengisian manager/grant
-- merupakan penetapan perusahaan tersendiri, bukan hak bisnis Super Admin.
create table review_policy_managers(profile_id uuid primary key references profiles(id));
create table review_authorizations (
 id uuid primary key default gen_random_uuid(), reviewer_id uuid not null references profiles(id),
 unit_id uuid references organizational_units(id), letter_type_id uuid references letter_types(id),
 is_active boolean not null default true, starts_on date not null default (now() at time zone 'Asia/Jakarta')::date, ends_on date,
 granted_by uuid not null references profiles(id), created_at timestamptz not null default now(),
 check(ends_on is null or ends_on>=starts_on)
);
alter table letters add column reviewer_id uuid references profiles(id);
alter table letters add column review_status text check(review_status in ('NOT_REQUIRED','NOT_STARTED','WAITING','PASSED','REVISION_REQUESTED'));
create table review_steps (
 id uuid primary key default gen_random_uuid(), letter_id uuid not null references letters(id),
 version_id uuid not null references letter_versions(id), file_hash text not null,
 reviewer_id uuid not null references profiles(id), cycle integer not null,
 policy_id uuid not null references review_policies(id), policy_revision integer not null,
 status text not null default 'PENDING' check(status in ('PENDING','PASSED','REVISION_REQUESTED')),
 assigned_at timestamptz not null default now(), decided_at timestamptz, decision_note text,
 unique(letter_id,cycle)
);
create index review_steps_inbox on review_steps(reviewer_id,status,letter_id,version_id);
create table review_comments (
 id uuid primary key default gen_random_uuid(), step_id uuid not null references review_steps(id),
 actor_id uuid not null references profiles(id), note text not null check(length(trim(note))>0),
 created_at timestamptz not null default now()
);
create function app.review_policy(p_category uuid,p_type uuid) returns review_policies
language sql stable security invoker set search_path=public as $$
 select r from review_policies r join document_categories c on c.code=r.category_code
 where c.id=p_category and c.is_active and (r.letter_type_id is null or r.letter_type_id=p_type)
 order by (r.letter_type_id is not null) desc limit 1
$$;
create function app.authorized_reviewer(p_actor uuid,p_unit uuid,p_type uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (app.active_assignment(p_actor)).id is not null and exists(
 select 1 from review_authorizations a where a.reviewer_id=p_actor and a.is_active
 and (a.unit_id is null or a.unit_id=p_unit) and (a.letter_type_id is null or a.letter_type_id=p_type)
 and a.starts_on<=(now() at time zone 'Asia/Jakarta')::date
 and (a.ends_on is null or a.ends_on>=(now() at time zone 'Asia/Jakarta')::date))
$$;
create function app.review_passed(p_letter uuid) returns boolean
language sql stable security invoker set search_path=public as $$
 select exists(select 1 from letters l join letter_versions v on v.id=l.current_version_id
 cross join lateral app.review_policy(l.category_id,l.letter_type_id) p
 join review_steps s on s.letter_id=l.id and s.version_id=v.id and s.file_hash=v.file_hash
 and s.reviewer_id=l.reviewer_id and s.policy_id=p.id and s.policy_revision=p.revision and s.status='PASSED'
 where l.id=p_letter and l.review_status='PASSED' and app.authorized_reviewer(s.reviewer_id,l.creator_unit_id,l.letter_type_id))
$$;

alter function save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_pre_review;
create function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare c document_categories; r uuid; v_id uuid; a user_assignments; t letter_types; p review_policies;
begin
 a:=app.active_assignment(p_actor);
 select * into c from document_categories where code=p_data->>'categoryCode' and is_active;
 if c.id is null then raise exception 'Pilih kategori surat yang aktif.'; end if;
 select * into t from letter_types where code=p_data->>'letterTypeCode' and is_active;
 p:=app.review_policy(c.id,t.id);
 if p.id is null then raise exception 'Aturan pemeriksaan kategori/jenis belum ditetapkan.'; end if;
 r:=nullif(p_data->>'reviewerId','')::uuid;
 if r is not null and (r=p_actor or not app.authorized_reviewer(r,a.unit_id,t.id)) then raise exception 'Pilih pemeriksa berbeda yang memiliki kewenangan jenis dan unit surat.'; end if;
 -- Reviewer wajib dipilih sebelum pengajuan; draft boleh disimpan sambil disiapkan.
 v_id:=save_letter_draft_pre_review(p_actor,p_data,p_document);
 update letters set category_id=c.id,reviewer_id=r,review_status=case when p.requires_review or r is not null then 'NOT_STARTED' else 'NOT_REQUIRED' end where letters.id=v_id;
 -- Keputusan lama utuh; pergantian versi membuatnya tidak berlaku pada gate baru.
 return v_id;
end $$;

alter function review_letter(uuid,uuid,text,integer,text) rename to review_letter_pre_review;
create function review_letter(p_actor uuid,p_letter uuid,p_action text,p_revision integer,p_note text default null) returns text
language plpgsql security invoker set search_path=public as $$
declare l letters; p review_policies; v letter_versions; s review_steps; seq integer;
begin
 select * into l from letters where id=p_letter for update;
 if p_action='SUBMIT' then
   if l.id is null or l.creator_id<>p_actor or (app.active_assignment(p_actor)).id is null
   or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null
   or l.revision is distinct from p_revision or l.previewed_revision is distinct from l.revision then raise exception 'Simpan dan pratinjau versi terkini sebelum mengajukan.'; end if;
   p:=app.review_policy(l.category_id,l.letter_type_id);
   if p.id is null then raise exception 'Pilih kategori dan aturan pemeriksaan sebelum pengajuan.'; end if;
   if p.requires_review or l.reviewer_id is not null then
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
 return review_letter_pre_review(p_actor,p_letter,p_action,p_revision,p_note);
end $$;

create function decide_letter_review(p_actor uuid,p_step uuid,p_version uuid,p_revision integer,p_action text,p_note text default null) returns text
language plpgsql security invoker set search_path=public as $$
declare s review_steps; l letters; p review_policies;
begin
 select * into s from review_steps where id=p_step;
 select * into l from letters where id=s.letter_id for update;
 select * into s from review_steps where id=p_step for update;
 p:=app.review_policy(l.category_id,l.letter_type_id);
 if s.id is null or s.reviewer_id<>p_actor or p_actor=l.creator_id or not app.authorized_reviewer(p_actor,l.creator_unit_id,l.letter_type_id)
 or l.review_status<>'WAITING' or s.status<>'PENDING' or l.status not in ('DRAFT','REVISION_REQUESTED') or l.finalized_at is not null
 or l.revision is distinct from p_revision or s.version_id is distinct from p_version or l.current_version_id is distinct from s.version_id
 or s.file_hash is distinct from (select file_hash from letter_versions where id=l.current_version_id)
 or s.policy_id is distinct from p.id or s.policy_revision is distinct from p.revision or l.reviewer_id is distinct from p_actor
 then raise exception 'Anda bukan pemeriksa aktif untuk versi dan aturan pemeriksaan ini.'; end if;
 if p_action not in ('COMMENT','PASS','REQUEST_REVISION') or p_action is null then raise exception 'Tindakan pemeriksaan tidak valid.'; end if;
 if p_action in ('COMMENT','REQUEST_REVISION') and nullif(trim(p_note),'') is null then raise exception 'Catatan pemeriksaan wajib diisi.'; end if;
 if p_action='COMMENT' then
   insert into review_comments(step_id,actor_id,note) values(s.id,p_actor,trim(p_note));
 else
   update review_steps set status=case p_action when 'PASS' then 'PASSED' else 'REVISION_REQUESTED' end,decision_note=nullif(trim(p_note),''),decided_at=now() where id=s.id;
   update letters set review_status=case p_action when 'PASS' then 'PASSED' else 'REVISION_REQUESTED' end,
     status=case p_action when 'REQUEST_REVISION' then 'REVISION_REQUESTED' else status end,
     revision=revision+1,previewed_revision=case when p_action='PASS' then revision+1 else null end where id=l.id;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,version_id,reason) values(p_actor,l.id,'REVIEW_'||p_action,'review_steps',s.id::text,s.version_id,nullif(trim(p_note),''));
 insert into notifications(recipient_id,letter_id,event_type,title,is_read) values(l.creator_id,l.id,'REVIEW_'||p_action,'Pemeriksaan surat telah diperbarui.',false);
 return p_action;
end $$;

-- Pertahankan seluruh guard penomoran baseline; tambahkan gate review versi terkini.
alter function issue_letter_number(uuid,uuid,text) rename to issue_letter_number_pre_review;
create function issue_letter_number(p_letter_id uuid,p_actor uuid,p_idempotency_key text) returns number_issuances
language plpgsql security invoker set search_path=public as $$
declare l letters; p review_policies;
begin
 select * into l from letters where id=p_letter_id for update;
 -- Retry nomor yang sudah sah tetap idempoten; tidak mewajibkan ulang review historis.
 if l.official_number is null then
   p:=app.review_policy(l.category_id,l.letter_type_id);
   if p.id is null or ((p.requires_review or l.reviewer_id is not null) and not app.review_passed(l.id)) then raise exception 'Pemeriksaan versi terkini belum selesai atau kewenangan berubah.'; end if;
 end if;
 return issue_letter_number_pre_review(p_letter_id,p_actor,p_idempotency_key);
end $$;

-- Hak baca reviewer hanya pada penugasan versi terkini saat menunggu/selesai pemeriksaan.
alter function app.can_read_letter_for(uuid,uuid) rename to can_read_letter_for_pre_review;
create function app.can_read_letter_for(p_actor uuid,p_letter uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for_pre_review(p_actor,p_letter) or exists(
 select 1 from letters l join review_steps s on s.letter_id=l.id and s.version_id=l.current_version_id
 where l.id=p_letter and l.reviewer_id=p_actor and s.reviewer_id=p_actor and s.status in ('PENDING','PASSED')
 and l.review_status in ('WAITING','PASSED') and app.authorized_reviewer(p_actor,l.creator_unit_id,l.letter_type_id))
$$;
-- Rebind existing session-bound helper: SQL functions retain dependency on renamed OID.
create or replace function app.can_read_letter(p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for(auth.uid(),p_letter)
$$;
-- Reviewer-only access is to the assigned current version, never old versions.
create function app.can_read_review_version(p_letter uuid,p_version uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for_pre_review(auth.uid(),p_letter) or (
 app.can_read_letter_for(auth.uid(),p_letter) and exists(select 1 from letters l where l.id=p_letter and l.current_version_id=p_version))
$$;
alter policy letter_versions_read on letter_versions using (app.can_read_review_version(letter_id,id));

alter table review_policies enable row level security;
alter table review_policy_managers enable row level security;
alter table review_authorizations enable row level security;
alter table review_steps enable row level security;
alter table review_comments enable row level security;
create policy review_policies_read on review_policies for select to authenticated using(true);
create policy review_authorizations_own on review_authorizations for select to authenticated using(reviewer_id=auth.uid());
create policy review_steps_read on review_steps for select to authenticated using(
 (reviewer_id=auth.uid() and exists(select 1 from profiles where id=auth.uid() and is_active))
 or exists(select 1 from letters l where l.id=letter_id and l.creator_id=auth.uid()));
create policy review_comments_read on review_comments for select to authenticated using(exists(select 1 from review_steps s where s.id=step_id));
revoke all on review_policies,review_policy_managers,review_authorizations,review_steps,review_comments from public,anon,authenticated;
grant select on review_policies,review_authorizations,review_steps,review_comments to authenticated;
grant all on review_policies,review_policy_managers,review_authorizations,review_steps,review_comments to service_role;

-- Konfigurasi hanya oleh pejabat yang ditunjuk perusahaan.
create function configure_review_policy(p_actor uuid,p_category text,p_type uuid,p_required boolean,p_reason text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare id uuid;
begin
 if (app.active_assignment(p_actor)).id is null or not exists(select 1 from review_policy_managers where profile_id=p_actor) then raise exception 'Anda bukan pengelola kebijakan pemeriksaan perusahaan.'; end if;
 if nullif(trim(p_reason),'') is null or p_required is null or p_category not in ('PERMOHONAN','LAPORAN','PEMBERITAHUAN') or p_category is null then raise exception 'Kategori, kewajiban dan alasan kebijakan wajib diisi.'; end if;
 if p_category in ('PERMOHONAN','LAPORAN') and not p_required then raise exception 'Permohonan dan Laporan tetap wajib pemeriksaan.'; end if;
 insert into review_policies(category_code,letter_type_id,requires_review,validation_status,validated_by)
 values(p_category,p_type,p_required,'VALIDATED',p_actor)
 on conflict(category_code,(coalesce(letter_type_id,'00000000-0000-0000-0000-000000000000'::uuid)))
 do update set requires_review=excluded.requires_review,revision=review_policies.revision+1,validation_status='VALIDATED',validated_by=p_actor,updated_at=now() returning review_policies.id into id;
 insert into audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) values(p_actor,'REVIEW_POLICY_SET','review_policies',id::text,p_reason,jsonb_build_object('policy',jsonb_build_object('category',p_category,'type',p_type,'requires_review',p_required)));
 return id;
end $$;
create function authorize_letter_reviewer(p_actor uuid,p_reviewer uuid,p_unit uuid,p_type uuid,p_active boolean,p_end date,p_reason text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare id uuid;
begin
 if (app.active_assignment(p_actor)).id is null or not exists(select 1 from review_policy_managers where profile_id=p_actor) then raise exception 'Anda bukan pengelola kebijakan pemeriksaan perusahaan.'; end if;
 if (app.active_assignment(p_reviewer)).id is null or p_active is null or nullif(trim(p_reason),'') is null then raise exception 'Pemeriksa aktif dan alasan penugasan wajib diisi.'; end if;
 if p_active then
 insert into review_authorizations(reviewer_id,unit_id,letter_type_id,granted_by,ends_on) values(p_reviewer,p_unit,p_type,p_actor,p_end) returning review_authorizations.id into id;
 else
 update review_authorizations set is_active=false where reviewer_id=p_reviewer and unit_id is not distinct from p_unit and letter_type_id is not distinct from p_type;
 id:=p_reviewer;
 end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) values(p_actor,'REVIEW_AUTHORIZATION_SET','review_authorizations',id::text,p_reason,jsonb_build_object('reviewer_id',p_reviewer,'unit_id',p_unit,'letter_type_id',p_type,'is_active',p_active,'ends_on',p_end));
 return id;
end $$;

-- Akses API pengguna tidak boleh memalsukan konfigurasi/pemeriksaan.
create function app.guard_review_fields() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then raise exception 'Simpan draft melalui aplikasi yang berwenang.' using errcode='42501'; end if;
  if new.category_id is distinct from old.category_id or new.reviewer_id is distinct from old.reviewer_id or new.review_status is distinct from old.review_status then
   raise exception 'Kategori dan pemeriksaan hanya dapat diubah melalui alur resmi.' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger letters_review_fields_guard before insert or update on letters for each row execute function app.guard_review_fields();
revoke all on function app.guard_review_fields() from public,anon,authenticated;
revoke all on function app.review_policy(uuid,uuid),app.authorized_reviewer(uuid,uuid,uuid),app.review_passed(uuid),app.can_read_letter_for(uuid,uuid),app.can_read_letter_for_pre_review(uuid,uuid),app.can_read_review_version(uuid,uuid) from public,anon,authenticated;
grant execute on function app.can_read_review_version(uuid,uuid) to authenticated,service_role;
grant execute on function app.review_policy(uuid,uuid),app.authorized_reviewer(uuid,uuid,uuid),app.review_passed(uuid),app.can_read_letter_for(uuid,uuid),app.can_read_letter_for_pre_review(uuid,uuid) to service_role;
revoke all on function save_letter_draft(uuid,jsonb,jsonb),review_letter(uuid,uuid,text,integer,text),decide_letter_review(uuid,uuid,uuid,integer,text,text),issue_letter_number(uuid,uuid,text),configure_review_policy(uuid,text,uuid,boolean,text),authorize_letter_reviewer(uuid,uuid,uuid,uuid,boolean,date,text) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb),review_letter(uuid,uuid,text,integer,text),decide_letter_review(uuid,uuid,uuid,integer,text,text),issue_letter_number(uuid,uuid,text),configure_review_policy(uuid,text,uuid,boolean,text),authorize_letter_reviewer(uuid,uuid,uuid,uuid,boolean,date,text) to service_role;
notify pgrst,'reload schema';
commit;
