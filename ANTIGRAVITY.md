> **Panduan historis — bukan kontrak aktif.** Ikuti `AGENTS.md`, `docs/INDEX.md`, dan `docs/spec/08-alur-ndo-r04.md` di root repo. PR-08 FINAL disetujui untuk implementasi dan pengujian lokal; jangan membuat fase PR-09, ubah database production, merge atau deploy tanpa persetujuan. Bagian lama yang melarang editor, gambar TTD/stempel, pengiriman atau Kotak Masuk tidak mengalahkan keputusan pengguna terbaru. Panduan visual yang tidak bertentangan tetap dapat digunakan.

> Revisi aktif: instruksi pengguna REV-01–07 tanggal 18 November 2026 pada `docs/spec/00-revisi-alur.md` berlaku di atas batasan lama yang bertentangan di dokumen ini.

# ANTIGRAVITY.md: Membangun SIADocs R.04

File ini adalah instruksi utama untuk agen di Google Antigravity (atau agen lain) agar membangun aplikasi **SIADocs** PT Semen Indonesia Aceh dengan **Next.js, TypeScript, dan Supabase**. Baca seluruh file sebelum menulis kode.

## 0. Cara memakai di Antigravity

1. Buka folder repo `siadocs/` sebagai workspace.
2. Salin file ini ke `.agent/rules/siadocs.md` (aturan workspace) agar selalu dibaca agen. `AGENTS.md` dan `CLAUDE.md` yang sudah ada tetap dibaca, tetapi bila berbeda, **file ini dan Blueprint R.04 yang berlaku**.
3. Pakai mode **Planning**. Minta agen membuat rencana dan daftar tugas per milestone (bagian 9) sebelum mengubah kode. Tinjau rencana, lalu setujui.
4. Kerjakan **satu milestone per percakapan agen**. Setelah tiap milestone jalankan `npm run check` dan commit.
5. Prompt pertama yang ditempel ada di bagian 11.

## 1. Tujuan produk

SIADocs adalah **sistem penomoran dan disposisi surat digital**. Fokusnya memastikan nomor surat resmi diterbitkan secara sah, unik, dan tercatat oleh pihak berwenang. Surat tetap disusun dan ditandatangani **di luar** sistem.

Dua layanan dengan aturan penomoran yang sama:
- **Buat Surat**: untuk surat yang belum ada. Isi data surat, unduh kop resmi, susun surat di luar sistem, unggah sebagai bukti.
- **Ambil Nomor**: untuk surat yang sudah jadi. Unggah surat dan isi data surat.

Tiga jenis surat: **Internal**, **Eksternal**, **Surat Pengantar Tagihan** (hanya unit Finance, tanpa penerima khusus).

## 2. Sumber kebenaran (urutan prioritas)

1. `docs/blueprint/Blueprint_R04_SIADocs.pdf` atau `.docx` (resmi, dengan diagram alur)
2. `docs/perubahan-R03-ke-R04.md` (apa yang berubah dari R.03)
3. `docs/spec/*.md` (ringkasan aturan, sudah disesuaikan ke R.04). `docs/arsip-R03/` hanya sejarah, jangan dipakai
4. `supabase/migrations/` (skema yang berjalan)
5. `docs/ui-reference/` (contoh tampilan)

Bila spesifikasi dan kode berbeda, spesifikasi menang. Catat temuan di `docs/FINDINGS.md`. Jangan mengubah aturan bisnis sendiri.

## 3. Aturan bisnis yang tidak boleh diubah

1. Nomor **tidak pernah** terbit saat draft. Nomor terbit hanya lewat aksi **Terbitkan Nomor Surat** setelah validasi, surat bukti terunggah, dan semua persetujuan wajib terpenuhi (status `READY_TO_ISSUE`). Persetujuan terakhir tidak menerbitkan nomor otomatis.
2. Nomor **atomik, unik, idempoten, tidak dipakai ulang, tidak dapat diedit**. Surat yang dibatalkan tetap menyimpan nomornya.
3. Tiga format nomor (contoh konfigurasi, tahun mengikuti go-live):
   - Eksternal: `{URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}`
   - Tagihan: `{URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}`
   - Internal: `{URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}`
   Nomor urut per seri dan tahun, mulai 001, reset tahunan menurut Asia/Jakarta. Tanpa migrasi register Excel.
