# PR-00 — cakupan dan hasil pemeriksaan

Tanggal: 18 November 2026 (WIB). Basis `Salsabiil08/SuratDigitalSIA`, baseline `4e0c0c661af58dd6db729c202643cd6629f7eb07`. Branch `docs/pr-00-r04-ndo-baseline`.

## Hasil perubahan

- Baseline repository/deployment beserta tree, digest dependensi dan 14 file migrasi disimpan pada `docs/baselines/`.
- Spesifikasi target `08-alur-ndo-r04.md` mencatat keputusan yang sudah disetujui: repo live tanpa rekonsiliasi; default kategori awal belum tervalidasi perusahaan dan mempertimbangkan jenis; reviewer hanya memeriksa/memberi catatan/meminta revisi, tanpa edit isi.
- Finalitas dokumen, pengiriman, penerimaan dan selesai alur dipisah secara konseptual; hak penerima pasca-kirim, self-signer tanpa approval duplikat, balasan baru berelasi dan penerimaan hasil oleh pemberi disposisi ditetapkan sebagai kontrak target.
- Rencana migrasi aditif, perlindungan 13 surat lama, risiko, gerbang izin dan urutan PR-01–08 didokumentasikan. Tidak dibuat file migrasi atau skrip backfill.
- AGENTS/README/indeks/backlog diselaraskan; panduan dan catatan lama diberi penanda historis tanpa menghapus blueprint biner/jejak lama.
- `vercel.json` mencegah deployment otomatis hanya branch PR-00. Tidak ada perubahan pengaturan project production atau perilaku main di luar branch ini.

## Pemeriksaan lokal

| Pemeriksaan | Hasil |
|---|---|
| `npm run check` | Lulus: typecheck dan **69/69 tes**, 7 berkas; 20 kasus database PGlite dan 49 kasus domain/dokumen |
| Diff terhadap baseline untuk src, supabase, tests, package.json, package-lock.json dan .github | Kosong; tidak ada perubahan implementasi/migrasi/dependensi/CI |
| Manifest baseline | SHA dan tree cocok; digest seluruh 14 file migrasi cocok dengan file baseline |
| Tautan lokal dokumen aktif baru/ditulis ulang dan penanda historis baru | 29 tautan relatif diperiksa; tautan arsip lama yang tidak disentuh tidak dinyatakan telah dibersihkan |
| Konfigurasi deployment branch | JSON valid; hanya key branch PR-00 bernilai false, tanpa pengaturan main, build, route, env atau region |
| `git diff --check` | Lulus |

`npm run test:db`/konkurensi PostgreSQL nyata tidak dijalankan: binari PostgreSQL lokal tidak tersedia dan PR ini tidak mengubah SQL/runtime. `npm run check` tidak mencakup suite itu. Build/deployment dan UAT target baru tidak dijalankan; tidak ada klaim reviewer/Inbox/balasan telah tersedia. Pemeriksaan tipe dapat memperbarui tsconfig.tsbuildinfo lokal yang sudah berubah sebelum tugas; file tersebut tidak dimasukkan ke commit PR-00.

## Verifikasi publikasi dan titik berhenti

Draft [PR #1](https://github.com/Salsabiil08/SuratDigitalSIA/pull/1) sudah dibuka dari branch PR-00 ke main. Verifikasi setelah publikasi: main tetap pada SHA baseline; deployment production tetap `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc` dengan SHA baseline dan status READY; daftar deployment branch PR-00 kosong. PR tidak di-merge, database production tidak dibaca/ditulis ulang pada pekerjaan PR-00, dan PR-01 tidak dimulai.

## CI remote dan temuan baseline

Pada commit dokumentasi pertama `9545f1748c6d0ae41af8312c1636316812b3dbd9`, [CI run 44236815468](https://github.com/Salsabiil08/SuratDigitalSIA/actions/runs/44236815468) selesai: job `check` lulus; job `db` gagal. Seluruh 14 migrasi diterapkan pada database sementara runner, lalu `supabase/tests/01_numbering_test.sql:106` gagal dengan `Surat belum siap diterbitkan.` dari fungsi `issue_letter_number`. Suite berhenti sehingga kelulusan uji PostgreSQL/konkurensi berikutnya tidak dapat diklaim.

SQL, tes, skrip dan CI identik dengan baseline; kegagalan dicatat sebagai temuan baseline, belum diperbaiki dalam PR dokumentasi ini. Perbaikan fixture/aturan penomoran harus ditinjau terpisah tanpa melonggarkan guard bisnis. CI untuk commit pembaruan laporan dapat berjalan ulang; status terbaru tersedia di halaman PR. Tidak ada klaim seluruh CI hijau.
