begin;
alter table public.master_bank add column code text;
create unique index master_bank_code_key on public.master_bank(lower(code)) where code is not null;

create table public.master_payment_accounts (
 id uuid primary key default gen_random_uuid(),
 bank_id uuid not null references public.master_bank(id),
 holder_name text not null check(length(trim(holder_name)) between 1 and 500),
 account_number text not null check(length(trim(account_number)) between 1 and 100),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(bank_id,account_number)
);
alter table public.master_payment_accounts enable row level security;
revoke all on public.master_payment_accounts from public,anon,authenticated;
grant select on public.master_payment_accounts to authenticated;
grant all on public.master_payment_accounts to service_role;

create function app.can_manage_payment_accounts(p_actor uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from letter_types t
 where t.category='BILLING' and t.is_active
 and t.creator_unit_id=(app.active_assignment(p_actor)).unit_id)
$$;
revoke all on function app.can_manage_payment_accounts(uuid) from public,anon,authenticated;
grant execute on function app.can_manage_payment_accounts(uuid) to authenticated,service_role;

create policy payment_accounts_finance_read on public.master_payment_accounts
 for select to authenticated using(app.can_manage_payment_accounts(auth.uid()));

create function public.save_payment_account(p_actor uuid,p_bank uuid,p_holder text,p_account text,p_active boolean) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare account_id uuid;
begin
 if not app.can_manage_payment_accounts(p_actor) then raise exception 'Akun tidak berwenang mengelola rekening.';end if;
 if not exists(select 1 from master_bank where id=p_bank and is_active) then raise exception 'Pilih bank aktif.';end if;
 insert into master_payment_accounts(bank_id,holder_name,account_number,is_active)
 values(p_bank,trim(p_holder),trim(p_account),p_active)
 on conflict(bank_id,account_number) do update set holder_name=excluded.holder_name,is_active=excluded.is_active
 returning id into account_id;
 insert into audit_logs(actor_id,action,entity_type,entity_id)
 values(p_actor,'PAYMENT_ACCOUNT_SAVED','master_payment_accounts',account_id::text);
 return account_id;
end $$;
revoke all on function public.save_payment_account(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_payment_account(uuid,uuid,text,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