4. **Penerbitan satu transaksi (R.04)**: `READY_TO_ISSUE` langsung menjadi `NUMBERED`. Tidak ada tahap pembuatan dokumen bernomor. Sistem **tidak menyisipkan nomor** ke DOCX atau PDF. Pengguna menyalin nomor atau mengunduh **kop bernomor**.
5. Status dipisah: **proses** (`DRAFT`, `IN_REVIEW`, `REVISION_REQUESTED`, `REJECTED`, `READY_TO_ISSUE`, `NUMBERED`, `CANCELLED`) dan **pengesahan** (`NOT_STARTED`, `NOT_REQUIRED`, `WAITING`, `UPLOADED`, `EXTERNAL`). **Status pengiriman dihapus.** `NUMBERED` tidak berarti sudah ditandatangani. `REJECTED` berbeda dari `CANCELLED`.
6. Dua jalur pengesahan dipilih pembuat: `IN_APP` (dilacak: penandatangan unduh, tanda tangan di luar, unggah dokumen bertanda tangan) dan `EXTERNAL` (unduh dokumen bernomor dengan ruang tanda tangan kosong, tidak dilacak).
7. Penandatangan hanya **Senior Manager dan Direktur Utama**. GM tidak dapat menandatangani. Eksternal: 1 tanda tangan. Tagihan: persetujuan SM Finance lalu Direktur Utama, 2 tanda tangan berurutan. Internal biasa antarstaf: persetujuan tidak wajib.
8. **Disposisi** satu tingkat: satu pemberi, satu penerima, status Baru, Diproses, Selesai. Bila `requires_letter` benar, disposisi **tidak boleh Selesai** sebelum surat terkait berstatus `NUMBERED`. Belum ada dokumen: pakai Buat Surat. Dokumen sudah ada: pakai Ambil Nomor.
9. Pembatalan surat bernomor: alasan wajib dan otorisasi menurut kewenangan (Internal: kepala unit atau delegasi tercatat. Eksternal: penandatangan. Tagihan: SM Finance dan Direktur Utama). Dieksekusi sistem, bukan tombol Super Admin.
10. **Log History hanya Super Admin.** Super Admin tidak otomatis menyetujui, menandatangani, membatalkan, atau melihat isi surat.
11. Struktur organisasi dinamis (Master Organisasi). Jangan meng-hardcode unit, jabatan, atau kode.
12. Dilarang: editor isi surat, template isi, distribusi, Kotak Masuk, Konfirmasi Terima, modul arsip, tanda tangan elektronik tersertifikasi, gambar tanda tangan atau stempel, OCR atau AI.
13. Data yang belum dikonfirmasi perusahaan diberi penanda `[PERLU VERIFIKASI PERUSAHAAN]`. Jangan mengarang data resmi.

## 4. Stack dan Supabase

- Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage, Realtime). Uji: vitest dan uji SQL di `supabase/tests/`.
- Seluruh data dan berkas memakai **Supabase**. Tidak ada basis data lain.

Langkah penyiapan (lakukan di M0, minta pengguna menjalankan bagian yang butuh akun):
1. Buat proyek Supabase. Isi `.env.local` dari `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (hanya server, jangan pernah ke browser).
2. Pasang Supabase CLI. `supabase link`, lalu `supabase db push` untuk menjalankan `supabase/migrations/`. Untuk pengembangan lokal pakai `supabase start`.
3. Bucket Storage privat: `letter-documents` (bukti, akhir, bertanda tangan) dan `letter-attachments`. Unduhan lewat signed URL berwaktu. Batas total lampiran 25 MB per surat (nilai di `system_settings`).
4. Aktifkan Realtime untuk tabel `notifications`.
5. RLS aktif di semua tabel. Pemeriksaan hak akses di database **dan** server. Menyembunyikan tombol tidak cukup.
6. Penerbitan nomor hanya lewat fungsi `issue_letter_number` yang dipanggil dari server dengan service role. Klien tidak boleh menulis `number_counters` atau `number_issuances`.
7. Seed (`supabase/seed.sql`): jenis surat, seri contoh, unit contoh (Accounting, Reporting, Finance), jabatan (Direktur Utama, Senior Manager, GM/Kepala Unit, Staff/PIC), pengguna demo per peran. Tandai sebagai contoh konfigurasi.

## 5. Perubahan skema untuk R.04 (migrasi baru `20261114000001_r04.sql`)

Audit ketergantungan dulu. **Jangan menghapus** tabel atau kolom lama sebelum audit selesai dan tes lulus. Lakukan:
- `letters`: tambah `source` (`CREATE` atau `UPLOAD`). Kolom status pengiriman tidak dipakai lagi.
- Sederhanakan penerbitan: `issue_letter_number(letter_id, actor, idempotency_key)` menyimpan nomor, mengubah `letters.status` menjadi `NUMBERED`, mengisi `official_number`, dan mencatat audit dalam **satu transaksi**. Hentikan pemakaian `complete_number_issuance` dan status `ALLOCATED`/`COMPLETED`. Pertahankan idempotensi dan uji konkurensi.
- `dispositions`: tambah `requires_letter boolean`, `letter_id uuid` (FK `letters`, opsional), `followup_note text`. Constraint atau trigger: status `Selesai` ditolak bila `requires_letter` dan surat terkait bukan `NUMBERED`.
- Jenis dokumen pada `letter_versions`: bukti (`DRAFT`), akhir (`NUMBERED`, diunggah pembuat), bertanda tangan (`SIGNED`, hanya jalur `IN_APP`).
- Tabel `letter_templates`, `letter_distributions`, `push_subscriptions` dibiarkan, tidak dipakai UI.
- Perbarui `src/domain/status.ts`: hapus `DistributionStatus`, `ISSUE_NUMBER` ke `NUMBERED`. Perbarui seluruh tes. Perbarui RLS dan tes RLS.

## 6. Desain UI (wajib mengikuti)

Contoh tampilan ada di `docs/ui-reference/` (HTML dan CSS) dan logo di `docs/ui-reference/assets/logo.png`. **Pertahankan semua teks dan alur yang ada pada contoh.**

**Palet**
| Peran | Warna |
|---|---|
| Merah utama | `#B30B0B` |
| Merah terang | `#E62314` |
| Oranye | `#F26A0F` |
| Sidebar (navy) | `#121A22`, teks menu `#E1E5EA` |
| Menu aktif | latar `rgba(242,106,15,.22)`, teks `#FFB27A` |
| Latar halaman | gradien `135deg, #FFF3EA 0%, #F4F4F7 55%, #EEF0F5 100%` |
| Kartu | putih, garis `#E4E4E0`, bayangan lembut |
| Teks redup | `#9AA3AE` |

