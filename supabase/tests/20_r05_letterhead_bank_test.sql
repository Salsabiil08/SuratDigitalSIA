\set ON_ERROR_STOP on
begin;
do $$
declare
 admin uuid := 'a0000000-0000-0000-0000-000000000001';
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 old_template uuid;
 new_template uuid;
 bank uuid;
 denied boolean := false;
begin
 insert into storage.objects(bucket_id,name) values('letter-documents',admin::text||'/one.docx'),('letter-documents',admin::text||'/two.docx');
 old_template:=publish_letterhead(admin,'IN',admin::text||'/one.docx',repeat('a',64));
 new_template:=publish_letterhead(admin,'IN',admin::text||'/two.docx',repeat('b',64));
 assert old_template<>new_template;
 assert(select not is_active from letter_templates where id=old_template);
 assert(select is_active from letter_templates where id=new_template);
 begin perform publish_letterhead(staff,'IN',admin::text||'/two.docx',repeat('b',64));exception when others then denied:=true;end;
 assert denied;
 bank:=save_r05_bank(admin,null,'r05test','Bank fixture R05',true);
 assert save_r05_bank(admin,bank,'r05test','Bank fixture R05',false)=bank;
 assert(select code='R05TEST' and not is_active from master_bank where id=bank);
 assert not has_function_privilege('authenticated','public.publish_letterhead(uuid,text,text,text)','EXECUTE');
end $$;
rollback;
