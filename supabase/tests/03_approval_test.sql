\set ON_ERROR_STOP on
grant usage on schema public,app,auth to authenticated;
grant select on letters,profiles,letter_versions,approval_steps to authenticated;
begin;
do $$
declare
 a uuid:='a0000000-0000-0000-0000-000000000005';d uuid:='a0000000-0000-0000-0000-000000000002';
 sm uuid:='a0000000-0000-0000-0000-000000000003';gm uuid:='a0000000-0000-0000-0000-000000000004';
 l uuid;l2 uuid;l3 uuid;rev integer;failed boolean;n integer;r review_steps;old_version uuid;iss number_issuances;
begin
 insert into approval_policy_managers values(d);insert into review_policy_managers values(d);
 perform authorize_letter_approver(d,gm,null,null,true,null,'Penugasan fixture PG');
 perform authorize_letter_reviewer(d,gm,null,null,true,null,'Pemeriksa fixture PG');
 l:=test_support.draft(a,'KRE',array[d],'PEMBERITAHUAN',null,array[sm],array[gm,gm,sm]);
 perform test_support.submit(a,l);select revision into rev from letters where id=l;
 assert(select count(*)=2 from approval_steps where letter_id=l),'Dedup harus menyisakan dua aktor';
 failed:=false;begin perform review_letter(gm,l,'APPROVE',rev,null);exception when others then failed:=true;end;assert failed,'Tambahan tidak boleh mendahului wajib';
 perform set_config('request.jwt.claim.sub',gm::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=0,'Tahap WAITING belum memberi akses';reset role;
 perform review_letter(sm,l,'APPROVE',rev,null);
 perform set_config('request.jwt.claim.sub',gm::text,true);set local role authenticated;
 select count(*) into n from letters where id=l;assert n=1,'Penyetuju aktif membaca versi penugasan';reset role;
 perform review_letter(gm,l,'APPROVE',rev,null);
 iss:=test_support.number(a,l,'pg-separated');assert iss.official_number like '%/KRE.DIR/%','Seri mengikuti signer, bukan approver';
 assert(select count(*)=1 from signature_requests where letter_id=l and signer_id=d);
 l2:=test_support.draft(sm,'KRE',array[sm],'PEMBERITAHUAN',null,array[d]);perform test_support.submit(sm,l2);
 assert(select count(*)=1 from approval_steps where letter_id=l2 and approver_id=d and status='PENDING');
 l3:=test_support.draft(sm,'Tag',array[sm,d]);perform test_support.submit(sm,l3,true);
 assert(select count(*)=1 from approval_steps where letter_id=l3 and approver_id=d and status='PENDING');
 select revision into rev from letters where id=l3;perform review_letter(d,l3,'APPROVE',rev,null);
 perform test_support.number(sm,l3,'pg-billing');
 assert(select count(*)=2 from signature_requests where letter_id=l3);
 -- Content review is now part of approval, without a second review task.
 l:=test_support.draft(a,'KRE',array[d],'PERMOHONAN',gm);perform test_support.submit(a,l);
 assert(select count(*)=0 from review_steps where letter_id=l);
 select revision into rev from letters where id=l;perform review_letter(d,l,'APPROVE',rev,null);
 select current_version_id,revision into old_version,rev from letters where id=l;perform restart_letter_approval(a,l,rev,'Koreksi fixture');
 failed:=false;begin perform test_support.submit(a,l);exception when others then failed:=true;end;assert failed,'Restart harus diikuti versi baru';
 assert(select count(*)=1 from approval_steps where letter_id=l and status='APPROVED' and version_id=old_version);
 assert(select approval_plan is null from letters where id=l);
end $$;
rollback;
