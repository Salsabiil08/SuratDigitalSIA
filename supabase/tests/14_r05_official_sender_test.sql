\set ON_ERROR_STOP on
begin;
do $$
declare
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 sm uuid := 'a0000000-0000-0000-0000-000000000003';
 finance_staff uuid := 'a0000000-0000-0000-0000-000000000006';
 gm uuid := 'a0000000-0000-0000-0000-000000000004';
 director uuid := 'a0000000-0000-0000-0000-000000000002';
 other_gm uuid := gen_random_uuid();
 draft uuid;
 revision_number integer;
 visible integer;
 input jsonb;
 doc jsonb := '{"path":"r05.docx","hash":"r05-test","format":"DOCX"}';
 denied boolean;
begin
 insert into auth.users(id,email) values(other_gm,'r05-gm@example.test');
 insert into profiles(id,full_name,email,is_active)
 values(other_gm,'GM fixture','r05-gm@example.test',true);
 insert into user_assignments(profile_id,position_id,unit_id,is_active)
 select other_gm,a.position_id,u.id,true
 from app.active_assignment(gm) a cross join organizational_units u where u.code='FIN';
 assert (select array_agg(s) from app.r05_internal_senders(finance_staff,sm) s)=array[other_gm];
 assert (select array_agg(s order by s) from app.r05_internal_senders(finance_staff,director) s)
   = array(select unnest(array[sm,other_gm]) order by 1);
 assert not exists(select 1 from app.r05_internal_senders(finance_staff,other_gm));
 assert (select array_agg(s) from app.r05_internal_senders(finance_staff,staff) s)=array[finance_staff];
 assert not has_function_privilege('authenticated','app.r05_internal_senders(uuid,uuid)','EXECUTE');
 input:=jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode','LAPORAN',
   'subject','R05 fixture','letterDate',(now() at time zone 'Asia/Jakarta')::date,
   'recipientUserId',other_gm,'officialSenderId',gm,'content','Isi surat','signatureMode','IN_APP');
 assert not exists(select 1 from app.r05_internal_senders(staff,gm));
 draft:=save_letter_draft(staff,input,doc);
 assert(select official_sender_id=gm and creator_id=staff and required_signature_count=0 from letters where id=draft);
 assert not app.can_dispatch_letter(staff,draft);
 assert app.can_dispatch_letter(gm,draft);
 assert not app.can_read_letter_for(other_gm,draft);
 perform test_support.submit(staff,draft);
 assert(select status='IN_REVIEW' from letters where id=draft);
 assert(select count(*)=1 from approval_steps where letter_id=draft and approver_id=gm and status='PENDING');
 assert app.can_read_letter_for(gm,draft);
 denied:=false;
 begin perform test_support.number(staff,draft,'r05-no-approval'); exception when others then denied:=true;end;
 assert denied;
 select revision into revision_number from letters where id=draft;
 perform review_letter(gm,draft,'APPROVE',revision_number,null);
 assert(select status='NUMBERED' and official_number is not null from letters where id=draft);
 assert(select count(*)=1 from number_issuances where letter_id=draft);
 perform test_support.number(staff,draft,'issue-'||draft::text);
 assert(select count(*)=1 from number_issuances where letter_id=draft);
 assert not app.can_read_letter_for(other_gm,draft);

 draft:=save_letter_draft(finance_staff,input||jsonb_build_object('recipientUserId',sm,'officialSenderId',other_gm),doc);
 assert not app.can_dispatch_letter(finance_staff,draft);
 assert app.can_dispatch_letter(other_gm,draft);
 perform test_support.submit(finance_staff,draft);
 assert not app.can_read_letter_for(sm,draft);
 assert app.can_read_letter_for(other_gm,draft);
 perform set_config('request.jwt.claim.sub',sm::text,true);set local role authenticated;
 select count(*) into visible from letters where id=draft;
 assert visible=0,'SM penerima tidak dapat membaca surat sebelum pengiriman';reset role;
 perform set_config('request.jwt.claim.sub',other_gm::text,true);set local role authenticated;
 select count(*) into visible from letters where id=draft;
 assert visible=1,'GM pengirim resmi dapat memeriksa surat dalam persetujuan';reset role;
 assert (select count(*)=1 from approval_steps where letter_id=draft);
 assert (select approver_id=other_gm and status='PENDING' from approval_steps where letter_id=draft);
 select revision into revision_number from letters where id=draft;
 denied:=false;
 begin perform review_letter(sm,draft,'APPROVE',revision_number,null); exception when others then denied:=true;end;
 assert denied;
 perform review_letter(other_gm,draft,'APPROVE',revision_number,null);
 assert(select status='NUMBERED' and official_number is not null from letters where id=draft);
 draft:=save_letter_draft(director,input||jsonb_build_object('recipientUserId',staff,'officialSenderId',director),doc);
 perform test_support.submit(director,draft);
 assert(select status='READY_TO_ISSUE' and required_signature_count=0 from letters where id=draft);
 assert not exists(select 1 from approval_steps where letter_id=draft);

 denied:=false;
 begin perform save_letter_draft(staff,input||jsonb_build_object('recipientUserId',gm),doc); exception when others then denied:=true;end;
 assert denied;
end $$;
rollback;
