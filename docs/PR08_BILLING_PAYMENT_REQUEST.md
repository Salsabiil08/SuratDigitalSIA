# Koreksi surat pengantar tagihan — 23 November 2026

Permintaan pengguna: mengikuti contoh surat pengantar pembayaran yang ditujukan kepada Direktur Utama, bukan surat tagihan eksternal kepada penerima pembayaran.

- Template khusus tagihan: judul/nomor di tengah, Kepada/Dari/Tanggal/Perihal, rincian tujuh kolom, total/terbilang, dan pengesahan Direktur di kiri serta SM di kanan. Nama dan nomor tetap dari akun/mekanisme resmi, tidak disalin dari contoh PDF.
- Form menyimpan No Dokumen, Keterangan, Penerima, Bank, No Rekening, dan Nominal per baris. Satu baris sah; tambah/hapus tetap tersedia.
- Empat kolom baru billing_items bersifat nullable untuk data historis. Tidak ada backfill atau regenerasi surat lama. Template baru digunakan saat membuat atau menyimpan koreksi draf secara eksplisit.
- Migrasi mengganti hanya fungsi inti draf yang sudah ada untuk menyimpan kolom tersebut dan mengizinkan minimal satu rincian. Wrapper review/approval/relasi, hak panggil RPC, penomoran, TTD SM→Direktur, lampiran wajib dan final lock dipertahankan.
- Pemisahan posisi dan urutan TTD: slot 2 (Direktur) kiri; slot 1 (SM) kanan. Marker teknis disembunyikan hanya pada DOM pratinjau; berkas asli dan hash tidak diubah.
- Bukti: validasi dan generasi DOCX, penerapan slot TTD/stempel, satu/lebih rincian, escaping, penyimpanan dan koreksi DB beserta penolakan akun salah, browser form/pratinjau desktop dan mobile. Seluruh pengujian regresi berjalan di CI.
- Batas: tes browser memakai data lokal, bukan bukti transaksi pembayaran atau mandat perusahaan. UAT beta dengan akun nyata tetap menggunakan mandat existing.
