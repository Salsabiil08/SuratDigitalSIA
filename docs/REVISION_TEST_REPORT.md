# Pengujian REV-01–07

Tanggal: 18 November 2026 (Asia/Jakarta).

## Pemeriksaan lokal

- TypeScript dan pengujian domain, generator DOCX, pengolahan gambar/PDF, serta transaksi PostgreSQL (PGlite) dijalankan dengan migrasi yang sama.
- Cakupan: tanggal Jakarta, tanggal lampau menurut kewenangan/alasan, date tidak reset saat edit, pengajuan memerlukan preview versi terkini, penerima internal/eksternal, TTD wajib, Finance dan lampiran tagihan, approval berurutan dan penyetuju salah, nomor tanpa draft/approval tidak boleh, idempotensi, tanda tangan berurutan, versi kedaluwarsa ditolak, audit stempel, penolakan/revisi, final terkunci, dan konfirmasi jalur luar.
- Pengolahan berkas diperiksa terhadap byte DOCX/PDF hasil: gambar benar-benar tertanam, marker tidak dikenal ditolak, koordinat di luar halaman ditolak, dan hasil preview/commit deterministik.

## Production

Production diverifikasi melalui form login asli, Server Actions dan endpoint aplikasi dengan lima akun Supabase Auth nyata, terpisah dari akun contoh lama. Seluruh pemeriksaan berikut lulus:
- Internal tanpa TTD: Draft → Preview → pengajuan → nomor resmi → finalisasi.
- Eksternal: antrean penyetuju yang benar, Setujui, nomor, preview gambar TTD/stempel, versi SIGNED dengan hash yang sesuai, finalisasi.
- Impor PDF: tanggal mundur oleh GM, koordinat TTD/stempel, approval dan finalisasi; tanggal tetap.
- Tagihan: Finance, rincian dan bukti, dua approval dan dua TTD berurutan, finalisasi.
- Impor DOCX: permintaan revisi, koreksi/unggah ulang, siklus approval baru, unggahan hasil TTD basah dan finalisasi.
- Penolakan tersimpan dan terlihat oleh pembuat; akun tidak terlibat menerima 403 saat mengunduh; endpoint menolak edit dokumen final.

57 tes lokal lulus, termasuk transaksi PostgreSQL terisolasi dan perbandingan byte preview/hasil penandatanganan lintas waktu. Build production lulus. Pemeriksaan browser memastikan pengunjung baru tiba di login; pemeriksaan alur terautentikasi dilakukan melalui HTTP aplikasi, bukan penilaian visual seluruh layar.

Data uji diberi label [UJI REV-18]. Lima surat uji telah final dan satu ditolak. Nomor uji yang sudah terbit tetap tercatat dan tidak dipakai ulang. Kredensial tidak dimasukkan ke repository.

## Batasan yang terlihat pengguna

- DOCX ditampilkan lewat renderer browser; tata letak Microsoft Word mungkin sedikit berbeda. Unduhan tetap tersedia untuk pemeriksaan.
- Isi impor dikoreksi di aplikasi asal lalu diunggah ulang saat masih Draft/Perlu Revisi; aplikasi tidak mengklaim editor penuh PDF/Word.
- Gambar TTD bukan TTE tersertifikasi. Unggahan tanda tangan basah disertai pernyataan pejabat, bukan verifikasi kriptografis identitas goresan.
- Jalur di luar sistem membutuhkan konfirmasi pembuat; sistem tidak mengklaim melihat bukti yang tidak diunggah.
- Data/nomor lama tidak ditulis ulang. Dokumen lama yang tidak pernah disimpan tidak dibuatkan bukti palsu.


## Revisi disposisi dan bahasa — 18 November 2026

- 64 uji otomatis lulus, termasuk 19 uji transaksi database dengan migrasi nyata dan akun berbeda. Build production lulus.
- Disposisi baru memisahkan surat acuan opsional dari surat tindak lanjut; penerima membuat draft melalui alur surat biasa. Pengiriman hasil wajib menunggu finalisasi bila surat diwajibkan. Hanya pemberi dapat menerima hasil; permintaan perbaikan wajib catatan.
- Diuji: staf/admin tanpa jabatan tidak dapat memberi tugas; GM tidak lintas unit; akun lain ditolak; RLS hanya peserta; pemberi dapat membaca hasil; larangan penyelesaian sendiri; perbaikan memakai surat baru dan mempertahankan nomor lama; konflik versi ditolak; audit/notifikasi atomik.
- Kode status database tetap, label antarmuka berbahasa Indonesia; SM ditampilkan sebagai Senior Manager lintas organisasi. SM pengesah tagihan tidak dibatasi unit Finance; pengaju tetap Finance dan urutan dua TTD tidak berubah. Ditambahkan uji SM dengan penugasan di luar Finance serta perlindungan draft perbaikan sebelum dikirim kembali. Login dropdown sementara tetap memakai Supabase Auth asli.
- Migrasi Supabase `20261118012449_disposition_review_flow` terverifikasi; RPC hanya server; advisor tidak menemukan masalah database baru. Peringatan lama perlindungan kata sandi bocor belum aktif tetap ada.

- Pengujian production mengungkap rekursi kebijakan baca riwayat pembatalan lama. Diperbaiki melalui lookup identitas sesi terbatasi pada migrasi `cancellation_read_scope`, dengan uji RLS pemilik dan akun lain. Tidak menambah hak pembatalan.

## Revisi lanjutan — editor, data awal dan akun

69 uji otomatis lulus. Tambahan: penyaringan HTML berbahaya; kompatibilitas teks lama; font/ukuran/alignment/bold/italic/underline/list dalam bytes DOCX; font bersarang; format HTML/TEXT tercatat di versi database. Enam akun organisasi bernama berhasil masuk melalui Supabase Auth. Akun QA dinonaktifkan, sesi dicabut, dan login dropdown dihapus. Data halaman utama disiapkan di server; autentikasi diverifikasi dan profil/penugasan dibaca bersamaan. Tidak ada kredensial pada kode atau laporan ini.
