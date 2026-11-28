\set ON_ERROR_STOP on
begin;
do $$
declare
 admin uuid := 'a0000000-0000-0000-0000-000000000001';
 finance uuid := 'a0000000-0000-0000-0000-000000000006';
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 old_template uuid;
 new_template uuid;
 bank uuid;
 account uuid;
 another_account uuid;
 denied boolean := false;
begin
 insert into storage.objects(bucket_id,name) values('letter-documents',admin::text||'/one.docx'),('letter-documents',admin::text||'/two.docx');
 old_template:=publish_letterhead(admin,'IN',admin::text||'/one.docx',repeat('a',64));
 new_template:=publish_letterhead_named(admin,'IN',admin::text||'/two.docx',repeat('b',64),'Kop Internal.docx');
 assert old_template<>new_template;
 assert(select not is_active from letter_templates where id=old_template);
 assert(select is_active and original_file_name='Kop Internal.docx' from letter_templates where id=new_template);
 assert(select count(*)=1 from audit_logs where action='LETTERHEAD_PUBLISHED' and entity_id=new_template::text and actor_id=admin);
 begin perform publish_letterhead(staff,'IN',admin::text||'/two.docx',repeat('b',64));exception when others then denied:=true;end;
 assert denied;
 bank:=save_r05_bank(admin,null,'r05test','Bank fixture R05',true);
 account:=manage_payment_account(finance,null,bank,'Pemilik Uji','0001',true);
 another_account:=manage_payment_account(finance,null,bank,'Pemilik Lain','0002',true);
 denied:=false;
 begin perform manage_payment_account(staff,account,bank,'Pemilik Uji','0003',true);exception when others then denied:=true;end;
 assert denied;
 denied:=false;
 begin perform manage_payment_account(finance,account,bank,'Pemilik Uji','0002',true);exception when others then denied:=true;end;
 assert denied;
 assert(select account_number='0001' from master_payment_accounts where id=account);
 assert(select account_number='0002' from master_payment_accounts where id=another_account);
 assert manage_payment_account(finance,account,bank,'Pemilik Baru','0003',false)=account;
 assert(select holder_name='Pemilik Baru' and account_number='0003' and not is_active from master_payment_accounts where id=account);
 assert(select count(*)=2 from audit_logs where action='PAYMENT_ACCOUNT_SAVED' and entity_id=account::text and actor_id=finance);
 assert save_r05_bank(admin,bank,'r05test','Bank fixture R05',false)=bank;
 assert(select code='R05TEST' and not is_active from master_bank where id=bank);
 assert not has_function_privilege('authenticated','public.publish_letterhead_named(uuid,text,text,text,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.manage_payment_account(uuid,uuid,uuid,text,text,boolean)','EXECUTE');
end $$;
rollback;
