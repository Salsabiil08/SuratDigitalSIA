-- Row Level Security: dasar. Akses ditentukan di database, bukan hanya di antarmuka.
-- Penulisan sensitif (penerbitan nomor, persetujuan, pembatalan, audit) dilakukan server dengan service role.
-- Kebijakan ini adalah dasar yang harus dilengkapi dan diuji (lihat tasks/M2-rls.md).

create schema if not exists app;

create or replace function app.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.system_role = 'SUPER_ADMIN' and p.is_active)
$$;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Data master: dibaca semua pengguna login, diubah Super Admin.
do $$
declare t text;
begin
  foreach t in array array['organizational_units','positions','roles','permissions','role_permissions','letter_types',
                           'document_categories','letter_templates','number_series','master_bank'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin())', t || '_admin', t);
  end loop;
end $$;

create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_admin on profiles for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());
create policy user_assignments_read on user_assignments for select to authenticated using (true);
create policy user_assignments_admin on user_assignments for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- Surat: pembuat, penerima internal (setelah dikirim), penyetuju dan penandatangan yang terlibat.
-- Fungsi security definer menghindari rekursi kebijakan antara letters dan approval_steps.
create or replace function app.can_read_letter(p_letter uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from letters l where l.id = p_letter and (
      l.creator_id = auth.uid()
      or l.signer_id = auth.uid()
      or (l.recipient_user_id = auth.uid() and l.distribution_status in ('SENT', 'RECEIVED'))
      or exists (select 1 from approval_steps a where a.letter_id = l.id and a.approver_id = auth.uid() and a.status <> 'WAITING')
      or exists (select 1 from signature_requests s where s.letter_id = l.id and s.signer_id = auth.uid())))
$$;
create policy letters_read on letters for select to authenticated using (app.can_read_letter(id));
create policy letters_insert on letters for insert to authenticated with check (creator_id = auth.uid() and status = 'DRAFT');
create policy letters_update on letters for update to authenticated
  using (creator_id = auth.uid() and status in ('DRAFT', 'REVISION_REQUESTED'))
  with check (creator_id = auth.uid() and status in ('DRAFT', 'REVISION_REQUESTED'));
create policy letters_delete on letters for delete to authenticated using (creator_id = auth.uid() and status = 'DRAFT');

-- Tabel turunan surat: mengikuti akses ke surat induk.
do $$
declare t text;
begin
  foreach t in array array['letter_versions','letter_attachments','approval_steps','signature_requests','billing_details','billing_items','letter_distributions','dispositions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.can_read_letter(letter_id))', t || '_read', t);
  end loop;
end $$;
create policy letter_versions_write on letter_versions for insert to authenticated
  with check (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')));
create policy letter_attachments_write on letter_attachments for all to authenticated
  using (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')))
  with check (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')));
create policy billing_details_write on billing_details for all to authenticated
  using (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')))
  with check (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')));
create policy billing_items_write on billing_items for all to authenticated
  using (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')))
  with check (exists (select 1 from letters l where l.id = letter_id and l.creator_id = auth.uid() and l.status in ('DRAFT','REVISION_REQUESTED')));

-- Notifikasi: milik penerima. Log History: hanya Super Admin.
create policy notifications_own on notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_mark_read on notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy audit_logs_admin_read on audit_logs for select to authenticated using (app.is_super_admin());
create policy system_settings_read on system_settings for select to authenticated using (true);
create policy system_settings_admin on system_settings for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());
create policy push_subscriptions_own on push_subscriptions for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- Tanpa kebijakan (hanya service role): number_counters, number_issuances, cancellation_requests,
-- cancellation_authorizations, authority_delegations (baca oleh Super Admin ditambahkan pada tugas M2).

-- Fungsi penomoran tidak boleh dipanggil langsung oleh pengguna.
revoke all on function issue_letter_number(uuid, uuid, text) from public;
revoke all on function complete_number_issuance(uuid, uuid, uuid) from public;
revoke all on function cancel_numbered_letter(uuid, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function issue_letter_number(uuid, uuid, text) to service_role;
    grant execute on function complete_number_issuance(uuid, uuid, uuid) to service_role;
    grant execute on function cancel_numbered_letter(uuid, uuid, text) to service_role;
  end if;
end $$;
