-- ========================================================
-- SIADocs PT Semen Indonesia Aceh (Blueprint R.04)
-- SETUP LENGKAP DATABASE SUPABASE (ONE-CLICK EXECUTION)
-- ========================================================

-- 0. Ekstensi & Reset Schema Bersih
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;
grant all on schema public to anon, authenticated, service_role;


-- ========================================================
-- MODUL: supabase/migrations/20261111000001_schema.sql
-- ========================================================

-- Skema SIADocs. Dibuat dari kamus data Blueprint R.03 (Bab 4.4).
-- Kolom dan tipe mengikuti blueprint. Pengetatan (NOT NULL, unik, indeks) ada di 20261111000002_constraints.sql.

create table profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  system_role text check (system_role in ('USER', 'SUPER_ADMIN')),
  is_active boolean,
  created_at timestamptz not null default now()
);

create table organizational_units (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text,
  parent_id uuid,
  head_assignment_id uuid,
  is_active boolean
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text,
  level integer,
  role_id uuid,
  is_active boolean
);

create table user_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  unit_id uuid,
  position_id uuid,
  supervisor_assignment_id uuid,
  is_official_signer boolean,
  start_date date,
  end_date date,
  is_active boolean
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text,
  description text
);

create table role_permissions (
  role_id uuid,
  permission_id uuid
);

create table authority_delegations (
  id uuid primary key default gen_random_uuid(),
  grantor_assignment_id uuid,
  grantee_assignment_id uuid,
  scope_unit_id uuid,
  authority_type text check (authority_type in ('LETTER_CANCELLATION')),
  basis_reference text,
  valid_from date,
  valid_until date,
  recorded_by uuid,
  is_active boolean
);

create table letter_types (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text,
  category text check (category in ('INTERNAL', 'EXTERNAL', 'BILLING')),
  series_basis text check (series_basis in ('SIGNER_POSITION', 'CREATOR_UNIT')),
  creator_unit_id uuid,
  required_attachment boolean,
  default_signature_count integer,
  is_active boolean
);

create table document_categories (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text,
  is_active boolean
);

