-- PR-07 aditif: workflow disposisi existing, tanpa backfill surat/tugas historis.
begin;
alter table dispositions add column source_dispatch_id uuid references internal_dispatches(id);
grant select on dispositions to authenticated;
create index dispositions_source_dispatch_idx on dispositions(source_dispatch_id);
create table disposition_operations(actor_id uuid not null references profiles(id),operation_key uuid not null,action text not null,disposition_id uuid not null references dispositions(id),request_hash text not null,created_at timestamptz not null default now(),primary key(actor_id,operation_key));
create table disposition_result_links(id uuid primary key default gen_random_uuid(),disposition_id uuid not null references dispositions(id),origin_letter_id uuid not null references letters(id),result_letter_id uuid not null unique references letters(id),created_by uuid not null references profiles(id),created_at timestamptz not null default now(),draft_key uuid not null,unique(disposition_id,draft_key),check(origin_letter_id<>result_letter_id));
create table disposition_result_files(id uuid primary key default gen_random_uuid(),disposition_id uuid not null references dispositions(id),uploaded_by uuid not null references profiles(id),operation_key uuid not null,file_name text not null,storage_path text not null unique,file_hash text not null,file_format text not null check(file_format in ('PDF','DOCX')),size_bytes integer not null check(size_bytes between 1 and 1048576),created_at timestamptz not null default now(),unique(uploaded_by,operation_key));
create table disposition_submissions(id uuid primary key default gen_random_uuid(),disposition_id uuid not null references dispositions(id),submitted_by uuid not null references profiles(id),created_at timestamptz not null default now(),revision_before integer not null,note text not null,result_letter_id uuid references letters(id),result_dispatch_id uuid references internal_dispatches(id),unique(disposition_id,revision_before));
create table disposition_submission_files(submission_id uuid not null references disposition_submissions(id),file_id uuid not null references disposition_result_files(id),primary key(submission_id,file_id));
create table disposition_decisions(id uuid primary key default gen_random_uuid(),submission_id uuid not null references disposition_submissions(id),decided_by uuid not null references profiles(id),decision text not null check(decision in ('ACCEPT','RETURN')),note text,created_at timestamptz not null default now(),unique(submission_id));
create index disposition_operations_task on disposition_operations(disposition_id);
create index disposition_submission_file_idx on disposition_submission_files(file_id);
create index disposition_links_origin on disposition_result_links(origin_letter_id);
create index disposition_files_task on disposition_result_files(disposition_id);
create index disposition_submissions_task on disposition_submissions(disposition_id,created_at);
create function app.disposition_participant(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles where id=auth.uid() and is_active) and exists(select 1 from dispositions where id=p_id and auth.uid() in (giver_id,recipient_id))
$$;
revoke all on function app.disposition_participant(uuid) from public,anon;
grant execute on function app.disposition_participant(uuid) to authenticated,service_role;
alter policy dispositions_select on dispositions using(app.disposition_participant(id));
do $$ declare t text;begin
 foreach t in array array['disposition_operations','disposition_result_links','disposition_result_files','disposition_submissions','disposition_submission_files','disposition_decisions'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public,anon,authenticated',t);
 execute format('grant all on %I to service_role',t);
 execute format('create trigger %I before update or delete on %I for each row execute function app.freeze_dispatch_snapshot()',t||'_immutable',t);
 end loop;
end $$;
grant select on disposition_result_links,disposition_result_files,disposition_submissions,disposition_submission_files,disposition_decisions to authenticated;
create policy disposition_result_links_read on disposition_result_links for select to authenticated using(app.disposition_participant(disposition_id) and app.can_read_letter(origin_letter_id) and app.can_read_letter(result_letter_id));
create policy disposition_submissions_read on disposition_submissions for select to authenticated using(app.disposition_participant(disposition_id));
create policy disposition_submission_files_read on disposition_submission_files for select to authenticated using(exists(select 1 from disposition_submissions where id=submission_id));
create policy disposition_result_files_read on disposition_result_files for select to authenticated using(app.disposition_participant(disposition_id) and (uploaded_by=auth.uid() or exists(select 1 from disposition_submission_files sf where sf.file_id=disposition_result_files.id)));
create policy disposition_decisions_read on disposition_decisions for select to authenticated using(exists(select 1 from disposition_submissions where id=submission_id));

create function app.can_reference_disposition_source(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select (app.active_assignment(p_actor)).id is not null and exists(select 1 from app.active_assignment(p_actor) a join positions pos on pos.id=a.position_id where pos.level>1)
 and app.can_read_letter_for(p_actor,p_letter) and exists(select 1 from letters l join letter_types t on t.id=l.letter_type_id where l.id=p_letter and l.status='NUMBERED'
 and (t.category<>'INTERNAL' or exists(select 1 from internal_dispatches ds join dispatch_recipients r on r.dispatch_id=ds.id where ds.letter_id=l.id and r.profile_id=p_actor and r.recipient_role='PRIMARY')))
$$;
revoke all on function app.can_reference_disposition_source(uuid,uuid) from public,anon,authenticated;
grant execute on function app.can_reference_disposition_source(uuid,uuid) to service_role;
create function app.can_start_disposition(p_letter uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select app.can_reference_disposition_source(auth.uid(),p_letter)$$;
revoke all on function app.can_start_disposition(uuid) from public,anon;
grant execute on function app.can_start_disposition(uuid) to authenticated,service_role;
create function list_disposition_sources(p_letter uuid default null) returns table(id uuid,official_number text,subject text,status text) language sql stable security invoker set search_path=public,pg_temp as $$
 select l.id,l.official_number,l.subject,l.status from letters l where (p_letter is null or l.id=p_letter) and app.can_start_disposition(l.id) order by l.created_at desc limit 100
$$;
revoke all on function list_disposition_sources(uuid) from public,anon,service_role;
grant execute on function list_disposition_sources(uuid) to authenticated;

-- Relasi baru tidak memberikan hak baca dokumen.
create or replace function app.can_read_letter_for_pre_review(p_actor uuid,p_letter uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from profiles where id=p_actor and is_active) and exists (
 select 1 from letters l where l.id=p_letter and (
 l.creator_id=p_actor or l.signer_id=p_actor

 or exists(select 1 from approval_steps a where a.letter_id=l.id and a.approver_id=p_actor and a.status<>'WAITING' and a.version_id=l.current_version_id and (a.required_roles is null or (a.cycle=l.approval_cycle and app.approval_roles_valid(p_actor,a.required_roles,l.creator_unit_id,l.letter_type_id))))
 or exists(select 1 from signature_requests s where s.letter_id=l.id and s.signer_id=p_actor)
 or exists(select 1 from cancellation_requests cr where cr.letter_id=l.id and (cr.requested_by=p_actor or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=p_actor)))
 or exists(select 1 from dispositions d where d.source_dispatch_id is null and (d.letter_id=l.id and d.recipient_id=p_actor and (not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))) or (d.source_dispatch_id is null and d.response_letter_id=l.id and d.giver_id=p_actor and d.submitted_at is not null and (l.recipient_user_id is distinct from p_actor or not exists(select 1 from letter_types t where t.id=l.letter_type_id and t.category='INTERNAL') or app.is_dispatch_recipient(p_actor,l.id))))
 ))
$$;
create function app.guard_integrated_disposition() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if old.source_dispatch_id is not null and (new.source_dispatch_id,new.giver_id,new.recipient_id,new.letter_id,new.requires_letter,new.due_date) is distinct from (old.source_dispatch_id,old.giver_id,old.recipient_id,old.letter_id,old.requires_letter,old.due_date) then raise exception 'Identitas dan ketentuan disposisi resmi tidak dapat diubah biasa.';end if;
 if new.source_dispatch_id is not null and new.status in ('IN_REVIEW','DONE') and (new.requires_letter or new.response_letter_id is not null) then
  if not exists(select 1 from disposition_result_links rel join internal_dispatches ds on ds.letter_id=rel.result_letter_id join letters l on l.id=ds.letter_id
  where rel.disposition_id=new.id and rel.result_letter_id=new.response_letter_id and l.creator_id=new.recipient_id and l.status='NUMBERED' and l.finalized_at is not null and ds.primary_recipient_id=new.giver_id)
  then raise exception 'Surat hasil harus final dan telah dikirim resmi kepada pemberi sebelum hasil diajukan.';end if;
 end if;
 return new;
end $$;
create trigger integrated_disposition_guard before update on dispositions for each row execute function app.guard_integrated_disposition();

alter function disposition_workflow(uuid,text,uuid,integer,jsonb) rename to disposition_workflow_pre_integration;
create function disposition_workflow(p_actor uuid,p_action text,p_id uuid default null,p_revision integer default null,p_data jsonb default '{}') returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare d dispositions;res uuid;k uuid;op disposition_operations;h text;src uuid;ds uuid;submission uuid;result_ds uuid;f uuid;file_ids uuid[];l_count integer;
begin
 if (app.active_assignment(p_actor)).id is null then raise exception 'Akun tidak memiliki penugasan aktif.';end if;
 k:=nullif(p_data->>'operationKey','')::uuid;
 h:=md5(jsonb_build_object('action',p_action,'id',p_id,'revision',p_revision,'data',p_data)::text);
 if k is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||k::text,0));
  select * into op from disposition_operations where actor_id=p_actor and operation_key=k;
  if op.actor_id is not null then
   if op.request_hash<>h then raise exception 'Kunci tindakan sudah dipakai untuk permintaan lain.';end if;
   return op.disposition_id;
  end if;
 end if;
 if p_action='CREATE' then
  src:=nullif(p_data->>'letterId','')::uuid;
  if src is not null then
   if not app.can_reference_disposition_source(p_actor,src) then raise exception 'Disposisi surat internal hanya dari penerima utama dengan kewenangan jabatan.';end if;
   select id into ds from internal_dispatches where letter_id=src;
   if ds is not null and k is null then raise exception 'Kunci pembuatan disposisi wajib diisi.';end if;
  end if;
  res:=disposition_workflow_pre_integration(p_actor,p_action,p_id,p_revision,p_data);
  if ds is not null then update dispositions set source_dispatch_id=ds where id=res;end if;
 else
  select * into d from dispositions where id=p_id for update;
  if d.source_dispatch_id is null then return disposition_workflow_pre_integration(p_actor,p_action,p_id,p_revision,p_data);end if;
  if p_actor not in (d.giver_id,d.recipient_id) then raise exception 'Anda tidak berwenang mengakses disposisi ini.';end if;
  if k is null then raise exception 'Kunci tindakan disposisi wajib diisi.';end if;
  if d.revision is distinct from p_revision then raise exception 'Disposisi telah berubah. Muat ulang halaman.';end if;
  if p_action='ATTACH' then
   if p_actor<>d.recipient_id or d.status not in ('NEW','IN_PROGRESS','REVISION_REQUESTED') then raise exception 'Lampiran hanya oleh pelaksana sebelum pengajuan hasil.';end if;
   if nullif(p_data->>'path','') is null or left(p_data->>'path',37)<>p_actor::text||'/' or length(coalesce(p_data->>'hash',''))<>64 or p_data->>'format' not in ('PDF','DOCX') or nullif(trim(p_data->>'name'),'') is null then raise exception 'Berkas hasil belum tersimpan secara sah.';end if;
   if (select coalesce(sum(size_bytes),0) from disposition_result_files where disposition_id=d.id)+coalesce((p_data->>'size')::integer,0)>26214400 then raise exception 'Total lampiran maksimal 25 MB.';end if;
   insert into disposition_result_files(disposition_id,uploaded_by,operation_key,file_name,storage_path,file_hash,file_format,size_bytes) values(d.id,p_actor,k,left(p_data->>'name',250),p_data->>'path',p_data->>'hash',p_data->>'format',(p_data->>'size')::integer);
   update dispositions set revision=revision+1 where id=d.id;
   insert into audit_logs(actor_id,action,entity_type,entity_id) values(p_actor,'DISPOSITION_ATTACHMENT_ADDED','dispositions',d.id::text);
   res:=d.id;
  else
   if p_action='SUBMIT' then
    select coalesce(array_agg(x::uuid),'{}') into file_ids from jsonb_array_elements_text(coalesce(p_data->'attachmentIds','[]')) x;
    if cardinality(file_ids)<>(select count(distinct x) from unnest(file_ids) x) or exists(select 1 from unnest(file_ids) x where not exists(select 1 from disposition_result_files where id=x and disposition_id=d.id and uploaded_by=p_actor)) then raise exception 'Lampiran hasil tidak sesuai disposisi dan pelaksana.';end if;
    -- Catatan selalu wajib pada core. Surat yang terkait tidak boleh diabaikan meski requires_letter=false.
    if d.response_letter_id is not null then select id into result_ds from internal_dispatches where letter_id=d.response_letter_id and primary_recipient_id=d.giver_id;end if;
   end if;
   res:=disposition_workflow_pre_integration(p_actor,p_action,p_id,p_revision,p_data);
   if p_action='SUBMIT' then
    insert into disposition_submissions(disposition_id,submitted_by,revision_before,note,result_letter_id,result_dispatch_id) values(d.id,p_actor,d.revision,trim(p_data->>'note'),d.response_letter_id,result_ds) returning id into submission;
    insert into disposition_submission_files select submission,x from unnest(file_ids) x;
   elsif p_action in ('RETURN','ACCEPT') then
    select id into submission from disposition_submissions where disposition_id=d.id order by revision_before desc limit 1;
    if submission is null then raise exception 'Bukti pengajuan hasil belum tersedia.';end if;
    insert into disposition_decisions(submission_id,decided_by,decision,note) values(submission,p_actor,p_action,nullif(trim(p_data->>'note'),''));
   end if;
  end if;
 end if;
 if k is not null then insert into disposition_operations values(p_actor,k,p_action,res,h,now());end if;
 return res;
