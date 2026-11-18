-- Hindari kebijakan pembatalan yang saling membaca melalui RLS secara berulang.
-- Lookup internal hanya menggunakan identitas sesi aktif, tanpa parameter identitas pengguna.
create function app.can_read_cancellation(p_request uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and is_active) and exists(
 select 1 from cancellation_requests cr where cr.id=p_request and (
 app.is_super_admin() or cr.requested_by=auth.uid()
 or exists(select 1 from cancellation_authorizations ca where ca.request_id=cr.id and ca.authorizer_id=auth.uid())
 or app.can_read_letter_for(auth.uid(),cr.letter_id)))
$$;
create function app.is_cancellation_requester(p_request uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and is_active) and exists(select 1 from cancellation_requests cr where cr.id=p_request and cr.requested_by=auth.uid())
$$;
revoke all on function app.can_read_cancellation(uuid),app.is_cancellation_requester(uuid) from public,anon;
grant execute on function app.can_read_cancellation(uuid),app.is_cancellation_requester(uuid) to authenticated,service_role;
drop policy cancellation_requests_read on cancellation_requests;
create policy cancellation_requests_read on cancellation_requests for select to authenticated using(app.can_read_cancellation(id));
drop policy cancellation_authorizations_read on cancellation_authorizations;
create policy cancellation_authorizations_read on cancellation_authorizations for select to authenticated using(app.is_super_admin() or authorizer_id=auth.uid() or app.is_cancellation_requester(request_id));
