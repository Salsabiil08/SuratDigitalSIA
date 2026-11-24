# Aktivitas Surat Terbaru — 24 November 2026

Kartu Dashboard sebelumnya membaca audit_logs langsung, yang tidak terbuka untuk Staff. Kesalahan query juga diabaikan sehingga terlihat seperti daftar kosong.

Kartu sekarang memakai RPC sesi tanpa argumen identitas. Implementasi privat mengembalikan maksimal lima ringkasan tindakan yang diizinkan pada surat yang masih boleh dibaca akun. Alasan, metadata, isi dokumen dan actor tidak disalin. Penerima pengiriman hanya melihat kejadian pengiriman/pembacaan/penerimaan setelah surat dikirim; riwayat draf dan pemeriksaan sebelumnya tetap privat. Aktivitas penerimaan/pembacaan penerima lain tidak dibuka kecuali kepada pembuat/pengirim.

Audit lengkap dan kebijakan aksesnya tidak diubah. Super Admin tidak otomatis mendapat akses surat melalui ringkasan. Tidak ada penulisan ulang data historis atau pembuatan event fiktif. Waktu menggunakan Asia/Jakarta; kegagalan query ditampilkan berbeda dari keadaan benar-benar kosong.

Uji SQL/PGlite dan PostgreSQL mencakup Staff, penerima sebelum/sesudah kirim, admin tanpa akses surat, batas lima, anon dan ketidakbocoran alasan/metadata. Uji server membedakan query gagal dari daftar kosong.
