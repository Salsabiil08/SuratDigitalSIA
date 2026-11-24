-- Transactional cancellation notifications, scoped to existing business authorizations.
begin;
alter table notifications add column cancellation_request_id uuid references cancellation_requests(id);
create unique index notifications_cancellation_event_unique on notifications(recipient_id,cancellation_request_id,event_type) where cancellation_request_id is not null;
create function app.pending_cancellation_authorizer(p_actor uuid,p_request uuid) returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from cancellation_requests r join letters l on l.id=r.letter_id join letter_types t on t.id=l.letter_type_id join cancellation_authorizations ca on ca.request_id=r.id left join authority_delegations d on d.id=ca.delegation_id
 where r.id=p_request and r.status='PENDING' and l.status='NUMBERED' and ca.authorizer_id=p_actor and ca.decision is null and (app.active_assignment(p_actor)).id is not null
 and (case when t.category<>'INTERNAL' then app.valid_signer(p_actor) else
 ((ca.authority_basis='UNIT_HEAD' and exists(select 1 from organizational_units u join user_assignments a on a.id=u.head_assignment_id where u.id=l.creator_unit_id and a.profile_id=p_actor and a.is_active))
 or (ca.authority_basis='DESIGNATED_OFFICIAL' and d.scope_unit_id=l.creator_unit_id and d.grantor_assignment_id=(select head_assignment_id from organizational_units where id=l.creator_unit_id) and exists(select 1 from user_assignments a where a.id=d.grantee_assignment_id and a.profile_id=p_actor and a.is_active) and d.is_active and (d.valid_from is null or d.valid_from<=(now() at time zone 'Asia/Jakarta')::date) and (d.valid_until is null or d.valid_until>=(now() at time zone 'Asia/Jakarta')::date))) end));
$$;
create function app.notify_cancellation_authorizer() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare r cancellation_requests;
begin
 select * into r from cancellation_requests where id=new.request_id;
 if tg_op='INSERT' then
  if app.pending_cancellation_authorizer(new.authorizer_id,new.request_id) then
   insert into notifications(recipient_id,letter_id,cancellation_request_id,event_type,title,is_read) values(new.authorizer_id,r.letter_id,r.id,'CANCELLATION_REQUESTED','Permohonan pembatalan surat menunggu persetujuan Anda.',false) on conflict do nothing;
  end if;
 elsif old.decision is null and new.decision='APPROVED' and (select count(*) from cancellation_authorizations where request_id=r.id and decision='APPROVED')<(case when (select t.category from letters l join letter_types t on t.id=l.letter_type_id where l.id=r.letter_id)='BILLING' then 2 else 1 end) then
  insert into notifications(recipient_id,letter_id,cancellation_request_id,event_type,title,is_read)
  select r.requested_by,r.letter_id,r.id,'CANCELLATION_APPROVED','Pembatalan disetujui sebagian; menunggu otorisasi berikutnya.',false where exists(select 1 from profiles where id=r.requested_by and is_active) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger cancellation_authorization_notification after insert or update of decision on cancellation_authorizations for each row execute function app.notify_cancellation_authorizer();
create function app.notify_cancellation_result() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.status is distinct from old.status and new.status in('EXECUTED','DECLINED') then
  insert into notifications(recipient_id,letter_id,cancellation_request_id,event_type,title,is_read)
  select p.id,new.letter_id,new.id,'CANCELLATION_'||new.status,case when new.status='EXECUTED' then 'Surat telah dibatalkan.' else 'Permohonan pembatalan ditolak. Surat tetap berlaku.' end,false
  from profiles p where p.is_active and (p.id=new.requested_by or p.id in(select authorizer_id from cancellation_authorizations where request_id=new.id)) on conflict do nothing;
 end if;return new;
end $$;
create trigger cancellation_result_notification after update of status on cancellation_requests for each row execute function app.notify_cancellation_result();
revoke all on function app.pending_cancellation_authorizer(uuid,uuid),app.notify_cancellation_authorizer(),app.notify_cancellation_result() from public,anon,authenticated;
grant execute on function app.pending_cancellation_authorizer(uuid,uuid),app.notify_cancellation_authorizer(),app.notify_cancellation_result() to service_role;
-- Deliver only still-actionable requests already present, without changing decisions or marking anything read.
insert into notifications(recipient_id,letter_id,cancellation_request_id,event_type,title,is_read)
select ca.authorizer_id,r.letter_id,r.id,'CANCELLATION_REQUESTED','Permohonan pembatalan surat menunggu persetujuan Anda.',false from cancellation_requests r join cancellation_authorizations ca on ca.request_id=r.id
where app.pending_cancellation_authorizer(ca.authorizer_id,r.id) on conflict do nothing;
notify pgrst,'reload schema';
commit;
