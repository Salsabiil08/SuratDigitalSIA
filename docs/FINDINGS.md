# Pembaruan PR-05 — 18 November 2026

PR-05 diizinkan setelah penerimaan PR-04; [laporan](plans/PR05_VALIDATION.md). Production belum berubah.

- Kotak Masuk hanya dari dispatch_recipients resmi milik akun; Kotak Keluar dari pengiriman dengan kewenangan sender/creator/delegasi sah. Super Admin bukan pembaca global.
- Daftar memakai client sesi/RLS dan RPC SECURITY INVOKER tanpa actor parameter/service role. Pencarian literal, filter status penerima dan pagination dihitung pada snapshot query yang sama; error tidak diubah menjadi sukses kosong.
- Status/time final, kirim, baca dan receipt terpisah; status per penerima/CC tidak diratakan menjadi Selesai. Filter receipt mengecualikan CC yang tidak berhak menerima sebagai PRIMARY.
- Surat Saya tetap; notifikasi menuju detail berotorisasi dengan jalur kembali kotak yang sesuai. Membuka daftar tidak mencatat READ/RECEIVE; API dokumen PR-04 hanya READ, penerimaan tetap aksi eksplisit.
- Grant delegasi yang dicabut dapat menutup daftar/dokumen sesuai hak baca PR-04; tidak ada asumsi akses arsip global. CC default nonaktif dan keputusan perusahaan PR-04 tetap berlaku.
- PR-06 balasan dan integrasi disposisi PR-07 belum diizinkan; hanya identifier dispatch/letter/recipient disiapkan sebagai titik integrasi.

## Snapshot PR-04 (historis)

# Pembaruan PR-04 — 18 November 2026

PR-04 diizinkan setelah penerimaan PR-03; [laporan dan batas](plans/PR04_VALIDATION.md). Production belum berubah.

- G-01 ditangani pada branch: penerima tidak mendapat akses dari status NUMBERED/CANCELLED. Hak receiver berasal dari snapshot pengiriman; versi lama/riwayat workflow privat tidak ikut dibuka. API final menyajikan bytes snapshot, Storage langsung tertutup oleh policy restrictive.
- Pengiriman/penerimaan/read memiliki fakta terpisah, RPC actor terverifikasi, row lock dan transaksi event/audit wajib. READ/unduh tidak membuat receipt; receipt tidak membuat READ atau selesai alur.
- Delegasi pengiriman unit dan pengelola kebijakan harus eksplisit. CC default nonaktif karena aturan tembusan belum disahkan; bila diaktifkan oleh pengelola sah, CC hanya salinan dan tidak boleh mengaku PRIMARY atau otomatis wajib balas.
- Internal formal jalur EXTERNAL tanpa berkas TTD di Storage ditahan pengirimannya, menunggu keputusan perusahaan. Finalisasi/download existing tetap tersedia; tidak mengarang bukti pengesahan.
- CI run 44259876072 lulus check (187 tes/typecheck) dan PostgreSQL/konkurensi: 40 nomor unik, 20 retry masing-masing SEND/READ/RECEIVE tanpa duplikasi snapshot atau event.
- Inbox/Outbox, balasan dan integrasi disposisi dari Inbox tetap di luar PR-04. RLS relasi surat internal acuan tidak menjadi jalur pintas sebelum pengiriman.

## Snapshot PR-03 (historis)

# Pembaruan PR-03 — 18 November 2026

PR-03 diizinkan setelah penerimaan fungsional PR-02; production tetap di luar cakupan. [Laporan PR-03](plans/PR03_VALIDATION.md) dan [perbaikan fixture terpisah](plans/PR03_POSTGRES_FIXTURES.md).

- G-03 ditangani pada branch: approver wajib/tambahan terpisah dari signer; satu keputusan per aktor/siklus, creator-confirmation eksplisit dan terikat versi. Kewenangan SM Finance–Direktur tidak dihapus.
- Ringkasan penerbitan statis (G-06) diganti data versi/plan approval sesungguhnya. Allocator nomor tetap; gate memakai seluruh plan, bukan jumlah TTD.
- Penanganan perubahan kewenangan/policy setelah approval sebelum nomor tersedia melalui Tarik untuk Koreksi, lalu simpan versi baru. Keputusan lama utuh; tidak backfill persetujuan lama.
- Reviewer/pengelola review dan manager/grant approver tambahan perlu ditetapkan perusahaan. Mandat Finance lintas unit harus eksplisit; nama jabatan SM tetap umum.
- Fixture SQL lama disimpan sebagai arsip reproduksi. Fixture aktif memakai RPC nyata. CI run 44255908236 kini lulus check dan PostgreSQL/konkurensi (40 nomor unik, retry tanpa counter naik); blocker fixture baseline sudah diselesaikan tanpa melonggarkan guard.
- G-01 penerima pra-kirim serta distribusi/receipt/balasan belum ditangani. PR-04 belum diizinkan.

