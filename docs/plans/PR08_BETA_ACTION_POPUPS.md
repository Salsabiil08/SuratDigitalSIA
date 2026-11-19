# BETA: popup hasil aktivitas

Lanjutan PR #9, 19 November 2026. Tanpa migrasi atau perubahan aturan tindakan.

- Pesan gagal/berhasil existing dipindah dari banner di posisi halaman menjadi popup fixed di atas layar melalui provider global. Berlaku pada login/registrasi, draft/pengajuan, review/persetujuan, nomor, TTD, unduhan/pratinjau, balasan, disposisi/lampiran, penerimaan, notifikasi dan administrasi organisasi.
- Popup tidak menggulir atau memindahkan fokus pengguna. Maksimal tiga ditumpuk, responsif, dapat ditutup dengan tombol berlabel. Pesan gagal tidak hilang otomatis; sukses hilang setelah 6 detik dan jeda saat disentuh fokus/hover. aria alert/status sesuai hasil, teks tetap dirender React, animasi mengikuti prefers-reduced-motion.
- Pesan percobaan berulang dapat muncul lagi meskipun isinya sama. Pesan sumber dihapus saat komponen/rute ditutup. Informasi status alur dan peringatan sinkronisasi latar tetap berada di tempatnya; tidak menjadi popup sukses palsu.
- Lokal: typecheck + 269 tes lulus. Browser desktop/mobile backend fixture: popup tetap terlihat di atas setelah scroll ke bawah, tidak meluap ke samping, error bertahan lebih dari 6 detik, dapat ditutup dan retry berhasil. Regresi editor, kop, stempel, unduhan tetap lulus. CI penuh menjadi gerbang deployment. UAT akun production tetap terpisah dari fixture.