end $$;
revoke all on function disposition_workflow(uuid,text,uuid,integer,jsonb),disposition_workflow_pre_integration(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function disposition_workflow(uuid,text,uuid,integer,jsonb),disposition_workflow_pre_integration(uuid,text,uuid,integer,jsonb) to service_role;

alter function save_letter_draft(uuid,jsonb,jsonb) rename to save_letter_draft_pre_disposition_integration;
create function save_letter_draft(p_actor uuid,p_data jsonb,p_document jsonb) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare did uuid;d dispositions;v uuid;k uuid;existing disposition_result_links;
begin
 did:=nullif(p_data->>'dispositionId','')::uuid;
 if did is null and nullif(p_data->>'id','') is not null then select id into did from dispositions where response_letter_id=(p_data->>'id')::uuid;end if;
 if did is not null then select * into d from dispositions where id=did for update;end if;
 if d.source_dispatch_id is null then return save_letter_draft_pre_disposition_integration(p_actor,p_data,p_document);end if;
 if d.recipient_id<>p_actor or d.status not in ('NEW','IN_PROGRESS','REVISION_REQUESTED') then raise exception 'Surat tindak lanjut hanya oleh penerima sebelum pemeriksaan hasil.';end if;
 if nullif(p_data->>'replyToDispatchId','') is not null then raise exception 'Surat hasil disposisi dan balasan resmi memiliki alur terpisah.';end if;
 if p_data->>'letterTypeCode' is distinct from 'IN' or (p_data->>'recipientUserId')::uuid is distinct from d.giver_id then raise exception 'Surat hasil internal ditujukan kepada pemberi disposisi.';end if;
 if nullif(p_data->>'id','') is null then
  k:=nullif(p_data->>'dispositionDraftKey','')::uuid;
  if k is null then raise exception 'Kunci pembuatan surat hasil wajib diisi.';end if;
  select * into existing from disposition_result_links where disposition_id=d.id and draft_key=k;
  if existing.id is not null then return existing.result_letter_id;end if;
 end if;
 v:=save_letter_draft_pre_disposition_integration(p_actor,p_data,p_document);
 if nullif(p_data->>'id','') is null then insert into disposition_result_links(disposition_id,origin_letter_id,result_letter_id,created_by,draft_key) values(d.id,d.letter_id,v,p_actor,k);end if;
 return v;
end $$;
revoke all on function save_letter_draft(uuid,jsonb,jsonb),save_letter_draft_pre_disposition_integration(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function save_letter_draft(uuid,jsonb,jsonb),save_letter_draft_pre_disposition_integration(uuid,jsonb,jsonb) to service_role;
create function app.validate_disposition_result_link() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from dispositions d join letters l on l.id=new.result_letter_id where d.id=new.disposition_id and d.source_dispatch_id is not null and d.letter_id=new.origin_letter_id and d.recipient_id=new.created_by and l.creator_id=new.created_by and l.recipient_user_id=d.giver_id and l.status='DRAFT' and l.official_number is null and not exists(select 1 from official_reply_links where reply_letter_id=l.id)) then raise exception 'Relasi hasil disposisi tidak sah.';end if;
 return new;
end $$;
create trigger disposition_result_link_guard before insert on disposition_result_links for each row execute function app.validate_disposition_result_link();
create function app.guard_disposition_result_letter() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if exists(select 1 from disposition_result_links r join dispositions d on d.id=r.disposition_id where r.result_letter_id=old.id and (new.creator_id is distinct from d.recipient_id or new.recipient_user_id is distinct from d.giver_id or new.letter_type_id is distinct from old.letter_type_id)) then raise exception 'Identitas dan penerima surat hasil harus sesuai disposisi.';end if;
 return new;
end $$;
create trigger disposition_result_letter_guard before update on letters for each row execute function app.guard_disposition_result_letter();

create function get_disposition_letter_context(p_letter uuid) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare tasks jsonb;links jsonb;
begin
 if auth.uid() is null or not app.can_read_letter(p_letter) then raise exception 'Surat tidak dapat diakses.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'subject',d.subject,'status',d.status,'isResult',d.response_letter_id=p_letter) order by d.created_at),'[]') into tasks from dispositions d where d.letter_id=p_letter or d.response_letter_id=p_letter or exists(select 1 from disposition_submissions s where s.disposition_id=d.id and s.result_letter_id=p_letter);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'dispositionId',r.disposition_id,'letterId',l.id,'subject',l.subject,'officialNumber',l.official_number,'createdAt',r.created_at,'createdBy',r.created_by)),'[]') into links from disposition_result_links r join letters l on l.id=case when r.result_letter_id=p_letter then r.origin_letter_id else r.result_letter_id end where r.origin_letter_id=p_letter or r.result_letter_id=p_letter;
 return jsonb_build_object('canCreate',app.can_start_disposition(p_letter),'tasks',tasks,'links',links);
end $$;
revoke all on function get_disposition_letter_context(uuid) from public,anon,service_role;
grant execute on function get_disposition_letter_context(uuid) to authenticated;
revoke all on function app.guard_integrated_disposition(),app.validate_disposition_result_link(),app.guard_disposition_result_letter() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
