# BETA: surat internal sesama jabatan

Keputusan pengguna 19 November 2026: internal sesama Staff atau sesama GM (jabatan setingkat) tanpa tanda tangan dan tanpa persetujuan. Ini diterapkan pada alur baru/koreksi draf; tidak menulis ulang surat atau keputusan lama.

- Pilihan penerima diperiksa terhadap level jabatan aktif organisasi. Untuk internal setingkat, form otomatis menyembunyikan persetujuan wajib/tambahan dan pilihan TTD; payload baru memakai signer/approver kosong. Stempel/area TTD tidak diminta untuk surat ini.
- Server simpan dan pengajuan memeriksa kembali level dan menolak payload yang memaksakan penandatangan/penyetuju untuk surat internal setingkat. Bukan sekadar menyembunyikan kontrol UI. Draf lama yang masih meminta formal authorization perlu diedit/disimpan melalui versi koreksi yang sah, bukan dibersihkan diam-diam.
- Setelah pemeriksaan kategori (bila wajib), pengajuan memakai mekanisme approval existing dengan rencana kosong dan menjadi siap penomoran tanpa menciptakan keputusan approval palsu. Tombol sesudah lolos pemeriksaan berganti menjadi Lanjutkan ke Penomoran bila memang tidak ada penyetuju. Nomor/finalisasi/kirim tetap eksplisit dan diaudit.
- Review naskah kategori Laporan/Permohonan tetap berbeda dari persetujuan; aturan dan mandat pemeriksa tidak dihapus. Formal internal bukan sesama level, eksternal, dan tagihan mempertahankan ketentuan yang ada.
- Stempel tetap bertumpuk di sisi kiri area TTD pada template baru seperti contoh pengguna; penempatan Word/preview tidak dipindah ke baris terpisah. Regresi overlay yang sudah ada tetap diuji. Dokumen yang sudah ditandatangani tidak diubah otomatis.

## Bukti

282 tes/typecheck lokal lulus: Staff/GM setingkat tanpa otorisasi, payload palsu ditolak, kondisi query gagal, dan alur lain tetap tidak dibatalkan. Browser desktop/mobile fixture memastikan form peer tidak menampilkan pejabat/TTD serta mengirim array kosong; regresi kop, overlay stempel, popup, dan unduhan tetap lulus. CI penuh menjadi gerbang integrasi/deploy. Tidak ada migrasi atau perubahan data historis. UAT akun produksi tetap terpisah dari fixture.
