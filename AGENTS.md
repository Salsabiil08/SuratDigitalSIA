# AGENTS.md — SIADocs

## Pekerjaan aktif dan batas persetujuan

Basis implementasi yang disetujui adalah **Salsabiil08/SuratDigitalSIA**. Jangan merekonsiliasi ke `Salsabiil08/SIAdocs` atau mengganti stack.

PR-00–02 tersedia sebagai draft PR #1–3, belum di-merge. Pengguna menerima PR-02 secara fungsional dengan catatan CI/reviewer dan mengizinkan **PR-03: pemisahan approver/penandatangan, deduplikasi dan perbaikan fixture PostgreSQL terpisah** pada 18 November 2026. Branch `feat/pr-03-independent-approval` berbasis PR-02. Creator-confirmation harus eksplisit, terikat versi dan diaudit; bukan approval historis palsu. Urutan dan kewenangan SM Finance–Direktur tetap wajib untuk tagihan. Pertahankan reviewer terpisah dan guard nomor; perbaiki data fixture agar mengikuti RPC nyata. Berhenti setelah PR-03 dilaporkan; **jangan mulai PR-04**. Tidak ada izin merge, perubahan database production atau deployment. Cegah auto-deploy branch yang belum diizinkan.

## Acuan dan cara membaca

1. Instruksi pengguna terbaru serta keputusan yang tercatat di [spesifikasi target R.04](docs/spec/08-alur-ndo-r04.md).
2. [Revisi fitur production](docs/spec/00-revisi-alur.md), [baseline terkunci](docs/baselines/production-2026-11-18.md), dan [rencana migrasi](docs/plans/R04_NDO_MIGRATION_PLAN.md).
3. Blueprint SIADocs R.03 untuk invarian SIA yang tidak direvisi; User Guide NDO untuk referensi adaptasi, bukan seluruh fitur wajib.
4. Spesifikasi/panduan lama bertanda historis hanya untuk penelusuran. PDF/DOCX R.04 lama tidak mengalahkan keputusan terbaru.
5. Kode dan migrasi pada baseline menjelaskan implementasi aktual; keberadaan halaman, tabel, atau checklist bukan bukti fitur selesai.

Mulai dari [docs/INDEX.md](docs/INDEX.md) dan tugas aktif di [tasks/BACKLOG.md](tasks/BACKLOG.md). Baca file relevan saja. Bila ada konflik bisnis yang belum diputuskan, catat di `docs/FINDINGS.md` dan hentikan bagian yang bergantung pada keputusan itu; pilihan teknis rutin tidak perlu konfirmasi ulang.

## Invarian yang dipertahankan

- Pertahankan fitur production: editor isi/format dan pratinjau, draft/koreksi/versi, nomor resmi, dua jalur pengesahan, stempel opsional, disposisi dua arah, Auth, Storage privat, audit, pembatalan, identitas merah–oranye, dan nama **Dashboard**. Jangan membangun ulang aplikasi.
- Internal: satu penerima utama di organisasi, tanpa TTD untuk komunikasi biasa, maksimal satu TTD formal. Eksternal: identitas penerima luar dan satu SM/Direktur. Tagihan: pengaju Finance, rincian/lampiran wajib, dua persetujuan dan TTD SM lalu Direktur. SM berlaku lintas organisasi, bukan hanya Finance. Tanpa tembusan.
- Nomor hanya melalui tindakan eksplisit Terbitkan Nomor Surat setelah syarat sah. Persetujuan tidak menerbitkan nomor otomatis. Counter atomik/idempoten per seri dan tahun WIB; nomor tidak diubah, direset, atau dipakai ulang, termasuk setelah pembatalan. Pemulihan dokumen memakai nomor yang sama.
- Jangan mengubah otomatis **13 surat lama yang belum memiliki versi dokumen**. Jangan mengarang dokumen, tanda tangan, review, pengiriman, atau bukti terima. Rekonsiliasi memerlukan berkas asli, kewenangan, dan persetujuan tersendiri.
- Dokumen final terkunci; finalisasi dokumen berbeda dari pengiriman, penerimaan, dan penyelesaian alur. Unduh bukan kirim, dibaca bukan diterima, nomor bukan bukti pengesahan.
- Target akses penerima baru diberikan setelah pengiriman resmi terhadap versi/hash terkirim. Hak reviewer/penyetuju/penandatangan berdasarkan penugasan diperiksa terpisah. Kekurangan baseline tetap tercatat sebagai GAP, bukan diklaim sudah diperbaiki.
- Reviewer hanya memberi catatan, menyetujui hasil pemeriksaan, atau meminta revisi; pembuat yang mengubah isi. Reviewer, penyetuju, dan penandatangan adalah peran berbeda. Hindari approval duplikat jika pembuat juga pejabat berwenang; penerbitan dan TTD tetap eksplisit.
- Konfigurasi awal kategori: Permohonan/Laporan wajib review; Pemberitahuan opsional. Pertimbangkan pasangan jenis–kategori dan kewenangan perusahaan. Ini konfigurasi awal **belum tervalidasi perusahaan**, bukan kebijakan final yang boleh diterapkan ke production dari PR-00.
- Disposisi hanya selesai sesudah pemberi memeriksa dan menerima hasil. Balasan resmi adalah surat baru berelasi, dengan identitas/versi/nomor sendiri. Jangan menimpa surat asal.
- `IN_APP`: penandatangan sah memeriksa lalu menerapkan gambar TTD atau mengunggah hasil basah melalui akunnya. Stempel opsional sesuai kewenangan. `EXTERNAL`: unduh untuk pengesahan luar tanpa kewajiban unggah. Gambar TTD bukan TTE tersertifikasi. Tanpa OCR atau penempatan nomor/TTD sembarangan.
- Super Admin tidak otomatis mendapat kewenangan bisnis atau akses isi surat. Identitas aktor dari sesi Auth terverifikasi; server dan RLS menegakkan hak. Secret/service role hanya server, berkas privat, audit append-only dan tanpa isi dokumen.

## Disiplin perubahan dan bukti

- Satu PR kecil sesuai persetujuan. Perubahan database lewat migrasi aditif baru setelah pengujian lokal/staging; jangan mengubah migrasi terpakai atau memperlebar grant untuk mengatasi RLS.
- Jangan menganggap target baru sudah diimplementasikan. Pisahkan baseline teruji, GAP, rencana, dan hasil UAT.
- Batas historis PR-00: tidak mengubah `src/`, `supabase/`, dependensi, CI, atau PDF/DOCX blueprint. Satu pengecualian konfigurasi: `vercel.json` boleh mencegah auto-deploy **hanya branch PR-00**, tanpa mengubah main/project production. PR-01 memperketat notifikasi. PR-02 menambah kategori/review versi terpisah. PR-03 menambah approval terpisah melalui migrasi aditif dan memperbaiki fixture secara terpisah; pengaman deployment diperluas hanya ke branch PR-03.
- Jalankan `npm run check` (typecheck + Vitest, termasuk PGlite). `npm run test:db` adalah suite PostgreSQL terpisah; jangan mengklaimnya dijalankan oleh `check`. Build lokal bukan deployment. Untuk dokumentasi, periksa tautan, konsistensi keputusan, dan diff runtime/migrasi.
- Perbarui status tugas dan laporkan bukti yang benar-benar dijalankan. Jangan menandai UAT seluruh target selesai karena tes PR-03 lulus.
