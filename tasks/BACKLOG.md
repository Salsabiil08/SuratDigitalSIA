# Backlog aktif — R.04 adaptasi NDO

Status: PR-00–07 selesai dalam draft; PR-08 FINAL disetujui pada 18 November 2026. Basis `Salsabiil08/SuratDigitalSIA`, baseline `4e0c0c661af58dd6db729c202643cd6629f7eb07`. Jangan merekonsiliasi `SIAdocs`.

## PR-00 — dokumentasi baseline dan rencana (selesai; menunggu tinjauan)
- [x] Tetapkan repo/SHA/deployment dan manifest baseline tanpa secret.
- [x] Dokumentasikan keputusan reviewer hanya memeriksa, bukan mengedit.
- [x] Catat default Permohonan/Laporan wajib dan Pemberitahuan opsional, override jenis–kategori berotorisasi, serta status belum tervalidasi perusahaan.
- [x] Pisahkan finalitas dokumen, pengiriman/penerimaan dan selesai alur dalam kontrak target.
- [x] Dokumentasikan akses penerima setelah kirim, deduplikasi pembuat-pejabat, balasan berelasi dan penerimaan hasil disposisi oleh pemberi.
- [x] Lindungi 13 surat lama dan rencanakan migrasi aditif tanpa backfill otomatis.
- [x] Selaraskan acuan agen/README/indeks dan tandai panduan lama historis.
- [x] Verifikasi tautan, batas diff, manifest dan `npm run check`; catat laporan PR-00.
- [x] Buka draft PR #1 untuk ditinjau tanpa merge/deployment; laporkan dan berhenti. CI check lulus; kegagalan tes PostgreSQL baseline dicatat pada laporan validasi.