create table letters (
  id uuid primary key default gen_random_uuid(),
  letter_type_id uuid,
  category_id uuid,
  creation_method text check (creation_method in ('EDITOR', 'UPLOAD')),
  status text check (status in ('DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'REJECTED', 'READY_TO_ISSUE', 'NUMBERED', 'CANCELLED')),
  signature_mode text check (signature_mode in ('IN_APP', 'EXTERNAL')),
  signature_status text check (signature_status in ('NOT_STARTED', 'NOT_REQUIRED', 'WAITING', 'UPLOADED', 'EXTERNAL')),
  distribution_status text check (distribution_status in ('NOT_SENT', 'SENT', 'RECEIVED')),
  subject text,
  creator_id uuid,
  creator_unit_id uuid,
  signer_id uuid,
  recipient_type text check (recipient_type in ('INTERNAL_USER', 'EXTERNAL')),
  recipient_user_id uuid,
  recipient_external_name text,
  recipient_external_org text,
  required_signature_count integer,
  current_version_id uuid,
  official_number text,
  issued_at timestamptz,
  status_reason text,
  copied_from_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table letter_versions (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  version_no integer,
  version_kind text check (version_kind in ('DRAFT', 'NUMBERED', 'SIGNED')),
  content_html text,
  storage_path text,
  file_format text check (file_format in ('PDF', 'DOCX')),
  file_hash text,
  number_position_mode text check (number_position_mode in ('TEMPLATE', 'MARKER', 'COORDINATE')),
  number_position jsonb,
  position_checked_at timestamptz,
  is_substantive_change boolean,
  created_by uuid,
  is_current boolean,
  created_at timestamptz not null default now()
);

create table letter_attachments (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  file_name text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table letter_templates (
  id uuid primary key default gen_random_uuid(),
  letter_type_id uuid,
  category_id uuid,
  unit_id uuid,
  name text,
  content_html text,
  version integer,
  is_active boolean
);

create table number_series (
  id uuid primary key default gen_random_uuid(),
  letter_type_id uuid,
  unit_id uuid,
  position_id uuid,
  pattern text,
  status text check (status in ('ACTIVE', 'INACTIVE'))
);

create table number_counters (
  id uuid primary key default gen_random_uuid(),
  series_id uuid,
  year integer,
  last_value integer
);

create table number_issuances (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  series_id uuid,
  year integer,
  sequence_number integer,
  official_number text,
  pattern_snapshot text,
  status text check (status in ('ALLOCATED', 'COMPLETED', 'CANCELLED')),
  idempotency_key text,
  issued_by uuid,
  issued_at timestamptz,
  verified_at timestamptz
);

create table approval_steps (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  cycle integer,
  step_order integer,
  approver_id uuid,
  step_source text check (step_source in ('CREATOR_SELECTED', 'SIGNER_CONFIRMATION', 'BILLING_SUBMITTER', 'BILLING_APPROVER')),
  status text check (status in ('WAITING', 'PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'SUPERSEDED')),
  decision_note text,
  version_id uuid,
  decided_at timestamptz
);

create table signature_requests (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  numbered_version_id uuid,
  signer_id uuid,
  sign_order integer,
  signer_role text,
  status text check (status in ('WAITING', 'PENDING', 'UPLOADED', 'SUPERSEDED', 'CANCELLED')),
  signed_version_id uuid,
  stamp_included boolean,
  uploaded_at timestamptz
);

create table cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  requested_by uuid,
  reason text,
  status text check (status in ('PENDING', 'EXECUTED', 'DECLINED', 'WITHDRAWN')),
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create table cancellation_authorizations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  authorizer_id uuid,
  authority_basis text check (authority_basis in ('UNIT_HEAD', 'DESIGNATED_OFFICIAL', 'SIGNING_OFFICIAL', 'SM_FINANCE', 'DIRECTOR')),
  delegation_id uuid,
  decision text check (decision in ('APPROVED', 'DECLINED')),
  note text,
  decided_at timestamptz
);

create table dispositions (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  giver_id uuid,
  recipient_id uuid,
  subject text,
  instruction text,
  priority text check (priority in ('NORMAL', 'IMPORTANT', 'URGENT')),
  due_date date,
  status text check (status in ('NEW', 'IN_PROGRESS', 'DONE')),
  follow_up_note text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table billing_details (
  letter_id uuid,
  bank_id uuid,
  payee_name text,
  account_number text,
  total_amount numeric(18,2),
  total_in_words text,
  sap_reference text
);

create table billing_items (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  line_no integer,
  description text,
  amount numeric(18,2)
);

create table master_bank (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_active boolean
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid,
  letter_id uuid,
  disposition_id uuid,
  event_type text,
  title text,
  is_read boolean,
  read_at timestamptz,
  channels_sent jsonb,
  created_at timestamptz not null default now()
);

create table letter_distributions (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid,
  method text check (method in ('IN_APP', 'EMAIL', 'PRINT', 'COURIER', 'HAND_DELIVERY', 'OTHER')),
  distributed_at timestamptz,
  recorded_by uuid,
  proof_attachment_id uuid,
  received_at timestamptz,
  received_by uuid,
  note text
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz,
  actor_id uuid,
  letter_id uuid,
  action text,
  entity_type text,
  entity_id text,
  status_before text,
  status_after text,
  official_number text,
  version_id uuid,
  reason text,
  metadata jsonb
);

create table system_settings (
  key text,
  value text,
  description text
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  endpoint text,
  keys text,
  created_at timestamptz not null default now()
);

-- Hubungan antar tabel
alter table profiles add constraint profiles_id_fk foreign key (id) references auth.users(id) on delete cascade;
alter table organizational_units add constraint organizational_units_parent_id_fkey foreign key (parent_id) references organizational_units(id);
alter table organizational_units add constraint organizational_units_head_assignment_id_fkey foreign key (head_assignment_id) references user_assignments(id);
alter table positions add constraint positions_role_id_fkey foreign key (role_id) references roles(id);
alter table user_assignments add constraint user_assignments_profile_id_fkey foreign key (profile_id) references profiles(id);
alter table user_assignments add constraint user_assignments_unit_id_fkey foreign key (unit_id) references organizational_units(id);
alter table user_assignments add constraint user_assignments_position_id_fkey foreign key (position_id) references positions(id);
alter table user_assignments add constraint user_assignments_supervisor_assignment_id_fkey foreign key (supervisor_assignment_id) references user_assignments(id);
alter table role_permissions add constraint role_permissions_role_id_fkey foreign key (role_id) references roles(id);
alter table role_permissions add constraint role_permissions_permission_id_fkey foreign key (permission_id) references permissions(id);
alter table authority_delegations add constraint authority_delegations_grantor_assignment_id_fkey foreign key (grantor_assignment_id) references user_assignments(id);
alter table authority_delegations add constraint authority_delegations_grantee_assignment_id_fkey foreign key (grantee_assignment_id) references user_assignments(id);
alter table authority_delegations add constraint authority_delegations_scope_unit_id_fkey foreign key (scope_unit_id) references organizational_units(id);
alter table authority_delegations add constraint authority_delegations_recorded_by_fkey foreign key (recorded_by) references profiles(id);
alter table letter_types add constraint letter_types_creator_unit_id_fkey foreign key (creator_unit_id) references organizational_units(id);
alter table letters add constraint letters_letter_type_id_fkey foreign key (letter_type_id) references letter_types(id);
alter table letters add constraint letters_category_id_fkey foreign key (category_id) references document_categories(id);
alter table letters add constraint letters_creator_id_fkey foreign key (creator_id) references profiles(id);
alter table letters add constraint letters_creator_unit_id_fkey foreign key (creator_unit_id) references organizational_units(id);
alter table letters add constraint letters_signer_id_fkey foreign key (signer_id) references profiles(id);
alter table letters add constraint letters_recipient_user_id_fkey foreign key (recipient_user_id) references profiles(id);
alter table letters add constraint letters_current_version_id_fkey foreign key (current_version_id) references letter_versions(id);
alter table letters add constraint letters_copied_from_id_fkey foreign key (copied_from_id) references letters(id);
alter table letter_versions add constraint letter_versions_letter_id_fkey foreign key (letter_id) references letters(id);
alter table letter_versions add constraint letter_versions_created_by_fkey foreign key (created_by) references profiles(id);
alter table letter_attachments add constraint letter_attachments_letter_id_fkey foreign key (letter_id) references letters(id);
alter table letter_attachments add constraint letter_attachments_uploaded_by_fkey foreign key (uploaded_by) references profiles(id);
alter table letter_templates add constraint letter_templates_letter_type_id_fkey foreign key (letter_type_id) references letter_types(id);
alter table letter_templates add constraint letter_templates_category_id_fkey foreign key (category_id) references document_categories(id);
alter table letter_templates add constraint letter_templates_unit_id_fkey foreign key (unit_id) references organizational_units(id);
alter table number_series add constraint number_series_letter_type_id_fkey foreign key (letter_type_id) references letter_types(id);
alter table number_series add constraint number_series_unit_id_fkey foreign key (unit_id) references organizational_units(id);
alter table number_series add constraint number_series_position_id_fkey foreign key (position_id) references positions(id);
alter table number_counters add constraint number_counters_series_id_fkey foreign key (series_id) references number_series(id);
alter table number_issuances add constraint number_issuances_letter_id_fkey foreign key (letter_id) references letters(id);
alter table number_issuances add constraint number_issuances_series_id_fkey foreign key (series_id) references number_series(id);
alter table number_issuances add constraint number_issuances_issued_by_fkey foreign key (issued_by) references profiles(id);
alter table approval_steps add constraint approval_steps_letter_id_fkey foreign key (letter_id) references letters(id);
alter table approval_steps add constraint approval_steps_approver_id_fkey foreign key (approver_id) references profiles(id);
alter table approval_steps add constraint approval_steps_version_id_fkey foreign key (version_id) references letter_versions(id);
alter table signature_requests add constraint signature_requests_letter_id_fkey foreign key (letter_id) references letters(id);
alter table signature_requests add constraint signature_requests_numbered_version_id_fkey foreign key (numbered_version_id) references letter_versions(id);
alter table signature_requests add constraint signature_requests_signer_id_fkey foreign key (signer_id) references profiles(id);
alter table signature_requests add constraint signature_requests_signed_version_id_fkey foreign key (signed_version_id) references letter_versions(id);
alter table cancellation_requests add constraint cancellation_requests_letter_id_fkey foreign key (letter_id) references letters(id);
alter table cancellation_requests add constraint cancellation_requests_requested_by_fkey foreign key (requested_by) references profiles(id);
alter table cancellation_authorizations add constraint cancellation_authorizations_request_id_fkey foreign key (request_id) references cancellation_requests(id);
alter table cancellation_authorizations add constraint cancellation_authorizations_authorizer_id_fkey foreign key (authorizer_id) references profiles(id);
alter table cancellation_authorizations add constraint cancellation_authorizations_delegation_id_fkey foreign key (delegation_id) references authority_delegations(id);
alter table dispositions add constraint dispositions_letter_id_fkey foreign key (letter_id) references letters(id);
alter table dispositions add constraint dispositions_giver_id_fkey foreign key (giver_id) references profiles(id);
alter table dispositions add constraint dispositions_recipient_id_fkey foreign key (recipient_id) references profiles(id);
alter table billing_details add constraint billing_details_bank_id_fkey foreign key (bank_id) references master_bank(id);
alter table billing_items add constraint billing_items_letter_id_fkey foreign key (letter_id) references letters(id);
alter table notifications add constraint notifications_recipient_id_fkey foreign key (recipient_id) references profiles(id);
alter table notifications add constraint notifications_letter_id_fkey foreign key (letter_id) references letters(id);
alter table notifications add constraint notifications_disposition_id_fkey foreign key (disposition_id) references dispositions(id);
alter table letter_distributions add constraint letter_distributions_letter_id_fkey foreign key (letter_id) references letters(id);
alter table letter_distributions add constraint letter_distributions_recorded_by_fkey foreign key (recorded_by) references profiles(id);
alter table letter_distributions add constraint letter_distributions_proof_attachment_id_fkey foreign key (proof_attachment_id) references letter_attachments(id);
alter table audit_logs add constraint audit_logs_actor_id_fkey foreign key (actor_id) references profiles(id);
alter table audit_logs add constraint audit_logs_letter_id_fkey foreign key (letter_id) references letters(id);
alter table audit_logs add constraint audit_logs_version_id_fkey foreign key (version_id) references letter_versions(id);
alter table push_subscriptions add constraint push_subscriptions_profile_id_fkey foreign key (profile_id) references profiles(id);


-- ========================================================
-- MODUL: supabase/migrations/20261111000002_constraints.sql
-- ========================================================

-- Pengetatan skema: kunci, keunikan, NOT NULL, default, indeks.
-- Aturan bisnis yang diwujudkan: nomor unik dan tidak dipakai ulang, satu penerbitan per surat,
-- nomor resmi hanya ada pada surat NUMBERED atau CANCELLED.

alter table role_permissions add primary key (role_id, permission_id);
alter table billing_details add primary key (letter_id);
alter table system_settings add primary key (key);

alter table roles add constraint roles_code_key unique (code);
alter table permissions add constraint permissions_code_key unique (code);
alter table positions add constraint positions_code_key unique (code);
alter table organizational_units add constraint organizational_units_code_key unique (code);
alter table letter_types add constraint letter_types_code_key unique (code);
alter table document_categories add constraint document_categories_code_key unique (code);

-- letters
alter table letters
  alter column letter_type_id set not null,
  alter column creation_method set not null,
  alter column status set not null, alter column status set default 'DRAFT',
  alter column signature_status set not null, alter column signature_status set default 'NOT_STARTED',
  alter column distribution_status set not null, alter column distribution_status set default 'NOT_SENT',
  alter column subject set not null,
  alter column creator_id set not null,
  alter column creator_unit_id set not null,
  alter column recipient_type set not null,
  alter column required_signature_count set not null, alter column required_signature_count set default 0,
  alter column created_at set default now(), alter column updated_at set default now();
alter table letters add constraint letters_official_number_key unique (official_number);
alter table letters add constraint letters_signature_count_chk check (required_signature_count between 0 and 2);
alter table letters add constraint letters_number_state_chk check (
  (official_number is null and issued_at is null and status <> 'NUMBERED')
  or (official_number is not null and issued_at is not null and status in ('NUMBERED', 'CANCELLED')));
alter table letters add constraint letters_distribution_chk check (distribution_status = 'NOT_SENT' or status = 'NUMBERED');

-- penomoran
alter table number_counters
  alter column series_id set not null, alter column year set not null,
  alter column last_value set not null, alter column last_value set default 0;
alter table number_counters add constraint number_counters_series_year_key unique (series_id, year);
alter table number_counters add constraint number_counters_last_value_chk check (last_value >= 0);

alter table number_issuances
  alter column letter_id set not null, alter column series_id set not null,
  alter column year set not null, alter column sequence_number set not null,
  alter column official_number set not null, alter column status set not null,
  alter column status set default 'ALLOCATED',
  alter column idempotency_key set not null, alter column issued_by set not null,
  alter column issued_at set not null, alter column issued_at set default now();
alter table number_issuances add constraint number_issuances_letter_key unique (letter_id);
alter table number_issuances add constraint number_issuances_seq_key unique (series_id, year, sequence_number);
alter table number_issuances add constraint number_issuances_number_key unique (official_number);
alter table number_issuances add constraint number_issuances_idem_key unique (idempotency_key);

alter table number_series
  alter column letter_type_id set not null, alter column pattern set not null,
  alter column status set not null, alter column status set default 'ACTIVE';

-- alur persetujuan, tagihan, lain-lain
alter table approval_steps
  alter column letter_id set not null, alter column cycle set not null, alter column step_order set not null,
  alter column approver_id set not null, alter column status set not null;
alter table billing_items alter column letter_id set not null, alter column line_no set not null,
  alter column description set not null, alter column amount set not null;
alter table billing_items add constraint billing_items_line_key unique (letter_id, line_no);
alter table billing_items add constraint billing_items_amount_chk check (amount > 0);
alter table audit_logs alter column occurred_at set not null, alter column occurred_at set default now(),
  alter column action set not null;
alter table notifications alter column recipient_id set not null, alter column is_read set not null,
  alter column is_read set default false;
alter table letter_versions alter column letter_id set not null;
alter table letter_attachments alter column letter_id set not null;

-- indeks untuk akses utama
create index letters_creator_idx on letters (creator_id, status);
create index letters_recipient_idx on letters (recipient_user_id) where recipient_user_id is not null;
create index letters_status_idx on letters (status);
create index letter_versions_letter_idx on letter_versions (letter_id);
create index approval_steps_approver_idx on approval_steps (approver_id, status);
create index approval_steps_letter_idx on approval_steps (letter_id, cycle);
create index signature_requests_letter_idx on signature_requests (letter_id);
create index notifications_recipient_idx on notifications (recipient_id, is_read);
create index audit_logs_letter_idx on audit_logs (letter_id, occurred_at);
create index dispositions_letter_idx on dispositions (letter_id);


-- ========================================================
-- MODUL: supabase/migrations/20261111000003_functions.sql
-- ========================================================

-- Fungsi inti: penomoran atomik, penyelesaian penerbitan, perlindungan data.

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger letters_updated_at before update on letters for each row execute function set_updated_at();

-- Audit hanya ditambah.
create or replace function audit_logs_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs bersifat append-only' using errcode = 'P0001'; end $$;
create trigger audit_logs_no_update before update or delete on audit_logs for each row execute function audit_logs_immutable();

-- Nomor resmi dan tanggal terbit tidak dapat diubah; surat bernomor tidak dapat dihapus.
create or replace function letters_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.official_number is not null then raise exception 'surat bernomor tidak dapat dihapus' using errcode = 'P0001'; end if;
    return old;
  end if;
  if old.official_number is not null and (new.official_number is distinct from old.official_number or new.issued_at is distinct from old.issued_at) then
    raise exception 'nomor resmi dan tanggal terbit tidak dapat diubah' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger letters_guard_trg before update or delete on letters for each row execute function letters_guard();

-- Penyusun nomor dari pola. Token: {URUT} {TGL} {BLN} {THN} {UNIT} {JABATAN} {JENIS}
create or replace function build_official_number(
  p_pattern text, p_seq integer, p_issued_at timestamptz,
  p_unit text, p_position text, p_type text) returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(p_pattern,
    '{URUT}', lpad(p_seq::text, 3, '0')),
    '{TGL}',  to_char(p_issued_at at time zone 'Asia/Jakarta', 'DD')),
    '{BLN}',  to_char(p_issued_at at time zone 'Asia/Jakarta', 'MM')),
    '{THN}',  to_char(p_issued_at at time zone 'Asia/Jakarta', 'YYYY')),
    '{UNIT}', coalesce(p_unit, '')),
    '{JABATAN}', coalesce(p_position, '')),
    '{JENIS}', coalesce(p_type, ''))
