begin;
alter table public.letter_templates add column template_path text;
alter table public.letter_templates add column template_hash text;
create unique index letterhead_one_active_type on public.letter_templates(letter_type_id)
 where is_active and template_path is not null;

create function public.publish_letterhead(p_actor uuid,p_type text,p_path text,p_hash text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare type_id uuid; template_id uuid; template_version integer;
begin
 if not exists(select 1 from profiles where id=p_actor and is_active and system_role='SUPER_ADMIN') then
  raise exception 'Akun tidak berwenang mengelola kop surat.';
 end if;
 select id into type_id from letter_types where code=p_type and is_active for update;
 if type_id is null or split_part(p_path,'/',1)<>p_actor::text or p_hash !~ '^[0-9a-f]{64}$'
  or not exists(select 1 from storage.objects where bucket_id='letter-documents' and name=p_path)
 then raise exception 'Jenis atau berkas kop belum sah.';end if;
 select coalesce(max(version),0)+1 into template_version from letter_templates where letter_type_id=type_id;
 update letter_templates set is_active=false where letter_type_id=type_id and template_path is not null and is_active;
 insert into letter_templates(letter_type_id,name,version,is_active,template_path,template_hash)
 values(type_id,'Kop surat R.05',template_version,true,p_path,p_hash) returning id into template_id;
 insert into audit_logs(actor_id,action,entity_type,entity_id) values(p_actor,'LETTERHEAD_PUBLISHED','letter_templates',template_id::text);
 return template_id;
end $$;

create function public.save_r05_bank(p_actor uuid,p_id uuid,p_code text,p_name text,p_active boolean)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare bank_id uuid;
begin
 if not exists(select 1 from profiles where id=p_actor and is_active and system_role='SUPER_ADMIN') then
  raise exception 'Akun tidak berwenang mengelola master bank.';
 end if;
 if nullif(trim(p_code),'') is null or length(trim(p_code))>30
  or nullif(trim(p_name),'') is null or length(trim(p_name))>150 or p_active is null then
  raise exception 'Lengkapi kode, nama, dan status bank.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('master-bank:'||lower(trim(p_name)),0));
 if exists(select 1 from master_bank b where lower(trim(b.name))=lower(trim(p_name)) and b.id is distinct from p_id) then
  raise exception 'Bank dengan nama ini sudah ada. Pilih bank tersebut untuk diperbarui.';
 end if;
 if p_id is null then
  insert into master_bank(code,name,is_active) values(upper(trim(p_code)),trim(p_name),p_active) returning id into bank_id;
 else
  update master_bank set code=upper(trim(p_code)),name=trim(p_name),is_active=p_active where id=p_id returning id into bank_id;
  if bank_id is null then raise exception 'Bank tidak ditemukan.';end if;
 end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id) values(p_actor,'BANK_SAVED','master_bank',bank_id::text);
 return bank_id;
end $$;
revoke all on function public.publish_letterhead(uuid,text,text,text),public.save_r05_bank(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.publish_letterhead(uuid,text,text,text),public.save_r05_bank(uuid,uuid,text,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
