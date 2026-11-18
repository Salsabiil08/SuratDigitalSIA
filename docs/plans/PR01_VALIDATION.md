# PR-01 — otorisasi notifikasi/event dan kerangka status

Tanggal: 18 November 2026 (WIB). Repository `Salsabiil08/SuratDigitalSIA`.
Branch `fix/pr-01-notifications-status`; basis PR-00 `a2be089ea84344764516c1c64e116cb2fc750803`, production/main baseline `4e0c0c661af58dd6db729c202643cd6629f7eb07`.

## Perubahan dan alasan

1. Hapus `createNotification` dan inputnya dari Server Action publik. Tidak ada caller production; tidak diganti helper generik service-role baru. Penulisan notifikasi tetap dalam RPC surat/disposisi berotorisasi, satu transaksi bersama status dan audit. Tidak membuat event atau approval dari browser.
2. Penanda baca memakai Auth aktif dan filter recipient dari sesi. ID asing/tidak ada dan kegagalan database menghasilkan kegagalan, tidak merevalidasi atau mengklaim sukses. Tandai semua tanpa baris tersisa tetap idempoten. Pesan database mentah tidak dikirim ke UI.
3. Migrasi baru `20261118043024_notifications_event_authorization.sql` dibuat dengan CLI Supabase 2.58.5. Mempersempit ACL hanya SELECT dan UPDATE(is_read,read_at) untuk authenticated, tanpa hak anon/PUBLIC/INSERT/DELETE/TRUNCATE. RLS mewajibkan pemilik dengan profil aktif. Trigger invoker menjaga semua kolom event tetap utuh serta waktu baca pertama dari database; tidak ada SECURITY DEFINER atau RPC publik baru.
4. Presentasi event dikenal maupun event legacy dinormalisasi ke label Indonesia tanpa judul/isi dokumen mentah. Pesan lima tahap disposisi yang sudah dikenal dipertahankan. Event persetujuan satu tahap tidak diklaim sebagai seluruh persetujuan selesai. Kode event/history tersimpan tidak ditulis ulang.
5. `workflowLabel` menampilkan **Dokumen final**, bukan Selesai, untuk finalized_at. Dimensi finalitas berdiri sendiri; tidak menyimpulkan pengiriman/penerimaan/penyelesaian. Enum/transisi proses dan penomoran tidak diubah. Reviewer independen/pengiriman/balasan belum diimplementasikan.
6. `vitest.config.ts` hanya menambahkan alias `@` yang sama dengan TypeScript untuk menguji Server Action dengan mock sesi/DB. Tidak mengubah dependensi atau CI. `vercel.json` menonaktifkan auto-deploy tambahan hanya branch PR-01.

## Pemeriksaan schema production (baca saja)

Melalui plugin Supabase pada project E-Surat-sig, diperiksa metadata tabel notifications, policy dan grants tanpa membaca isi surat. Ditemukan 10 kolom sesuai baseline, RLS aktif, dua policy pemilik, tanpa trigger non-internal. Anon/authenticated masih memiliki grant tabel luas termasuk UPDATE/TRUNCATE; RLS tidak membatasi kolom UPDATE dan bukan pelindung TRUNCATE. Migrasi lokal menutup hak ini tanpa memperluas akses. Tidak menjalankan DDL/DML, seed, repair atau apply_migration di production. History baseline tidak diperbaiki otomatis.

Rujukan teknis: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog.md). Tidak mengubah versi SDK atau mengadopsi CLI v3.

## Bukti pengujian