$$;

-- Alokasi nomor. Atomik, idempoten, tidak pernah menggunakan ulang nomor.
-- Hanya dipanggil dari server (service role). Nomor baru tidak diambil bila surat sudah memiliki penerbitan.
create or replace function issue_letter_number(p_letter_id uuid, p_actor uuid, p_idempotency_key text)
returns number_issuances language plpgsql as $$
declare
  v_letter letters; v_type letter_types; v_series number_series; v_issuance number_issuances;
  v_year integer; v_seq integer; v_now timestamptz := now();
  v_unit text; v_pos text; v_number text; v_signer_pos uuid;
begin
  select * into v_letter from letters where id = p_letter_id for update;
  if not found then raise exception 'LETTER_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Ulang yang aman: penerbitan yang sudah ada untuk surat ini dikembalikan apa adanya.
  select * into v_issuance from number_issuances where letter_id = p_letter_id;
  if found then
    if v_issuance.status = 'CANCELLED' then raise exception 'ISSUANCE_CANCELLED' using errcode = 'P0001'; end if;
    return v_issuance;
  end if;

  if v_letter.status <> 'READY_TO_ISSUE' then
    raise exception 'LETTER_NOT_READY: status %', v_letter.status using errcode = 'P0001';
  end if;

  select * into v_type from letter_types where id = v_letter.letter_type_id;

  if v_type.series_basis = 'SIGNER_POSITION' then
    select ua.position_id into v_signer_pos from user_assignments ua
      where ua.profile_id = v_letter.signer_id and ua.is_active order by ua.start_date desc nulls last limit 1;
    select * into v_series from number_series
      where letter_type_id = v_type.id and position_id = v_signer_pos and status = 'ACTIVE' limit 1;
  else
    select * into v_series from number_series
      where letter_type_id = v_type.id and unit_id = v_letter.creator_unit_id and status = 'ACTIVE' limit 1;
  end if;
  if v_series.id is null then raise exception 'NO_ACTIVE_SERIES' using errcode = 'P0001'; end if;

  v_year := extract(year from v_now at time zone 'Asia/Jakarta')::integer;
  insert into number_counters (series_id, year, last_value) values (v_series.id, v_year, 0)
    on conflict (series_id, year) do nothing;
  update number_counters set last_value = last_value + 1
    where series_id = v_series.id and year = v_year returning last_value into v_seq;

  select code into v_unit from organizational_units where id = v_letter.creator_unit_id;
  select p.code into v_pos from positions p where p.id = coalesce(v_signer_pos, v_series.position_id);
  v_number := build_official_number(v_series.pattern, v_seq, v_now, v_unit, v_pos, v_type.code);

  insert into number_issuances (letter_id, series_id, year, sequence_number, official_number, pattern_snapshot,
                                status, idempotency_key, issued_by, issued_at)
  values (p_letter_id, v_series.id, v_year, v_seq, v_number,
          jsonb_build_object('pattern', v_series.pattern, 'unit', v_unit, 'position', v_pos, 'type', v_type.code)::text,
          'ALLOCATED', p_idempotency_key, p_actor, v_now)
  returning * into v_issuance;

  insert into audit_logs (actor_id, letter_id, action, entity_type, entity_id, status_before, status_after, official_number)
  values (p_actor, p_letter_id, 'NUMBER_ALLOCATED', 'number_issuances', v_issuance.id::text, v_letter.status, v_letter.status, v_number);
  return v_issuance;
