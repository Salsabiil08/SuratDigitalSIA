\set ON_ERROR_STOP on
grant usage on schema public,app,auth to authenticated;
grant select on letters,profiles,letter_versions to authenticated;
begin;
-- Data hanya pada database test; tidak backfill surat production.
create function test_support.mailbox_dispatch(p_actor uuid,p_recipient uuid,p_subject text,p_cc uuid[] default '{}') returns uuid language plpgsql as $$
declare l uuid;rev integer;v letter_versions;
begin
 l:=save_letter_draft(p_actor,jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode','PEMBERITAHUAN','subject',p_subject,'letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId',p_recipient,'signatureMode','IN_APP','signerIds','[]'::jsonb,'areas','[]'::jsonb,'content','Naskah fixture kotak surat'),jsonb_build_object('path',p_actor::text||'/mailbox.docx','format','DOCX','hash','mailbox-fixture-hash'));
 perform test_support.submit(p_actor,l);perform test_support.number(p_actor,l,'mailbox-number-'||l::text);
 select revision into rev from letters where id=l;perform finalize_letter(p_actor,l,rev,false);
 select * into v from letter_versions where id=(select current_version_id from letters where id=l);
 return dispatch_internal_letter(p_actor,l,v.id,v.file_hash,'mailbox-send-'||l::text,p_cc);
end $$;
do $$
declare a uuid:='a0000000-0000-0000-0000-000000000005';r uuid:='a0000000-0000-0000-0000-000000000006';
 cc uuid:='a0000000-0000-0000-0000-000000000004';other_id uuid:='a0000000-0000-0000-0000-000000000003';adm uuid:='a0000000-0000-0000-0000-000000000001';manager uuid:='a0000000-0000-0000-0000-000000000002';
 l uuid;rev integer;d uuid;d1 uuid;d2 uuid;dcc uuid;other_d uuid;i integer;j jsonb;p1 jsonb;p2 jsonb;official text;failed boolean;unit uuid;row_count_before bigint;
begin
 l:=test_support.draft(a);perform test_support.submit(a,l);perform test_support.number(a,l,'mailbox-unsent');select revision into rev from letters where id=l;perform finalize_letter(a,l,rev,false);
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 j:=list_internal_mailbox('INBOX');assert(j->>'total')::integer=0,'Final belum dikirim bukan inbox';reset role;
 for i in 1..23 loop
  d:=test_support.mailbox_dispatch(a,r,'Surat Operasional '||i);if i=1 then d1:=d;elsif i=2 then d2:=d;end if;
 end loop;
 other_d:=test_support.mailbox_dispatch(other_id,cc,'Rahasia pihak lain');
 perform record_internal_recipient_action(r,d1,'READ');perform record_internal_recipient_action(r,d2,'RECEIVE');
 select official_number into official from internal_dispatches where id=d1;
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 j:=list_internal_mailbox('INBOX');assert(j->>'total')::integer=23;assert jsonb_array_length(j->'items')=10;
 p1:=j;p2:=list_internal_mailbox('INBOX','ALL','',2,10);assert jsonb_array_length(p2->'items')=10;
 assert not exists(select 1 from jsonb_array_elements(p1->'items') x join jsonb_array_elements(p2->'items') y on x->>'dispatch_id'=y->>'dispatch_id'),'Pagination harus stabil/tanpa duplikasi';
 j:=list_internal_mailbox('INBOX','ALL','',999,10);assert(j->>'page')::integer=3;assert jsonb_array_length(j->'items')=3;
 j:=list_internal_mailbox('INBOX','UNREAD');assert(j->>'total')::integer=22;
 j:=list_internal_mailbox('INBOX','UNRECEIVED');assert(j->>'total')::integer=22;
 j:=list_internal_mailbox('INBOX','RECEIVED');assert(j->>'total')::integer=1;
 j:=list_internal_mailbox('INBOX','ALL',official);assert(j->>'total')::integer=1;
 j:=list_internal_mailbox('INBOX','ALL','oPERASIONAL');assert(j->>'total')::integer=23;
 j:=list_internal_mailbox('INBOX','ALL','Rina');assert(j->>'total')::integer=23;
 j:=list_internal_mailbox('INBOX','ALL','%_');assert(j->>'total')::integer=0,'Wildcard harus literal';
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=0,'Recipient bukan otomatis pengirim';
 failed:=false;begin perform list_internal_mailbox('INBOX','INVALID');exception when others then failed:=true;end;assert failed;
 reset role;
 -- Membuka daftar tidak menulis READ/RECEIVE.
 assert(select read_at is null from dispatch_recipients where dispatch_id=d2 and profile_id=r);
 assert(select received_at is null from dispatch_recipients where dispatch_id=d1 and profile_id=r);
 perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=23;
 assert not exists(select 1 from jsonb_array_elements(j->'items') x where x ? 'storage_path' or x ? 'file_hash' or x ? 'content_html');reset role;
 perform set_config('request.jwt.claim.sub',other_id::text,true);set local role authenticated;
 j:=list_internal_mailbox('INBOX');assert(j->>'total')::integer=0;
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=1;assert j->'items'->0->>'dispatch_id'=other_d::text;reset role;
 perform set_config('request.jwt.claim.sub',adm::text,true);set local role authenticated;
 j:=list_internal_mailbox('INBOX');assert(j->>'total')::integer=0;
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=0;reset role;
 insert into delivery_policy_managers values(manager);
 perform configure_internal_delivery(manager,null,null,null,null,true,'Kebijakan CC uji mailbox');
 dcc:=test_support.mailbox_dispatch(a,r,'Tembusan resmi',array[cc]);
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;
 j:=list_internal_mailbox('INBOX');assert(j->>'total')::integer=2;
 assert exists(select 1 from jsonb_array_elements(j->'items') x where x->>'dispatch_id'=dcc::text and jsonb_array_length(x->'recipients')=1 and x->'recipients'->0->>'role'='CC');
 j:=list_internal_mailbox('INBOX','UNRECEIVED');assert(j->>'total')::integer=1,'CC bukan receipt wajib';
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=0;reset role;
 select id into unit from organizational_units where code='ACH';
 perform configure_internal_delivery(manager,cc,unit,true,null,null,'Delegasi outbox uji');
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;
 j:=list_internal_mailbox('OUTBOX','ALL','Tembusan resmi');assert(j->>'total')::integer=1;assert jsonb_array_length(j->'items'->0->'recipients')=2;reset role;
 perform configure_internal_delivery(manager,cc,unit,false,null,null,'Cabut delegasi outbox');
 perform set_config('request.jwt.claim.sub',cc::text,true);set local role authenticated;
 j:=list_internal_mailbox('OUTBOX');assert(j->>'total')::integer=0;reset role;
 -- Error permission harus error, bukan payload kosong sukses.
 revoke select on internal_dispatches from authenticated;
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 failed:=false;begin perform list_internal_mailbox('INBOX');exception when insufficient_privilege then failed:=true;end;assert failed;reset role;
 grant select on internal_dispatches to authenticated;
 update profiles set is_active=false where id=r;
 perform set_config('request.jwt.claim.sub',r::text,true);set local role authenticated;
 failed:=false;begin perform list_internal_mailbox('INBOX');exception when insufficient_privilege then failed:=true;end;assert failed;reset role;
 assert not has_function_privilege('anon','list_internal_mailbox(text,text,text,integer,integer)','execute');
 assert not has_function_privilege('service_role','list_internal_mailbox(text,text,text,integer,integer)','execute');
end $$;
rollback;
