\set ON_ERROR_STOP on
begin;
do $$ declare t text;failed boolean;a user_assignments;actor uuid:='a0000000-0000-0000-0000-000000000005';begin
 foreach t in array array['letters','letter_versions','approval_steps','signature_requests','audit_logs','number_counters','number_issuances','dispositions','dispatch_recipients','official_reply_links','disposition_submissions'] loop
 assert not has_table_privilege('authenticated','public.'||t,'INSERT');
 assert not has_table_privilege('authenticated','public.'||t,'UPDATE');
 assert not has_table_privilege('authenticated','public.'||t,'DELETE');
 assert not has_table_privilege('authenticated','public.'||t,'TRUNCATE');
 assert not has_table_privilege('anon','public.'||t,'TRUNCATE');
 end loop;
 assert has_column_privilege('authenticated','notifications','is_read','UPDATE');
 assert not has_column_privilege('authenticated','notifications','recipient_id','UPDATE');
 set local role authenticated;failed:=false;
 begin truncate public.audit_logs;exception when insufficient_privilege then failed:=true;end;
 assert failed,'TRUNCATE harus ditolak meskipun tidak tunduk RLS';reset role;
 select * into a from app.active_assignment(actor);
 assert a.id is not null;
 update positions set is_active=false where id=a.position_id;
 assert (app.active_assignment(actor)).id is null,'Jabatan nonaktif tidak boleh memberi mandat';
 failed:=false;begin perform test_support.draft(actor);exception when others then failed:=true;end;assert failed;
 update positions set is_active=true where id=a.position_id;
 update organizational_units set is_active=false where id=a.unit_id;
 assert (app.active_assignment(actor)).id is null,'Unit nonaktif tidak boleh memberi mandat';
 update organizational_units set is_active=true where id=a.unit_id;
 update user_assignments set start_date=(now() at time zone 'Asia/Jakarta')::date,end_date=(now() at time zone 'Asia/Jakarta')::date where id=a.id;
 perform set_config('TimeZone','Pacific/Kiritimati',true);assert (app.active_assignment(actor)).id=a.id,'Tanggal mandat harus WIB';
 perform set_config('TimeZone','Etc/GMT+12',true);assert (app.active_assignment(actor)).id=a.id,'Timezone sesi tidak boleh mengubah mandat';
end $$;
rollback;
