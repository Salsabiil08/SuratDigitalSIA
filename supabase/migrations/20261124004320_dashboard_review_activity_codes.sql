-- Sanitized activity feed; never grants direct access to the administrator audit log.
create or replace function app.dashboard_letter_activity() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(feed) order by feed.occurred_at desc,feed.id desc),'[]'::jsonb)
 from (
  select a.id,a.letter_id,a.action,l.subject,l.official_number,a.occurred_at
  from public.audit_logs a join public.letters l on l.id=a.letter_id
  where auth.uid() is not null
   and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
   and app.can_read_letter_for(auth.uid(),l.id)
   and a.action in ('CREATE','UPLOAD','DRAFT_SAVED','SAVE_DRAFT','SUBMIT','REVIEW_REQUESTED','REVIEW_PASS','REVIEW_REQUEST_REVISION','REVIEW_COMMENT','APPROVE','REJECT','REQUEST_REVISION','FINALIZE','ISSUE_NUMBER','NUMBER_ISSUED','NUMBERED_DOCUMENT_STORED','SIGNATURE_REQUESTED','SIGNATURE_APPLIED','CANCEL_DRAFT','CANCELLATION_REQUESTED','INTERNAL_SENT','INTERNAL_READ','INTERNAL_RECEIVE')
   and (a.action not in ('INTERNAL_READ','INTERNAL_RECEIVE') or a.actor_id=auth.uid() or l.creator_id=auth.uid() or exists(select 1 from public.internal_dispatches d where d.letter_id=l.id and d.sender_id=auth.uid()))
   -- A delivery recipient does not inherit the creator's private draft/review history.
   and (app.can_read_letter_for_pre_review(auth.uid(),l.id)
     or (l.reviewer_id=auth.uid() and app.authorized_reviewer(auth.uid(),l.creator_unit_id,l.letter_type_id))
     or exists(select 1 from public.internal_dispatches d where d.letter_id=l.id and a.occurred_at>=d.sent_at and a.action in ('INTERNAL_SENT','INTERNAL_READ','INTERNAL_RECEIVE')))
  order by a.occurred_at desc,a.id desc limit 5
 ) feed
$$;
notify pgrst,'reload schema';
