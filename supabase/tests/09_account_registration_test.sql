begin;
do $$
declare u uuid;p uuid;r uuid;n int;
begin
 select id into u from organizational_units where code='ACH';
 select id into p from positions where code='STF';
 select count(*) into n from user_assignments where unit_id=u and position_id=p;
 insert into auth.users(id,email,raw_user_meta_data) values('b9000000-0000-0000-0000-000000000001','registration-one@example.test',jsonb_build_object('siadocs_registration',true,'full_name','Pegawai Baru','requested_unit_id',u,'requested_position_id',p,'system_role','SUPER_ADMIN','is_active',true));
 if not exists(select 1 from profiles where id='b9000000-0000-0000-0000-000000000001' and not is_active and system_role='USER') then raise exception 'Signup privilege escalation';end if;
 select id into r from account_registrations where profile_id='b9000000-0000-0000-0000-000000000001';
 begin perform decide_account_registration('a0000000-0000-0000-0000-000000000005',r,'APPROVE',u,p,'Dilarang');raise exception 'Staff approval accepted';exception when others then if sqlerrm='Staff approval accepted' then raise;end if;end;
 perform decide_account_registration('a0000000-0000-0000-0000-000000000001',r,'APPROVE',u,p,'Identitas diperiksa');
 perform decide_account_registration('a0000000-0000-0000-0000-000000000001',r,'APPROVE',u,p,'Retry identik');
 if (select count(*) from user_assignments where unit_id=u and position_id=p)<>n+1 then raise exception 'Existing staff replaced or retry duplicated';end if;
 if exists(select 1 from user_assignments where profile_id='b9000000-0000-0000-0000-000000000001' and is_official_signer) then raise exception 'Signer granted';end if;
 if (select count(*) from audit_logs where action='ACCOUNT_REGISTRATION_APPROVED' and entity_id=r::text)<>1 then raise exception 'Duplicate audit';end if;
 insert into auth.users(id,email,raw_user_meta_data) values('b9000000-0000-0000-0000-000000000002','registration-two@example.test',jsonb_build_object('siadocs_registration',true,'requested_unit_id',u,'requested_position_id',p));
 select id into r from account_registrations where profile_id='b9000000-0000-0000-0000-000000000002';
 perform decide_account_registration('a0000000-0000-0000-0000-000000000001',r,'REJECT',null,null,'Identitas belum sesuai');
 if exists(select 1 from profiles where id='b9000000-0000-0000-0000-000000000002' and is_active) then raise exception 'Rejected account active';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b9000000-0000-0000-0000-000000000002',true);
do $$begin
 if (select count(*) from profiles)<>1 then raise exception 'Pending user directory leak';end if;
 if exists(select 1 from account_registrations) then raise exception 'Pending registration list leak';end if;
 if has_function_privilege('authenticated','public.decide_account_registration(uuid,uuid,text,uuid,uuid,text)','execute') then raise exception 'RPC public exposure';end if;
end $$;
reset role;
rollback;
