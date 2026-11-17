# SIADocs — PT Semen Indonesia Aceh (Blueprint R.04)

SIADocs adalah sistem penomoran dan disposisi surat digital PT Semen Indonesia Aceh berbasis **Next.js 14 (App Router), TypeScript, dan Supabase** sesuai spesifikasi resmi **Blueprint R.04**.

---

## Status Implementasi Backlog

Seluruh milestone dari **M0 hingga M8** pada [tasks/BACKLOG.md](tasks/BACKLOG.md) telah selesai 100% dan terverifikasi penuh:

| Bagian / Fitur | Status |
|---|---|
| Spesifikasi ringkas (`docs/spec/`) dan Blueprint R.04 (`docs/blueprint/`) | Siap |
| Skema database, fungsi atomik `issue_letter_number`, trigger disposisi, RLS multi-peran, seed | Siap, lulus uji PostgreSQL 15+ |
| Logika domain TypeScript (`src/domain/`: status, penomoran, terbilang rupiah) | Siap, 31 uji vitest lulus |
| Fondasi UI Next.js 14, Tailwind CSS, Google Fonts, komponen bersama (`src/components/ui/`) | Siap |
| Alur Buat Surat (`CREATE`) dan Ambil Nomor (`UPLOAD`) | Siap |
| Surat Pengantar Tagihan (rincian, bank, terbilang nominal otomatis) | Siap |
| Alur Persetujuan bertingkat, validasi kewenangan, Konfirmasi & Terbitkan Nomor resmi | Siap |
| Pengesahan tanda tangan dua jalur (`IN_APP` dan `EXTERNAL`) | Siap |
| Disposisi digital dengan aturan penyelesaian bersyarat (`requires_letter`) | Siap |
| Pusat Notifikasi Realtime dalam aplikasi (tanpa memuat isi dokumen) | Siap |
| Prosedur Pembatalan draf dan surat bernomor resmi (nomor tetap tersimpan) | Siap |
| Dashboard, Surat Saya, Detail Surat, Log History (Super Admin), aksesibilitas WCAG AA | Siap |

---

## Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js 18.17+ atau 20+
- Proyek Supabase (URL dan Kunci Akses)

### 2. Instalasi Dependensi & Konfigurasi
```bash
npm install
cp .env.example .env.local
```
Sesuaikan variabel lingkungan pada `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

### 4. Menjalankan Pengujian & Verifikasi
```bash
npm run typecheck    # Pemeriksaan tipe TypeScript (0 error)
npm run test         # Uji unit domain dan acceptance test vitest (31 test lulus)
npm run check        # Menjalankan typecheck dan seluruh rangkaian tes
npm run build        # Build produksi Next.js (18 rute terkompilasi)
```

---

## Aturan Bisnis Kritis (Blueprint R.04)

1. **Nomor Surat Tidak Pernah Terbit Saat Draft**: Nomor hanya terbit lewat aksi eksplisit *Terbitkan Nomor Surat* setelah surat mencapai status `READY_TO_ISSUE`.
2. **Penerbitan Nomor Satu Transaksi**: Transisi langsung dari `READY_TO_ISSUE` $\rightarrow$ `NUMBERED` dalam satu transaksi atomik ACID (`issue_letter_number`).
3. **Surat Dibatalkan Tetap Menyimpan Nomor**: Nomor resmi tidak pernah dihapus dan tidak pernah dipakai ulang untuk surat lain.
4. **Dua Jalur Pengesahan**:
   - `IN_APP`: Dilacak di aplikasi (unduh kop bernomor, tanda tangan di luar aplikasi, unggah berkas bertanda tangan, verifikasi hash SHA-256).
   - `EXTERNAL`: Di luar aplikasi (unduh kop bernomor, tanpa kewajiban unggah).
5. **Penyelesaian Disposisi**: Disposisi dengan `requires_letter = true` tidak boleh diselesaikan (`DONE`) sebelum surat terkait berstatus `NUMBERED`.
6. **Privasi dan Keamanan**: Notifikasi dan audit log tidak memuat isi dokumen surat. Jejak audit hanya dapat ditambah (*append-only*).

---

## Struktur Folder

```
AGENTS.md           Aturan wajib bagi pengembang AI
ANTIGRAVITY.md      Panduan implementasi teknis dan kriteria penerimaan
tasks/BACKLOG.md    Daftar tugas backlog M0 - M8
docs/spec/          Spesifikasi aturan bisnis dan model data
docs/FINDINGS.md    Catatan temuan dan hasil uji arsitektur
supabase/
  migrations/       Migrasi skema database (termasuk 20261114000001_r04.sql)
  seed.sql          Data awal contoh (unit, jabatan, seri, user demo)
  tests/            Uji SQL penomoran dan RLS
src/
  app/              Rute halaman Next.js 14 App Router
  components/ui/    Komponen UI bersama (Button, Card, Chip, Table, Sidebar, dll.)
  domain/           Logika bisnis murni tanpa I/O (status, penomoran, terbilang)
  lib/supabase/     Klien Supabase (browser, server, admin)
  server/           Server actions (surat, persetujuan, tanda tangan, disposisi, notifikasi, admin)
tests/              Uji vitest (domain.test.ts dan acceptance.test.ts)
```
