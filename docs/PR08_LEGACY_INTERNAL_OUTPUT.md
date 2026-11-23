# Koreksi tampilan surat internal lama — 24 November 2026

Permintaan pengguna mencakup surat lama tanpa TTD, termasuk dokumen final dan terkirim. Endpoint dokumen menghapus hanya tabel bawaan template lama yang ditandai sebagai blok internal 0 TTD. Pemeriksaan Auth, akses penerima, dan hash snapshot asli tetap dijalankan sebelum salinan keluaran dikoreksi. Pratinjau, DOCX dan konversi PDF menggunakan endpoint yang sama.

Berkas Storage, versi, hash, bukti pengiriman, nomor, isi, tanggal, status dan audit asli tidak ditimpa. Tidak diperlukan migrasi atau penyuntingan data historis. Surat formal/internal dengan TTD, eksternal dan tagihan tidak terpengaruh. Tabel pengguna atau dokumen impor tanpa penanda template tidak dihapus secara spekulatif.

Inventaris read-only menemukan 17 surat internal tanpa TTD: 10 memiliki versi DOCX; 7 belum memiliki versi berkas dan tetap tidak direkonstruksi. Uji menggunakan berkas sintetis template lama; bukan klaim inspeksi isi seluruh berkas privat production.
