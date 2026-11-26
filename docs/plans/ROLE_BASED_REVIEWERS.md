# Pemeriksa berdasarkan jabatan

Instruksi pengguna 25 November 2026 mengganti persyaratan mandat manual pemeriksa dengan urutan jabatan SIA:

| Pembuat | Pilihan pemeriksa aktif |
|---|---|
| Staff/PIC (STF) | GM, SM, Dirut |
| GM | SM, Dirut |
| SM | Dirut |
| Dirut | Tidak ada jabatan di atasnya |

Berlaku pada Buat Surat, Surat Penagihan, impor/ambil nomor, serta koreksi draft, untuk seluruh jenis/unit. Hanya pejabat dengan profil, unit, posisi dan penugasan yang aktif ditampilkan. Satu kandidat diisi otomatis saat pemeriksaan dipilih; beberapa kandidat tetap dipilih pengguna. Dirut tidak dapat memilih Ya untuk pemeriksaan di atasnya pada surat baru.

Ini kelayakan untuk dipilih, bukan akses otomatis ke semua surat. Hak baca dan keputusan tetap memerlukan reviewer yang dipilih, tugas pada versi/hash terkini, serta siklus dan status yang sah. Rekan setingkat, bawahan, diri sendiri, dan akun administrasi teknis tidak memenuhi syarat. Pemeriksa GM/SM/Dirut mendapat menu Pemeriksaan Surat tanpa grant tambahan. Kewenangan persetujuan/TTD tetap memakai aturan sebelumnya.

Migrasi mengganti predikat reviewer pada gate simpan, pengajuan, keputusan, penerbitan nomor berbasis hasil review, hak baca versi/riwayat dan aktivitas terkait. Tidak menulis grant buatan, tidak menugaskan ulang surat lama, dan tidak mengubah naskah, nomor atau keputusan historis. Tabel review_authorizations dipertahankan sebagai riwayat konfigurasi lama, tidak lagi menjadi prasyarat pemilihan pemeriksa.

Pengujian lokal: `npm run check` lulus 404 tes, termasuk matriks jabatan, tanpa grant pada CREATE/UPLOAD, akses baru setelah penugasan, penolakan rekan/bawahan/admin dan validasi penugasan aktif. Fixture browser memeriksa daftar pilihan per jabatan, pengisian otomatis Dirut untuk SM, serta pilihan Ya yang tidak tersedia bagi Dirut. Data fixture sintetis; bukan UAT akun perusahaan nyata.
