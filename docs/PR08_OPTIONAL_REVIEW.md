# Pemeriksaan isi opsional — keputusan pengguna 24 November 2026

Formulir Buat Surat, Impor, koreksi draf, dan Surat Penagihan memakai pilihan `Perlu pemeriksaan isi? Tidak / Ya`. Kategori tidak lagi dipilih pengguna. Persetujuan, tanda tangan, penerbitan nomor, finalisasi dan pengiriman tetap terpisah.

- `Tidak`: tanpa pemeriksa; tidak membuat tugas pemeriksaan.
- `Ya`: draf boleh disimpan tanpa pemeriksa; pengajuan menuntut pemeriksa berwenang. Pemeriksaan versi terkini harus selesai sebelum persetujuan/nomor.
- `letters.review_requested` bernilai NULL untuk surat lama: aturan lama tetap dipertahankan sampai pembuat menyimpan ulang draf dengan pilihan eksplisit. Tidak ada backfill atau perubahan surat final.
- Kategori lama tetap disimpan. Metadata kompatibilitas surat baru memakai kategori yang tersedia; flag eksplisit menentukan pemeriksaan, bukan kategori tersebut.
- Klien lama yang tidak mengirim flag tetap mengikuti pemeriksaan kategori. Tidak ada perluasan Auth, RLS, mandat pemeriksa, atau hak Super Admin.

Migrasi: `20261124125158_optional_letter_review.sql`. Jalankan migrasi sebelum kode antarmuka baru diterbitkan. Validasi mencakup dua pilihan, gate pemeriksa, nomor eksplisit, penolakan pemalsuan flag, dan seluruh regresi historis.

Validasi: typecheck dan 347 tes otomatis lulus. Verifikasi hosted memastikan hash agregat surat/versi/penerbitan dan jumlah audit tetap sama; semua pilihan lama tetap NULL. Migrasi hosted `20261124125158` sesuai berkas repo. UAT lintas akun pemeriksaan nyata belum diklaim.
