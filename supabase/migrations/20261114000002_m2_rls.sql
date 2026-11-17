-- Migrasi M2: Penyesuaian RLS untuk R.04, Disposisi mandiri, dan Akses Super Admin (Blueprint R.04)

-- 1. Perbarui app.can_read_letter untuk R.04 (tanpa status pengiriman)
create or replace function app.can_read_letter(p_letter uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from letters l where l.id = p_letter and (
      l.creator_id = auth.uid()
      or l.signer_id = auth.uid()
      -- Penerima internal dapat melihat surat setelah bernomor resmi (R.04: tanpa distribusi)
      or (l.recipient_user_id = auth.uid() and l.status in ('NUMBERED', 'CANCELLED'))
      -- Penyetuju aktif dan yang pernah memutuskan
      or exists (select 1 from approval_steps a where a.letter_id = l.id and a.approver_id = auth.uid() and a.status <> 'WAITING')
      -- Pejabat penandatangan dalam antrean pengesahan
      or exists (select 1 from signature_requests s where s.letter_id = l.id and s.signer_id = auth.uid())
      -- Pengaju dan pejabat otorisasi pembatalan
      or exists (select 1 from cancellation_requests cr where cr.letter_id = l.id and (
        cr.requested_by = auth.uid()
        or exists (select 1 from cancellation_authorizations ca where ca.request_id = cr.id and ca.authorizer_id = auth.uid())
      ))
    )
  )
$$;

-- 2. Kebijakan RLS tersendiri untuk Disposisi (mendukung disposisi mandiri saat letter_id NULL)
drop policy if exists dispositions_read on dispositions;
drop policy if exists dispositions_select on dispositions;
drop policy if exists dispositions_insert on dispositions;
drop policy if exists dispositions_update on dispositions;

create policy dispositions_select on dispositions for select to authenticated
  using (
    giver_id = auth.uid()
    or recipient_id = auth.uid()
    or (letter_id is not null and app.can_read_letter(letter_id))
  );

create policy dispositions_insert on dispositions for insert to authenticated
  with check (
    giver_id = auth.uid()
  );

create policy dispositions_update on dispositions for update to authenticated
  using (
    giver_id = auth.uid() or recipient_id = auth.uid()
  )
  with check (
    giver_id = auth.uid() or recipient_id = auth.uid()
  );

-- 3. Kebijakan baca untuk tabel administratif & otorisasi pembatalan
drop policy if exists number_issuances_admin_read on number_issuances;
create policy number_issuances_admin_read on number_issuances for select to authenticated
  using (app.is_super_admin() or exists (select 1 from letters l where l.id = letter_id and app.can_read_letter(l.id)));

drop policy if exists number_counters_admin_read on number_counters;
create policy number_counters_admin_read on number_counters for select to authenticated
  using (app.is_super_admin());

drop policy if exists cancellation_requests_read on cancellation_requests;
create policy cancellation_requests_read on cancellation_requests for select to authenticated
  using (
    app.is_super_admin()
    or requested_by = auth.uid()
    or exists (select 1 from cancellation_authorizations ca where ca.request_id = id and ca.authorizer_id = auth.uid())
    or app.can_read_letter(letter_id)
  );

drop policy if exists cancellation_authorizations_read on cancellation_authorizations;
create policy cancellation_authorizations_read on cancellation_authorizations for select to authenticated
  using (
    app.is_super_admin()
    or authorizer_id = auth.uid()
    or exists (select 1 from cancellation_requests cr where cr.id = request_id and cr.requested_by = auth.uid())
  );

drop policy if exists authority_delegations_read on authority_delegations;
create policy authority_delegations_read on authority_delegations for select to authenticated
  using (
    app.is_super_admin()
    or grantor_assignment_id in (select id from user_assignments where profile_id = auth.uid())
    or grantee_assignment_id in (select id from user_assignments where profile_id = auth.uid())
  );

drop policy if exists authority_delegations_admin on authority_delegations;
create policy authority_delegations_admin on authority_delegations for all to authenticated
  using (app.is_super_admin())
  with check (app.is_super_admin());

