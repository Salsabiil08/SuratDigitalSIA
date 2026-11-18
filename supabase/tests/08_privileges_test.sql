\set ON_ERROR_STOP on
begin;
do $$ declare t text;failed boolean;begin
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
end $$;
rollback;
