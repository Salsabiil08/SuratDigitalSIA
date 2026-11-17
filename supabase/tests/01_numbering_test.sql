-- Uji penomoran atomik satu transaksi dan aturan data (Blueprint R.04).
\set ON_ERROR_STOP on
begin;
create temp table ctx (k text primary key, v text);

do $$
declare
  u_fin uuid; u_ach uuid; p_dir uuid; p_stf uuid; t_in uuid; t_kre uuid; t_tag uuid;
  prof_a uuid := gen_random_uuid(); prof_dir uuid := gen_random_uuid();
  l1 uuid; l2 uuid; l3 uuid; l4 uuid;
  i1 number_issuances; i1b number_issuances; i2 number_issuances; i3 number_issuances;
  lt letters;
  disp_id1 uuid; disp_id2 uuid; disp_id3 uuid;
begin
  select id into u_fin from organizational_units where code='FIN';
  select id into u_ach from organizational_units where code='ACH';
  select id into p_dir from positions where code='DIR';
  select id into p_stf from positions where code='STF';
  select id into t_in from letter_types where code='IN';
  select id into t_kre from letter_types where code='KRE';
  select id into t_tag from letter_types where code='Tag';

  insert into auth.users (id, email) values (prof_a,'a@x'), (prof_dir,'d@x');
  insert into profiles (id, full_name, email, system_role, is_active) values
    (prof_a,'A','a@x','USER',true), (prof_dir,'Dir','d@x','USER',true);
  insert into user_assignments (profile_id, unit_id, position_id, is_official_signer, start_date, is_active) values
    (prof_a, u_ach, p_stf, false, current_date, true), (prof_dir, u_ach, p_dir, true, current_date, true);

  -- Surat internal siap terbit (R.04: default source 'CREATE')
  insert into letters (letter_type_id, source, status, subject, creator_id, creator_unit_id, recipient_type)
    values (t_in,'CREATE','READY_TO_ISSUE','Uji 1',prof_a,u_ach,'INTERNAL_USER') returning id into l1;
  insert into letters (letter_type_id, source, status, subject, creator_id, creator_unit_id, recipient_type)
    values (t_in,'CREATE','READY_TO_ISSUE','Uji 2',prof_a,u_ach,'INTERNAL_USER') returning id into l2;
  insert into letters (letter_type_id, source, status, subject, creator_id, creator_unit_id, signer_id, recipient_type, required_signature_count, signature_mode)
    values (t_kre,'UPLOAD','READY_TO_ISSUE','Uji 3',prof_a,u_ach,prof_dir,'EXTERNAL',1,'IN_APP') returning id into l3;
  insert into letters (letter_type_id, source, status, subject, creator_id, creator_unit_id, recipient_type)
    values (t_in,'CREATE','DRAFT','Draf',prof_a,u_ach,'INTERNAL_USER') returning id into l4;

  -- 1. Draf tidak bisa diberi nomor
  begin perform issue_letter_number(l4, prof_a, 'k-draft'); raise exception 'seharusnya gagal';
  exception when sqlstate 'P0001' then null; end;
  assert (select count(*) from number_issuances where letter_id = l4) = 0, 'draf tidak boleh punya nomor';

  -- 2. Penerbitan satu transaksi (R.04): READY_TO_ISSUE langsung menjadi NUMBERED
  i1 := issue_letter_number(l1, prof_a, 'k1');
  assert i1.sequence_number = 1, 'urut pertama harus 1';
  assert i1.official_number ~ '^001[0-9]{2}-IN/ACH/SIA/[0-9]{2}\.[0-9]{4}$', 'format internal salah: ' || i1.official_number;
  assert i1.status = 'ISSUED', 'status penerbitan harus ISSUED';
  assert (select status from letters where id = l1) = 'NUMBERED', 'surat harus langsung berstatus NUMBERED';
  assert (select official_number from letters where id = l1) = i1.official_number, 'nomor resmi harus terisi pada surat';

  -- 3. Idempoten: panggilan ulang mengembalikan penerbitan yang sama tanpa menaikkan counter
  i1b := issue_letter_number(l1, prof_a, 'k1-retry');
  assert i1b.id = i1.id and i1b.official_number = i1.official_number, 'ulang harus mengembalikan nomor yang sama';
  assert (select last_value from number_counters c join number_series s on s.id=c.series_id join letter_types t on t.id=s.letter_type_id where t.code='IN') = 1, 'counter tidak boleh naik';

  -- 4. Nomor kedua pada seri yang sama berurutan
  i2 := issue_letter_number(l2, prof_a, 'k2');
  assert i2.sequence_number = 2 and i2.official_number ~ '^002', 'urut kedua harus 002';
  assert (select status from letters where id = l2) = 'NUMBERED';

  -- 5. Seri eksternal memakai jabatan penandatangan (DIR), status pengesahan WAITING (IN_APP)
  i3 := issue_letter_number(l3, prof_a, 'k3');
  assert i3.official_number ~ '^001[0-9]{2}/KRE\.DIR/[0-9]{2}\.[0-9]{4}$', 'format eksternal salah: ' || i3.official_number;
  select * into lt from letters where id = l3;
  assert lt.status = 'NUMBERED' and lt.signature_status = 'WAITING', 'status pengesahan harus WAITING';

  -- 6. Nomor tidak dapat diubah dan surat bernomor tidak dapat dihapus
  begin update letters set official_number = 'X' where id = l3; raise exception 'seharusnya gagal';
  exception when sqlstate 'P0001' then null; end;
  begin delete from letters where id = l3; raise exception 'seharusnya gagal';
  exception when sqlstate 'P0001' then null; end;

  -- 7. Batal surat bernomor: nomor tetap tersimpan, tidak dipakai ulang
  lt := cancel_numbered_letter(l3, prof_a, 'uji pembatalan');
  assert lt.status = 'CANCELLED' and lt.official_number = i3.official_number;
  assert (select status from number_issuances where id = i3.id) = 'CANCELLED';
  begin perform cancel_numbered_letter(l3, prof_a, ''); raise exception 'seharusnya gagal';
  exception when sqlstate 'P0001' then null; end;

  -- 8. Audit logs: NUMBER_ISSUED dicatat dalam transaksi penerbitan
  assert (select count(*) from audit_logs where action = 'NUMBER_ISSUED') >= 3;

  -- 9. Aturan Disposisi (R.04):
  -- Disposisi mandiri (requires_letter = false) dapat Selesai tanpa surat
  insert into dispositions (giver_id, recipient_id, subject, instruction, status, requires_letter)
    values (prof_dir, prof_a, 'Disposisi 1', 'Kerjakan', 'IN_PROGRESS', false) returning id into disp_id1;
  update dispositions set status = 'DONE', follow_up_note = 'Selesai' where id = disp_id1;
  assert (select status from dispositions where id = disp_id1) = 'DONE';

  -- Disposisi dengan requires_letter = true TIDAK BOLEH Selesai bila surat belum NUMBERED (misal masih DRAFT)
  insert into dispositions (giver_id, recipient_id, letter_id, subject, instruction, status, requires_letter)
    values (prof_dir, prof_a, l4, 'Disposisi 2', 'Tindaklanjuti', 'IN_PROGRESS', true) returning id into disp_id2;
  begin
    update dispositions set status = 'DONE', follow_up_note = 'Selesai' where id = disp_id2;
    raise exception 'seharusnya gagal karena surat masih DRAFT';
  exception when sqlstate 'P0001' then null; end;

  -- Disposisi dengan requires_letter = true BERHASIL Selesai bila surat sudah NUMBERED
  insert into dispositions (giver_id, recipient_id, letter_id, subject, instruction, status, requires_letter)
    values (prof_dir, prof_a, l1, 'Disposisi 3', 'Tindaklanjuti', 'IN_PROGRESS', true) returning id into disp_id3;
  update dispositions set status = 'DONE', follow_up_note = 'Selesai tindak lanjut' where id = disp_id3;
  assert (select status from dispositions where id = disp_id3) = 'DONE';

  raise notice 'SEMUA UJI PENOMORAN DAN DISPOSISI R.04 LULUS';
end $$;
rollback;
