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
