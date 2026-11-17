# Pengesahan dan Pengiriman

## Pilihan jalur (di Buat Surat)
Pertanyaan: "Kelola pengesahan tanda tangan melalui SIADocs?" Pilihan **Ya, Melalui SIADocs** (`signature_mode = IN_APP`) atau **Tidak, Di luar SIADocs** (`EXTERNAL`). Diajukan untuk surat yang memerlukan tanda tangan (Eksternal dan Tagihan selalu, Internal bila memerlukan pengesahan). Dapat diubah selama belum bernomor (bukan perubahan substansi, tidak memicu persetujuan ulang), terkunci setelah nomor terbit. Pilihan hanya menentukan mekanisme setelah nomor terbit. Persetujuan wajib tetap berjalan sebelum nomor pada kedua jalur. Memilih Tidak tidak berarti surat tidak perlu tanda tangan.

## Dokumen bernomor (kedua jalur)
Kop resmi, nomor, tanggal, isi dan penerima, nama dan jabatan penandatangan, ruang tanda tangan kosong (1 eksternal, 2 tagihan, 1 internal yang memerlukan pengesahan), area stempel bila perlu. Tombol Unduh Surat Bernomor tersedia sejak `NUMBERED` bagi pengguna berwenang. Tidak mengubah status pengesahan maupun pengiriman dan bukan bukti tanda tangan atau pengiriman.

## Jalur Ya (`IN_APP`)
1. Nomor terbit → `signature_status = WAITING`, `signature_requests` dibuat, surat muncul di Menunggu Pengesahan pejabat.
2. Pejabat mengunduh, menandatangani di luar aplikasi (bukan TTE tersertifikasi), mengunggah dokumen bertanda tangan melalui akunnya.
3. Dokumen harus dokumen bernomor yang sama, tanpa perubahan substansi. Pengunggah menyatakan kesesuaian. Sistem mencatat versi `SIGNED`, pengunggah, waktu, hash berkas. Tanpa OCR atau AI.
4. Tagihan: berurutan SM Finance lalu Direktur Utama pada dokumen yang sama. Setiap versi disimpan.
5. `UPLOADED` setelah seluruh unggahan wajib terpenuhi. UI menampilkan "Dokumen Bertanda Tangan Terunggah", bukan "Sudah Disahkan". Unggahan bukan syarat penerbitan nomor.

## Jalur Tidak (`EXTERNAL`)
`signature_status = EXTERNAL` ("Di Luar Sistem"). Tidak ada `signature_requests`, tidak ada antrean, tidak ada kewajiban unggah. Pengguna mengunduh dokumen bernomor, mencetak, tanda tangan basah dan stempel fisik, mengirim di luar aplikasi. Sistem menyimpan nomor, metadata, dokumen bernomor, dan riwayat. `EXTERNAL` bukan bukti sudah ditandatangani.

## Pengiriman
- Unduh ≠ kirim ≠ catat pengiriman.
- **Kirim melalui SIADocs**: hanya surat internal. Penerima diberi notifikasi dan surat tampil di Kotak Masuk, status `SENT`. Jalur `IN_APP`: dokumen bertanda tangan harus sudah terunggah dan versi `SIGNED` terbaru yang dikirim. Jalur `EXTERNAL`: pengguna mengonfirmasi dokumen benar.
- **Catat Pengiriman**: merekam pengiriman yang sudah terjadi (kanal, tanggal, bukti opsional) di `letter_distributions`, kapan pun setelah `NUMBERED`. Tidak diblokir status pengesahan, tetapi tampilkan peringatan bila pengesahan belum selesai dan simpan keterangan pada audit.
- Surat eksternal dan tagihan dikirim di luar SIADocs. Penerima eksternal tidak punya akun.
- **Konfirmasi Terima**: hanya internal via SIADocs. Pencatatan penerimaan, bukan persetujuan: simpan waktu, status `RECEIVED`, beri tahu pembuat. Waktu pertama dibuka masuk riwayat aktivitas.
- Setiap tindakan tercatat pada audit dengan pelaku dan waktu.
