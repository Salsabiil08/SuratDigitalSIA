-- Data sintetis lokal saja, tidak disalin dari surat/akun production.
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
insert into supabase_migrations.schema_migrations(version,name) values
('20261117204405','revision_workflow'),('20261117204922','workflow_permissions'),('20261117210259','authorized_cancellation'),('20261117213134','workflow_validation_guards'),('20261118012449','disposition_review_flow'),('20261118013200','general_senior_manager'),('20261118013517','cancellation_read_scope'),('20261118020743','rich_text_content');
insert into letters(letter_type_id,source,status,subject,creator_id,creator_unit_id,recipient_type,official_number,issued_at)
 select (select id from letter_types where code='IN'),'CREATE','NUMBERED','SINTETIS historis '||n,'a0000000-0000-0000-0000-000000000005',(select id from organizational_units where code='ACH'),'INTERNAL_USER','LEGACY-'||n,now() from generate_series(1,13)n;
insert into number_counters(series_id,year,last_value) select id,2026,200 from number_series;
insert into audit_logs(actor_id,action,entity_type,entity_id) values('a0000000-0000-0000-0000-000000000005','SYNTHETIC_BASELINE','test','historical');
create table public.test_integrity as select 'letters'::text as kind,jsonb_agg(to_jsonb(l) order by id) as rows from letters l
union all select 'counters',jsonb_agg(to_jsonb(n) order by id) from number_counters n
union all select 'audit',jsonb_agg(to_jsonb(a) order by id) from audit_logs a;

-- Meniru grant awal Supabase production; forward harus mencabut mutasi workflow.
grant all on all tables in schema public to anon,authenticated;
-- PR-01 akan mencabut table-level update notifikasi dan mengembalikan grant kolom.
