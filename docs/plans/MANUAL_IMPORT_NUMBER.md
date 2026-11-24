# Impor surat: nomor dahulu, unggah setelah diisi manual

Disetujui pengguna 25 November 2026. Khusus jalur Impor Surat / Ambil Nomor: pilih jenis dan isi perihal, ambil nomor, cantumkan nomor pada berkas di luar SIADocs, kemudian unggah. Dokumen tidak ditulis ulang dan nomor tidak ditempatkan otomatis. Eksternal memilih pejabat lebih dahulu karena seri bergantung pada jabatan; tagihan tetap khusus Finance.

Nomor dicadangkan atomik per seri/tahun WIB dengan kunci permintaan idempoten. Reservasi bukan dokumen/approval fiktif. Daftar milik sendiri menyediakan kelanjutan unggah. Setelah unggah, persetujuan, pengesahan, finalisasi dan pengiriman memakai syarat yang sudah berlaku. Aktivasi dokumen memakai nomor reservasi tanpa menaikkan counter lagi. Nomor tidak dipakai ulang. Jalur Buat Surat tidak berubah.

Pengguna mengonfirmasi nomor telah tercantum; ini pernyataan pengguna, bukan hasil OCR. Konfirmasi terikat versi/hash unggahan dan harus diulang saat menyimpan koreksi. Default pengesahan impor di luar SIADocs. Pilihan melalui SIADocs tetap memerlukan area TTD PDF atau placeholder DOCX; area nomor tidak diperlukan pada jalur manual.

Bukti lokal: `npm run check` lulus 372 tes, termasuk reservasi idempoten, isolasi pemilik, konfirmasi unggahan, kelanjutan surat yang sama, gerbang persetujuan, hash kedaluwarsa, seri eksternal dan pembatasan Finance. CI juga menjalankan PostgreSQL dan fixture browser desktop/mobile. Tidak mengklaim UAT akun nyata. Tidak menerbitkan eksperimen OCR lokal.