end $$;

-- Penyelesaian: dipanggil setelah dokumen bernomor dibuat dan nomor pada dokumen diperiksa sama dengan database.
create or replace function complete_number_issuance(p_issuance_id uuid, p_version_id uuid, p_actor uuid)
returns letters language plpgsql as $$
declare v_iss number_issuances; v_letter letters; v_sig_status text;
begin
  select * into v_iss from number_issuances where id = p_issuance_id for update;
  if not found then raise exception 'ISSUANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_letter from letters where id = v_iss.letter_id for update;
  if v_iss.status = 'COMPLETED' then return v_letter; end if;
  if v_iss.status <> 'ALLOCATED' then raise exception 'ISSUANCE_NOT_ALLOCATED' using errcode = 'P0001'; end if;

  v_sig_status := case
    when v_letter.required_signature_count = 0 then 'NOT_REQUIRED'
    when v_letter.signature_mode = 'IN_APP' then 'WAITING'
    when v_letter.signature_mode = 'EXTERNAL' then 'EXTERNAL'
    else 'NOT_REQUIRED' end;

  update number_issuances set status = 'COMPLETED', verified_at = now() where id = p_issuance_id;
  update letters set status = 'NUMBERED', official_number = v_iss.official_number, issued_at = v_iss.issued_at,
         signature_status = v_sig_status, current_version_id = coalesce(p_version_id, current_version_id)
   where id = v_letter.id returning * into v_letter;

  insert into audit_logs (actor_id, letter_id, action, entity_type, entity_id, status_before, status_after, official_number, version_id)
  values (p_actor, v_letter.id, 'NUMBER_ISSUED', 'letters', v_letter.id::text, 'READY_TO_ISSUE', 'NUMBERED', v_iss.official_number, p_version_id);
  return v_letter;