## Snapshot PR-02 (historis)

# Pembaruan PR-02 — 18 November 2026

Implementasi/pengujian lokal PR-02 diizinkan setelah penerimaan fungsional PR-01. [Laporan PR-02](plans/PR02_VALIDATION.md) membedakan perubahan branch dari production yang belum berubah.

- Kategori kini masuk form, draft dan pengajuan; reviewer independen mempunyai penugasan jenis/unit yang eksplisit dan hanya catatan/lolos/minta perbaikan. Keputusan terkait versi/hash, terpisah dari approval/TTD.
- G-04 bagian reviewer ditangani pada branch PR-02. Inbox pengiriman, receipt dan balasan formal masih menunggu PR terkait. G-01 akses penerima pra-kirim tidak dinyatakan telah diperbaiki oleh PR-02.
- Default kategori berstatus INITIAL; validasi perusahaan, penetapan pengelola policy dan pemberian kewenangan pemeriksa belum dilakukan. Tidak otomatis memberikan kewenangan bisnis kepada Super Admin/jabatan tertentu.
- [Investigasi fixture penomoran](plans/PR02_BASELINE_FIXTURE_INVESTIGATION.md) mereproduksi kegagalan pada baseline tanpa PR-02: READY_TO_ISSUE tanpa versi dokumen. Guard tidak dilonggarkan; perbaikan fixture penuh tetap terpisah.
- Tiga belas surat lama tidak dibackfill. Snapshot 13 surat simulasi dan audit sebelum/sesudah migrasi lokal identik setelah mengecualikan kolom baru NULL.

## Snapshot temuan PR-01 (historis)

# Pembaruan PR-01 — 18 November 2026

Implementasi/pengujian lokal PR-01 disetujui setelah PR-00. [Laporan PR-01](plans/PR01_VALIDATION.md) mencatat bukti dan batas; production belum berubah.

- G-02: label `finalized_at` kini **Dokumen final**, tidak lagi Selesai. Pengiriman/penerimaan/selesai alur belum diimplementasikan.
- G-06, bagian notifikasi: helper service-role publik tanpa caller dihapus. Event tetap berasal dari RPC sah. Migrasi baru mempersempit ACL/RLS dan melindungi kolom event; error write diteruskan sebagai gagal, judul dinormalisasi Indonesia. Perbaikan belum aktif di production.
- G-06, ringkasan penerbitan statis, G-01 akses penerima pra-kirim, G-03 deduplikasi dan G-04 reviewer/Inbox/receipt/balasan tetap terbuka untuk PR terkait.
- Tes PostgreSQL baseline PR-00 gagal pada fixture penomoran; tidak diperbaiki terselubung oleh PR-01 dan tetap penghalang CI penuh.

## Snapshot temuan PR-00 (historis)

# Temuan aktif — PR-00 R.04 adaptasi NDO

Tanggal: 18 November 2026. Temuan audit disimpan, belum diperbaiki oleh PR dokumentasi ini.

