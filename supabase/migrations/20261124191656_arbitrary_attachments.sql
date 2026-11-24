-- Any attachment bytes remain private and download-only. Main letters/signatures keep their strict formats.
begin;
alter table letter_attachments add column file_hash text;
alter table letter_attachments add column storage_bucket text not null default 'letter-documents' check(storage_bucket in('letter-documents','letter-attachments'));
alter table disposition_result_files add column storage_bucket text not null default 'letter-documents' check(storage_bucket in('letter-documents','letter-attachments'));
alter table disposition_result_files drop constraint disposition_result_files_file_format_check;
alter table disposition_result_files add constraint disposition_result_files_file_format_check check(file_format in('PDF','DOCX','BINARY'));
create function app.set_attachment_bucket() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$ begin if new.file_format='BINARY' then new.storage_bucket:='letter-attachments';end if;return new;end $$;
create trigger disposition_file_bucket before insert on disposition_result_files for each row execute function app.set_attachment_bucket();
revoke all on function app.set_attachment_bucket() from public,anon,authenticated;
grant execute on function app.set_attachment_bucket() to service_role;
do $$ declare definition text;patched text;begin
 select pg_get_functiondef('public.save_letter_draft_core(uuid,jsonb,jsonb)'::regprocedure) into definition;
 patched:=replace(definition,'letter_attachments(letter_id,file_name,storage_path,mime_type,size_bytes,uploaded_by)','letter_attachments(letter_id,file_name,storage_path,mime_type,size_bytes,uploaded_by,file_hash,storage_bucket)');
 patched:=replace(patched,$old$(i->>'size')::bigint,p_actor from jsonb_array_elements$old$,$new$(i->>'size')::bigint,p_actor,i->>'hash',coalesce(i->>'bucket','letter-documents') from jsonb_array_elements$new$);
 if patched=definition or position('uploaded_by,file_hash,storage_bucket' in patched)=0 then raise exception 'Attachment insertion definition did not match.';end if;
 execute patched;
 select pg_get_functiondef('public.disposition_workflow(uuid,text,uuid,integer,jsonb)'::regprocedure) into definition;
 patched:=replace(definition,$old$p_data->>'format' not in ('PDF','DOCX')$old$,$new$p_data->>'format' not in ('PDF','DOCX','BINARY')$new$);
 if patched=definition then raise exception 'Disposition attachment validation did not match.';end if;
 execute patched;
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('letter-attachments','letter-attachments',false,1048576,null)
  on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=null;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
