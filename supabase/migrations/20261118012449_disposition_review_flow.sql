-- Revisi eksplisit pengguna: surat tindak lanjut kembali ke pemberi untuk diperiksa.
alter table dispositions drop constraint dispositions_status_check;
alter table dispositions add constraint dispositions_status_check check(status in ('NEW','IN_PROGRESS','IN_REVIEW','REVISION_REQUESTED','DONE'));
alter table dispositions add column response_letter_id uuid references letters(id);
alter table dispositions add column review_note text;
alter table dispositions add column submitted_at timestamptz;
alter table dispositions add column reviewed_at timestamptz;
alter table dispositions add column revision integer not null default 0;
create index dispositions_response_idx on dispositions(response_letter_id);
-- Tidak ada perubahan langsung oleh klien; seluruh transisi dan audit satu transaksi.
drop policy if exists dispositions_insert on dispositions;
drop policy if exists dispositions_update on dispositions;
drop policy if exists dispositions_select on dispositions;
create policy dispositions_select on dispositions for select to authenticated using(giver_id=auth.uid() or recipient_id=auth.uid());

create or replace function app.can_read_letter_for(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from profiles where id=p_actor and is_active) and exists (
 select 1 from letters l where l.id=p_letter and (
 l.creator_id=p_actor or l.signer_id=p_actor
 or (l.recipient_user_id=p_actor and l.status in ('NUMBERED','CANCELLED'))
 or exists(select 1 from approval_steps a where a.letter_id=l.id and a.approver_id=p_actor and a.status<>'WAITING')
 or exists(select 1 from signature_requests s where s.letter_id=l.id and s.signer_id=p_actor)
 or exists(select 1 from cancellation_requests cr where cr.letter_id=l.id and (cr.requested_by=p_actor or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=p_actor)))
 or exists(select 1 from dispositions d where (d.letter_id=l.id and d.recipient_id=p_actor) or (d.response_letter_id=l.id and d.giver_id=p_actor and d.submitted_at is not null))
 ))
$$;
revoke all on function app.can_read_letter_for(uuid,uuid) from public,anon,authenticated;
grant execute on function app.can_read_letter_for(uuid,uuid) to service_role;
create or replace function app.can_read_letter(p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
 select app.can_read_letter_for(auth.uid(),p_letter)
$$;

create or replace function check_disposition_completion() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status in ('IN_REVIEW','DONE') and new.requires_letter then
   if not exists(select 1 from letters l where l.id=new.response_letter_id and l.creator_id=new.recipient_id and l.status='NUMBERED' and l.finalized_at is not null) then
     raise exception 'Selesaikan surat tindak lanjut beserta pengesahannya sebelum mengirim hasil.';
   end if;
 end if;
 return new;
end $$;

create function disposition_workflow(p_actor uuid,p_action text,p_id uuid default null,p_revision integer default null,p_data jsonb default '{}') returns uuid language plpgsql set search_path=public as $$
declare d dispositions; a user_assignments; r user_assignments; lvl integer; rlv integer; target uuid; old_status text; src uuid;
begin
 a:=app.active_assignment(p_actor);
 if a.id is null then raise exception 'Akun tidak memiliki penugasan aktif.'; end if;
 if p_action='CREATE' then
   select level into lvl from positions where id=a.position_id;
   r:=app.active_assignment((p_data->>'recipientId')::uuid);
   select level into rlv from positions where id=r.position_id;
   if lvl<=1 or r.id is null or rlv>=lvl or (p_data->>'recipientId')::uuid=p_actor or (lvl=2 and a.unit_id<>r.unit_id) then raise exception 'Pilih penerima dengan jabatan di bawah Anda sesuai kewenangan unit.'; end if;
   if length(trim(coalesce(p_data->>'subject','')))=0 or length(trim(coalesce(p_data->>'instruction','')))=0 then raise exception 'Perihal dan arahan wajib diisi.'; end if;
   src:=nullif(p_data->>'letterId','')::uuid;
   if src is not null and (not app.can_read_letter_for(p_actor,src) or not exists(select 1 from letters where id=src and status='NUMBERED')) then raise exception 'Surat acuan harus sudah bernomor dan dapat Anda akses.'; end if;
   insert into dispositions(giver_id,recipient_id,letter_id,subject,instruction,priority,due_date,status,requires_letter)
   values(p_actor,r.profile_id,src,trim(p_data->>'subject'),trim(p_data->>'instruction'),p_data->>'priority',nullif(p_data->>'dueDate','')::date,'NEW',coalesce((p_data->>'requiresLetter')::boolean,true)) returning * into d;
   target:=d.recipient_id;
 else
   select * into d from dispositions where id=p_id for update;
   if d.id is null or p_actor not in (d.giver_id,d.recipient_id) then raise exception 'Anda tidak berwenang mengakses disposisi ini.'; end if;
   if p_revision is distinct from d.revision then raise exception 'Disposisi telah berubah. Muat ulang halaman.'; end if;
   old_status:=d.status;
   if p_action='START' and p_actor=d.recipient_id and d.status in ('NEW','REVISION_REQUESTED') then
     update dispositions set status='IN_PROGRESS',read_at=coalesce(read_at,now()),revision=revision+1 where id=d.id returning * into d;
     target:=d.giver_id;
   elsif p_action='SUBMIT' and p_actor=d.recipient_id and d.status in ('NEW','IN_PROGRESS','REVISION_REQUESTED') then
     if nullif(trim(p_data->>'note'),'') is null then raise exception 'Catatan hasil pekerjaan wajib diisi.'; end if;
     update dispositions set status='IN_REVIEW',follow_up_note=trim(p_data->>'note'),submitted_at=now(),reviewed_at=null,revision=revision+1 where id=d.id returning * into d;
     target:=d.giver_id;
   elsif p_action in ('ACCEPT','RETURN') and p_actor=d.giver_id and d.status='IN_REVIEW' then
     if p_action='RETURN' and nullif(trim(p_data->>'note'),'') is null then raise exception 'Tuliskan bagian yang perlu diperbaiki.'; end if;
     update dispositions set status=case when p_action='ACCEPT' then 'DONE' else 'REVISION_REQUESTED' end,review_note=nullif(trim(p_data->>'note'),''),reviewed_at=now(),completed_at=case when p_action='ACCEPT' then now() else null end,revision=revision+1 where id=d.id returning * into d;
     target:=d.recipient_id;
   else raise exception 'Tindakan tidak sesuai tahap atau kewenangan Anda.';
   end if;
 end if;
 insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,status_before,status_after,reason,metadata) values(p_actor,d.response_letter_id,'DISPOSITION_'||p_action,'dispositions',d.id::text,old_status,d.status,nullif(p_data->>'note',''),jsonb_build_object('source_letter_id',d.letter_id));
 insert into notifications(recipient_id,letter_id,disposition_id,event_type,title,is_read) values(target,d.response_letter_id,d.id,'DISPOSITION',case p_action when 'CREATE' then 'Disposisi baru diterima' when 'START' then 'Disposisi mulai dikerjakan' when 'SUBMIT' then 'Hasil disposisi menunggu pemeriksaan Anda' when 'RETURN' then 'Hasil disposisi perlu diperbaiki' else 'Hasil disposisi telah diterima' end,false);
 return d.id;
