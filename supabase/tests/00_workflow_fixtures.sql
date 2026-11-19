-- HANYA database uji sementara. Tidak termasuk migrasi/seed production.
create schema test_support;
create function test_support.draft(p_actor uuid,p_type text default 'IN',p_signers uuid[] default '{}',p_category text default 'PEMBERITAHUAN',p_reviewer uuid default null,p_mandatory uuid[] default null,p_extra uuid[] default '{}') returns uuid
language plpgsql as $$
declare p jsonb; bank uuid;doc jsonb;
begin
 p:=jsonb_build_object('source','CREATE','letterTypeCode',p_type,'categoryCode',p_category,'reviewerId',p_reviewer,'subject','Fixture sah','letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId','a0000000-0000-0000-0000-000000000006','recipientName','Penerima','recipientOrg','Instansi','recipientAddress','Alamat','content','Dokumen pengujian','signatureMode','IN_APP','signerIds',to_jsonb(p_signers),'areas','[]'::jsonb,'additionalApproverIds',to_jsonb(p_extra));
 if p_mandatory is not null then p:=p||jsonb_build_object('mandatoryApproverIds',to_jsonb(p_mandatory));end if;
 doc:=jsonb_build_object('path',p_actor::text||'/fixture.docx','format','DOCX','hash','fixture-only-hash');
 if p_type='Tag' then
  insert into master_bank(name,is_active) values('Bank fixture',true) returning id into bank;
  p:=p||jsonb_build_object('billing',jsonb_build_object('bankId',bank,'accountNumber','123','accountHolder','Fixture','items',jsonb_build_array(jsonb_build_object('description','A','amount',100),jsonb_build_object('description','B','amount',200))));
  doc:=doc||jsonb_build_object('attachments',jsonb_build_array(jsonb_build_object('path',p_actor::text||'/bukti.pdf','name','Bukti.pdf','mime','application/pdf','size',100)));
 end if;
 return save_letter_draft(p_actor,p,doc);
end $$;
create function test_support.submit(p_actor uuid,p_letter uuid,p_confirm boolean default false) returns text language plpgsql as $$
declare rev integer;
begin
 select revision into rev from letters where id=p_letter;
 perform review_letter(p_actor,p_letter,'PREVIEW',rev,null);
 return submit_letter_for_approval(p_actor,p_letter,rev,p_confirm);
end $$;
create function test_support.number(p_actor uuid,p_letter uuid,p_key text) returns number_issuances language plpgsql as $$
declare iss number_issuances; v uuid;
begin
 iss:=issue_letter_number(p_letter,p_actor,p_key);
 select current_version_id into v from letters where id=p_letter;
 if exists(select 1 from letter_versions where id=v and version_kind='DRAFT') then
 perform record_numbered_document(p_actor,p_letter,v,jsonb_build_object('path',p_actor::text||'/numbered.docx','format','DOCX','hash','numbered-fixture-hash'));end if;
 return iss;
end $$;

-- PR-06 helper tambahan, selalu melalui RPC draf nyata.
create function test_support.reply_draft(p_actor uuid,p_origin uuid,p_key uuid,p_category text default 'PEMBERITAHUAN',p_reviewer uuid default null,p_signers uuid[] default '{}') returns uuid language plpgsql as $$
begin
 return save_letter_draft(p_actor,jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode',p_category,'reviewerId',p_reviewer,'subject','Balasan fixture','letterDate',(now() at time zone 'Asia/Jakarta')::date,
 'recipientUserId',(select sender_id from internal_dispatches where id=p_origin),'signatureMode','IN_APP','signerIds',to_jsonb(p_signers),'areas','[]'::jsonb,'content','Isi balasan fixture','replyToDispatchId',p_origin,'replyKey',p_key),
 jsonb_build_object('path',p_actor::text||'/reply-'||p_key::text||'.docx','format','DOCX','hash','reply-fixture-hash'));
end $$;
-- PR-07 helpers hanya database uji sementara.
create function test_support.disposition_origin(p_actor uuid,p_recipient uuid,p_cc uuid[] default '{}') returns uuid language plpgsql as $$
declare l uuid;rev integer;v letter_versions;
begin
 l:=save_letter_draft(p_actor,jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode','PEMBERITAHUAN','subject','Asal disposisi','letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId',p_recipient,'signatureMode','IN_APP','signerIds','[]'::jsonb,'areas','[]'::jsonb,'content','Surat sumber'),jsonb_build_object('path',p_actor::text||'/source.docx','format','DOCX','hash','source-test'));
 perform test_support.submit(p_actor,l);perform test_support.number(p_actor,l,'disposition-number-'||l::text);select revision into rev from letters where id=l;perform finalize_letter(p_actor,l,rev,false);
 select * into v from letter_versions where id=(select current_version_id from letters where id=l);
 return dispatch_internal_letter(p_actor,l,v.id,v.file_hash,'disposition-source-send-'||l::text,p_cc);
end $$;
create function test_support.disposition_result(p_actor uuid,p_task uuid,p_key uuid) returns uuid language plpgsql as $$
begin
 return save_letter_draft(p_actor,jsonb_build_object('source','CREATE','letterTypeCode','IN','categoryCode','PEMBERITAHUAN','subject','Hasil disposisi','letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId',(select giver_id from dispositions where id=p_task),'signatureMode','IN_APP','signerIds','[]'::jsonb,'areas','[]'::jsonb,'content','Surat hasil','dispositionId',p_task,'dispositionDraftKey',p_key),jsonb_build_object('path',p_actor::text||'/result.docx','format','DOCX','hash','result-test'));
end $$;