end $$;

-- Pembatalan surat bernomor: nomor tetap tersimpan dan tidak pernah dipakai ulang.
create or replace function cancel_numbered_letter(p_letter_id uuid, p_actor uuid, p_reason text)
returns letters language plpgsql as $$
declare v_letter letters;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_letter from letters where id = p_letter_id for update;
  if v_letter.status <> 'NUMBERED' then raise exception 'LETTER_NOT_NUMBERED' using errcode = 'P0001'; end if;
  update number_issuances set status = 'CANCELLED' where letter_id = p_letter_id;
  update letters set status = 'CANCELLED', status_reason = p_reason where id = p_letter_id returning * into v_letter;
  insert into audit_logs (actor_id, letter_id, action, entity_type, entity_id, status_before, status_after, official_number, reason)
  values (p_actor, p_letter_id, 'LETTER_CANCELLED', 'letters', p_letter_id::text, 'NUMBERED', 'CANCELLED', v_letter.official_number, p_reason);
  return v_letter;
end $$;


-- ========================================================
-- MODUL: supabase/migrations/20261111000004_rls.sql
-- ========================================================

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


-- ========================================================
-- MODUL: supabase/migrations/20261114000001_r04.sql
-- ========================================================

-- Migrasi R.04: Penyesuaian skema dan fungsi penomoran satu transaksi (Blueprint R.04)

