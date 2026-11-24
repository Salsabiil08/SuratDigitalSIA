# Tampilan form sesuai alur dan pengguna — 24 November 2026

Permintaan: sederhanakan bagian persetujuan/TTD dan konsistenkan penyesuaian tampilan sebelumnya untuk seluruh pengguna, tanpa perubahan aturan bisnis.

- Form bersama menunggu penerima internal dipilih sebelum menawarkan pengesahan. Sesama level hanya melihat keterangan tanpa persetujuan/TTD; pemeriksaan kategori tetap terpisah dan tidak dibatalkan.
- Internal beda level mempertahankan pilihan formal existing. Penyetuju wajib dan penandatangan ditampilkan dalam kartu berbeda. Penyetuju tambahan ditampilkan hanya jika daftar kewenangan existing tidak kosong.
- Eksternal tetap satu TTD SM/Direktur; penagihan mempertahankan dua persetujuan dan tanda tangan berurutan. Tidak ada perubahan perhitungan jumlah TTD, penyimpanan pilihan, kewenangan server, maupun database.
- Posisi nomor PDF tetap tersedia untuk surat tanpa TTD; area tanda tangan/stempel tidak ditawarkan bila jumlah TTD nol.
- Lebar form bersama, termasuk edit dan penagihan, menggunakan batas yang sama dengan Kotak Keluar. Penghapusan pencarian header serta petunjuk/tautan Kotak Masuk/Keluar sudah berlaku melalui komponen bersama dan dipertahankan. Tidak ada perubahan menu atau hak akses.
- Uji tampilan sintetis meliputi Staff, GM, SM, Direktur, Super Admin tanpa penetapan kewenangan, internal sesama level/formal, eksternal, penagihan, serta impor PDF. Ini bukan klaim UAT lintas akun production.
