-- User-approved hierarchy: STF -> GM/SM/DIR, GM -> SM/DIR, SM -> DIR.
-- Eligibility is not read access: existing assignment/version/hash/cycle checks remain mandatory.
begin;
create function app.review_hierarchy(p_creator uuid,p_reviewer uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_creator<>p_reviewer and exists(
 select 1 from positions c join positions r on true
 where c.id=(app.active_assignment(p_creator)).position_id and r.id=(app.active_assignment(p_reviewer)).position_id
 and c.code in('STF','GM','SM','DIR') and r.code in('GM','SM','DIR')
 and (case r.code when 'GM' then 2 when 'SM' then 3 when 'DIR' then 4 else 0 end)>(case c.code when 'STF' then 1 when 'GM' then 2 when 'SM' then 3 when 'DIR' then 4 else 0 end));
$$;
revoke all on function app.review_hierarchy(uuid,uuid) from public,anon,authenticated;
grant execute on function app.review_hierarchy(uuid,uuid) to service_role;
-- Replace only the old reviewer-mandate predicate at its existing workflow/read gates.
-- The surrounding creator ownership, selected reviewer, version and finality checks are preserved verbatim.
do $$ declare f record;definition text;patched text;changed integer:=0;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('public','app') and p.prokind='f' and p.prosrc like '%app.authorized_reviewer(%' loop
  select pg_get_functiondef(f.sig) into definition;
  patched:=replace(definition,'app.authorized_reviewer(r,a.unit_id,t.id)','app.review_hierarchy(p_actor,r)');
  patched:=replace(patched,'app.authorized_reviewer(l.reviewer_id,l.creator_unit_id,l.letter_type_id)','app.review_hierarchy(l.creator_id,l.reviewer_id)');
  patched:=replace(patched,'app.authorized_reviewer(s.reviewer_id,l.creator_unit_id,l.letter_type_id)','app.review_hierarchy(l.creator_id,s.reviewer_id)');
  patched:=replace(patched,'app.authorized_reviewer(p_actor,l.creator_unit_id,l.letter_type_id)','app.review_hierarchy(l.creator_id,p_actor)');
  patched:=replace(patched,'app.authorized_reviewer(auth.uid(),l.creator_unit_id,l.letter_type_id)','app.review_hierarchy(l.creator_id,auth.uid())');
  if patched=definition or position('app.authorized_reviewer(' in patched)>0 then raise exception 'Reviewer gate definition did not match: %',f.sig;end if;
  execute patched;changed:=changed+1;
 end loop;
 if changed<6 then raise exception 'Reviewer workflow gates incomplete: %',changed;end if;
end $$;
-- Historical grants/decisions/documents are retained. No new reviewer assignments or grants are fabricated.
notify pgrst,'reload schema';
commit;