| ID | Keputusan/temuan | Perlakuan PR-00 |
|---|---|---|
| D-01 | Website live berasal dari SuratDigitalSIA, bukan SIAdocs | Pengguna menetapkan SuratDigitalSIA sebagai basis; tidak ada rekonsiliasi sekarang. |
| D-02 | Review wajib/opsional harus memperhitungkan kategori dan jenis | Default awal Permohonan/Laporan wajib, Pemberitahuan opsional; konfigurasi awal belum tervalidasi perusahaan. Tidak diterapkan ke database. |
| D-03 | Reviewer tidak mengedit | Catatan, setujui pemeriksaan atau minta revisi saja; pembuat membuat versi baru. |
| G-01 | Penerima dapat membaca sejak NUMBERED sebelum kirim | Tetap GAP sampai PR pengiriman/RLS disetujui; target hak baca berbasis snapshot pengiriman. |
| G-02 | finalized_at menyebabkan label Selesai tanpa bukti pengiriman/penerimaan | Kontrak target memisahkan finalitas dan selesai alur; runtime tidak diubah. |
| G-03 | Pembuat yang juga signer mendapat approval duplikat | Rencana deduplikasi tanpa melewati kewenangan pihak wajib lain/penerbitan/TTD. |
| G-04 | Reviewer, Inbox, receipt dan balasan formal belum tersambung | Target dan urutan PR dicatat, bukan dinyatakan tersedia. |
| G-05 | Ada 13 surat bernomor tanpa versi dokumen dan selisih history migrasi | Tidak diubah otomatis, tidak dibuat bukti palsu, tidak menjalankan ulang baseline/repair. |
| G-06 | Helper notifikasi tanpa guard dan judul berkode; ringkasan nomor lama statis | Tetap temuan terbuka untuk PR-01/PR terkait; tidak diperbaiki terselubung dalam PR-00. |
| G-07 | Panduan lama meniadakan editor/pengiriman/Inbox dan mengklaim selesai penuh | Diberi penanda historis; spesifikasi target dan bukti baseline menjadi acuan aktif. |

Lihat [baseline](baselines/production-2026-11-18.md), [spesifikasi target](spec/08-alur-ndo-r04.md) dan [rencana migrasi](plans/R04_NDO_MIGRATION_PLAN.md). Validasi perusahaan tentang lingkup reviewer, pengesah policy, override per jenis, bukti terima luar dan penutupan balasan masih tertunda. Izin PR-00 tidak mengizinkan PR-01, perubahan database production, merge atau deployment.

## Catatan historis sebelum PR-00

Catatan berikut dipertahankan sebagai riwayat, bukan bukti seluruh target baru sudah berfungsi. Misalnya klaim lama bahwa kolom distribution_status dihapus tidak sama dengan schema aktual audit: kolom/tabel masih ada, alurnya belum tersambung.

# Temuan & Laporan Hasil Uji Arsitektur (Blueprint R.04)

Catat di sini temuan, klarifikasi teknis, atau penegasan aturan bisnis SIADocs Blueprint R.04.

| Tanggal | Temuan / Klarifikasi | Rujukan | Keputusan & Solusi Implementasi |
|---|---|---|---|
| 2026-11-14 | **Penerbitan Nomor Satu Transaksi**: Transisi dari R.03 (status `ALLOCATED`) ke R.04 langsung mengeksekusi `READY_TO_ISSUE` $\rightarrow$ `NUMBERED` dalam satu transaksi ACID. | Blueprint R.04 Bab 5 & 6; `ANTIGRAVITY.md` Bagian 3 | Diimplementasikan fungsi database `issue_letter_number` satu langkah atomik. Tabel `number_issuances` mencatat status `'ISSUED'`. Telah diuji konkurensi (paralel) dan idempotensinya. |
| 2026-11-14 | **Penghapusan Status Distribusi**: Di R.03 terdapat pelacakan distribusi dan ekspedisi. Di R.04 status pengiriman dihilangkan sepenuhnya dari tabel `letters`. | Dokumen Perubahan R.03 ke R.04; Blueprint R.04 | Kolom `distribution_status` dihapus dari model domain dan skema database. Tabel `letters` hanya memuat dua status utama: Status Proses (`status`) dan Status Pengesahan (`signature_status`). |
| 2026-11-14 | **Integritas Selesai Disposisi**: Disposisi dengan `requires_letter = true` harus terikat ke surat dan surat tersebut harus sudah berstatus `NUMBERED`. | Blueprint R.04 Bab 6.13; `docs/spec/01-aturan-bisnis.md` | Ditegakkan ganda melalui domain check TypeScript `canCompleteDisposition` dan Database Trigger `check_disposition_completion` pada PostgreSQL. |
| 2026-11-14 | **Nomor Surat Dibatalkan**: Surat bernomor resmi yang dibatalkan tidak boleh kehilangan nomor resminya. | Blueprint R.04 Bab 6.12; `ANTIGRAVITY.md` Bagian 3 | Fungsi `cancel_numbered_letter` memvalidasi alasan, mempertahankan `official_number`, mengubah status menjadi `CANCELLED`, dan mencatat ke `audit_logs`. Nomor tidak pernah dilepas kembali ke antrean penomoran. |
| 2026-11-14 | **Privasi Dokumen pada Notifikasi & Audit**: Pengguna tidak boleh melihat kutipan atau isi dokumen pada push notification atau log sistem. | Blueprint R.04 Bab 8; `ANTIGRAVITY.md` Bagian 8 | Tabel `notifications` dan `audit_logs` hanya memuat referensi ID, judul event, dan metadata status. Tidak ada kolom isi dokumen. |

