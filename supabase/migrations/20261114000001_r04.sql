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

