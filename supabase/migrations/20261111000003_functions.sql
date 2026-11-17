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
