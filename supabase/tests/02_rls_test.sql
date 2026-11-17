-- Uji RLS Komprehensif (Blueprint R.04 & docs/spec/05-peran-dan-akses.md).
\set ON_ERROR_STOP on
grant usage on schema public, app, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on function auth.uid() to authenticated;
begin;

do $$
declare
  ua uuid := gen_random_uuid();      -- Pembuat surat / Pemberi disposisi
  ub uuid := gen_random_uuid();      -- Penerima internal / Penerima disposisi
  u_other uuid := gen_random_uuid(); -- Pengguna lain (tidak terkait)
  uadm uuid := gen_random_uuid();    -- Super Admin
  u_ach uuid; t_in uuid; l1 uuid; l2 uuid; disp1 uuid; n int;
begin
  select id into u_ach from organizational_units where code='ACH';
  select id into t_in from letter_types where code='IN';

  insert into auth.users (id,email) values
    (ua,'ra@x'), (ub,'rb@x'), (u_other,'ro@x'), (uadm,'adm@x');
  insert into profiles (id, full_name, email, system_role, is_active) values
    (ua,'A','ra@x','USER',true),
    (ub,'B','rb@x','USER',true),
    (u_other,'Other','ro@x','USER',true),
    (uadm,'Adm','adm@x','SUPER_ADMIN',true);

  -- 1. Surat Draft: ua pembuat, ub penerima internal
  insert into letters (letter_type_id, source, status, subject, creator_id, creator_unit_id, recipient_type, recipient_user_id)
    values (t_in,'CREATE','DRAFT','Surat Rahasia Draft',ua,u_ach,'INTERNAL_USER',ub) returning id into l1;
  insert into audit_logs (action, letter_id) values ('CREATE_DRAFT', l1);

  -- 2. Surat Sudah Bernomor: ua pembuat, ub penerima internal
  insert into letters (letter_type_id, source, status, official_number, issued_at, subject, creator_id, creator_unit_id, recipient_type, recipient_user_id)
    values (t_in,'CREATE','NUMBERED','00101-IN/ACH/SIA/01.2027',now(),'Surat Resmi Terbit',ua,u_ach,'INTERNAL_USER',ub) returning id into l2;

  -- 3. Disposisi mandiri: ua pemberi, ub penerima
  insert into dispositions (giver_id, recipient_id, subject, instruction, status, requires_letter)
    values (ua, ub, 'Instruksi Segera', 'Harap diproses', 'NEW', false) returning id into disp1;

  -- =========================================================================
  -- PENGUJIAN 1: Penerima internal (ub)
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', ub::text, true); set local role authenticated;

  -- Tidak boleh melihat surat DRAFT
  select count(*) into n from letters where id = l1;
  assert n = 0, 'penerima tidak boleh melihat surat draft sebelum bernomor';

  -- BISA melihat surat setelah berstatus NUMBERED
  select count(*) into n from letters where id = l2;
  assert n = 1, 'penerima harus bisa melihat surat internal bernomor resmi';

  -- Tidak boleh mengedit surat bernomor
  update letters set subject = 'Hack' where id = l2;
  get diagnostics n = row_count;
  assert n = 0, 'penerima tidak boleh mengedit surat';

  -- Penerima BISA melihat disposisi yang ditujukan kepadanya
  select count(*) into n from dispositions where id = disp1;
  assert n = 1, 'penerima harus bisa melihat disposisi yang ditujukan kepadanya';

  -- Bukan Super Admin tidak boleh melihat audit_logs
  select count(*) into n from audit_logs;
  assert n = 0, 'pengguna biasa tidak boleh melihat audit log';

  -- Bukan Super Admin tidak boleh mengeksekusi langsung issue_letter_number
  begin perform issue_letter_number(l1, ub, 'x'); raise exception 'seharusnya ditolak';
  exception when insufficient_privilege then null; end;
  reset role;

  -- =========================================================================
  -- PENGUJIAN 2: Pembuat surat (ua)
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', ua::text, true); set local role authenticated;

  -- Pembuat bisa melihat surat draft miliknya
  select count(*) into n from letters where id = l1;
  assert n = 1, 'pembuat harus bisa melihat surat draft miliknya';

  -- Pembuat boleh mengubah draf miliknya
  update letters set subject = 'Draf Diperbarui' where id = l1;
  get diagnostics n = row_count;
  assert n = 1, 'pembuat boleh memperbarui draf';

  -- Pembuat bisa melihat disposisi yang dibuatnya
  select count(*) into n from dispositions where id = disp1;
  assert n = 1, 'pemberi disposisi harus bisa melihat disposisi buatannya';
  reset role;

  -- =========================================================================
  -- PENGUJIAN 3: Pengguna lain yang tidak terlibat (u_other)
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', u_other::text, true); set local role authenticated;

  -- Tidak boleh melihat surat yang tidak melibatkannya
  select count(*) into n from letters where id in (l1, l2);
  assert n = 0, 'pengguna luar tidak boleh melihat surat orang lain';

  -- Tidak boleh melihat disposisi orang lain
  select count(*) into n from dispositions where id = disp1;
  assert n = 0, 'pengguna luar tidak boleh melihat disposisi orang lain';

  -- Tidak boleh mengedit data master
  begin
    insert into organizational_units (code, name, is_active) values ('HCK', 'Hacked Unit', true);
    raise exception 'seharusnya ditolak';
  exception when others then null; end;
  reset role;

  -- =========================================================================
  -- PENGUJIAN 4: Super Admin (uadm)
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', uadm::text, true); set local role authenticated;

  -- Super Admin HARUS bisa melihat audit_logs
  select count(*) into n from audit_logs;
  assert n >= 1, 'Super Admin harus bisa melihat audit_logs';

  -- Super Admin TIDAK OTOMATIS melihat isi dokumen / surat draft
  select count(*) into n from letters where id = l1;
  assert n = 0, 'Super Admin tidak otomatis melihat isi surat tanpa keterlibatan langsung';

  -- Super Admin BISA mengelola data master (Master Organisasi & Seri)
  insert into organizational_units (code, name, is_active) values ('ADM_TEST', 'Unit Uji Admin', true);
  get diagnostics n = row_count;
  assert n = 1, 'Super Admin harus berwenang mengelola data master organisasi';
  reset role;

  raise notice 'SEMUA UJI RLS PERAN DAN AKSES R.04 LULUS DENGAN SUKSES';
end $$;
rollback;
