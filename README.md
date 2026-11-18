# SIADocs — PT Semen Indonesia Aceh

Aplikasi persuratan digital yang berjalan di https://suratdigital-sig.vercel.app/, berbasis Next.js 14 App Router, TypeScript, Tailwind dan Supabase (Auth, PostgreSQL, Storage).

**Repository basis: `Salsabiil08/SuratDigitalSIA`.** Tidak ada rekonsiliasi ke repo `SIAdocs` pada pekerjaan ini.

## Status yang dapat ditinjau

Baseline production adalah commit `4e0c0c661af58dd6db729c202643cd6629f7eb07`. Editor format/pratinjau, draft/versi, penomoran, pengesahan dan disposisi dua arah mempunyai bukti kerja. Reviewer independen, pengiriman/penerimaan internal, Kotak Masuk dan balasan resmi berelasi masih menjadi target pengembangan. Jangan menafsirkan checklist lama sebagai klaim seluruh R.04 adaptasi NDO telah selesai.

PR-00–03 tersedia sebagai draft; **PR-04 (pengiriman/penerimaan internal)** disetujui untuk implementasi/pengujian pada branch terpisah. PR-05 menunggu persetujuan berikutnya. Tidak ada izin mengubah database production, merge, atau deploy.

| Dokumen | Tujuan |
|---|---|
| [Indeks](docs/INDEX.md) | Memilih acuan aktif dan membedakan dokumen historis |
| [Baseline production](docs/baselines/production-2026-11-18.md) | SHA/deployment, bukti audit, perlindungan fitur dan 13 surat lama |
| [Spesifikasi target R.04](docs/spec/08-alur-ndo-r04.md) | Keputusan pengguna, reviewer, status, akses penerima dan relasi surat |
| [Rencana migrasi](docs/plans/R04_NDO_MIGRATION_PLAN.md) | Perubahan aditif, urutan PR, risiko dan gerbang persetujuan |
| [Laporan PR-04](docs/plans/PR04_VALIDATION.md) | Pengiriman, receipt, snapshot, RLS/Storage dan pengujian |
| [Laporan PR-03](docs/plans/PR03_VALIDATION.md) | Hasil approval terpisah dan fixture PostgreSQL |
| [Laporan PR-02](docs/plans/PR02_VALIDATION.md) | Hasil implementasi, pengujian dan risiko kategori/review |
| [Laporan PR-00](docs/plans/PR00_VALIDATION.md) | Cakupan dan hasil pemeriksaan PR ini |
| [Backlog](tasks/BACKLOG.md) | Progres PR-00–04 dan pekerjaan berikutnya yang belum diizinkan |

## Menjalankan lokal

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Isi konfigurasi Supabase melalui environment lokal. Service role key hanya di server; jangan memasukkan kredensial akun atau secret ke repository. `supabase/seed.sql` berisi contoh lokal, bukan perintah untuk memperbarui data production.

## Pemeriksaan

```bash
npm run check        # typecheck + Vitest; termasuk kasus database PGlite
npm run test:db      # suite PostgreSQL terpisah, hanya lingkungan uji lokal
npm run build        # build lokal; tidak melakukan deployment
```

Laporan audit baseline mencatat 69 tes lulus. Ini bukan bukti bahwa reviewer, pengiriman, penerimaan dan balasan target baru sudah lulus UAT. Hasil pemeriksaan PR-00 dicatat terpisah pada laporan PR.

`vercel.json` menonaktifkan auto-deploy hanya untuk branch PR-00, PR-01, PR-02, PR-03 dan PR-04 yang sedang ditinjau. Tidak ada perubahan pengaturan project production atau perintah deploy pada PR-00.
