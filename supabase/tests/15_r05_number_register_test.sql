\set ON_ERROR_STOP on
begin;
grant usage on schema app,auth,public to authenticated;
grant select on letters,profiles,organizational_units,letter_types to authenticated;
do $$
declare
 staff uuid := 'a0000000-0000-0000-0000-000000000005';
 unrelated uuid := 'a0000000-0000-0000-0000-000000000006';
 draft uuid;
 issued number_issuances;
begin
 draft:=test_support.draft(staff);
 perform test_support.submit(staff,draft);
 issued:=test_support.number(staff,draft,'register-test');
 perform set_config('request.jwt.claim.sub',staff::text,true);
 set local role authenticated;
 assert exists(select 1 from read_number_register(issued.official_number) r where r.issuance_id=issued.id);
 assert not exists(select 1 from read_number_register('must not match') r where r.issuance_id=issued.id);
 reset role;
 update number_issuances set status='CANCELLED' where id=issued.id;
 set local role authenticated;
 assert exists(select 1 from read_number_register(issued.official_number,'IN',issued.year,null,'CANCELLED') r where r.issuance_id=issued.id);
 perform set_config('request.jwt.claim.sub',unrelated::text,true);
 assert not exists(select 1 from read_number_register(issued.official_number) r where r.issuance_id=issued.id);
 reset role;
end $$;
rollback;
