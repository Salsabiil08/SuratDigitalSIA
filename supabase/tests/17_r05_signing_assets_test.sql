\set ON_ERROR_STOP on
begin;
do $$
declare
 signer uuid := 'a0000000-0000-0000-0000-000000000003';
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 admin uuid := 'a0000000-0000-0000-0000-000000000001';
 asset_path text := signer::text||'/master/fixture.png';
 denied boolean;
begin
 insert into storage.objects(bucket_id,name) values('signature-assets',asset_path);
 perform save_official_signing_asset(signer,'SIGNATURE',asset_path,repeat('a',64));
 assert exists(select 1 from official_signing_assets where owner_id=signer and storage_path=asset_path);
 denied:=false;
 begin perform save_official_signing_asset(staff,'SIGNATURE',asset_path,repeat('a',64)); exception when others then denied:=true;end;
 assert denied;
 denied:=false;
 begin perform save_official_signing_asset(admin,'STAMP',asset_path,repeat('a',64)); exception when others then denied:=true;end;
 assert denied;
 assert not has_table_privilege('authenticated','public.official_signing_assets','SELECT');
 assert not has_function_privilege('authenticated','public.save_official_signing_asset(uuid,text,text,text)','EXECUTE');
end $$;
rollback;
