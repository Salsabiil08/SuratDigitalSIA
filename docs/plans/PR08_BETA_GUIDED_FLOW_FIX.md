# BETA: alur terpandu, kop pratinjau, dan stempel

19 November 2026; lanjutan PR #9. Tidak ada migrasi, perubahan surat lama, mandat baru, atau perubahan nomor.

- Detail surat menampilkan satu petunjuk Langkah berikutnya sesuai aktor dan status, dengan tautan ke bagian tindakan. Pembatalan disembunyikan dalam opsi tambahan.
- Ajukan Surat mencatat konfirmasi pratinjau versi terkini lalu mengajukan melalui RPC existing. Tombol Konfirmasi Pratinjau terpisah dihilangkan. Pratinjau tetap wajib dimuat; persetujuan, nomor, TTD, finalisasi, dan pengiriman tetap tindakan eksplisit sesuai kewenangan.
- Detail surat menyesuaikan status otomatis setiap 20 detik hanya ketika tab aktif dan sedang menunggu, serta saat kembali ke tab/online. Tidak ada permintaan paralel dari scheduler, polling berhenti ketika ditutup dan tidak mengulang mutasi. Daftar pemeriksaan/persetujuan/TTD diperbarui setiap 30 detik saat aktif.
- Pemeriksa harus lebih tinggi dari pembuat: Staff → GM/SM/Direktur, GM → SM/Direktur, SM → Direktur. Pilihan UI serta server simpan/pengajuan/keputusan memeriksa hierarki aktif. Mandat jenis/unit dan validitas versi pada database tetap wajib. Tidak ada penetapan reviewer perusahaan otomatis; bila mandat kosong, kategori wajib review tetap tertahan.
- Kop resmi tersusun dari vektor Word yang tidak didukung renderer browser. Fallback hanya aktif untuk hash header resmi dan relasi header yang cocok; jalur vektor diekstrak dari template existing melalui skrip reproducible. Byte dokumen tersimpan/unduhan tidak berubah; dokumen impor dengan header berbeda tidak diberi kop palsu.
- Template baru menempatkan placeholder stempel di paragraf TTD pertama sebagai lapisan di atas gambar TTD. Rasio gambar dipertahankan; PDF tetap memakai koordinat tervalidasi, DOCX impor tetap memakai placeholder pengguna. Dokumen yang sudah ditandatangani tidak dipindah/ditulis ulang otomatis. Posisi surat lama hanya berubah lewat koreksi versi yang sah sebelum pengajuan ulang.

## Bukti

Lokal: typecheck dan 269 tes lulus; browser nyata desktop/mobile memverifikasi editor, retry pembaruan, logo kop dan perpotongan area stempel–TTD dengan backend fixture lokal. Tes scheduler memverifikasi fokus, tab tersembunyi, offline, permintaan bersamaan, kegagalan/retry, dan cleanup. CI penuh wajib lulus sebelum integrasi/deploy. UAT akun nyata bukan hasil fixture dan tetap perlu diuji pengguna.

## Cara uji pengguna

Buat Pemberitahuan internal formal baru → simpan → ikuti Langkah berikutnya → Ajukan Surat. Direktur memberi persetujuan; saat pembuat kembali ke tab, status otomatis berubah dan petunjuk menjadi Terbitkan nomor surat. Sesudah nomor terbit, Direktur membuka Tanda Tangan, memilih PNG TTD dan stempel, memeriksa pratinjau lalu menyimpan. Pembuat memeriksa hasil, finalisasi, kemudian mengirim. Penerima mengonfirmasi penerimaan secara eksplisit. Laporan/Permohonan tetap memerlukan pemeriksa lebih tinggi yang bermandat.