end $$;
revoke all on function disposition_workflow(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function disposition_workflow(uuid,text,uuid,integer,jsonb) to service_role;

-- Kaitkan penyimpanan surat dan disposisi secara atomik, termasuk saat membuat versi perbaikan.
alter function save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_core;
revoke all on function save_letter_draft_core(uuid,jsonb,jsonb) from public,anon,authenticated;
create function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid language plpgsql set search_path=public as $$
declare d dispositions; v uuid; did uuid; old_id uuid;
begin
 did:=nullif(p_data->>'dispositionId','')::uuid;
 -- Edit surat yang sudah terhubung juga tidak boleh melewati tahap pemeriksaan.
 if did is null and nullif(p_data->>'id','') is not null then select id into did from dispositions where response_letter_id=(p_data->>'id')::uuid; end if;
 if did is not null then
   select * into d from dispositions where id=did for update;
   if d.id is null or d.recipient_id<>p_actor or d.status not in ('NEW','IN_PROGRESS','REVISION_REQUESTED') then raise exception 'Surat tindak lanjut hanya dapat dikerjakan oleh penerima sebelum dikirim untuk pemeriksaan.'; end if;
   if d.response_letter_id is not null and nullif(p_data->>'id','') is null and exists(select 1 from letters where id=d.response_letter_id and finalized_at is null and status not in ('REJECTED','CANCELLED')) then raise exception 'Lanjutkan surat tindak lanjut yang sudah dibuat.'; end if;
   if nullif(p_data->>'id','') is not null and d.response_letter_id is distinct from (p_data->>'id')::uuid then raise exception 'Surat tidak sesuai disposisi.'; end if;
 end if;
 v:=save_letter_draft_core(p_actor,p_data,p_document);
 if did is not null then
   old_id:=d.response_letter_id;
   update dispositions set response_letter_id=v,status=case when status='NEW' then 'IN_PROGRESS' else status end,revision=revision+1 where id=did;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,metadata) values(p_actor,v,'DISPOSITION_LETTER_SAVED','dispositions',did::text,jsonb_build_object('previous_letter_id',old_id));
 end if;
 return v;
end $$;
revoke all on function save_letter_draft(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb) to service_role;
-- Senior Manager merupakan jabatan lintas organisasi, bukan nama unit Finance.
update profiles set full_name='[UJI REV] Senior Manager' where id='4daddd7f-d62a-445a-becc-e0d85b3a38e3' and full_name='[UJI REV] SM Finance';
update profiles set full_name='Siti Rahma (Senior Manager)' where id='a0000000-0000-0000-0000-000000000003' and full_name='Siti Rahma (Senior Manager Finance)';
