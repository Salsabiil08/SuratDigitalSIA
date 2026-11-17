# Pengesahan Tanda Tangan (R.04)

Tanda tangan dan stempel selalu di luar SIADocs, tanpa TTE tersertifikasi. Pembuat memilih jalur di Buat Surat atau Ambil Nomor untuk surat yang memerlukan tanda tangan (Eksternal dan Tagihan selalu, Internal bila perlu). Jalur dapat diubah sebelum bernomor dan terkunci setelah nomor terbit. Persetujuan wajib tetap berjalan sebelum nomor pada kedua jalur. Penandatangan hanya Senior Manager atau Direktur Utama.

## Jalur dilacak SIADocs (`IN_APP`)
1. Nomor terbit: `signature_status = WAITING`, `signature_requests` dibuat, surat muncul di Menunggu Pengesahan penandatangan.
2. Penandatangan mengunduh dokumen bernomor, menandatangani di luar, mengunggah dokumen bertanda tangan (versi `SIGNED`: pengunggah, waktu, hash). Tanpa OCR atau AI.
3. Tagihan: SM Finance lalu Direktur Utama berurutan. `UPLOADED` setelah semua unggahan wajib terpenuhi. Unggahan bukan syarat penerbitan nomor.
4. Catatan "sudah ditandatangani dan sudah dikirim" dari penandatangan hanya keterangan, bukan distribusi. [PERLU VERIFIKASI PERUSAHAAN]

## Jalur di luar SIADocs (`EXTERNAL`)
`signature_status = EXTERNAL`. Tidak ada antrean dan tidak ada kewajiban unggah. Pembuat mengunduh dokumen dengan ruang tanda tangan kosong dan mengurus tanda tangan sendiri. `EXTERNAL` bukan bukti sudah ditandatangani.

## Tidak ada pengiriman
Distribusi, Kotak Masuk, dan Konfirmasi Terima tidak dikelola SIADocs. Pengiriman surat dilakukan di luar sistem.
