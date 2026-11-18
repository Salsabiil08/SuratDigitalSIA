# PR-08 FINAL — keputusan production readiness

18 November 2026, WIB. Basis PR-07 `fad16b73d0f72bf1ad0637ea1c5994e6277752d8`. **NO-GO production**: blocker staging/UAT dan penetapan perusahaan belum ditutup. Laporan ini melengkapi PR-00–07, tidak menggantikan bukti historisnya.

| Pemeriksaan | Hasil dan bukti |
|---|---|
| Stack PR-00–07 | PASS integrasi ancestry: delapan draft belum merge, base/head berantai, GitHub menyatakan mergeable. CI PR-00–02 historis gagal fixture; PR-03–07 lulus. PR-08 menguji gabungan ke main, tanpa bypass CI lama. |
| Regresi/typecheck | PASS lokal: **244/244**, 32 berkas; editor, review, approval, nomor, TTD, pengiriman/receipt, balasan, disposisi dan penolakan akses tetap diuji. |
| Build | PASS Next **15.5.29**; async cookies/params/searchParams disesuaikan. Perubahan versi diperlukan karena advisori keamanan, tanpa redesain/modul baru. |
| Dependensi production | PASS `npm audit --omit=dev`: **0**. Sebelum perbaikan 1 critical/1 high; PostCSS dipin/override **8.5.33**. Supabase SDK dipin ke versi lockfile yang sama. |
| PostgreSQL nyata | PASS lokal PostgreSQL **17.11**, 22 migrasi + fixture 01–08; 40 nomor unik, retry serentak kirim/baca/terima/balasan/disposisi/draf hasil tanpa duplikasi. |
| Forward + recovery atomik | PASS 8 migrasi lanjutan dalam satu transaksi, 13 surat sintetis tanpa versi/counter/audit tetap. Fault sebelum commit rollback schema/history; perubahan counter disengaja ditolak integrity guard; replay ditolak. Bukan uji restore backup Supabase/Storage. |
| Schema production read-only | PASS struktur baseline: 30 tabel/27 fungsi/6 trigger/48 policy cocok; 8 fungsi hanya beda format whitespace. 37 perbedaan ACL dari managed defaults ditinjau, bukan disamakan dengan PostgreSQL biasa. [Snapshot](../baselines/production-pr08-schema.json), [perbandingan](../baselines/production-pr08-comparison.json). |
| Hak akses production-like | PASS forward dimulai dengan grant luas serupa production. Migrasi baru `20261118125914_workflow_table_privileges.sql` mencabut DML workflow dan TRUNCATE, mempertahankan baca RLS serta UPDATE kolom notifikasi sah. Tidak mengubah baris historis. |
| HTTP/browser desktop/mobile | PASS halaman publik lokal: redirect ke login, validasi kosong, kegagalan jaringan login, tanpa overflow horizontal/error JS/permintaan production. Viewport 1366×768 dan 390×844; bukan UAT halaman setelah login. |
| Vercel staging | PREPARED `siadocs-r04-staging` / `prj_WcEEQdbZEfWKnajexjxnAQlhciIe`: Node 22, npm ci, build preflight, tanpa Git auto-deploy/secret production/deployment. |
| Supabase staging | **BLOCKED**. Tidak ada staging pada dua koneksi yang tersedia. Create branch ditolak `PaymentRequiredException: Branching is supported only on the Pro plan or above`. Proyek lain TaskManager tidak disentuh. |
| UAT nyata lengkap | **BLOCKED/NOT RUN**: login lintas akun, Auth/Storage/API/URL ilegal, seluruh alur privat, mobile/desktop sesudah login, retry dan jaringan gagal pada layanan staging nyata. Tes SQL/mocked/SSR tidak menggantikan UAT ini. |
| Production | Tetap deployment `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc`, main `4e0c0c661af58dd6db729c202643cd6629f7eb07`. Tidak merge/deploy/apply migration/seed/repair/reset atau mengubah Auth/Storage production. |

