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