-- 1. letters: Tambah source ('CREATE' atau 'UPLOAD') dan nonaktifkan dependensi status pengiriman
alter table letters add column if not exists source text check (source in ('CREATE', 'UPLOAD')) default 'CREATE';
alter table letters alter column distribution_status drop not null;
alter table letters alter column creation_method drop not null;
alter table letters drop constraint if exists letters_distribution_chk;

-- 2. number_issuances: Perbarui status constraint agar mendukung 'ISSUED'
alter table number_issuances drop constraint if exists number_issuances_status_check;
alter table number_issuances add constraint number_issuances_status_check
  check (status in ('ISSUED', 'ALLOCATED', 'COMPLETED', 'CANCELLED'));
alter table number_issuances alter column status set default 'ISSUED';

-- 3. dispositions: Tambah requires_letter, letter_id FK, followup_note, dan constraint penyelesaian
alter table dispositions add column if not exists requires_letter boolean not null default false;
alter table dispositions add column if not exists followup_note text;

alter table dispositions drop constraint if exists dispositions_letter_id_fkey;
alter table dispositions add constraint dispositions_letter_id_fkey
  foreign key (letter_id) references letters(id) on delete set null;

-- Trigger penyelesaian disposisi: status DONE ditolak bila requires_letter=true dan surat terkait bukan NUMBERED
create or replace function check_disposition_completion() returns trigger language plpgsql as $$
declare
  v_letter_status text;
begin
  if new.status = 'DONE' and new.requires_letter = true then
    if new.letter_id is null then
      raise exception 'DISPOSITION_REQUIRES_LETTER: surat belum dikaitkan' using errcode = 'P0001';
    end if;
    select status into v_letter_status from letters where id = new.letter_id;
    if v_letter_status is distinct from 'NUMBERED' then
      raise exception 'DISPOSITION_LETTER_NOT_NUMBERED: status surat %', coalesce(v_letter_status, 'TIDAK_DITEMUKAN') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists disposition_completion_trg on dispositions;
create trigger disposition_completion_trg
  before insert or update on dispositions
  for each row execute function check_disposition_completion();

-- 4. Fungsi penomoran atomik satu transaksi (R.04):
-- READY_TO_ISSUE langsung bertransisi menjadi NUMBERED, mengisi official_number dan audit dalam 1 transaksi
create or replace function issue_letter_number(p_letter_id uuid, p_actor uuid, p_idempotency_key text)
returns number_issuances language plpgsql as $$
declare
  v_letter letters;
  v_type letter_types;
  v_series number_series;
  v_issuance number_issuances;
  v_year integer;
  v_seq integer;
  v_now timestamptz := now();
  v_unit text;
  v_pos text;
  v_number text;
  v_signer_pos uuid;
  v_sig_status text;
begin
  -- Kunci baris surat
  select * into v_letter from letters where id = p_letter_id for update;
  if not found then raise exception 'LETTER_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Idempoten: bila sudah pernah diterbitkan untuk surat ini, kembalikan record yang sama
  select * into v_issuance from number_issuances where letter_id = p_letter_id;
  if found then
    if v_issuance.status = 'CANCELLED' then
      raise exception 'ISSUANCE_CANCELLED' using errcode = 'P0001';
    end if;
    return v_issuance;
  end if;

  -- Nomor hanya dapat diterbitkan bila berstatus READY_TO_ISSUE
  if v_letter.status <> 'READY_TO_ISSUE' then
    raise exception 'LETTER_NOT_READY: status %', v_letter.status using errcode = 'P0001';
  end if;

  select * into v_type from letter_types where id = v_letter.letter_type_id;

  if v_type.series_basis = 'SIGNER_POSITION' then
    select ua.position_id into v_signer_pos from user_assignments ua
      where ua.profile_id = v_letter.signer_id and ua.is_active order by ua.start_date desc nulls last limit 1;
    select * into v_series from number_series
      where letter_type_id = v_type.id and position_id = v_signer_pos and status = 'ACTIVE' limit 1;
  else
    select * into v_series from number_series
      where letter_type_id = v_type.id and unit_id = v_letter.creator_unit_id and status = 'ACTIVE' limit 1;
  end if;
  if v_series.id is null then raise exception 'NO_ACTIVE_SERIES' using errcode = 'P0001'; end if;

  -- Counter per seri dan tahun Asia/Jakarta
  v_year := extract(year from v_now at time zone 'Asia/Jakarta')::integer;
  insert into number_counters (series_id, year, last_value) values (v_series.id, v_year, 0)
    on conflict (series_id, year) do nothing;
  update number_counters set last_value = last_value + 1
    where series_id = v_series.id and year = v_year returning last_value into v_seq;

  select code into v_unit from organizational_units where id = v_letter.creator_unit_id;
  select p.code into v_pos from positions p where p.id = coalesce(v_signer_pos, v_series.position_id);
  v_number := build_official_number(v_series.pattern, v_seq, v_now, v_unit, v_pos, v_type.code);

  -- Hitung status tanda tangan
  v_sig_status := case
    when v_letter.required_signature_count = 0 then 'NOT_REQUIRED'
    when v_letter.signature_mode = 'IN_APP' then 'WAITING'
    when v_letter.signature_mode = 'EXTERNAL' then 'EXTERNAL'
    else 'NOT_REQUIRED' end;

  -- 1 Transaksi: Simpan number_issuances
  insert into number_issuances (
    letter_id, series_id, year, sequence_number, official_number, pattern_snapshot,
    status, idempotency_key, issued_by, issued_at, verified_at
  )
  values (
    p_letter_id, v_series.id, v_year, v_seq, v_number,
    jsonb_build_object('pattern', v_series.pattern, 'unit', v_unit, 'position', v_pos, 'type', v_type.code)::text,
    'ISSUED', p_idempotency_key, p_actor, v_now, v_now
  )
  returning * into v_issuance;

  -- 1 Transaksi: Update letters menjadi NUMBERED
  update letters set
    status = 'NUMBERED',
    official_number = v_number,
    issued_at = v_now,
    signature_status = v_sig_status,
    updated_at = v_now
  where id = v_letter.id;

  -- 1 Transaksi: Catat audit_logs
  insert into audit_logs (
    actor_id, letter_id, action, entity_type, entity_id, status_before, status_after, official_number
  )
  values (
    p_actor, p_letter_id, 'NUMBER_ISSUED', 'letters', v_letter.id::text, 'READY_TO_ISSUE', 'NUMBERED', v_number
  );

  return v_issuance;