## Delta database dan bukti yang dapat diulang

Awal branch 21 file: 6 fondasi sudah ada secara schema tetapi tidak tercatat history, 8 history production, 7 perubahan PR-01–07 belum terpasang. PR-08 menambah **1 migrasi keamanan**, sehingga total **22 file**; forward = **8**. History setelah forward terkontrol = 16, bukan 22: enam fondasi **tidak direplay atau direpair otomatis**. Jalur CLI migration up/db push umum belum aman untuk history ini.

Production diamati 22 surat, termasuk **13 bernomor tanpa versi**; tidak ada dokumen/approval/pengiriman fiktif yang dibuat. Fixture forward memakai data sintetis, bukan ekspor isi surat/credential perusahaan.

- `npm ci && npm run check && npm audit --omit=dev && npm run build`
- `npm run test:db` (PostgreSQL 15+, lokal diuji 17.11)
- `mkdir -p test-results && bash scripts/readiness/test-forward.sh`
- `node scripts/readiness/compare-schema.mjs docs/baselines/production-pr08-schema.json test-results/baseline-local.json test-results/comparison.json`
- `python scripts/readiness/browser-public.py` dengan server localhost yang dibuild memakai target dummy terisolasi; lihat CI `browser-public` dan artefak `readiness-public-browser`.

Generator `scripts/readiness/prepare-forward.mjs` hanya menulis artefak SQL/manifest; tidak mempunyai koneksi DB. History, definisi fungsi baseline, lock, fingerprint baris lama dan transaksi melindungi eksekusi yang kelak disetujui. Perbandingan schema penuh tetap wajib dibaca ulang sebelum release.

## Tindakan yang masih dibutuhkan

| Keputusan/akses | Gerbang dan default aman |
|---|---|
| Supabase staging baru | Pilih organisasi **Salsabiil08 (`vnlajvyxdkzrlvbyqcze`)** atau sediakan project staging terpisah. Pembuatan project baru memerlukan pilihan organisasi; biaya nonzero tidak disetujui otomatis. Tidak memakai production untuk mutasi uji. |
| Reviewer dan pengelola kebijakan | **Wajib sebelum go-live**: perusahaan menetapkan orang/ruang lingkup dan memvalidasi kategori Permohonan/Laporan/Pemberitahuan. Manager/grant tidak otomatis diberikan ke Super Admin. |
| Approver, Finance, Direktur, signer | **Wajib sebelum go-live**: jabatan/penugasan resmi, kewenangan Finance dan urutan tagihan, signer serta unit/seri dikonfirmasi; tidak mengarang pejabat atau tanda tangan. |
| CC/delegasi/tenggat/hasil | Opsional: CC nonaktif, delegasi kosong, hanya pemberi menerima disposisi, tenggat tanpa default. Kewajiban hasil surat hanya arahan eksplisit yang sah. |
| TTD luar | Pengiriman internal tanpa bukti unggahan pengesahan tetap ditahan; gunakan jalur tersimpan yang sah atau putuskan kebijakan perusahaan. Download basah tetap ada; gambar TTD bukan TTE tersertifikasi. |
| Akun, 13 historis, backup | Konfirmasi/rotasi kredensial sementara dan daftar akun resmi; terima pembatasan historis atau lakukan rekonsiliasi berizin dengan dokumen asli. Backup DB/Storage/Auth settings serta restore drill staging belum diverifikasi. |

Checklist release: [x] perbaikan/test/forward lokal; [x] staging Vercel terisolasi; [ ] Supabase staging; [ ] UAT nyata lengkap; [ ] kebijakan wajib; [ ] backup/restore staging; [ ] izin release. **Jangan mengubah NO-GO hanya karena CI hijau.** Langkah setelah blocker ditutup: [runbook siap tinjau](PR08_PRODUCTION_RUNBOOK.md).
