-- Keep privileged implementation private; public API wrappers retain the caller's rights.
alter function public.add_letter_comment(uuid,text,uuid) set schema app;
alter function public.get_letter_comment_context(uuid) set schema app;
revoke all on function app.add_letter_comment(uuid,text,uuid),app.get_letter_comment_context(uuid) from public,anon;
grant execute on function app.add_letter_comment(uuid,text,uuid),app.get_letter_comment_context(uuid) to authenticated;
create function public.add_letter_comment(p_letter uuid,p_body text,p_key uuid) returns uuid
language sql security invoker set search_path=public,pg_temp as $$ select app.add_letter_comment(p_letter,p_body,p_key) $$;
create function public.get_letter_comment_context(p_letter uuid) returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$ select app.get_letter_comment_context(p_letter) $$;
revoke all on function public.add_letter_comment(uuid,text,uuid),public.get_letter_comment_context(uuid) from public,anon,authenticated;
grant execute on function public.add_letter_comment(uuid,text,uuid),public.get_letter_comment_context(uuid) to authenticated;
notify pgrst,'reload schema';
