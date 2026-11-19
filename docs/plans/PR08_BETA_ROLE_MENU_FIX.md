# BETA: menu akun, pembaruan status, dan uji TTD

19 November 2026. Lanjutan PR #9; tanpa migrasi atau perubahan data.

## Perbaikan

- Menu berasal dari penugasan aktif, mandat pemeriksa/penyetuju, status penandatangan resmi, dan unit pengaju tagihan yang dikonfigurasi. Super Admin tidak memperoleh hak bisnis otomatis. Server dan RLS tetap menjadi penentu hak tindakan/dokumen.
- Persetujuan kini memiliki menu sendiri. Pengesahan diberi nama Tanda Tangan. Administrasi hanya untuk Super Admin. Pemeriksaan hanya untuk akun bermandat.
- Perbarui status mengambil data terbaru, menampilkan proses/berhasil/gagal dan dapat dicoba ulang. Pratinjau tidak dibatalkan saat versi/revisi tidak berubah.
- Kartu hubungan surat disembunyikan bila tidak ada relasi atau tindakan yang sah. Daftar TTD kosong menjelaskan prasyaratnya.

## Diagnosis surat pengguna

Surat 80df2630-4ae0-4bd3-9217-019ccc3db927 masih Draft, kategori Laporan, belum bernomor. Budi sudah dipilih sebagai penyetuju dan penandatangan, tetapi belum ada tugas TTD. Kategori Laporan wajib pemeriksaan dan belum ada reviewer yang diberi mandat. Surat ini tidak diubah otomatis untuk melewati aturan.

## Uji pribadi: internal formal satu TTD

Gunakan **surat baru kategori Pemberitahuan**, contoh “UJI BETA — Pemberitahuan Rapat”. Jangan mengubah kategori surat Laporan demi melewati pemeriksaan.

1. Rina → Buat Surat → Internal → Pemberitahuan → penerima Doni. Aktifkan Perlu pengesahan formal (1 TTD), pilih Budi untuk persetujuan dan penandatangan, jalur melalui SIADocs. Isi naskah lalu simpan draf.
2. Rina → lihat pratinjau → Konfirmasi Pratinjau → Ajukan Surat. Budi seharusnya menerima tugas Persetujuan; belum ada tugas TTD.
3. Budi → Persetujuan → Pratinjau dan Setujui → periksa dokumen → Setujui.
4. Rina → Surat Saya → buka surat → Perbarui status → Terbitkan Nomor Surat. Nomor resmi dan tugas TTD baru terbentuk pada tahap ini.
5. Budi → Tanda Tangan → Pratinjau dan Tanda Tangani. Pilih gambar PNG uji milik sendiri, pratinjau hasil, konfirmasi, lalu Tanda Tangani dan Simpan. Gambar TTD bukan TTE tersertifikasi.
6. Rina → Perbarui status → periksa hasil → Finalisasi dan Kunci Dokumen → pilih/konfirmasi penerima → Kirim Surat Internal.
7. Doni → Kotak Masuk → buka surat → Konfirmasi Terima Surat. Membuka saja tidak mengonfirmasi penerimaan.

Laporan/Permohonan harus menunggu penetapan pemeriksa yang sah; tidak dibuat mandat fiktif. Disposisi memerlukan hierarki sah. Staf dapat menerima/menyerahkan hasil, bukan menyelesaikan sendiri hasil tugasnya.

## Bukti dan batas

- Lokal: typecheck + 260 tes lulus; browser desktop/mobile untuk editor dan pembaruan berhasil/gagal/retry lulus dengan backend mock lokal.
- CI penuh menjadi gerbang sebelum integrasi dan deployment BETA. Tidak ada perubahan SQL/RLS/Storage/nomor.
- UAT lintas akun pada production bukan hasil tes fixture. Langkah di atas disediakan untuk pengujian pengguna; mandat pemeriksa perusahaan tetap pending.
