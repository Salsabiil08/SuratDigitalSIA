# Backlog aktif — R.04 adaptasi NDO

Status: PR-00/PR-01 selesai dalam draft; implementasi PR-02 disetujui pada 18 November 2026. Basis `Salsabiil08/SuratDigitalSIA`, baseline `4e0c0c661af58dd6db729c202643cd6629f7eb07`. Jangan merekonsiliasi `SIAdocs`.

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

## Tahap berikutnya — belum diizinkan
- [ ] PR-03: persetujuan pilihan/pejabat wajib dan self-signer.
- [ ] PR-04: pengiriman/penerimaan transaksi dan RLS snapshot.
- [ ] PR-05: Kotak Masuk/Keluar dan label penyelesaian alur.
- [ ] PR-06: balasan surat baru berelasi.
- [ ] PR-07: integrasi disposisi dari Inbox dan hasil berelasi.
- [ ] PR-08: UAT lintas peran dan regresi lengkap.

Rincian: [spesifikasi target](../docs/spec/08-alur-ndo-r04.md), [rencana migrasi](../docs/plans/R04_NDO_MIGRATION_PLAN.md), [validasi PR-00](../docs/plans/PR00_VALIDATION.md), [validasi PR-01](../docs/plans/PR01_VALIDATION.md), [validasi PR-02](../docs/plans/PR02_VALIDATION.md).

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
