# Notifikasi pembatalan surat

Permintaan pengguna 25 November 2026: pembatalan harus memberi pemberitahuan dan hasil jelas saat Perbarui status, tanpa perlu mencari bagian pembatalan.

- Event permohonan dibuat di transaksi otorisasi pembatalan untuk pejabat yang ditetapkan dan masih berwenang. Hasil ditolak/terlaksana dikirim kepada pembuat dan pejabat terkait; persetujuan sebagian tagihan tetap dibedakan dari pembatalan selesai.
- Kunci unik penerima–permohonan–event mencegah duplikasi. Permohonan lama yang masih memerlukan tindakan mendapat notifikasi melalui backfill terbatas, tanpa mengubah keputusan atau surat.
- Penerima tetap dibatasi RLS; browser tidak dapat membuat event atau memanggil helper baru. Isi pemberitahuan berupa teks event tetap, tanpa isi naskah/alasan privat.
- Lonceng diperbarui ketika tab aktif, saat fokus kembali, saat dibuka dan setelah Perbarui status. Klik notifikasi membuka bagian pembatalan; pejabat yang perlu bertindak langsung melihat bagian terbuka. Status juga tampil di atas halaman dan pada popup Perbarui status.
- Tidak mengubah kewenangan/urutan keputusan, nomor atau dokumen. Pengujian lokal `npm run check`: 379 tes lulus, termasuk otorisasi, retry tanpa duplikasi, penolakan, dua pejabat tagihan, RLS dan permohonan lama. CI menjalankan PostgreSQL serta fixture browser desktop/mobile untuk popup hasil pembatalan. UAT akun nyata tidak diklaim.
