# Pengujian REV-01–07

Tanggal: 18 November 2026 (Asia/Jakarta).

## Pemeriksaan lokal

- TypeScript dan pengujian domain, generator DOCX, pengolahan gambar/PDF, serta transaksi PostgreSQL (PGlite) dijalankan dengan migrasi yang sama.
- Cakupan: tanggal Jakarta, tanggal lampau menurut kewenangan/alasan, date tidak reset saat edit, pengajuan memerlukan preview versi terkini, penerima internal/eksternal, TTD wajib, Finance dan lampiran tagihan, approval berurutan dan penyetuju salah, nomor tanpa draft/approval tidak boleh, idempotensi, tanda tangan berurutan, versi kedaluwarsa ditolak, audit stempel, penolakan/revisi, final terkunci, dan konfirmasi jalur luar.
- Pengolahan berkas diperiksa terhadap byte DOCX/PDF hasil: gambar benar-benar tertanam, marker tidak dikenal ditolak, koordinat di luar halaman ditolak, dan hasil preview/commit deterministik.

## Production

Hasil pengujian production dan akun nyata akan dilengkapi setelah deployment terverifikasi. Jangan menafsirkan tes lokal sebagai bukti seluruh alur cloud selesai.

## Batasan yang terlihat pengguna

- DOCX ditampilkan lewat renderer browser; tata letak Microsoft Word mungkin sedikit berbeda. Unduhan tetap tersedia untuk pemeriksaan.
- Isi impor dikoreksi di aplikasi asal lalu diunggah ulang saat masih Draft/Perlu Revisi; aplikasi tidak mengklaim editor penuh PDF/Word.
- Gambar TTD bukan TTE tersertifikasi. Unggahan tanda tangan basah disertai pernyataan pejabat, bukan verifikasi kriptografis identitas goresan.
- Jalur di luar sistem membutuhkan konfirmasi pembuat; sistem tidak mengklaim melihat bukti yang tidak diunggah.
- Data/nomor lama tidak ditulis ulang. Dokumen lama yang tidak pernah disimpan tidak dibuatkan bukti palsu.
