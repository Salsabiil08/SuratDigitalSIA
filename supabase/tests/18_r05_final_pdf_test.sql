\set ON_ERROR_STOP on
begin;
do $$
declare
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 peer uuid := 'a0000000-0000-0000-0000-000000000006';
 draft uuid;
 current_letter letters;
 asset_path text := staff::text||'/final.pdf';
 denied boolean := false;
begin
 draft:=save_letter_draft(staff,jsonb_build_object(
   'source','CREATE','letterTypeCode','IN','categoryCode','LAPORAN','subject','PDF R05',
   'letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientUserId',peer,
   'officialSenderId',staff,'content','Isi surat','signatureMode','IN_APP'
 ),'{"path":"pdf-fixture.docx","hash":"fixture","format":"DOCX"}');
 perform test_support.submit(staff,draft);
 perform test_support.number(staff,draft,'r05-pdf');
 select * into current_letter from letters where id=draft;
 begin perform finalize_letter(staff,draft,current_letter.revision,false);exception when others then denied:=true;end;
 assert denied,'DOCX cannot become the official final version';
 insert into storage.objects(bucket_id,name) values('letter-documents',asset_path);
 perform finalize_letter_with_pdf(staff,draft,current_letter.revision,current_letter.current_version_id,
   jsonb_build_object('path',asset_path,'hash',repeat('b',64),'format','PDF'));
 assert exists(select 1 from letters l join letter_versions v on v.id=l.current_version_id
  where l.id=draft and l.finalized_at is not null and v.file_format='PDF' and v.storage_path=asset_path);
 assert exists(select 1 from letter_versions where id=current_letter.current_version_id and not is_current);
 assert not exists(select 1 from internal_dispatches where letter_id=draft);
 perform finalize_letter_with_pdf(staff,draft,current_letter.revision,current_letter.current_version_id,null);
 assert(select count(*)=1 from letter_versions where letter_id=draft and file_format='PDF');
end $$;
rollback;
