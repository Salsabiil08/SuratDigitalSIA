# PR-05 — Kotak Masuk, Kotak Keluar, status alur surat

18 November 2026 (WIB). Repository `Salsabiil08/SuratDigitalSIA`, branch `feat/pr-05-inbox-outbox`, basis PR-04 `40a593e1e9e3a7033daf4f4f7d6b01ebe449765c`. PR sebelumnya belum digabungkan. Tidak ada izin merge, migrasi production atau deployment. PR-06/PR-07 tidak dimulai.

## File dan migrasi

| Area | File/perubahan |
|---|---|
| Migrasi aditif | `supabase/migrations/20261118074431_internal_mailboxes.sql`: helper outbox session-bound, RPC list SECURITY INVOKER, policy metadata penerima untuk pengirim berwenang, indeks sort waktu/id |
| Pembaca daftar | `src/server/mailbox.ts`: requireUser, createClient pengguna, validasi respons dan error; tanpa createAdminClient |
| Domain | `src/domain/mailbox.ts`: query/filter, pagination/URL, tanggal WIB, tipe item/penerima dan agregat PRIMARY/CC; `notification-links.ts`: tautan internal lokal, bukan otorisasi |
| Rute | `src/app/(dashboard)/kotak-masuk/page.tsx`, `kotak-keluar/page.tsx`, dynamic per sesi |
| UI | `src/components/mailbox/prepared-mailbox.tsx`, `mailbox-client.tsx`: form GET, filter, daftar kartu/grid responsif, pagination, empty/error, aksi receipt |
| Navigasi/notifikasi | Sidebar dan dashboard-shell, halaman notifikasi, detail surat: Inbox/Outbox dan tautan kembali; Surat Saya tetap |
| Invalidation | `src/server/actions/delivery.ts` dan API document: invalidate daftar sesudah kirim/READ/RECEIVE, tanpa menyamakan tindakan tersebut |
| Pengujian | `supabase/tests/05_mailbox_test.sql`, skrip DB dan postgres-fixtures, `mailbox.test.ts`, `mailbox-server.test.ts`, `mailbox-ui.test.tsx`; mock next/cache pada delivery-api test mengikuti invalidation |
| Dokumentasi/pengaman | Acuan AGENTS/README/indeks/spesifikasi/backlog diperbarui; vercel.json menonaktifkan auto-deploy hanya branch PR-05 tambahan |

Tidak menulis ulang dispatch atau data penerima. Tidak membuat delivery/receipt dari 13 surat historis. Tidak mengganti alur editor/review/approval/nomor/TTD/disposisi. Tidak menambah reply/disposition action palsu atau disabled placeholder. ID letter/dispatch dan role penerima menjadi titik integrasi tahap berikutnya saja.

## Semantik dan kewenangan

- Inbox mensyaratkan baris pengiriman resmi dan baris penerima `profile_id=auth.uid()`. Final yang belum dikirim, draft/review atau nomor saja tidak menjadi Inbox. Jika pengguna juga punya peran lain, itu bukan alasan memasukkan surat yang belum dikirim kepadanya ke Inbox.
- Outbox hanya untuk creator, actual sender atau delegasi unit yang sah, tetap memerlukan hak baca PR-04. Super Admin/reviewer/approver/signer bukan otomatis pembaca Outbox seluruh surat. Pengirim historis yang hak bacanya dicabut tidak memperoleh akses baru dari daftar ini.
- Policy dispatch_recipients memberi receiver-only baris sendiri. Pemilik/pengirim/delegasi Outbox sah dapat melihat status semua penerima pengiriman dalam lingkupnya. Helper SECURITY DEFINER hanya boolean, terikat `auth.uid()`, tanpa actor parameter, search_path tetap. RPC daftar SECURITY INVOKER menegakkan RLS pada seluruh query; executable hanya authenticated, bukan anon/service_role.
- Item hanya metadata sah: pengirim, perihal, nomor, final_at/sent_at, status dokumen bila dibatalkan, serta identitas/role/read_at/received_at penerima yang boleh dilihat. Isi, storage path, hash, audit privat dan riwayat approval tidak diambil oleh daftar.
- Semua = pengiriman sesuai kotak. Belum Dibaca = ada penerima yang berlaku pada kotak tersebut dengan read_at NULL. Belum Diterima/Sudah Diterima hanya PRIMARY berdasarkan received_at, karena CC tidak berhak memberi receipt utama. Inbox CC menampilkan status salinan dan tidak otomatis wajib balas.
- Outbox menampilkan tiap penerima, bukan satu status dokumen pengganti. Agregat menyebut jumlah penerima/baca serta receipt PRIMARY dan jumlah CC; tidak menyatakan Selesai karena final/terkirim. Dokumen final, terkirim, dibaca, diterima memiliki waktu masing-masing dalam WIB.
- Daftar tidak mempunyai mutation READ/RECEIVE. Membuka pratinjau/unduhan memakai API PR-04 (READ saja); receipt tombol eksplisit PRIMARY melalui RPC PR-04 dari sesi, lalu server refresh data nyata. Error mutasi tidak optimistis ditampilkan diterima.
- Pencarian perihal/nomor/pengirim adalah literal case-insensitive (parameter RPC, bukan string SQL/or filter yang disambung). Filter dan kata pencarian dipertahankan saat pagination. Ukuran 10/20/50; page dan input dibatasi. Sort `sent_at DESC,id DESC` stabil; page di luar rentang dikembalikan ke halaman terakhir yang sah. Count dan item memakai satu query snapshot, bukan count global sebelum RLS.
- Query Auth/database/response gagal melempar error dan halaman menampilkan alert/coba kembali; bukan fallback data kosong sukses. Kosong yang sah memiliki total 0 dan pesan kosong tersendiri.

