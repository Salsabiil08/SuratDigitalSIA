begin;

create or replace function app.guard_integrated_disposition() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if old.source_dispatch_id is not null
   and (new.source_dispatch_id,new.giver_id,new.recipient_id,new.letter_id,new.requires_letter,new.due_date) is distinct from (old.source_dispatch_id,old.giver_id,old.recipient_id,old.letter_id,old.requires_letter,old.due_date)
   and not (old.status='NEW' and old.read_at is null and old.response_letter_id is null and old.submitted_at is null and not exists(select 1 from disposition_submissions where disposition_id=old.id))
 then raise exception 'Identitas dan ketentuan disposisi resmi tidak dapat diubah setelah mulai dikerjakan.';end if;
 if new.source_dispatch_id is not null and new.status in ('IN_REVIEW','DONE') and (new.requires_letter or new.response_letter_id is not null) then
  if not exists(select 1 from disposition_result_links rel join internal_dispatches ds on ds.letter_id=rel.result_letter_id join letters l on l.id=ds.letter_id
  where rel.disposition_id=new.id and rel.result_letter_id=new.response_letter_id and l.creator_id=new.recipient_id and l.status='NUMBERED' and l.finalized_at is not null and ds.primary_recipient_id=new.giver_id)
  then raise exception 'Surat hasil harus final dan telah dikirim resmi kepada pemberi sebelum hasil diajukan.';end if;
 end if;
 return new;
end $$;

create or replace function disposition_workflow(p_actor uuid,p_action text,p_id uuid default null,p_revision integer default null,p_data jsonb default '{}') returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare d dispositions;res uuid;k uuid;op disposition_operations;h text;src uuid;ds uuid;submission uuid;result_ds uuid;f uuid;file_ids uuid[];l_count integer;target uuid;r user_assignments;lvl integer;rlv integer;old_status text;
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
  if d.id is null then raise exception 'Disposisi tidak tersedia.';end if;
  if p_actor not in (d.giver_id,d.recipient_id) then raise exception 'Anda tidak berwenang mengakses disposisi ini.';end if;
  if d.revision is distinct from p_revision then raise exception 'Disposisi telah berubah. Muat ulang halaman.';end if;
  if p_action='EDIT' then
   if k is null then raise exception 'Kunci perubahan disposisi wajib diisi.';end if;
   if p_actor<>d.giver_id then raise exception 'Hanya pembuat disposisi yang dapat mengubahnya.';end if;
   if d.status<>'NEW' or d.read_at is not null or d.response_letter_id is not null or d.submitted_at is not null or exists(select 1 from disposition_submissions where disposition_id=d.id) then
    raise exception 'Disposisi hanya dapat diubah sebelum penerima mulai mengerjakannya.';
   end if;
   if length(trim(coalesce(p_data->>'subject','')))=0 or length(trim(coalesce(p_data->>'subject','')))>250
     or length(trim(coalesce(p_data->>'instruction','')))=0 or length(trim(coalesce(p_data->>'instruction','')))>5000
     or coalesce(p_data->>'priority','') not in ('NORMAL','IMPORTANT','URGENT')
     or jsonb_typeof(p_data->'requiresLetter') is distinct from 'boolean'
   then raise exception 'Perihal, arahan, prioritas, atau kewajiban surat tidak valid.';end if;
   select level into lvl from positions where id=(app.active_assignment(p_actor)).position_id;
   target:=nullif(p_data->>'recipientId','')::uuid;
   if target is null then raise exception 'Pilih penerima disposisi.';end if;
   if target is distinct from d.recipient_id then
    r:=app.active_assignment(target);
    select level into rlv from positions where id=r.position_id;
    if lvl<=1 or r.id is null or rlv>=lvl or target=p_actor or (lvl=2 and (app.active_assignment(p_actor)).unit_id<>r.unit_id) then
     raise exception 'Pilih penerima aktif dengan jabatan di bawah Anda sesuai kewenangan unit.';
    end if;
   elsif lvl<=1 then raise exception 'Jabatan Anda tidak berwenang mengubah disposisi.';
   end if;
   old_status:=d.status;
   update dispositions set recipient_id=target,subject=trim(p_data->>'subject'),instruction=trim(p_data->>'instruction'),
     priority=p_data->>'priority',due_date=nullif(p_data->>'dueDate','')::date,requires_letter=(p_data->>'requiresLetter')::boolean,revision=revision+1
   where id=d.id returning * into d;
   insert into audit_logs(actor_id,letter_id,action,entity_type,entity_id,status_before,status_after,metadata)
   values(p_actor,d.response_letter_id,'DISPOSITION_EDIT','dispositions',d.id::text,old_status,d.status,
     jsonb_build_object('fields',jsonb_build_array('recipient_id','subject','instruction','priority','due_date','requires_letter')));
   insert into notifications(recipient_id,letter_id,disposition_id,event_type,title,is_read)
   values(d.recipient_id,d.response_letter_id,d.id,'DISPOSITION','Disposisi diperbarui',false);
   res:=d.id;
  elsif d.source_dispatch_id is null then
   return disposition_workflow_pre_integration(p_actor,p_action,p_id,p_revision,p_data);
  else
   if k is null then raise exception 'Kunci tindakan disposisi wajib diisi.';end if;
   if p_action='ATTACH' then
    if p_actor<>d.recipient_id or d.status not in ('NEW','IN_PROGRESS','REVISION_REQUESTED') then raise exception 'Lampiran hanya oleh pelaksana sebelum pengajuan hasil.';end if;
    if nullif(p_data->>'path','') is null or left(p_data->>'path',37)<>p_actor::text||'/' or length(coalesce(p_data->>'hash',''))<>64 or p_data->>'format' not in ('PDF','DOCX','BINARY') or nullif(trim(p_data->>'name'),'') is null then raise exception 'Berkas hasil belum tersimpan secara sah.';end if;
    if (select coalesce(sum(size_bytes),0) from disposition_result_files where disposition_id=d.id)+coalesce((p_data->>'size')::integer,0)>26214400 then raise exception 'Total lampiran maksimal 25 MB.';end if;
    insert into disposition_result_files(disposition_id,uploaded_by,operation_key,file_name,storage_path,file_hash,file_format,size_bytes) values(d.id,p_actor,k,left(p_data->>'name',250),p_data->>'path',p_data->>'hash',p_data->>'format',(p_data->>'size')::integer);
    update dispositions set revision=revision+1 where id=d.id;
    insert into audit_logs(actor_id,action,entity_type,entity_id) values(p_actor,'DISPOSITION_ATTACHMENT_ADDED','dispositions',d.id::text);
    res:=d.id;
   else
    if p_action='SUBMIT' then
     select coalesce(array_agg(x::uuid),'{}') into file_ids from jsonb_array_elements_text(coalesce(p_data->'attachmentIds','[]')) x;
     if cardinality(file_ids)<>(select count(distinct x) from unnest(file_ids) x) or exists(select 1 from unnest(file_ids) x where not exists(select 1 from disposition_result_files where id=x and disposition_id=d.id and uploaded_by=p_actor)) then raise exception 'Lampiran hasil tidak sesuai disposisi dan pelaksana.';end if;
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
 end if;
 if k is not null then insert into disposition_operations values(p_actor,k,p_action,res,h,now());end if;
 return res;
end $$;

revoke all on function disposition_workflow(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function disposition_workflow(uuid,text,uuid,integer,jsonb) to service_role;

commit;
