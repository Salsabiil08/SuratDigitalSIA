# Format surat tagihan lama — 24 November 2026

Acuan pemilik beta: Surat Pengantar pembayaran Operasional OP IUP MPP Peduli (2).pdf. Pembacaan read-only menemukan dua surat BILLING lama, keduanya final, dua rincian per surat, tanpa nomor dokumen/penerima per baris.

Koreksi hanya salinan keluaran DOCX template lama yang dikenali secara ketat. Pratinjau dan unduh memakai judul, metadata, tabel tujuh kolom, dan susunan Direktur kiri/SM kanan. Isi, nomor, tanggal, penerima asli, uraian, total, bank/rekening/penerima pembayaran lama dipertahankan dari bytes dokumen; nomor dokumen yang tidak tersedia dibiarkan kosong. Tidak mengambil nilai dari contoh atau mengarang instansi/pejabat historis.

Gambar TTD/stempel dan relasinya berasal dari sel dokumen yang sama, dipindah bersama sel sesuai peran. Seluruh paket selain document.xml tetap identik. Tidak ada pembacaan ulang aset TTD pengguna, pengesahan baru, perubahan database, status final, nomor, audit atau hash sumber. Bukti asli tetap tersedia dengan parameter original=1, setelah pemeriksaan akses yang sama. Header/filename dan label pratinjau membedakan salinan format terbaru. Salinan bukan bukti penandatanganan ulang.

Format baru, surat jenis lain, PDF, struktur tidak dikenali atau total tidak cocok tidak diubah. Pengujian menggunakan contoh sintetis bertanda tangan/tanpa TTD; tidak mengklaim isi kedua dokumen privat production sudah diunduh dan diuji melalui sesi pengguna. Verifikasi visual DOCX dilakukan dengan renderer sebelum deployment.

Koreksi lanjutan: tautan dokumen sebelum penyesuaian hanya ditampilkan pada Riwayat Surat setelah header salinan dikenali. Garis rincian diberi warna dan border tiap sel secara eksplisit; renderer mengenali hanya tujuh judul kolom tagihan dan memberi grid putih/gelap yang sama untuk pratinjau serta konversi PDF. Tabel metadata dan penandatangan tidak terkena aturan ini.
