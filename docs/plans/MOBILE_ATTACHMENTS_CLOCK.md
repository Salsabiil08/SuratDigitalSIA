# Lampiran bebas format, perbaikan mobile dan jam

Permintaan pengguna 25 November 2026: lampiran menerima jenis berkas apa pun, perbaiki hambatan TTD pada impor, rapikan halaman mobile untuk seluruh jenis akun dan perbarui jam tanpa tertinggal.

Lampiran surat dan hasil disposisi menerima bytes apa pun, maksimal 1 MB per berkas (total lampiran surat tetap 25 MB). Berkas baru disimpan di bucket privat letter-attachments sebagai application/octet-stream dan hanya dilayani lewat endpoint unduh terautentikasi/RLS, dengan Content-Disposition attachment serta nosniff. Nama asli, ukuran dan hash dicatat; tidak menjalankan atau mengekstrak isi lampiran. Format dokumen utama dan aset gambar TTD tidak dilonggarkan. Lampiran lama tetap menggunakan bucket asal.

Impor tanpa area gambar TTD tetap bisa diajukan, tanpa melewati pemeriksaan/persetujuan/TTD wajib. Penandatangan mengunggah hasil TTD lewat akunnya, memeriksa pratinjau dan mengonfirmasi versi/hash. PNG/stempel tetap tersedia untuk surat yang dibuat di SIADocs dan PDF impor dengan area yang dipilih. Tidak menebak posisi nomor atau TTD pada dokumen bebas.

Layout bersama diberi batas lebar/min-width yang benar. Baris tombol, notifikasi, form dan judul membungkus; tabel lebar menggulir di kontainernya. Header menyesuaikan ruang tablet/mobile. Jam membaca waktu WIB tiap detik dan langsung menyelaraskan saat tab aktif kembali.

Bukti lokal: 396 tes lulus, termasuk izin dan integritas unduh lampiran, penyimpanan metadata/bucket, ukuran, berbagai ekstensi, dan fallback TTD. CI menjalankan PostgreSQL serta fixture komponen nyata dengan data sintetis untuk 5 jenis akun, lebar 320/390/768/1366 dan pergantian menit WIB. Bukan klaim UAT akun perusahaan nyata.
