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
