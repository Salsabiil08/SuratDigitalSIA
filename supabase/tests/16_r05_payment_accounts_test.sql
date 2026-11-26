\set ON_ERROR_STOP on
begin;
grant usage on schema app,auth,public to authenticated;
do $$
declare
 finance uuid := 'a0000000-0000-0000-0000-000000000006';
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 bank uuid;
 account uuid;
 denied boolean := false;
begin
 insert into master_bank(name,code,is_active) values('Fixture bank','R05FIXTURE',true) returning id into bank;
 account:=save_payment_account(finance,bank,'Fixture payee','001',true);
 assert save_payment_account(finance,bank,'Fixture payee','001',true)=account;
 begin perform save_payment_account(staff,bank,'Unauthorized','002',true);exception when others then denied:=true;end;
 assert denied;
 perform set_config('request.jwt.claim.sub',finance::text,true);
 set local role authenticated;
 assert exists(select 1 from master_payment_accounts where id=account);
 perform set_config('request.jwt.claim.sub',staff::text,true);
 assert not exists(select 1 from master_payment_accounts where id=account);
 assert not has_function_privilege('authenticated','public.save_payment_account(uuid,uuid,text,text,boolean)','EXECUTE');
 reset role;
end $$;
rollback;