end $$;

-- 5. Kompatibilitas fungsi lama complete_number_issuance (di-bypass pada R.04)
create or replace function complete_number_issuance(p_issuance_id uuid, p_version_id uuid, p_actor uuid)
returns letters language plpgsql as $$
declare
  v_iss number_issuances;
  v_letter letters;
begin
  select * into v_iss from number_issuances where id = p_issuance_id;
  if not found then raise exception 'ISSUANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_letter from letters where id = v_iss.letter_id;
  return v_letter;
end $$;



-- ========================================================
-- MODUL: supabase/migrations/20261114000002_m2_rls.sql
-- ========================================================

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



-- ========================================================
-- MODUL: supabase/seed.sql
-- ========================================================

-- Data awal contoh SIADocs (Blueprint R.04).
-- Kode, nama unit, jabatan, dan pengguna adalah contoh konfigurasi.
-- Master Organisasi dikelola oleh Super Admin secara dinamis.

-- 1. Peran dan kewenangan
insert into roles (code, name) values
  ('DIREKTUR_UTAMA','Direktur Utama'),
  ('SENIOR_MANAGER','Senior Manager'),
  ('GM_KEPALA_UNIT','GM/Kepala Unit atau Departemen'),
  ('STAFF_PIC','Staff/PIC')
on conflict (code) do nothing;

insert into permissions (code, description) values
  ('letter.create','Membuat surat'),
  ('letter.issue_number','Menerbitkan nomor surat'),
  ('letter.approve','Memberi persetujuan'),
  ('letter.sign_upload','Mengunggah dokumen bertanda tangan'),
  ('letter.cancel_authorize','Otorisasi pembatalan'),
  ('disposition.create','Membuat disposisi')
on conflict (code) do nothing;

-- 2. Jabatan
insert into positions (code, name, level, role_id)
select v.code, v.name, v.level, r.id
from (values
  ('DIR','Direktur Utama',4,'DIREKTUR_UTAMA'),
  ('SM','Senior Manager',3,'SENIOR_MANAGER'),
  ('GM','GM/Kepala Unit atau Departemen',2,'GM_KEPALA_UNIT'),
  ('STF','Staff/PIC',1,'STAFF_PIC')
) v(code,name,level,role)
join roles r on r.code = v.role
on conflict (code) do nothing;

update positions set is_active = true;

-- 3. Unit organisasi contoh
insert into organizational_units (code, name, is_active) values
  ('ACH','Accounting',true),
  ('RPT','Reporting',true),
  ('FIN','Finance',true)
on conflict (code) do nothing;

-- 4. Kategori dokumen
insert into document_categories (code, name, is_active) values
  ('PERMOHONAN','Permohonan',true),
  ('PEMBERITAHUAN','Pemberitahuan',true),
  ('LAPORAN','Laporan',true)
on conflict (code) do nothing;

-- 5. Jenis surat (satu entitas letters)
insert into letter_types (code, name, category, series_basis, required_attachment, default_signature_count, is_active)
values
  ('IN','Surat Internal','INTERNAL','CREATOR_UNIT',false,0,true),
  ('KRE','Surat Eksternal','EXTERNAL','SIGNER_POSITION',false,1,true)
on conflict (code) do nothing;

insert into letter_types (code, name, category, series_basis, creator_unit_id, required_attachment, default_signature_count, is_active)
select 'Tag','Surat Pengantar Tagihan','BILLING','CREATOR_UNIT', u.id, true, 2, true
from organizational_units u where u.code = 'FIN'
on conflict (code) do nothing;

-- 6. Seri nomor awal (pola resmi blueprint R.04)
insert into number_series (letter_type_id, position_id, pattern, status)
select t.id, p.id, '{URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}', 'ACTIVE'
from letter_types t, positions p
where t.code='KRE' and p.code in ('DIR','SM')
on conflict do nothing;