**Tipografi**: teks isi memakai sans-serif bersih (Inter). Tulisan **SIADocs** di samping logo memakai **Playfair Display 800** (25 px di sidebar, 34 px di Login). Pasang lewat `next/font`.

**Pola umum**
- Tata letak: sidebar navy kiri (logo + SIADocs di atas, menu berkelompok, kartu pengguna di bawah) dan konten di kanan. Garis atas konten 4 px gradien merah ke oranye.
- Tombol utama: pil (`border-radius:999px`), gradien `90deg, #B30B0B, #E62314 55%, #F26A0F`, bayangan lembut. Tombol sekunder: pil putih bergaris.
- Kartu bersudut membulat dengan bayangan halus. Tabel bersih dengan baris tipis. Tab berbentuk pil.
- Chip status berwarna: abu (Draft), kuning (Menunggu), biru (Siap Diberi Nomor), hijau (Sudah Bernomor), merah (Ditolak atau Dibatalkan). Warna tidak boleh menjadi satu-satunya pembeda: sertakan label teks.
- Login: panel kiri gradien `#121A22` ke `#B30B0B` dengan logo dan hiasan kartu, panel kanan formulir pada latar hangat.
- Responsif (ponsel dan desktop), fokus keyboard terlihat, kontras teks memenuhi WCAG AA.
- Satu set komponen bersama (`src/components/ui`): `Button`, `Card`, `Chip`, `Table`, `Tabs`, `Field`, `Sidebar`, `PageHeader`. Jangan menulis gaya yang sama berulang di tiap halaman.

**Halaman (rute)**
| Rute | Halaman | Catatan |
|---|---|---|
| `/login` | Login | sesuai contoh |
| `/` | Dashboard | kartu ringkasan, pintasan Buat Surat dan Ambil Nomor |
| `/surat` | Surat Saya | tab, filter, cari nomor atau perihal, dua kolom status (proses, pengesahan) |
| `/surat/buat` | Buat Surat | jenis surat, data surat, jalur pengesahan, unduh kop, unggah bukti dan lampiran |
| `/surat/ambil-nomor` | **Ambil Nomor (baru)** | unggah surat jadi, data surat, jalur pengesahan |
| `/surat/[id]` | Detail Surat | riwayat; tombol Terbitkan Nomor Surat, Salin Nomor, Unduh Kop Bernomor, Unggah Dokumen Akhir, Ajukan Pembatalan. **Tanpa elemen distribusi** |
| `/surat/[id]/terbitkan` | Konfirmasi Penerbitan | ringkasan dan syarat |
| `/persetujuan` | Persetujuan Masuk | Setujui, Minta Revisi, Tolak |
| `/pengesahan` | Menunggu Pengesahan | unduh dan unggah dokumen bertanda tangan |
| `/tagihan/buat` | Surat Pengantar Tagihan | khusus Finance |
| `/disposisi` | Disposisi | daftar, form, kaitan ke surat |
| `/notifikasi`, `/profil` | Notifikasi, Profil | profil tanpa gambar tanda tangan |
| `/admin/organisasi`, `/admin/seri`, `/admin/log` | Master Organisasi, Seri Nomor, Log History | Super Admin |

## 7. Struktur kode

