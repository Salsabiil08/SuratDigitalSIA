# PR-02 — kategori dan reviewer independen

18 November 2026 (WIB). Repository `Salsabiil08/SuratDigitalSIA`.
Branch `feat/pr-02-independent-review`, berbasis PR-01 `43db72db6856c2dbdc62f680aea6dce0cbf19d06`. PR sebelumnya belum digabungkan; PR-02 diajukan ke branch PR-01.

## Perubahan yang dapat ditinjau

- Form Buat/Impor/Ambil Nomor dan edit draft memakai kategori aktif Permohonan, Laporan atau Pemberitahuan. Jenis surat tetap terpisah: Internal/Eksternal/Tagihan. Pemeriksa dipilih dari pegawai aktif dengan penugasan eksplisit untuk unit pengirim/jenis surat; pembuat tidak dapat memeriksa suratnya sendiri.
- Konfigurasi awal kategori: Permohonan/Laporan wajib, Pemberitahuan opsional. Kebijakan spesifik jenis–kategori mendahului default kategori. Pemeriksa opsional yang sudah dipilih tetap harus menyelesaikan pemeriksaan. Default berstatus INITIAL dan belum dianggap tervalidasi perusahaan. RPC konfigurasi tidak mengizinkan menurunkan kewajiban Permohonan/Laporan.
- Pengajuan pertama yang memerlukan pemeriksaan membuat tugas pada halaman **Pemeriksaan Surat**, bukan approval atau permintaan TTD. Pembuat boleh menyimpan draft tanpa pemeriksa sambil menyiapkan surat, tetapi pengajuan wajib-review tidak dapat dilanjutkan tanpa pemeriksa sah. Pratinjau versi terkini tetap wajib sebelum pengajuan.
- Pemeriksa membuka pratinjau di detail, memberi catatan, meloloskan pemeriksaan, atau meminta perbaikan dengan catatan wajib. Hanya pembuat mengedit. Lolos pemeriksaan meninggalkan surat belum diajukan ke approval; pembuat mengajukan persetujuan sebagai tindakan terpisah. Penomoran tetap eksplisit sesudah syarat approval baseline.
- `review_steps` menyimpan reviewer, versi/hash, siklus dan snapshot ID/revisi policy; `review_comments` menyimpan catatan. Simpan/koreksi draft menghasilkan versi baru melalui RPC existing dan membuat hasil versi lama tidak berlaku. Keputusan/catatan lama tidak ditimpa untuk mengarang hasil versi baru. Meminta perbaikan mengharuskan versi baru sebelum pengajuan ulang.
- RLS memberikan pemeriksa hak dokumen hanya pada penugasan versi terkini yang sah, tanpa memberikan akses otomatis ke arsip versi lain. Akses sebagai penyetuju/penandatangan/aktor lain tetap diperiksa terpisah. Reviewer tidak mempunyai hak edit isi atau mutasi review langsung dari Data API. RPC sensitif service-only; aktor Server Action berasal dari sesi Auth.
- Migrasi baru `20261118045220_independent_category_review.sql` aditif: tabel policy/penugasan/tugas/catatan, dua kolom nullable pada letters, wrapper RPC dan hardening RLS/field. Tidak mengubah 15 file migrasi terdahulu, nomor/counter, SQL fixture baseline, dependensi atau CI. Tidak ada backfill surat lama. `vercel.json` hanya menambahkan larangan auto-deploy branch PR-02.

## Konfigurasi kewenangan perusahaan

Tidak ada jabatan atau Super Admin yang otomatis diberi hak pemeriksa/pengesah kebijakan. `review_policy_managers` memerlukan penunjukan perusahaan; `review_authorizations` memuat reviewer, unit/jenis opsional, masa berlaku dan pemberi kewenangan. `authorize_letter_reviewer` dan `configure_review_policy` memeriksa pejabat aktif yang sudah ditunjuk dan mencatat audit. Caller anon/authenticated tidak diberi execute; UI pengguna biasa tidak dapat mengatur kewenangannya sendiri.

PR ini menyediakan kontrak konfigurasi melalui RPC server-only, bukan halaman pengaturan kebijakan baru. Tidak ada penunjukan manager/grant perusahaan yang disisipkan otomatis oleh migrasi. Sebelum UAT staging, otoritas perusahaan perlu menetapkan pengelola policy dan pemeriksa dengan alasan/audit melalui provisioning berotorisasi yang ditinjau. Pengujian otomatis memakai penunjukan sintetis hanya di database sementara. Jika belum ada penugasan, UI menjelaskan bahwa pemeriksa belum tersedia dan menahan pengajuan wajib-review; bukan memilih pejabat secara acak.