| Pemeriksaan | Hasil |
|---|---|
| `npm run check` | Lulus typecheck dan **109/109 tes**, 10 berkas; baseline 69 dan 40 tambahan |
| Server Action, 8 kasus | Tidak ada ekspor create event; tanpa akun aktif; identitas sesi; ID asing/hilang; error write/read; tandai semua dibatasi pemilik |
| Domain event/finalitas, 10 kasus | Tidak membocorkan judul mentah/kode/prototype; pesan disposisi sah; final tidak mengklaim selesai alur |
| ACL/RLS/trigger PGlite, 20 kasus | Lintas akun/admin/nonaktif/anon, kolom event immutable, insert/delete/truncate ditolak, waktu baca DB/idempoten, fungsi tidak publik, hak service-role tetap |
| Alur DB existing + 2 tambahan | Total 22 kasus; aksi tidak sah tanpa event/audit, fault injection insert notifikasi membatalkan status/audit, retry tidak menggandakan event |
| Forward migration PGlite | Seluruh migrasi baseline + grant luas + notifikasi existing → migrasi baru; isi baris existing identik sebelum/sesudah |
| Integritas baseline/dokumentasi | 14 migrasi baseline, dependensi dan CI utuh; 24 tautan aktif diperiksa; `git diff --check` lulus |
| `npm run build` | Lulus kompilasi, typecheck dan pembangkitan 20 halaman; bukan deployment |
| `npm run test:db` | Tidak dapat berjalan lokal: `initdb` tidak tersedia (exit 127). Jangan mengklaim konkurensi PostgreSQL nyata lulus |

## Risiko, penerapan dan titik berhenti

- Ini hardening notifikasi, bukan pengiriman surat. GAP penerima dapat membaca surat pra-kirim tetap menunggu PR-04; notifikasi bukan pemberian hak baca dokumen.
- Setelah kelak disetujui: backup/snapshot, uji PostgreSQL/staging dengan schema/grant production dan pemeriksaan seluruh migrasi/history terlebih dahulu. Tinjau migrasi baru secara terpisah; jangan mengulang baseline atau backfill 13 surat lama. Aplikasi penanda baca tetap kompatibel sebelum/sesudah migrasi.
- ACL bisa memengaruhi integrasi di luar repo yang memakai anon/authenticated untuk menulis notifikasi; tidak ada caller semacam itu dalam repo. Event sah menggunakan RPC service role dan tetap teruji. Jika perlu pemulihan, gunakan perbaikan maju yang ditinjau; jangan mengembalikan helper publik tanpa guard, grant luas, atau menghapus audit.
- Tidak ada migrasi baseline, counter/format nomor, data surat/versi/hash/audit lama yang diubah. Tidak ada perubahan production, merge atau deployment.
- PR-01 diajukan bertumpuk di atas branch PR-00 agar diff terpisah selama PR #1 belum di-merge. Setelah merge PR-00 kelak diizinkan, basis PR-01 dapat ditargetkan ulang; ini bukan izin merge.
- Publikasi draft PR dan hasil CI remote dicatat pada halaman PR. Kegagalan PostgreSQL baseline sudah terkonfirmasi pada PR-00: `01_numbering_test.sql:106`, `Surat belum siap diterbitkan.`; SQL/test fixture tersebut tidak diubah di sini. CI penuh belum dapat dinyatakan hijau.
- **Berhenti setelah PR-01. PR-02 belum diizinkan.**

## Publikasi terverifikasi

[Draft PR #2](https://github.com/Salsabiil08/SuratDigitalSIA/pull/2) dibuka ke branch PR-00 tanpa merge. Commit implementasi pertama `da53c53a0e589bcd0c6f95fef4323e12ee17b393`. Setelah publikasi, daftar deployment Vercel branch PR-01 kosong; production tetap READY pada `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc`, SHA `4e0c0c661af58dd6db729c202643cd6629f7eb07`, dan main masih SHA yang sama. [CI run pertama](https://github.com/Salsabiil08/SuratDigitalSIA/actions/runs/44238383240) mencatat job check lulus (109 tes dan typecheck), sedangkan job PostgreSQL gagal pada fixture baseline yang sama (`01_numbering_test.sql:106`, `Surat belum siap diterbitkan.`) setelah semua 15 migrasi termasuk migrasi PR-01 berhasil diterapkan pada database sementara runner. Uji ACL/RLS PR-01 tetap dibuktikan oleh PGlite, bukan diklaim telah dijalankan suite PostgreSQL penuh. Hasil job check dan commit laporan terbaru tersedia di PR. Ini bukan izin produksi atau PR-02.
