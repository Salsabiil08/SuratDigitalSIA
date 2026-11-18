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
| Tautan lokal dokumen aktif baru/ditulis ulang dan penanda historis baru | Diperiksa; tautan arsip lama yang tidak disentuh tidak dinyatakan telah dibersihkan |
| Konfigurasi deployment branch | JSON valid; hanya key branch PR-00 bernilai false, tanpa pengaturan main, build, route, env atau region |
| `git diff --check` | Lulus |

`npm run test:db`/konkurensi PostgreSQL nyata tidak dijalankan: binari PostgreSQL lokal tidak tersedia dan PR ini tidak mengubah SQL/runtime. `npm run check` tidak mencakup suite itu. Build/deployment dan UAT target baru tidak dijalankan; tidak ada klaim reviewer/Inbox/balasan telah tersedia. Pemeriksaan tipe dapat memperbarui tsconfig.tsbuildinfo lokal yang sudah berubah sebelum tugas; file tersebut tidak dimasukkan ke commit PR-00.

## Verifikasi publikasi dan titik berhenti

PR akan dibuka sebagai draft untuk peninjauan. URL PR dan pemeriksaan branch/deployment dicatat setelah publikasi. Main harus tetap pada SHA baseline dan deployment production harus tetap sama. PR tidak di-merge, database production tidak dibaca/ditulis ulang pada pekerjaan PR-00, dan PR-01 tidak dimulai.
