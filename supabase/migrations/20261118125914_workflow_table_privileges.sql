-- PR-08: tutup grant DML/TRUNCATE implisit Supabase. Tanpa perubahan data/policy baca.
begin;
do $$ declare t text;begin
 foreach t in array array['letters','letter_versions','letter_attachments','approval_steps','signature_requests','number_counters','number_issuances','letter_distributions','billing_details','billing_items','audit_logs','dispositions','review_policies','review_policy_managers','review_authorizations','review_steps','review_comments','approval_policy_managers','approver_authorizations','delivery_policy_managers','internal_delivery_settings','dispatch_authorizations','internal_dispatches','dispatch_recipients','official_reply_links','official_reply_sends','disposition_operations','disposition_result_links','disposition_result_files','disposition_submissions','disposition_submission_files','disposition_decisions'] loop
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated',t);
 end loop;
 -- TRUNCATE tidak tunduk pada RLS, termasuk untuk tabel master yang boleh dikelola admin.
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
 and not exists(select 1 from pg_depend d where d.objid=c.oid and d.deptype='e') loop
  execute format('revoke truncate on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
-- Penandaan notifikasi tetap melalui grant kolom dan guard PR-01.
revoke insert,delete,truncate,references,trigger on notifications from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
