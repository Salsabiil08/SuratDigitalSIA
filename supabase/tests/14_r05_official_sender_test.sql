\set ON_ERROR_STOP on
begin;
do $$
declare
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 gm uuid := 'a0000000-0000-0000-0000-000000000004';
 director uuid := 'a0000000-0000-0000-0000-000000000002';
 other_gm uuid := gen_random_uuid();
 draft uuid;
 revision_number integer;
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

 draft:=save_letter_draft(director,input||jsonb_build_object('recipientUserId',staff,'officialSenderId',director),doc);
 perform test_support.submit(director,draft);
 assert(select status='READY_TO_ISSUE' and required_signature_count=0 from letters where id=draft);
 assert not exists(select 1 from approval_steps where letter_id=draft);

 denied:=false;
 begin perform save_letter_draft(staff,input||jsonb_build_object('recipientUserId',gm),doc); exception when others then denied:=true;end;
 assert denied;
end $$;
rollback;
