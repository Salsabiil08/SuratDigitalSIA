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
