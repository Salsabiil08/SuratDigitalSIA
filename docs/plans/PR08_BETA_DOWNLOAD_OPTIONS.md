# BETA: satu tombol Unduh Surat

Lanjutan PR #9, 19 November 2026. Tanpa migrasi, perubahan data, atau perluasan hak akses.

## Perilaku

- Pilih Versi surat (Bertanda tangan / Belum bertanda tangan), Format (PDF / DOCX), lalu satu tombol Unduh Surat. Versi bertanda tangan hanya aktif bila versi SIGNED memang tersedia. Riwayat sebelum TTD hanya ditawarkan untuk hak versi lengkap dan hash berbeda; penerima tidak memperoleh hak riwayat tambahan.
- Salinan tanpa TTD berasal dari versi NUMBERED existing melalui API berotorisasi; tidak menghapus gambar dari dokumen SIGNED. Format sumber salinan dapat berbeda dari format hasil tanda tangan basah.
- Unduhan format asli mengambil byte dari API existing tanpa konversi. Format alternatif dikonversi di browser setelah pemeriksaan akses dan Content-Type sumber; tidak mengunggah dokumen ke layanan pihak ketiga atau mengganti snapshot final/hash/audit.
- DOCX → PDF merupakan salinan visual tampilan pratinjau (halaman diraster, teks tidak dapat dipilih). PDF → DOCX berupa gambar per halaman, bukan rekonstruksi teks yang dapat diedit. Batas konversi 40 halaman; dokumen berukuran/format tidak didukung menampilkan error dan tetap dapat diunduh dalam format asli. Ini bukan TTE tersertifikasi.
- Mesin konversi dimuat hanya saat pengguna memerlukan format alternatif, bukan saat membuka halaman. Berkas sementara dan iframe/worker dibersihkan. Tombol mencegah permintaan ganda, menampilkan proses/error, dan mendukung retry tanpa fallback ke versi lain.

## Verifikasi

- Typecheck dan 269 tes lokal lulus. Audit dependensi production: 0 kerentanan.
- Browser desktop/mobile dengan backend fixture lokal: signed/unsigned × DOCX/PDF; native DOCX dan PDF identik dengan sumber, PDF konversi valid dengan jumlah/ukuran halaman yang benar, PDF dua halaman → DOCX memiliki kedua gambar/relasi halaman. Akses 403 tidak membuat unduhan sukses palsu dan dapat dicoba ulang.
- Regresi editor, kop, stempel, dan pembaruan status tetap lulus. CI penuh menjadi gerbang sebelum integrasi/deploy.
- UAT menggunakan akun production dan dokumen asli tetap terpisah dari hasil fixture. Layout PDF mengikuti renderer pratinjau, dapat berbeda dari Microsoft Word. Dokumen yang memakai tata letak kompleks sebaiknya diperiksa sebelum digunakan di luar beta.