## PR-01 — notifikasi/event dan kerangka status
- [x] Hapus helper service-role publik yang tidak digunakan; pertahankan event transaksi RPC.
- [x] Tangani write gagal dan ID asing tanpa sukses palsu.
- [x] Tambahkan migrasi baru ACL/RLS/trigger notifikasi tanpa mengubah data lama.
- [x] Normalisasi label event Indonesia dan bedakan Dokumen final dari selesai alur.
- [x] Uji negatif server action, ACL/RLS dan rollback status/audit/event.
- [x] Buka [draft PR #2](https://github.com/Salsabiil08/SuratDigitalSIA/pull/2) bertumpuk di atas PR-00, laporkan hasil dan berhenti.

## PR-02 — kategori dan reviewer independen
- [x] Kategori aktif pada form dan validasi server/DB.
- [x] Default awal Permohonan/Laporan wajib, Pemberitahuan opsional; kebijakan jenis–kategori dan grant pemeriksa berdasarkan unit/jenis, tanpa hak otomatis Super Admin.
- [x] Penugasan dan catatan/hasil pemeriksaan terikat versi/hash, terpisah dari approval dan TTD.
- [x] Halaman Pemeriksaan Surat, detail dan riwayat; pembuat tetap pengedit.
- [x] Migrasi aditif dan uji 13 surat lama tanpa perubahan otomatis.
- [x] Pengujian lintas akun/RLS/stale/fault injection dan investigasi fixture baseline terpisah.
- [x] Buka [Draft PR #3](https://github.com/Salsabiil08/SuratDigitalSIA/pull/3) berbasis PR-01, verifikasi hasil dan laporkan; berhenti sebelum PR-03. Check lulus; job PostgreSQL tertahan fixture lama yang belum memenuhi prasyarat.

## PR-03 — persetujuan terpisah dan tanpa duplikasi
- [x] Approver wajib/tambahan terpisah dari penandatangan, snapshot per versi/hash dan siklus.
- [x] Deduplikasi per aktor; konfirmasi pembuat eksplisit melalui pengajuan, tetap mengikuti urutan wajib.
- [x] Kewenangan Finance/Direktur dan grant approver tambahan, tanpa hak bisnis otomatis Super Admin/pemeriksa.
- [x] Tarik untuk koreksi sebelum nomor, simpan versi baru dan ajukan ulang tanpa menghapus keputusan lama.
- [x] Ringkasan penerbitan memakai data nyata; allocator/seri/urutan/idempotensi/pembatalan dipertahankan.
- [x] Fixture PostgreSQL diperbaiki terpisah melalui draft/versi/preview/RPC sah; fixture gagal awal diarsipkan untuk reproduksi.
- [x] Uji lintas akun/RLS/urutan/gagal transaksi dan dokumentasi keputusan perusahaan.
- [x] Buka [Draft PR #4](https://github.com/Salsabiil08/SuratDigitalSIA/pull/4) berbasis PR-02; CI check dan PostgreSQL/konkurensi lulus, production tidak berubah; laporkan dan berhenti.

## PR-04 — pengiriman/penerimaan internal
- [x] Snapshot final/hash/pengirim/penerima/key tetap; kirim dan event wajib atomik.
- [x] Receipt/READ terpisah, aktor Auth, CC tidak menjadi PRIMARY/kewajiban balas.
- [x] Tutup akses receiver pra-kirim pada RLS/versi/API/Storage/relasi; pertahankan penugasan independen.
- [x] Pengirim pembuat/delegasi unit eksplisit; Super Admin tidak otomatis berwenang.
- [x] UI detail untuk kirim/terima, tanpa membangun Inbox/Outbox PR-05.
- [x] Uji fault injection, lintas akun, API, Storage dan snapshot; tambah fixture/konkurensi PostgreSQL.
- [x] Buka [Draft PR #5](https://github.com/Salsabiil08/SuratDigitalSIA/pull/5) berbasis PR-03; CI check/PostgreSQL/konkurensi lulus, production tidak berubah; laporkan dan berhenti sebelum PR-05.

## PR-05 — Kotak Masuk/Keluar dan status nyata
- [x] Daftar dari dispatch/recipient resmi, sesi pengguna dan RLS tanpa service role.
- [x] Filter/pencarian/pagination serta error/empty berbeda, hak outbox terotorisasi.
- [x] PRIMARY/CC/status tiap penerima serta final/kirim/baca/terima terpisah, tanpa label Selesai otomatis.
- [x] Receipt eksplisit, notifikasi/detail sah, refresh cache setelah baca/terima; Surat Saya dipertahankan.
- [x] Migrasi aditif read-only dan uji PostgreSQL/mailbox/UI/server/regresi.
- [x] Buka [Draft PR #6](https://github.com/Salsabiil08/SuratDigitalSIA/pull/6) berbasis PR-04; CI check 202/202 dan PostgreSQL/konkurensi lulus (run #33), production tidak berubah; laporkan dan berhenti sebelum PR-06.

## PR-06 — Balasan resmi dan relasi surat
- [x] Tindakan penerima utama membuat draf baru lewat editor SIADocs; referensi/penerima sesuai asal, tanpa nomor otomatis.
- [x] Relasi permanen/idempoten dan RLS dua endpoint; CC/admin/akun lain tidak berwenang.
- [x] Balasan mengikuti review/approval/nomor/pengesahan; revisi membatalkan keputusan versi sebelumnya.
- [x] Status per penerima hanya sesudah kirim, dalam transaksi yang sama; gagal kirim/audit/notifikasi rollback.
- [x] Migrasi aditif, fixture lintas akun/rollback/RLS serta uji retry/konkurensi.
- [x] Buka [Draft PR #7](https://github.com/Salsabiil08/SuratDigitalSIA/pull/7) berbasis PR-05; CI #37 check 217/217 dan PostgreSQL/konkurensi lulus, production tidak berubah; laporkan dan berhenti sebelum PR-07.

## PR-07 — Disposisi dari Inbox dan surat hasil
- [x] Navigasi detail surat → disposisi existing; PRIMARY dan hierarki/penugasan diperiksa database.
- [x] Draf surat hasil melalui editor/gate biasa, tujuan pemberi, relasi permanen tanpa hak baca otomatis.
- [x] Catatan/lampiran/surat hasil, snapshot pengajuan dan riwayat RETURN/ACCEPT; surat hasil wajib dikirim resmi.
- [x] Retry/idempotensi/rollback dan konkurensi buat/ajukan/terima; balasan PR-06 terpisah.
- [x] Tes lokal server/API/UI dan fixture PostgreSQL, regresi serta build.
- [x] Buka [Draft PR #8](https://github.com/Salsabiil08/SuratDigitalSIA/pull/8) berbasis PR-06; CI #41 check 234/234 dan PostgreSQL/konkurensi lulus, production tidak berubah; laporkan dan berhenti sebelum PR-08.

## PR-08 FINAL — Production readiness
- [x] Verifikasi stack/CI historis, schema/history production read-only dan data historis.
- [x] Patch keamanan Next/PostCSS, adaptasi async API, guard staging, role UI dan error login.
- [x] Migrasi grant aditif, tes PostgreSQL nyata/forward/rollback/replay/integritas.
- [x] Smoke browser public desktop/mobile; Auth/Storage nyata bukan PASS.
- [x] Vercel staging terpisah tanpa deploy/secret production; template/preflight siap.
- [ ] Supabase staging: pilihan organisasi/proyek terpisah masih diperlukan; branching ditolak paket.
- [ ] UAT Auth/Storage lintas akun dan sign-off kebijakan wajib perusahaan.
- [x] [Draft PR-08 #9](https://github.com/Salsabiil08/SuratDigitalSIA/pull/9), CI integrasi #45 hijau, laporan NO-GO dan runbook; wajib verifikasi ulang Checks pada head release.

Tidak membuat fase PR-09. Production/merge/deploy menunggu persetujuan baru.

Rincian: [spesifikasi target](../docs/spec/08-alur-ndo-r04.md), [rencana migrasi](../docs/plans/R04_NDO_MIGRATION_PLAN.md), [validasi PR-00](../docs/plans/PR00_VALIDATION.md), [validasi PR-01](../docs/plans/PR01_VALIDATION.md), [validasi PR-02](../docs/plans/PR02_VALIDATION.md), [validasi PR-03](../docs/plans/PR03_VALIDATION.md), [validasi PR-04](../docs/plans/PR04_VALIDATION.md), [validasi PR-05](../docs/plans/PR05_VALIDATION.md), [validasi PR-06](../docs/plans/PR06_VALIDATION.md), [validasi PR-07](../docs/plans/PR07_VALIDATION.md).

## Riwayat backlog sebelum adaptasi NDO

Checklist di bawah dipertahankan sebagai catatan pekerjaan terdahulu. Status `[x]` bukan klaim seluruh target NDO selesai dan tidak menutup GAP audit. Beberapa klaim lama perlu dibaca bersama baseline dan laporan audit.

# Backlog (R.04)

Kerjakan berurutan. Tugas selesai bila kriteria terpenuhi dan `npm run check` lulus. Rincian milestone ada di `ANTIGRAVITY.md` bagian 9.

## M0 Fondasi
- [x] Scaffold Next.js (App Router, TypeScript), Tailwind, font, komponen UI dasar (`src/components/ui`)
- [x] Klien Supabase (browser, server, service role khusus server) dan `.env.local`
- [x] `npm install`, vitest, CI lulus

## M1 Database dan domain (R.04)
- [x] Skema, constraint, fungsi penomoran atomik, RLS dasar, uji awal (versi R.03)
- [x] Audit ketergantungan, lalu migrasi `20261114000001_r04.sql`: `letters.source`, penerbitan satu transaksi, `dispositions` (requires_letter, letter_id, followup_note)
- [x] Perbarui `src/domain/status.ts` (tanpa DistributionStatus, ISSUE_NUMBER ke NUMBERED), tes domain, tes SQL, tes konkurensi
- [x] Seed contoh (unit, jabatan, jenis, seri, pengguna demo)

## M2 Auth, master, RLS
- [x] Login, profil, peran
- [x] Master Organisasi, Master Jenis dan Seri Nomor (Super Admin)
- [x] Uji RLS tiap peran terhadap tiap tabel (`docs/spec/05`)

## M3 Buat Surat dan Ambil Nomor
- [x] Buat Surat: data surat, unduh kop, unggah bukti dan lampiran (25 MB), signed URL
- [x] Ambil Nomor: unggah surat jadi, data surat
- [x] Surat Pengantar Tagihan: rincian, bank, total, terbilang

## M4 Persetujuan dan penerbitan nomor
- [x] Alur persetujuan dan validasi kewenangan
- [x] Konfirmasi dan Terbitkan Nomor Surat, Salin Nomor, Unduh Kop Bernomor, Unggah Dokumen Akhir

## M5 Pengesahan
- [x] Jalur IN_APP (antrean, unggah bertanda tangan, hash) dan EXTERNAL (`docs/spec/04-pengesahan.md`)

## M6 Disposisi, notifikasi, pembatalan
- [x] Disposisi dengan aturan penyelesaian
- [x] Notifikasi dalam aplikasi (Realtime), tanpa isi dokumen
- [x] Pembatalan draft dan surat bernomor dengan otorisasi dan delegasi

## M7 Halaman dan polesan
- [x] Dashboard, Surat Saya, Detail Surat, Log History (Super Admin), aksesibilitas

## M8 Penerimaan
- [x] Uji terhadap 11 kriteria Bab 10 Blueprint R.04, laporan temuan

## Perbaikan akses awal
- [x] Pengunjung tanpa sesi diarahkan ke `/login` dari seluruh halaman dashboard; hapus akun demo otomatis saat tidak ada sesi.

## REV-01–07 — Revisi pengguna 18 November 2026
- [x] REV-01: tanggal surat lampau menurut kewenangan, alasan, audit, tanggal stabil saat edit.
- [x] REV-02: approval riil per akun/versi, status tersimpan, pengujian antarperan.
- [x] REV-03: area TTD DOCX/PDF tervalidasi dan terlihat pada preview.
- [x] REV-04: draft, preview, koreksi, pengajuan, nomor, TTD, finalisasi terkunci.
- [x] REV-05: gambar TTD/unggahan basah tersimpan di Supabase, identitas/waktu/hash/audit, tanpa klaim TTE tersertifikasi.
- [x] REV-06: stempel opsional oleh penandatangan sah, preview dan audit.
- [x] REV-07: penerima, field, template dan validasi internal/eksternal berbeda; tagihan tetap Finance dan dua tahap.
- [x] Verifikasi migration, RLS, Storage, login nyata, production dan laporan tes.

### Revisi pengguna 18 November — disposisi dan bahasa
- [x] Label teknis surat/status diganti bahasa Indonesia; jabatan umum Senior Manager.
- [x] Disposisi → buat surat tindak lanjut → kirim hasil → pemeriksaan pemberi → perbaikan/penerimaan.
- [x] Otorisasi database, akses dokumen peserta, audit dan notifikasi transaksi, pencegahan penyelesaian sepihak.
- [x] Uji database akun berbeda dan proses perbaikan tanpa mengubah nomor lama.

### Revisi lanjutan 18 November — Dashboard, editor, pembukaan halaman, akun
- [x] Nama Dashboard dipulihkan.
- [x] Data awal server untuk surat, persetujuan, notifikasi, detail dan formulir; hapus tampilan/animasi memuat; deduplikasi autentikasi per render.
- [x] Sambungkan editor format dan pertahankan format dalam DOCX serta penyimpanan draft; HTML aman dan kompatibilitas teks lama.
- [x] Hapus login demo tanpa sandi; aktifkan enam akun bernama; nonaktifkan akun QA dan cabut sesi lama.
- [x] 69 uji otomatis dan login keenam akun melalui Auth nyata.
