-- Fixture sesuai RPC nyata: versi, preview, approval, nomor, pembatalan, disposisi.
\set ON_ERROR_STOP on
begin;
do $$
declare
 a uuid:='a0000000-0000-0000-0000-000000000005';d uuid:='a0000000-0000-0000-0000-000000000002';
 sm uuid:='a0000000-0000-0000-0000-000000000003';fin uuid:='a0000000-0000-0000-0000-000000000006';
 l1 uuid;l2 uuid;l3 uuid;l4 uuid;iss number_issuances;retry number_issuances;rev integer;disp uuid;dr integer;failed boolean;
begin
 l1:=test_support.draft(a);l2:=test_support.draft(a);l3:=test_support.draft(a,'KRE',array[d]);l4:=test_support.draft(a);
 failed:=false;begin perform issue_letter_number(l4,a,'draft');exception when others then failed:=true;end;assert failed,'Draft harus ditolak';
 perform test_support.submit(a,l1);perform test_support.submit(a,l2);
 iss:=test_support.number(a,l1,'k1');assert iss.sequence_number=1;assert iss.official_number~'^001[0-9]{2}-IN/ACH/SIA/[0-9]{2}\.[0-9]{4}$';
 retry:=test_support.number(a,l1,'k1-retry');assert retry.id=iss.id;
 iss:=test_support.number(a,l2,'k2');assert iss.sequence_number=2;
 perform test_support.submit(a,l3);select revision into rev from letters where id=l3;
 failed:=false;begin perform review_letter(fin,l3,'APPROVE',rev,null);exception when others then failed:=true;end;assert failed,'Aktor lain tidak boleh approve';
 perform review_letter(d,l3,'APPROVE',rev,null);
 iss:=test_support.number(a,l3,'k3');assert iss.official_number~'^001[0-9]{2}/KRE\.DIR/[0-9]{2}\.[0-9]{4}$';
 assert(select signature_status='WAITING' from letters where id=l3);
 perform cancel_letter_workflow(a,l3,'REQUEST','Uji pembatalan sah');
 failed:=false;begin perform cancel_letter_workflow(fin,l3,'APPROVE',null);exception when others then failed:=true;end;assert failed;
 perform cancel_letter_workflow(d,l3,'APPROVE',null);
 assert(select status='CANCELLED' and official_number=iss.official_number from letters where id=l3);
 assert(select status='CANCELLED' from number_issuances where letter_id=l3);
 assert(select count(*)>=3 from audit_logs where action='NUMBER_ISSUED');
 disp:=disposition_workflow(sm,'CREATE',null,null,jsonb_build_object('recipientId',fin,'subject','Tindak lanjut','instruction','Kerjakan','requiresLetter',false));
 select revision into dr from dispositions where id=disp;
 perform disposition_workflow(fin,'SUBMIT',disp,dr,jsonb_build_object('note','Hasil pekerjaan'));
 select revision into dr from dispositions where id=disp;
 failed:=false;begin perform disposition_workflow(fin,'ACCEPT',disp,dr,'{}');exception when others then failed:=true;end;assert failed;
 perform disposition_workflow(sm,'ACCEPT',disp,dr,jsonb_build_object('note','Sesuai'));
 assert(select status='DONE' from dispositions where id=disp);
end $$;
rollback;
