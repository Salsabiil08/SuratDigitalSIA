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
