\set ON_ERROR_STOP on
grant usage on schema public,app,auth to authenticated,anon;
grant select on letters,profiles,letter_versions,approval_steps to authenticated;
begin;
create function test_support.fail_dispatch() returns trigger language plpgsql as $$begin raise exception 'Fault pengiriman';end $$;
do $$
declare a uuid:='a0000000-0000-0000-0000-000000000005';r uuid:='a0000000-0000-0000-0000-000000000006';
 adm uuid:='a0000000-0000-0000-0000-000000000001';gm uuid:='a0000000-0000-0000-0000-000000000004';
 l uuid;l2 uuid;v letter_versions;rev integer;d uuid;again uuid;failed boolean;n integer;cnt integer;ts timestamptz;fault_table text;
begin
 l:=test_support.draft(a);perform test_support.submit(a,l);perform test_support.number(a,l,'delivery-pg');
 select * into v from letter_versions where id=(select current_version_id from letters where id=l);
 failed:=false;begin perform dispatch_internal_letter(a,l,v.id,v.file_hash,'send-before-final');exception when others then failed:=true;end;assert failed,'Belum final harus ditolak';
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=0,'Penerima pra-kirim tidak boleh baca surat bernomor';
 select count(*) into n from letter_versions where letter_id=l;assert n=0;reset role;
 select revision into rev from letters where id=l;perform finalize_letter(a,l,rev,false);
 failed:=false;begin perform dispatch_internal_letter(adm,l,v.id,v.file_hash,'admin-send');exception when others then failed:=true;end;assert failed,'Admin bukan pengirim otomatis';
 -- Setiap kegagalan wajib harus rollback snapshot, penerima, event dan audit.
 select count(*) into cnt from notifications;
 foreach fault_table in array array['dispatch_recipients','notifications','audit_logs'] loop
  execute format('create trigger fail_delivery_stage before insert on %I for each row execute function test_support.fail_dispatch()',fault_table);
  failed:=false;begin perform dispatch_internal_letter(a,l,v.id,v.file_hash,'fault-send');exception when others then failed:=true;end;assert failed;
  execute format('drop trigger fail_delivery_stage on %I',fault_table);
  assert(select count(*)=0 from internal_dispatches where letter_id=l);assert(select count(*)=cnt from notifications);
 end loop;
 d:=dispatch_internal_letter(a,l,v.id,v.file_hash,'send-valid');again:=dispatch_internal_letter(a,l,v.id,v.file_hash,'send-retry');assert d=again;
 assert(select count(*)=1 from internal_dispatches where letter_id=l);assert(select count(*)=1 from dispatch_recipients where dispatch_id=d);
 assert(select count(*)=1 from notifications where dispatch_id=d and event_type='INTERNAL_SENT');
 assert(select count(*)=1 from audit_logs where entity_id=d::text and action='INTERNAL_SENT');
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=1;
 select count(*) into n from letter_versions where letter_id=l;assert n=1,'Hanya versi snapshot, bukan arsip draft';
 select count(*) into n from approval_steps where letter_id=l;assert n=0,'Penerima tidak mendapat riwayat workflow privat';
 reset role;
 perform record_internal_recipient_action(r,d,'READ');assert(select received_at is null from dispatch_recipients where dispatch_id=d);
 failed:=false;begin perform record_internal_recipient_action(a,d,'RECEIVE');exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform record_internal_recipient_action(adm,d,'RECEIVE');exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform record_internal_recipient_action(gm,d,'RECEIVE');exception when others then failed:=true;end;assert failed;
 create trigger fail_receipt_notification before insert on notifications for each row execute function test_support.fail_dispatch();
 failed:=false;begin perform record_internal_recipient_action(r,d,'RECEIVE');exception when others then failed:=true;end;assert failed;
 drop trigger fail_receipt_notification on notifications;
 assert(select received_at is null from dispatch_recipients where dispatch_id=d);
 ts:=record_internal_recipient_action(r,d,'RECEIVE');assert record_internal_recipient_action(r,d,'RECEIVE')=ts;
 assert(select count(*)=1 from audit_logs where entity_id=d::text and action='INTERNAL_RECEIVE');
 assert(select count(*)=1 from notifications where dispatch_id=d and event_type='INTERNAL_RECEIVED');
 assert(select finalized_at is not null and status='NUMBERED' from letters where id=l);
 -- Delegasi/CC harus ditetapkan perusahaan; tidak ada hak otomatis kepala unit/admin.
 insert into delivery_policy_managers values('a0000000-0000-0000-0000-000000000002');
 l2:=test_support.draft(a);perform test_support.submit(a,l2);perform test_support.number(a,l2,'delivery-pg-second');
 select revision into rev from letters where id=l2;perform finalize_letter(a,l2,rev,false);
 select * into v from letter_versions where id=(select current_version_id from letters where id=l2);
 failed:=false;begin perform dispatch_internal_letter(gm,l2,v.id,v.file_hash,'no-delegate');exception when others then failed:=true;end;assert failed;
 perform configure_internal_delivery('a0000000-0000-0000-0000-000000000002',gm,(select creator_unit_id from letters where id=l2),true,null,true,'Uji delegasi dan CC');
 again:=dispatch_internal_letter(gm,l2,v.id,v.file_hash,'delegate-send',array[adm]);
 perform set_config('request.jwt.claim.sub',adm::text,true);set local role authenticated;
 select count(*) into n from letters where id=l2;assert n=1,'CC sah mendapat snapshot';reset role;
 failed:=false;begin perform record_internal_recipient_action(adm,again,'RECEIVE');exception when others then failed:=true;end;assert failed;
 assert(select not requires_response from dispatch_recipients where dispatch_id=again and profile_id=adm);
 -- URL Storage tetap tidak terbuka walaupun terdapat policy permisif lain.
 insert into storage.objects(bucket_id,name) values('letter-documents',v.storage_path),('signature-assets','raw.png');
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 select count(*) into n from storage.objects where bucket_id in ('letter-documents','signature-assets');assert n=0;
 reset role;
end $$;
rollback;
