\set ON_ERROR_STOP on
begin;
do $$
declare
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 sm uuid := 'a0000000-0000-0000-0000-000000000003';
 director uuid := 'a0000000-0000-0000-0000-000000000002';
 draft uuid;
 bill uuid;
 finance uuid := 'a0000000-0000-0000-0000-000000000006';
 current_letter letters;
 path text := director::text||'/master/signature.png';
 request_id uuid;
 denied boolean := false;
begin
 draft:=save_letter_draft(staff,jsonb_build_object(
  'source','CREATE','letterTypeCode','KRE','subject','Pengesahan eksternal',
  'letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientName','Penerima',
  'recipientOrg','Instansi','recipientAddress','Alamat','originCity','Banda Aceh',
  'officialSenderId',director,'content','Isi','signatureMode','IN_APP'
 ),'{"path":"consent.docx","hash":"fixture","format":"DOCX"}');
 perform test_support.submit(staff,draft);
 select * into current_letter from letters where id=draft;
 begin perform confirm_r05_signing(director,draft,current_letter.revision,'APPROVE',false,null);exception when others then denied:=true;end;
 assert denied;
 assert(select status='IN_REVIEW' and official_number is null from letters where id=draft);
 insert into storage.objects(bucket_id,name) values('signature-assets',path);
 perform save_official_signing_asset(director,'SIGNATURE',path,repeat('d',64));
 denied:=false;
 begin perform confirm_r05_signing(sm,draft,current_letter.revision,'APPROVE',false,null);exception when others then denied:=true;end;
 assert denied;
 assert confirm_r05_signing(director,draft,current_letter.revision,'APPROVE',false,null)='NUMBERED';
 assert(select count(*)=1 from number_issuances where letter_id=draft);
 assert exists(select 1 from r05_signing_consents where letter_id=draft and signer_id=director and signature_path=path and stamp_path is null);
 perform test_support.number(staff,draft,'issue-'||draft::text);
 select * into current_letter from letters where id=draft;
 select id into request_id from signature_requests where letter_id=draft;
 perform record_r05_authorized_signature(request_id,current_letter.revision,current_letter.current_version_id,
  '{"path":"signed.docx","hash":"signed","format":"DOCX"}');
 assert(select signature_status='UPLOADED' and finalized_at is null from letters where id=draft);
 bill:=test_support.draft(finance,'Tag',array[sm,director]);
 update letters set official_sender_id=sm where id=bill;
 perform test_support.submit(finance,bill);
 select * into current_letter from letters where id=bill;
 denied:=false;
 begin perform confirm_r05_signing(director,bill,current_letter.revision,'APPROVE',false,null);exception when others then denied:=true;end;
 assert denied,'Director cannot approve before SM';
 insert into storage.objects(bucket_id,name) values('signature-assets',sm::text||'/master/signature.png');
 perform save_official_signing_asset(sm,'SIGNATURE',sm::text||'/master/signature.png',repeat('a',64));
 assert confirm_r05_signing(sm,bill,current_letter.revision,'APPROVE',false,null)='IN_REVIEW';
 assert(select official_number is null from letters where id=bill);
 select * into current_letter from letters where id=bill;
 assert confirm_r05_signing(director,bill,current_letter.revision,'APPROVE',false,null)='NUMBERED';
 assert(select count(*)=2 from r05_signing_consents where letter_id=bill);
 assert(select array_agg(status order by sign_order)=array['PENDING','WAITING'] from signature_requests where letter_id=bill);
 assert not has_function_privilege('authenticated','public.confirm_r05_signing(uuid,uuid,integer,text,boolean,text)','EXECUTE');
end $$;
rollback;
