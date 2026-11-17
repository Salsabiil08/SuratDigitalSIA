# AGENTS.md: SIADocs

Petunjuk untuk agen AI pengembang (Codex, Claude Code, atau agen lain). Baca file ini sebelum mengerjakan apa pun.

## Revisi aktif (18 November 2026)

Instruksi pengguna REV-01 sampai REV-07 pada `docs/spec/00-revisi-alur.md` menggantikan larangan editor isi, gambar TTD, stempel, dan batasan tanggal pada R.04. Blueprint R.03 tetap menjadi acuan penomoran dan kewenangan; perubahan mekanisme gambar TTD/stempel merupakan revisi eksplisit pengguna, bukan klaim isi R.03. Kerjakan alur ini dengan Auth, database, dan Storage Supabase yang nyata, tanpa fallback akun demo.

## Tujuan

SIADocs adalah sistem penomoran dan disposisi surat digital PT Semen Indonesia Aceh (Blueprint R.04): Buat Surat, Ambil Nomor, persetujuan, penerbitan nomor resmi, pengesahan tanda tangan, dan disposisi. Stack: Next.js (App Router), TypeScript, Supabase (PostgreSQL, Auth, Storage, Realtime). Instruksi pembangunan lengkap: `ANTIGRAVITY.md`.

## Sumber kebenaran (urutan prioritas)

1. `docs/spec/*.md` (ringkasan aturan bisnis yang sudah disepakati, mudah dibaca agen)
2. `docs/blueprint/Blueprint_R04_SIADocs.pdf` atau `.docx` (dokumen resmi lengkap, termasuk diagram dan mockup layar)
3. Skema yang berjalan: `supabase/migrations/`

Bila ada perbedaan antara kode dan spesifikasi, spesifikasi menang. Jangan mengubah aturan bisnis sendiri. Catat temuan di `docs/FINDINGS.md`.

## Aturan bisnis yang tidak boleh diubah

1. Nomor surat TIDAK pernah diterbitkan saat draft. Nomor terbit hanya lewat aksi eksplisit Terbitkan Nomor Surat, setelah validasi dan persetujuan wajib terpenuhi. Persetujuan terakhir hanya menghasilkan status `READY_TO_ISSUE`.
2. Nomor unik, atomik (fungsi database `issue_letter_number`), tidak pernah dipakai ulang, tidak pernah diedit. Surat dibatalkan tetap menyimpan nomornya.
3. Format nomor dan seri tidak berubah (lihat `docs/spec/03-penomoran.md`). Tahun mengikuti go-live, urut mulai 001, reset tahunan menurut Asia/Jakarta. Tanpa migrasi register Excel.
4. Dua jalur pengesahan, dipilih pembuat: melalui SIADocs (unduh, tanda tangan di luar aplikasi, unggah dokumen bertanda tangan) atau di luar SIADocs (unduh dokumen bernomor dengan kop dan ruang tanda tangan kosong, tanpa kewajiban unggah).
5. Dua status terpisah: proses dan pengesahan (status pengiriman dihapus pada R.04). `NUMBERED` tidak sama dengan sudah ditandatangani.
6. Satu penerima utama per surat. Tanpa tembusan. Penerima eksternal hanya data, bukan akun.
7. Tanpa tanda tangan elektronik tersertifikasi, tanpa gambar tanda tangan atau stempel otomatis, tanpa OCR atau AI untuk dokumen.
8. Super Admin tidak otomatis berwenang membatalkan, menyetujui, atau menandatangani. Log History khusus Super Admin.
9. Struktur organisasi dinamis (Master Organisasi), tidak di-hardcode. Kode unit, jabatan, dan jenis surat berasal dari data.
10. Penerbitan nomor satu transaksi (`READY_TO_ISSUE` ke `NUMBERED`). SIADocs tidak menyisipkan nomor ke dokumen.

## Cakupan

Kerjakan hanya yang ada di `tasks/BACKLOG.md`. Jangan menambah fitur, memperluas cakupan, atau mengganti stack. Fitur yang sengaja tidak ada: editor isi, template isi, distribusi, Kotak Masuk, Konfirmasi Terima, arsip, penyisipan nomor otomatis, tembusan, impor register.

## Penamaan

- Kode, kolom database, dan kode status memakai bahasa Inggris (`NUMBERED`, `READY_TO_ISSUE`, `official_number`).
- Teks antarmuka memakai bahasa Indonesia sesuai istilah blueprint: Terbitkan Nomor Surat, Alur Kerja, Penyetuju, Persetujuan, Nomor urut, Penanda posisi nomor, Riwayat aktivitas, status pengiriman. Label status ada di `src/domain/status.ts` (`STATUS_LABEL`).

## Struktur repo

```
AGENTS.md  CLAUDE.md  README.md
docs/spec/            ringkasan aturan bisnis dan model data
docs/blueprint/       Blueprint R.04 (PDF dan DOCX)
supabase/migrations/  skema, constraint, fungsi, RLS (urut berdasarkan nama file)
supabase/seed.sql     data awal contoh
supabase/tests/       uji SQL (penomoran, RLS)
src/domain/           logika murni TypeScript (status, penomoran) bertes
src/                  aplikasi Next.js (dibuat pada tugas M0)
tasks/BACKLOG.md      daftar tugas dan kriteria selesai
.claude/agents/       peran agen
.claude/commands/     perintah siap pakai
scripts/              skrip uji database
```

## Perintah

```
npm run typecheck     pemeriksaan tipe
npm run test          uji unit domain (vitest)
npm run test:db       migrasi + uji SQL pada PostgreSQL sementara (perlu PostgreSQL 15+ terpasang)
npm run check         ketiganya
```

## Cara bekerja

1. Ambil tugas berikutnya yang belum selesai dari `tasks/BACKLOG.md`. Baca bagian spesifikasi yang dirujuk.
2. Tulis uji dahulu bila logika bisnis (domain atau SQL), lalu implementasi.
3. Jalankan `npm run check`. Jangan menandai tugas selesai bila ada uji gagal atau dilewati.
4. Perubahan database selalu berupa file migrasi baru (jangan mengubah migrasi lama yang sudah dipakai). Setiap tabel baru wajib RLS aktif.
5. Perbarui `tasks/BACKLOG.md` (centang tugas) dan, bila perlu, `docs/spec/`. Commit kecil dengan pesan jelas.
6. Bila menemukan konflik bisnis kritis yang tidak terjawab spesifikasi, berhenti pada tugas itu dan tulis di `docs/FINDINGS.md`. Untuk keputusan teknis biasa pilih yang paling sederhana, aman, dan konsisten, lalu lanjut.

## Keamanan

- Service role key hanya di server (Route Handler atau Server Action), tidak pernah ke browser. Penerbitan nomor, persetujuan akhir, pembatalan, dan penulisan audit lewat server.
- Hak akses ditegakkan di database (RLS) dan di server, bukan hanya dengan menyembunyikan tombol.
- Berkas privat di Supabase Storage, diakses lewat signed URL berumur pendek setelah pemeriksaan hak.
- Notifikasi dan log tidak memuat isi dokumen. `audit_logs` hanya ditambah.
- Tidak ada rahasia di repo. Gunakan `.env.local` (lihat `.env.example`).

## Definisi selesai

Spesifikasi terpenuhi, uji ada dan lulus, RLS ditinjau, label antarmuka sesuai istilah, tidak ada fitur di luar cakupan, backlog diperbarui.
