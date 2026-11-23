begin;
do $$
declare p jsonb;doc jsonb;l uuid;bank uuid;before_count integer;rev integer;
begin
 insert into master_bank(name,is_active) values('Bank pembayaran fixture',true) returning id into bank;
 p:=jsonb_build_object('source','CREATE','letterTypeCode','Tag','categoryCode','PEMBERITAHUAN','subject','Permintaan Pembayaran','letterDate',(now() at time zone 'Asia/Jakarta')::date,'recipientName','Direktur Utama','recipientOrg','PT Semen Indonesia Aceh','recipientAddress','Kantor SIA','content','Mohon pembayaran','signatureMode','IN_APP','signerIds',jsonb_build_array('a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002'),'areas','[]'::jsonb,'billing',jsonb_build_object('layout','PAYMENT_REQUEST','bankId',bank,'accountNumber','000045','accountHolder','Penerima','items',jsonb_build_array(jsonb_build_object('documentNumber','1900000110','description','Biaya operasional','payeeName','Penerima','bankName','BSI','accountNumber','000045','amount',10000000))));
 doc:=jsonb_build_object('path','a0000000-0000-0000-0000-000000000006/payment.docx','format','DOCX','hash','billing-test','attachments',jsonb_build_array(jsonb_build_object('path','a0000000-0000-0000-0000-000000000006/proof.pdf','name','Bukti.pdf','mime','application/pdf','size',100)));
 l:=save_letter_draft('a0000000-0000-0000-0000-000000000006',p,doc);
 assert (select count(*) from billing_items where letter_id=l)=1,'Satu rincian sah ditolak';
 assert exists(select 1 from billing_items where letter_id=l and document_number='1900000110' and payee_name='Penerima' and bank_name='BSI' and account_number='000045'),'Data tabel hilang';
 assert (select official_number is null and status='DRAFT' from letters where id=l),'Draf menerbitkan nomor otomatis';
 select revision into rev from letters where id=l;
 select count(*) into before_count from letters;
 begin
  perform save_letter_draft('a0000000-0000-0000-0000-000000000006',jsonb_set(p,'{billing,items,0,documentNumber}','""'),doc);
  raise exception 'Missing document accepted';
 exception when others then if sqlerrm='Missing document accepted' then raise;end if;end;
 assert (select count(*) from letters)=before_count,'Kegagalan meninggalkan draf parsial';
 begin
  perform save_letter_draft('a0000000-0000-0000-0000-000000000005',p,doc);
  raise exception 'Non Finance accepted';
 exception when others then if sqlerrm='Non Finance accepted' then raise;end if;end;
 p:=p||jsonb_build_object('id',l,'revision',rev);
 perform save_letter_draft('a0000000-0000-0000-0000-000000000006',jsonb_set(p,'{billing,items,0,documentNumber}','"1900000111"'),doc);
 assert exists(select 1 from billing_items where letter_id=l and document_number='1900000111'),'Koreksi tidak tersimpan';
 assert (select count(*) from letter_versions where letter_id=l)=2,'Koreksi tidak membuat versi';
 assert not has_table_privilege('authenticated','billing_items','UPDATE'),'Hak tulis langsung melebar';
end $$;
rollback;
