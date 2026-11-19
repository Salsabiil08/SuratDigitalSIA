\set ON_ERROR_STOP on
-- Jangan grant ALL; uji ACL yang akan dipakai aplikasi.
grant usage on schema public,app,auth to authenticated;
grant select on letters,letter_versions,profiles,dispositions,audit_logs to authenticated;
begin;
do $$
declare a uuid:='a0000000-0000-0000-0000-000000000005';r uuid:='a0000000-0000-0000-0000-000000000006';
 other_id uuid:='a0000000-0000-0000-0000-000000000004';adm uuid:='a0000000-0000-0000-0000-000000000001';l uuid;n integer;blocked boolean;
begin
 l:=test_support.draft(a);
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=0,'Penerima tidak dapat membaca draft';reset role;
 perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=1,'Pembuat dapat membaca draft';
 blocked:=false;begin perform issue_letter_number(l,a,'bypass');exception when insufficient_privilege then blocked:=true;end;assert blocked,'RPC nomor harus service-only';
 reset role;
 perform set_config('request.jwt.claim.sub',other_id::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=0;reset role;
 perform set_config('request.jwt.claim.sub',adm::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=0,'Admin tidak otomatis membaca isi';reset role;
end $$;
rollback;
