begin;
alter table public.letter_templates add column original_file_name text;

create function public.publish_letterhead_named(p_actor uuid,p_type text,p_path text,p_hash text,p_filename text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare template_id uuid;
begin
 if p_filename is null or length(p_filename)>255 or p_filename !~* '\.docx$'
   or p_filename ~ '[[:cntrl:]/\\]' then
  raise exception 'Nama berkas DOCX tidak valid.';
 end if;
 template_id:=publish_letterhead(p_actor,p_type,p_path,p_hash);
 update letter_templates set original_file_name=p_filename where id=template_id;
 return template_id;
end $$;

create function public.manage_payment_account(p_actor uuid,p_id uuid,p_bank uuid,p_holder text,p_account text,p_active boolean)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare account_id uuid; existing_bank uuid;
begin
 if not app.can_manage_payment_accounts(p_actor) then raise exception 'Akun tidak berwenang mengelola rekening.';end if;
 if nullif(trim(p_holder),'') is null or length(trim(p_holder))>500
  or nullif(trim(p_account),'') is null or length(trim(p_account))>100 or p_active is null then
  raise exception 'Lengkapi nama pemilik, nomor rekening, dan status.';
 end if;
 if p_id is not null then
  select bank_id into existing_bank from master_payment_accounts where id=p_id for update;
  if not found then raise exception 'Rekening tidak ditemukan.';end if;
 end if;
 if p_bank is null or ((p_bank is distinct from existing_bank or p_active) and
  not exists(select 1 from master_bank where id=p_bank and is_active)) then
  raise exception 'Pilih bank aktif.';
 end if;
 if p_id is null then
  insert into master_payment_accounts(bank_id,holder_name,account_number,is_active)
  values(p_bank,trim(p_holder),trim(p_account),p_active) returning id into account_id;
 else
  update master_payment_accounts set bank_id=p_bank,holder_name=trim(p_holder),account_number=trim(p_account),is_active=p_active
  where id=p_id returning id into account_id;
 end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id)
 values(p_actor,'PAYMENT_ACCOUNT_SAVED','master_payment_accounts',account_id::text);
 return account_id;
exception when unique_violation then raise exception 'Nomor rekening ini sudah terdaftar pada bank yang sama.';
end $$;
revoke all on function public.publish_letterhead_named(uuid,text,text,text,text),public.manage_payment_account(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.publish_letterhead_named(uuid,text,text,text,text),public.manage_payment_account(uuid,uuid,uuid,text,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
