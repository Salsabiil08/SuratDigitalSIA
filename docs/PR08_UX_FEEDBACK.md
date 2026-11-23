# Penyempurnaan petunjuk dan umpan balik beta — 23 November 2026

Ruang lingkup: UI, teks, pemuatan tindakan, sinkronisasi tampilan dan pemeriksaan akses halaman administrasi sesuai peran existing. Tidak ada migrasi, perubahan data, atau perubahan tahapan/mandat bisnis. Fitur gambar TTD/stempel existing dipertahankan; ruang lingkup perusahaan masih perlu diverifikasi.

- Button menunggu pemasangan penangan interaksi sebelum aktif; menampilkan alasan nonaktif dan status proses. Pengajuan, pemeriksaan, finalisasi, pengiriman, pembatalan dan perbaikan disposisi mendapat petunjuk syarat existing.
- Popup sukses 4 detik, informasi 6 detik, gagal 8 detik; berhenti saat mendapat fokus/tetikus. Kesalahan tetap tersedia dekat bagian tindakan setelah popup ditutup. Pesan teknis umum dibaca ulang dalam bahasa Indonesia.
- Validasi wajib/pilihan/format/batas angka menggunakan bahasa Indonesia dan penanda aksesibilitas. Koreksi isian membersihkan pesan validasi sebelumnya.
- Halaman gagal membuka surat/formulir memiliki tautan kembali. Petunjuk final surat eksternal mengarah ke unduhan, bukan menjanjikan pengiriman internal.
- Penomoran tidak diberi label seolah membatalkan keputusan sebelumnya: persetujuan yang terhubung pada rencana persetujuan aktif diberi konteks sebelum penerbitan nomor. Riwayat pemeriksaan tidak mengarang keberlakuan baru.
- Kotak masuk/keluar dan detail memperbarui data saat tab terlihat. Detail mengambil ulang status setelah pratinjau dibaca. Pengambilan ulang tidak mengirim ulang tindakan.
- Disposisi menampilkan tahap, pemberi/penerima, pelaku berikutnya, alasan surat hasil belum siap, tautan existing, dan riwayat perbaikan. Tidak ada kewajiban surat hasil baru bagi tugas yang menerima catatan saja.
- Semua halaman admin dilindungi di server; Staff melihat Akses terbatas dan tombol Dashboard. Getter admin tetap memeriksa peran dan tidak mengubah kegagalan kueri menjadi contoh data atau daftar kosong palsu. Tombol seri yang memang belum memiliki implementasi diberi alasan nonaktif, bukan dibuat seolah berfungsi.
- Penanda teknis pada pratinjau sudah disembunyikan oleh perbaikan sebelumnya; tetap diuji oleh regresi dokumen/tagihan. Berkas/hashes asli tidak dimodifikasi untuk tujuan tampilan.

## Bukti dan batas pengujian

- TypeScript dan seluruh Vitest/PGlite; PostgreSQL penuh di CI, termasuk penomoran/review/approval/TTD/pengiriman/balasan/disposisi.
- Browser desktop/mobile: validasi Indonesia, syarat tombol, siklus disposisi baru→diproses→pemeriksaan→perbaikan→pemeriksaan→selesai, riwayat tetap ada, klik ganda, popup gagal kedaluwarsa dan tetap terlihat saat diarahkan tetikus, pesan kesalahan inline tetap tersedia.
- Browser memakai fixture lokal; bukan klaim UAT akun production. PostgreSQL menguji kewenangan server dan jalur perbaikan existing secara terpisah.
- CI wajib hijau sebelum main diperbarui; branch kerja tidak dideploy otomatis. Tidak ada penetapan pemeriksa, delegasi, CC, atau kewenangan baru.
