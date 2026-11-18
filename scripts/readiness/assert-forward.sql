do $$ declare before_rows jsonb;after_rows jsonb;begin
 select rows into before_rows from test_integrity where kind='letters';
 select jsonb_agg((select jsonb_object_agg(e.key,e.value) from jsonb_each(to_jsonb(l))e where e.key in(select jsonb_object_keys(before_rows->0))) order by id) into after_rows from letters l;
 assert before_rows=after_rows,'Surat historis berubah';
 assert(select count(*)=13 from letters where official_number is not null and current_version_id is null);
 assert(select rows=(select jsonb_agg(to_jsonb(n) order by id) from number_counters n) from test_integrity where kind='counters');
 assert(select rows=(select jsonb_agg(to_jsonb(a) order by id) from audit_logs a) from test_integrity where kind='audit');
 assert(select count(*)=0 from internal_dispatches);assert(select count(*)=0 from official_reply_links);assert(select count(*)=0 from disposition_result_links);
 assert(select count(*)=16 from supabase_migrations.schema_migrations),'History hanya 8+8; enam fondasi tidak direpair';
end $$;

do $$ begin
 assert not has_table_privilege('authenticated','letters','TRUNCATE');
 assert not has_table_privilege('anon','audit_logs','TRUNCATE');
 assert not has_table_privilege('authenticated','billing_details','UPDATE');
end $$;