Implementasi awal mendukung satu pemeriksa per versi/siklus. Jumlah/urutan pemeriksa dan pejabat pengesah policy tetap memerlukan validasi perusahaan sesuai keputusan audit. Tidak ada klaim konfigurasi awal sudah aktif di production.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
|---|---|
| `npm run check` | Lulus typecheck dan **136/136 tes**, 13 berkas |
| DB review PGlite, 21 kasus | Kategori wajib/opsional; self-review/lingkup salah; internal/eksternal/tagihan; review terpisah dari approval/TTD; versi stale; revisi; komentar; RLS; akun nonaktif/grant berakhir; policy berubah; kegagalan event dan idempotensi |
| Server Action review, 4 kasus | Identitas dari sesi; tanpa akun aktif; RPC gagal; daftar mengabaikan versi lama/akses tercabut/aktor lain |
| Investigasi fixture, 2 kasus terpisah | Mereproduksi fixture baseline tanpa PR-02; status READY tanpa versi tetap ditolak tanpa menerbitkan nomor atau menaikkan counter |
| Regresi baseline | 109 tes PR-01 tetap berjalan; helper draft DB diperbarui memilih Pemberitahuan secara eksplisit, bukan menurunkan guard |
| Integritas source/dokumen | 15 migrasi baseline, SQL fixture/scripts/dependensi/CI utuh; 28 tautan relatif aktif diperiksa; `git diff --check` lulus |
| Forward migration lokal | Simulasi 13 surat bernomor tanpa versi dan audit existing identik sebelum/sesudah, selain dua kolom baru NULL; tidak ada bukti pemeriksaan fiktif |
| Build | Lulus kompilasi, typecheck, dan pembangkitan 21 halaman; bukan deployment |

Schema production diperiksa baca-saja: belum ada tabel review baru, hanya category_id pada letters, history tetap 8 entri. Tidak ada apply_migration/DDL/DML/seed/repair ke production. Semua penerapan/pengujian mutasi berlangsung di PGlite lokal.

## Risiko dan batas pengujian

1. PostgreSQL penuh/konkurensi nyata dan UAT browser dengan Supabase Auth/Storage staging belum dijalankan. Database lokal lintas aktor menggunakan PGlite, bukan klaim pengujian akun live. CI PostgreSQL baseline masih merupakan blocker; lihat [investigasi terpisah](PR02_BASELINE_FIXTURE_INVESTIGATION.md). Tidak melonggarkan aturan untuk meluluskan fixture.
2. Sebelum produksi perlu persetujuan tersendiri, backup/snapshot, staging yang sesuai schema/grant production, validasi perusahaan, dan tinjauan history 8 entri versus 15 migrasi baseline. Jangan mengulang baseline atau repair otomatis. Policy/penugasan INITIAL perlu divalidasi, bukan dianggap kebijakan final.
3. Perubahan policy atau pencabutan kewenangan sesudah pemeriksaan/approval menahan penerbitan nomor baru. Pemulihan pengajuan yang sudah siap nomor memerlukan penanganan alur persetujuan pada PR-03 atau pemulihan kewenangan yang sah; PR-02 tidak otomatis membatalkan approval/dokumen historis atau memutar status surat. Hindari mengubah policy aktif tanpa rencana penanganan antrean.
4. GAP akses penerima sebelum pengiriman, pengiriman/receipt, balasan resmi, dan deduplikasi pembuat-pejabat tetap pekerjaan PR berikutnya. Reviewer yang kebetulan juga penyetuju/penandatangan dapat memiliki hak lain berdasarkan peran terpisah, bukan karena review.
5. Nomor lama dan 13 surat tanpa versi tidak dipulihkan oleh PR-02. Surat lama tanpa kategori/versi yang hendak diajukan tidak boleh melewati gate baru; perlu koreksi oleh pembuat/penanganan berotorisasi, tanpa membuat dokumen pengganti otomatis. Retry nomor yang telah sah tetap idempoten dan tidak memerlukan review fiktif historis.

## Titik berhenti

Draft PR-02 diajukan di atas PR-01, tanpa merge, migrasi production atau deployment. PR-03 tidak diizinkan dan tidak dimulai. Hasil CI/publikasi terbaru tersedia di halaman PR; laporan tidak menyatakan seluruh CI hijau bila job PostgreSQL baseline gagal.

## Publikasi dan CI terverifikasi

[Draft PR #3](https://github.com/Salsabiil08/SuratDigitalSIA/pull/3) dibuka ke branch PR-01 pada commit implementasi `b9d860bd6081af4f93e4c5d0ffc64c712880578e`, tanpa merge. [CI run 44251004155](https://github.com/Salsabiil08/SuratDigitalSIA/actions/runs/44251004155): job check lulus typecheck/136 tes; job db berhasil menerapkan seluruh 16 migrasi ke PostgreSQL sementara runner, kemudian gagal di `01_numbering_test.sql:106` dengan **Pemeriksaan versi terkini belum selesai atau kewenangan berubah.** Fixture lama tidak menyiapkan kategori/review, sehingga pada PR-02 tertahan guard tambahan sebelum mencapai guard dokumen baseline. Reproduksi terpisah tanpa PR-02 tetap menunjukkan kegagalan awal **Surat belum siap diterbitkan.** karena versi kosong. Ini dua bukti berbeda, bukan klaim pesan CI sama atau suite PostgreSQL/RLS/konkurensi penuh lulus.

Pemeriksaan setelah publikasi: deployment branch PR-02 berjumlah nol; production tetap READY pada deployment `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc`, SHA `4e0c0c661af58dd6db729c202643cd6629f7eb07`; main tetap SHA baseline yang sama. Tidak ada perubahan database production. Commit laporan dapat memicu ulang CI; status terbaru tersedia di PR. Pengaman branch tetap berlaku. PR-03 belum dimulai.
