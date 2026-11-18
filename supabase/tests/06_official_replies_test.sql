\set ON_ERROR_STOP on
grant usage on schema public,app,auth to authenticated;
grant select on letters,profiles,letter_versions to authenticated;
begin;
create function test_support.reply_origin(p_actor uuid,p_recipient uuid,p_cc uuid[] default '{}') returns uuid language plpgsql as $$
declare l uuid;v letter_versions;rev integer;
begin
 l:=save_letter_draft(p_actor,jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode','PEMBERITAHUAN','subject','Asal balasan','letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId',p_recipient,'signatureMode','IN_APP','signerIds','[]'::jsonb,'areas','[]'::jsonb,'content','Isi surat asal'),jsonb_build_object('path',p_actor::text||'/origin.docx','format','DOCX','hash','origin-fixture-hash'));
 perform test_support.submit(p_actor,l);perform test_support.number(p_actor,l,'reply-origin-number-'||l::text);
 select revision into rev from letters where id=l;perform finalize_letter(p_actor,l,rev,false);
 select * into v from letter_versions where id=(select current_version_id from letters where id=l);
 return dispatch_internal_letter(p_actor,l,v.id,v.file_hash,'reply-origin-send-'||l::text,p_cc);
end $$;
create function test_support.fail_reply_stage() returns trigger language plpgsql as $$begin raise exception 'Fault balasan';end $$;
do $$
declare a uuid:='a0000000-0000-0000-0000-000000000005';r uuid:='a0000000-0000-0000-0000-000000000006';cc uuid:='a0000000-0000-0000-0000-000000000004';
 adm uuid:='a0000000-0000-0000-0000-000000000001';manager uuid:='a0000000-0000-0000-0000-000000000002';
 d uuid;d2 uuid;orig uuid;reply uuid;again uuid;link_id uuid;rd uuid;l uuid;rev integer;v letter_versions;rr review_steps;j jsonb;before_orig jsonb;failed boolean;tbl text;cnt bigint;formal_reply uuid;req uuid;payload jsonb;old_version uuid;k uuid:=gen_random_uuid();
begin
 insert into delivery_policy_managers values(manager);
 perform configure_internal_delivery(manager,null,null,null,null,true,'Aktivasi CC khusus uji balasan');
 d:=test_support.reply_origin(a,r,array[cc]);select letter_id into orig from internal_dispatches where id=d;
 select to_jsonb(x) into before_orig from letters x where id=orig;
 -- Tanpa pengiriman, admin, pengirim dan CC bukan penerima utama.
 l:=test_support.draft(a);
 failed:=false;begin perform test_support.reply_draft(r,l,k);exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform test_support.reply_draft(adm,d,k);exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform test_support.reply_draft(a,d,k);exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform test_support.reply_draft(cc,d,k);exception when others then failed:=true;end;assert failed;
 -- Gagal relasi/audit tidak meninggalkan draft/versi/relasi palsu.
 select count(*) into cnt from letters;
 foreach tbl in array array['official_reply_links','audit_logs'] loop
  execute format('create trigger fail_reply before insert on %I for each row execute function test_support.fail_reply_stage()',tbl);
  failed:=false;begin perform test_support.reply_draft(r,d,k);exception when others then failed:=true;end;assert failed;
  execute format('drop trigger fail_reply on %I',tbl);
  assert(select count(*)=cnt from letters);assert not exists(select 1 from official_reply_links);
 end loop;
 reply:=test_support.reply_draft(r,d,k);again:=test_support.reply_draft(r,d,k);assert reply=again and reply<>orig;
 select id into link_id from official_reply_links where reply_letter_id=reply;
 assert(select count(*)=1 from official_reply_links where reply_letter_id=reply);
 assert(select count(*)=1 from audit_logs where letter_id=reply and action='OFFICIAL_REPLY_CREATED');
 assert(select status='DRAFT' and official_number is null and creator_id=r and recipient_user_id=a from letters where id=reply);
 assert not exists(select 1 from official_reply_sends);assert(select to_jsonb(x)=before_orig from letters x where id=orig);
 -- RLS tidak membocorkan draft balasan pada pengirim asal/CC/admin, meski tahu relasi.
 perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
 assert(select count(*)=0 from letters where id=reply);assert(select count(*)=0 from letter_versions where letter_id=reply);
 assert(select count(*)=0 from official_reply_links where id=link_id);
 j:=get_official_reply_context(orig);assert jsonb_array_length(j->'links')=0;assert j->'seed'='null'::jsonb;
 assert app.official_reply_status(d,r) is null;reset role;
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 j:=get_official_reply_context(orig);assert j->'seed'->>'dispatchId'=d::text;assert jsonb_array_length(j->'links')=1;
 j:=get_official_reply_context(reply);assert j->'links'->0->>'direction'='ORIGIN';
 failed:=false;begin insert into official_reply_links select * from official_reply_links where id=link_id;exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform save_letter_draft(r,'{}','{}');exception when others then failed:=true;end;assert failed;
 reset role;
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;
 j:=get_official_reply_context(orig);assert j->'seed'='null'::jsonb;assert jsonb_array_length(j->'links')=0;
 assert app.official_reply_status(d,r) is null;reset role;
 perform set_config('request.jwt.claim.sub',adm::text,true);set local role authenticated;
 assert(select count(*)=0 from official_reply_links);failed:=false;begin perform get_official_reply_context(orig);exception when others then failed:=true;end;assert failed;reset role;
 -- Relasi tidak boleh ditimpa, ke dirinya sendiri, atau sumber palsu.
 failed:=false;begin update official_reply_links set reply_letter_id=orig where id=link_id;exception when others then failed:=true;end;assert failed;
 failed:=false;begin delete from official_reply_links where id=link_id;exception when others then failed:=true;end;assert failed;
 failed:=false;begin insert into official_reply_links(origin_dispatch_id,origin_letter_id,recipient_id,reply_letter_id,created_by,idempotency_key) values(d,orig,r,orig,r,gen_random_uuid());exception when others then failed:=true;end;assert failed;
 failed:=false;begin update letters set recipient_user_id=cc where id=reply;exception when others then failed:=true;end;assert failed;
 -- Draf/review/nomor/final bukan status dibalas; kategori wajib tetap menghalangi submit tanpa reviewer.
 l:=test_support.reply_draft(r,d,gen_random_uuid(),'PERMOHONAN');
 failed:=false;begin perform test_support.submit(r,l);exception when others then failed:=true;end;assert failed;
 assert not exists(select 1 from official_reply_sends);
 -- Jalur internal biasa tetap alur nyata. Pengesahan wajib diuji melalui regresi PR-04.
 perform test_support.submit(r,reply);
 failed:=false;begin select * into v from letter_versions where id=(select current_version_id from letters where id=reply);perform dispatch_internal_letter(r,reply,v.id,v.file_hash,'too-early');exception when others then failed:=true;end;assert failed;
 perform test_support.number(r,reply,'reply-new-number');
 assert(select official_number<>(select official_number from letters where id=orig) from letters where id=reply);
 select revision into rev from letters where id=reply;perform finalize_letter(r,reply,rev,false);
 assert not exists(select 1 from official_reply_sends);
 select * into v from letter_versions where id=(select current_version_id from letters where id=reply);
 -- Setiap tahap wajib kirim gagal => reply status/audit/snapshot juga rollback.
 foreach tbl in array array['official_reply_sends','dispatch_recipients','notifications','audit_logs'] loop
  execute format('create trigger fail_reply before insert on %I for each row execute function test_support.fail_reply_stage()',tbl);
  failed:=false;begin perform dispatch_internal_letter(r,reply,v.id,v.file_hash,'reply-fault');exception when others then failed:=true;end;assert failed;
  execute format('drop trigger fail_reply on %I',tbl);
  assert not exists(select 1 from internal_dispatches where letter_id=reply);assert not exists(select 1 from official_reply_sends);
  assert not exists(select 1 from audit_logs where action='OFFICIAL_REPLY_SENT' and entity_id=link_id::text);
 end loop;
 rd:=dispatch_internal_letter(r,reply,v.id,v.file_hash,'reply-send');assert dispatch_internal_letter(r,reply,v.id,v.file_hash,'reply-retry')=rd;
 assert(select count(*)=1 from official_reply_sends where relation_id=link_id);
 assert(select count(*)=1 from audit_logs where action='OFFICIAL_REPLY_SENT' and entity_id=link_id::text);
 assert(select received_at is null and read_at is null and not requires_response from dispatch_recipients where dispatch_id=d and profile_id=r);
 assert(select not requires_response from dispatch_recipients where dispatch_id=d and profile_id=cc);
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 assert app.official_reply_status(d,r) is not null;assert app.official_reply_status(d,cc) is null;
 j:=list_internal_mailbox('INBOX');assert exists(select 1 from jsonb_array_elements(j->'items') i,jsonb_array_elements(i->'recipients') recip_json where i->>'dispatch_id'=d::text and recip_json->>'replied_at' is not null);
 reset role;
 perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
 j:=get_official_reply_context(orig);assert jsonb_array_length(j->'links')=1 and j->'links'->0->>'sentAt' is not null;
 assert(select count(*)=1 from letters where id=reply);
 assert(select count(*)=1 from letter_versions where letter_id=reply),'Receiver hanya snapshot final balasan';reset role;
 -- Balasan untuk satu surat/penerima tidak memengaruhi surat lain atau CC.
 d2:=test_support.reply_origin(a,cc);
 perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
 assert app.official_reply_status(d2,cc) is null;reset role;
 failed:=false;begin perform test_support.reply_draft(r,d2,k);exception when others then failed:=true;end;assert failed;
 -- Mengetahui UUID relasi bukan akses dokumen/Storage; policy Storage tetap restrictive.
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;
 assert(select count(*)=0 from official_reply_links where id=link_id);assert(select count(*)=0 from letters where id=reply);
 assert(select count(*)=0 from letter_versions where letter_id=reply);assert(select count(*)=0 from official_reply_sends);reset role;
 assert(select to_jsonb(x)=before_orig from letters x where id=orig);

 -- Balasan formal: pemeriksaan terpisah, approval versi baru, nomor lalu TTD.
 insert into review_policy_managers values(manager);
 perform authorize_letter_reviewer(manager,cc,null,null,true,null,'Pemeriksa balasan fixture');
 formal_reply:=test_support.reply_draft(r,d,gen_random_uuid(),'LAPORAN',cc,array[manager]);
 perform test_support.submit(r,formal_reply);
 select * into rr from review_steps where letter_id=formal_reply and status='PENDING';select revision into rev from letters where id=formal_reply;
 failed:=false;begin perform test_support.number(r,formal_reply,'reply-no-review');exception when others then failed:=true;end;assert failed;
 perform decide_letter_review(cc,rr.id,rr.version_id,rev,'PASS',null);
 assert not exists(select 1 from approval_steps where letter_id=formal_reply);
 perform test_support.submit(r,formal_reply);select revision,current_version_id into rev,old_version from letters where id=formal_reply;
 failed:=false;begin perform test_support.number(r,formal_reply,'reply-no-approval');exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform review_letter(cc,formal_reply,'APPROVE',rev,null);exception when others then failed:=true;end;assert failed;
 perform review_letter(manager,formal_reply,'APPROVE',rev,null);
 perform restart_letter_approval(r,formal_reply,rev,'Koreksi substansial balasan');
 select revision into rev from letters where id=formal_reply;
 payload:=jsonb_build_object('id',formal_reply,'revision',rev,'source','CREATE','letterTypeCode','IN','categoryCode','LAPORAN','reviewerId',cc,'subject','Koreksi balasan','letterDate',(now() at time zone 'Asia/Jakarta')::date,
 'recipientUserId',a,'signatureMode','IN_APP','signerIds',jsonb_build_array(manager),'areas','[]'::jsonb,'content','Isi koreksi balasan');
 perform save_letter_draft(r,payload,jsonb_build_object('path',r::text||'/reply-revised.docx','format','DOCX','hash','reply-revised-hash'));
 assert(select current_version_id<>old_version from letters where id=formal_reply);
 perform test_support.submit(r,formal_reply);
 select * into rr from review_steps where letter_id=formal_reply and status='PENDING';select revision into rev from letters where id=formal_reply;
 failed:=false;begin perform test_support.number(r,formal_reply,'reply-old-decisions');exception when others then failed:=true;end;assert failed;
 perform decide_letter_review(cc,rr.id,rr.version_id,rev,'PASS',null);
 perform test_support.submit(r,formal_reply);select revision into rev from letters where id=formal_reply;
 perform review_letter(manager,formal_reply,'APPROVE',rev,null);
 perform test_support.number(r,formal_reply,'reply-formal-number');select revision,current_version_id into rev,old_version from letters where id=formal_reply;
 failed:=false;begin perform finalize_letter(r,formal_reply,rev,false);exception when others then failed:=true;end;assert failed;
 select id into req from signature_requests where letter_id=formal_reply;
 failed:=false;begin perform record_signature(cc,req,rev,old_version,jsonb_build_object('path','signed.docx','hash','signed','format','DOCX'),'WET_UPLOAD',null,null);exception when others then failed:=true;end;assert failed;
 perform record_signature(manager,req,rev,old_version,jsonb_build_object('path',manager::text||'/reply-signed.docx','hash','reply-signed-hash','format','DOCX'),'WET_UPLOAD',null,null);
 select revision into rev from letters where id=formal_reply;perform finalize_letter(r,formal_reply,rev,false);
 assert not exists(select 1 from official_reply_sends x join official_reply_links y on y.id=x.relation_id where y.reply_letter_id=formal_reply);
 select * into v from letter_versions where id=(select current_version_id from letters where id=formal_reply);
 perform dispatch_internal_letter(r,formal_reply,v.id,v.file_hash,'formal-reply-sent');
 assert exists(select 1 from official_reply_sends x join official_reply_links y on y.id=x.relation_id where y.reply_letter_id=formal_reply);
 assert(select to_jsonb(x)=before_orig from letters x where id=orig);
 assert not has_function_privilege('authenticated','save_letter_draft(uuid,jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','get_official_reply_context(uuid)','EXECUTE');
 assert not has_function_privilege('service_role','get_official_reply_context(uuid)','EXECUTE');
end $$;
rollback;
