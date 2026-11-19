# Perbaikan editor, unduhan, dan beban halaman — 19 November 2026

Lanjutan beta PR-08, tanpa migrasi atau PR baru. Basis deployment sebelumnya `fa5b525fb8ca6d58de4b387997a775323b449e2f`.

- Editor: DOM area ketik tidak lagi dikelola ulang melalui dangerouslySetInnerHTML. Sinkronisasi membedakan perubahan dari pengguna dan isi pengganti; komposisi IME dijaga, parsing HTML tidak dilakukan setiap ketukan, terjemahan otomatis pada naskah dinonaktifkan. Sanitasi awal/tempel serta validasi HTML server tetap berlaku.
- Keluhan tidak bisa mengetik belum terulang di fixture lokal sebelum patch. Regresi browser sesudah patch mencakup formulir lengkap, kursor, baris baru, hapus, tebal, perataan, dan data FormData yang disimpan; desktop dan mobile lulus. Endpoint draft pada pengujian ini **tiruan lokal**, bukan bukti UAT akun production.
- Unduhan: satu tautan sebelum pengesahan; label area TTD kosong hanya saat relevan. Setelah versi SIGNED berbeda dari NUMBERED, pengguna dengan akses versi penuh mendapat unduhan tanpa TTD. Penerima tidak diberi akses tambahan. Endpoint blank menolak jika versi NUMBERED tidak tersedia, tidak jatuh kembali ke dokumen bertanda tangan; nama berkas berbeda.
- Penjelasan alur berulang di formulir/preview dipersingkat. Peringatan penting penguncian, kewenangan, penerimaan, dan pembatalan tetap ada.
- Beban: query independen opsi formulir dan konteks detail dijalankan paralel; preview dimuat saat mendekati viewport, request yang tak dipakai dibatalkan; prefetch sidebar dinonaktifkan; jam berlabel WIB memakai zona Jakarta dan diperbarui 30 detik. Tidak memakai cache data antar pengguna.
- Penempatan fungsi deployment sebelumnya iad1 (AS), database ap-southeast-1 (Singapura). Deployment perbaikan diarahkan ke sin1. Dampak waktu nyata lintas akun belum diukur; jangan mengklaim angka percepatan.

Bukti lokal: 251 tes + typecheck lulus; build Next lulus; browser editor desktop/mobile lulus. CI branch harus hijau sebelum fast-forward ke main dan deployment beta. Tidak ada perubahan database, nomor, audit, akun atau hak akses. Regresi PostgreSQL dijalankan oleh CI seperti semula.