insert into number_series (letter_type_id, unit_id, pattern, status)
select t.id, u.id, '{URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}', 'ACTIVE'
from letter_types t, organizational_units u
where t.code='Tag' and u.code='FIN'
on conflict do nothing;

insert into number_series (letter_type_id, unit_id, pattern, status)
select t.id, u.id, '{URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}', 'ACTIVE'
from letter_types t, organizational_units u
where t.code='IN'
on conflict do nothing;

-- 7. Pengaturan sistem
insert into system_settings (key, value, description) values
  ('attachment_max_mb','25','Batas ukuran total lampiran per surat (MB), nilai awal'),
  ('timezone','Asia/Jakarta','Zona waktu penerbitan nomor')
on conflict (key) do nothing;

-- 8. Pengguna demo per peran dan penugasan contoh
do $$
declare
  u_admin uuid := 'a0000000-0000-0000-0000-000000000001';
  u_dir   uuid := 'a0000000-0000-0000-0000-000000000002';
  u_sm    uuid := 'a0000000-0000-0000-0000-000000000003';
  u_gm    uuid := 'a0000000-0000-0000-0000-000000000004';
  u_stf_a uuid := 'a0000000-0000-0000-0000-000000000005';
  u_stf_f uuid := 'a0000000-0000-0000-0000-000000000006';

  pos_dir uuid; pos_sm uuid; pos_gm uuid; pos_stf uuid;
  unit_ach uuid; unit_fin uuid; unit_rpt uuid;
  asg_dir uuid; asg_sm uuid; asg_gm uuid;
begin
  select id into pos_dir from positions where code = 'DIR';
  select id into pos_sm from positions where code = 'SM';
  select id into pos_gm from positions where code = 'GM';
  select id into pos_stf from positions where code = 'STF';

  select id into unit_ach from organizational_units where code = 'ACH';
  select id into unit_fin from organizational_units where code = 'FIN';
  select id into unit_rpt from organizational_units where code = 'RPT';

  -- Auth users (bila ada skema auth)
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email) values
      (u_admin, 'admin@sia.co.id'),
      (u_dir, 'dirut@sia.co.id'),
      (u_sm, 'sm.finance@sia.co.id'),
      (u_gm, 'gm.accounting@sia.co.id'),
      (u_stf_a, 'staff.accounting@sia.co.id'),
      (u_stf_f, 'staff.finance@sia.co.id')
    on conflict (id) do nothing;
  end if;

  -- Profil pengguna
  insert into profiles (id, full_name, email, system_role, is_active) values
    (u_admin, 'Super Admin SIADocs', 'admin@sia.co.id', 'SUPER_ADMIN', true),
    (u_dir, 'Budi Hartono (Direktur Utama)', 'dirut@sia.co.id', 'USER', true),
    (u_sm, 'Siti Rahma (Senior Manager Finance)', 'sm.finance@sia.co.id', 'USER', true),
    (u_gm, 'Ahmad Fauzi (GM Accounting)', 'gm.accounting@sia.co.id', 'USER', true),
    (u_stf_a, 'Rina Dewi (Staff Accounting)', 'staff.accounting@sia.co.id', 'USER', true),
    (u_stf_f, 'Doni Pratama (Staff Finance)', 'staff.finance@sia.co.id', 'USER', true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    system_role = excluded.system_role,
    is_active = excluded.is_active;

  -- Hapus penugasan lama untuk pengguna demo agar seed idempoten
  delete from user_assignments where profile_id in (u_dir, u_sm, u_gm, u_stf_a, u_stf_f);

  -- 1. Direktur Utama (Penandatangan resmi level 4)
  insert into user_assignments (profile_id, unit_id, position_id, is_official_signer, start_date, is_active)
  values (u_dir, unit_ach, pos_dir, true, current_date - interval '1 year', true)
  returning id into asg_dir;

  -- 2. Senior Manager Finance (Penandatangan resmi level 3)
  insert into user_assignments (profile_id, unit_id, position_id, supervisor_assignment_id, is_official_signer, start_date, is_active)
  values (u_sm, unit_fin, pos_sm, asg_dir, true, current_date - interval '1 year', true)
  returning id into asg_sm;

  -- 3. GM Accounting (Kepala unit level 2)
  insert into user_assignments (profile_id, unit_id, position_id, supervisor_assignment_id, is_official_signer, start_date, is_active)
  values (u_gm, unit_ach, pos_gm, asg_dir, false, current_date - interval '1 year', true)
  returning id into asg_gm;

  -- 4. Staff Accounting
  insert into user_assignments (profile_id, unit_id, position_id, supervisor_assignment_id, is_official_signer, start_date, is_active)
  values (u_stf_a, unit_ach, pos_stf, asg_gm, false, current_date - interval '6 months', true);

  -- 5. Staff Finance
  insert into user_assignments (profile_id, unit_id, position_id, supervisor_assignment_id, is_official_signer, start_date, is_active)
  values (u_stf_f, unit_fin, pos_stf, asg_sm, false, current_date - interval '6 months', true);

  -- Hubungkan kepala unit
  update organizational_units set head_assignment_id = asg_gm where id = unit_ach;
  update organizational_units set head_assignment_id = asg_sm where id = unit_fin;

end $$;


-- ========================================================
-- POST-SETUP: GRANT PRIVILEGES TO SUPABASE POSTGREST
-- ========================================================
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;