`src/app` (rute), `src/components/ui`, `src/server` (aksi server, akses data), `src/lib` (klien Supabase, util), `src/domain` (status, penomoran, aturan disposisi: murni, tanpa I/O, diuji), `supabase/migrations`, `supabase/tests`, `supabase/seed.sql`. Kode dan kolom berbahasa Inggris, teks antarmuka berbahasa Indonesia sesuai istilah blueprint.

## 8. Aturan bekerja untuk agen

- Kerjakan hanya yang ada di `tasks/BACKLOG.md` dan bagian 9. Jangan menambah fitur atau mengganti stack.
- Untuk keputusan teknis non-bisnis, pilih pendekatan paling sederhana, aman, dan konsisten, tanpa membuat daftar pertanyaan. Tanya hanya bila ada pertentangan **bisnis** kritis yang tidak bisa diselesaikan dari dokumen ini.
- Validasi di server untuk semua aksi. Setiap aksi penting dicatat di `audit_logs`.
- Tulis tes untuk aturan bisnis, terutama: nomor tidak terbit di draft, konkurensi dan idempotensi penomoran, reset tahunan, kewenangan penandatangan, aturan penyelesaian disposisi, RLS tiap peran.
- Jangan menyimpan rahasia di repo. Jangan menaruh service role di kode klien.
- Setelah tiap milestone: `npm run check` lulus, perbarui `tasks/BACKLOG.md`, ringkas hasil dan temuan.

## 9. Milestone

| M | Isi | Selesai bila |
|---|---|---|
| M0 | Scaffold Next.js, Tailwind, font, komponen UI dasar, klien Supabase, env | `npm run dev` jalan, `typecheck` dan `test` lulus |
| M1 | Migrasi R.04, perbarui domain dan tes, seed | `supabase db reset` sukses, tes SQL dan vitest lulus (termasuk konkurensi) |
| M2 | Auth, profil, peran, RLS, Master Organisasi, Master Jenis dan Seri | login per peran jalan, uji RLS tiap peran lulus |
| M3 | Buat Surat dan Ambil Nomor (draft, unggah bukti, lampiran, signed URL, unduh kop) | surat Draft tersimpan tanpa nomor |
| M4 | Persetujuan menurut jenis dan kewenangan, Konfirmasi dan Terbitkan Nomor Surat, Salin Nomor, Kop Bernomor, Dokumen Akhir | nomor terbit hanya di `READY_TO_ISSUE`, tanpa nomor ganda |
| M5 | Pengesahan dua jalur, Surat Pengantar Tagihan (rincian, bank, terbilang, 2 tanda tangan) | kedua jalur dan tagihan sesuai blueprint |
| M6 | Disposisi dengan aturan penyelesaian, Notifikasi (Realtime), Pembatalan bernomor | disposisi tidak Selesai sebelum surat `NUMBERED` |
| M7 | Dashboard, Surat Saya, Log History, polesan UI, aksesibilitas | seluruh halaman sesuai bagian 6 |
| M8 | Uji penerimaan terhadap Bab 10 Blueprint R.04 dan laporan temuan | 11 kriteria lulus |

## 10. Kriteria penerimaan (ringkas dari Blueprint R.04 Bab 10)

1. Nomor tidak pernah terbit saat Draft. 2. Dua penerbitan bersamaan tidak menghasilkan nomor ganda, dan permintaan ulang mengembalikan nomor yang sama. 3. Tiga format nomor benar dan reset tahunan Asia/Jakarta. 4. Surat dibatalkan tetap menyimpan nomor. 5. Buat Surat dan Ambil Nomor memakai aturan yang sama. 6. Tagihan hanya untuk Finance dengan dua persetujuan dan dua tanda tangan. 7. Eksternal tidak bernomor tanpa konfirmasi pejabat berwenang. 8. Kedua jalur pengesahan berfungsi dan hanya SM atau Direktur Utama yang menandatangani. 9. Disposisi yang menuntut surat tidak Selesai sebelum surat `NUMBERED`. 10. Log History hanya Super Admin. 11. Tidak ada editor isi, distribusi, arsip, atau penyisipan nomor otomatis.

## 11. Prompt pertama untuk ditempel di Antigravity

```
Baca ANTIGRAVITY.md, docs/blueprint/Blueprint_R04_SIADocs.pdf, docs/perubahan-R03-ke-R04.md,
docs/spec/*.md, dan docs/ui-reference/ (abaikan docs/arsip-R03). Buat rencana (Planning) dan daftar tugas untuk milestone M0
sampai M1 saja, lalu tunggu persetujuan saya. Patuhi aturan bisnis di bagian 3 dan jangan
mengubahnya. Pakai Supabase untuk semua data dan berkas. Setelah rencana disetujui, kerjakan M0,
jalankan npm run check, lalu laporkan hasilnya sebelum lanjut ke M1.
```