## Cache, navigasi dan visual

Rute force-dynamic, pembaca tidak memakai cache global lintas pengguna, dan tidak memakai service role. Perbarui/focus/visibility memuat ulang data sesi; kembali dari link surat menyegarkan daftar sekali memakai penanda rute UI di sessionStorage. Penanda ini tidak menyimpan dokumen/identitas/status dan bukan sumber kebenaran. Tidak ada polling atau layar kata Memuat baru. Pengiriman/receipt dan READ API menginvalidasi rute daftar.

Notifikasi memakai `/surat/{id}` dengan origin kotak yang sesuai untuk pengiriman/penerimaan internal, tanpa membuat URL Storage atau hak baca. Halaman/API tetap Auth/RLS; URL lama tidak meloloskan akses yang sudah dicabut. Link surat tidak diprefetch sebagai dokumen dan navigasi tidak membuat receipt.

Kartu memakai komponen/palet/typografi SIADocs yang ada, grid/flex responsif, teks panjang dapat dibungkus; form/filter/pagination tetap dapat dipakai pada layar kecil. Identitas visual dan nama Dashboard dipertahankan. Belum ada klaim screenshot/UAT perangkat nyata.

## Hasil lokal dan fixture

- `npm run check`: **202/202 tes dan typecheck lulus**, 22 berkas, termasuk seluruh regresi PR-04. Hasil akhir CI dicatat sesudah run.
- Domain mailbox/link 4 kasus; server read 5 kasus (sesi/RPC tanpa actor/service, tanpa akun, query/response gagal); UI server-render 5 kasus (status/tombol PRIMARY, CC, multi recipient/agregat, error terpisah kosong, URL/pagination dan layout responsif).
- Fixture `05_mailbox_test.sql` lewat PGlite: final unsent tidak muncul; 23 pengiriman, pencarian literal/nomor/pengirim/case, filter READ/RECEIVE independen, tiga halaman tanpa duplikasi, clamp page, akun lain/admin, delegasi dicabut, CC dan status masing-masing, daftar tidak memutasi read/receipt, query permission/inactive benar-benar error, anon/service tidak mendapat execute RPC.
- Fixture yang sama ditambahkan ke suite PostgreSQL nyata, bersama regresi nomor/review/approval/TTD/disposisi/delivery/Storage dan konkurensi PR-04. Kelulusan PGlite tidak disamakan dengan PostgreSQL sebelum hasil CI tersedia.
- `npm run build` lulus kompilasi, typecheck dan pembangkitan 23 halaman termasuk dua route baru; bukan deployment.
- Migrasi tidak DML pada surat/dispatch/recipient/audit. Uji forward 13 surat lama tetap utuh, tanpa delivery/receipt fiktif. Seluruh 18 migrasi baseline dan dependensi/CI tetap dipertahankan; hanya migrasi baru, fixture dan skrip pengujian yang ditambah.

Metadata production hanya dibaca: RPC mailbox belum ada, tabel dispatch belum diterapkan di production dan history tetap 8 entri. Tidak ada apply_migration, repair, seed, DML/DDL production, merge atau deploy.

## Risiko dan UAT staging

1. UAT Supabase Auth/Storage/browser staging tetap wajib: login lintas akun dan logout/back; daftar serta tautan notifikasi sesudah grant dicabut/nonaktif; PRIMARY/CC, beberapa penerima, read tanpa receipt dan receipt tanpa read; kembali dari preview/download dan penghitungan filter terkini.
2. UAT desktop/mobile untuk perihal/nomor/nama panjang, banyak penerima/CC, error jaringan, perpindahan filter/page, dan pagination sesudah receipt mengurangi halaman. Tes markup otomatis bukan bukti piksel/aksesibilitas perangkat lengkap.
3. Volume besar memerlukan pemeriksaan rencana query/index dan latensi count/search di staging. Pagination berbasis offset/sort stabil tidak menjanjikan snapshot lintas beberapa permintaan bila pengiriman baru masuk di antaranya; refresh kembali ke data terbaru adalah perilaku yang disengaja.
4. Delegasi/grant dan aktivasi CC PR-04 tetap keputusan perusahaan; CC default nonaktif. Jalur TTD luar tanpa unggahan dan penanganan surat historis tetap ketentuan aman PR-04. Daftar tidak memberikan hak bisnis baru kepada Super Admin atau mengadopsi data lama.
5. Kebijakan Outbox mengikuti hak baca aktif PR-04. Akses arsip historis setelah pencabutan mandat memerlukan keputusan perusahaan terpisah; tidak ditebak melalui UI ini.
6. Sebelum produksi perlu persetujuan tersendiri, backup/snapshot, staging sesuai schema/grant/policy serta tinjauan history 8 versus 18 migrasi baseline. Jangan replay baseline atau repair otomatis. Eksternal tidak dianggap dikirim/diterima melalui Inbox internal.

## Titik berhenti

Draft PR berbasis PR-04. Tidak merge, tidak mengubah database production atau deploy. Tidak mengimplementasikan PR-06 balasan resmi atau PR-07 integrasi disposisi. Hasil publikasi/CI ditambahkan setelah verifikasi, kemudian berhenti untuk peninjauan pengguna.
