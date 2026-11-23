# Tanggapan melalui komentar — keputusan pengguna 24 November 2026

- Penerima utama dapat menanggapi surat internal yang sudah dikirim dengan komentar, tanpa membuat surat atau nomor baru. Pengirim resmi dapat membalas dalam percakapan yang sama.
- Balasan dengan surat resmi tetap tersedia sebagai pilihan terpisah dan mengikuti alur existing. Komentar tidak membuat relasi balasan resmi, mengubah dokumen/nomor, mengonfirmasi baca/terima, atau menyelesaikan disposisi.
- Komentar dan ringkasannya hanya terbuka untuk pengirim dan penerima utama yang masih memiliki akses surat. CC, reviewer, approver, dan Super Admin tidak otomatis mendapat akses komentar.
- Isi berupa teks biasa maksimal 5000 karakter. Nama aktor berasal dari Auth/profil, waktu dari database. Komentar tidak dapat diedit/dihapus langsung oleh pengguna.
- Migrasi aditif menambah letter_comments, view ringkasan security_invoker, RLS, dan dua RPC beridentitas Auth. Implementasi penulisan berhak khusus disimpan pada schema privat; RPC publik tetap mengikuti hak pemanggil. Penulisan komentar, notifikasi counterpart, dan audit berlangsung dalam satu transaksi. Retry memakai kunci unik per aktor; isi tidak disalin ke audit/notifikasi.
- Tidak ada backfill atau perubahan surat historis. Status tanggapan komentar dibedakan dari pengiriman surat balasan resmi.
- Uji PGlite/PostgreSQL: sebelum kirim, recipient/sender, CC/admin ditolak, RLS dan view, retry/key mismatch, rollback notifikasi, integritas surat/versi/counter/receipt, dan 20 retry bersamaan.
- Browser desktop/mobile memakai fixture lokal untuk komentar kosong, pengiriman, hasil tidak pasti dan retry dengan kunci sama, teks aman, tanpa pembuatan surat. Bukan klaim UAT akun production.