---

## Verifikasi 11 Kriteria Penerimaan Bab 10 Blueprint R.04

Seluruh 11 kriteria penerimaan telah diuji secara otomatis pada file [tests/acceptance.test.ts](file:///c:/Users/Asus/Downloads/siadocs_r04%20(1)/siadocs/tests/acceptance.test.ts):

1. **Nomor tidak pernah terbit saat Draft** $\rightarrow$ **LULUS** (`mayHaveOfficialNumber('DRAFT') === false`, percobaan terbit saat draft melempar `TransitionError`).
2. **Dua penerbitan bersamaan tidak menghasilkan nomor ganda (Idempotensi)** $\rightarrow$ **LULUS** (30 request paralel untuk surat yang sama mengembalikan nomor identik, 25 request surat berbeda menghasilkan 25 nomor unik berurutan tanpa selisih).
3. **Tiga format nomor benar dan reset tahunan Asia/Jakarta** $\rightarrow$ **LULUS** (Format Eksternal `/KRE.DIR/`, Pengantar Tagihan `-Tag/`, Internal `-IN/`, konversi pergantian tahun berbasis WIB).
4. **Surat dibatalkan tetap menyimpan nomor** $\rightarrow$ **LULUS** (`status = CANCELLED` tetap menyimpan `official_number` dan status bersifat terminal).
5. **Buat Surat (CREATE) dan Ambil Nomor (UPLOAD) memakai aturan yang sama** $\rightarrow$ **LULUS** (Keduanya berawal dari DRAFT, melalui persetujuan, dan mencapai `READY_TO_ISSUE` sebelum diterbitkan).
6. **Tagihan hanya untuk Finance dengan dua persetujuan dan dua tanda tangan** $\rightarrow$ **LULUS** (Terbilang rupiah otomatis, jalur unit FIN/ACH).
7. **Eksternal tidak bernomor tanpa konfirmasi pejabat berwenang** $\rightarrow$ **LULUS** (Memerlukan persetujuan tahap akhir menuju `READY_TO_ISSUE`).
8. **Kedua jalur pengesahan berfungsi** $\rightarrow$ **LULUS** (Jalur `IN_APP` bertransisi ke `WAITING` untuk pelacakan unggah bertanda tangan, jalur `EXTERNAL` langsung `EXTERNAL`).
9. **Disposisi yang menuntut surat tidak Selesai sebelum surat NUMBERED** $\rightarrow$ **LULUS** (Trigger SQL dan domain menolak penyelesaian disposisi jika surat belum bernomor).
10. **Log History hanya Super Admin** $\rightarrow$ **LULUS** (Hak akses RLS dan Server Guard khusus peran Super Admin, tanpa isi dokumen).
11. **Tidak ada editor isi, distribusi, arsip, atau penyisipan nomor otomatis** $\rightarrow$ **LULUS** (Aplikasi murni berfungsi sebagai sistem penomoran dan disposisi persuratan digital sesuai batasan Blueprint R.04).

## Revisi pengguna 18 November 2026

- Form pembuatan sebelumnya langsung menulis NUMBERED dan merangkai nomor di server JavaScript, tanpa transaksi counter resmi dan tanpa approval; 13 nomor lama tidak memiliki number_issuances. Nomor tersebut dipertahankan dan counter baru menghindari penggunaan ulang.
- Daftar approval sebelumnya membaca step_number, padahal skema menggunakan step_order; pengajuan menulis PENDING tetapi daftar membaca WAITING. Beberapa penulisan tidak memeriksa error.
- Production belum memiliki bucket Storage. Akun contoh auth.users belum memiliki kata sandi/konfirmasi email; fallback cookie berisi profil dan login dengan password arbitrer tidak membuktikan identitas.
- Instruksi eksplisit REV-01..07 menggantikan batasan R.04 yang melarang editor/gambar TTD/stempel; perbedaan terhadap R.03 dijelaskan pada docs/spec/00-revisi-alur.md.
