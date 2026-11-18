# Spesifikasi target SIADocs R.04 — adaptasi NDO

Tanggal keputusan: 18 November 2026 (WIB). Status: **arah dan keputusan pengguna disetujui; PR-00 hanya mendokumentasikan, belum mengimplementasikan alur baru**. Persetujuan perusahaan atas konfigurasi awal review belum diperoleh.

## 1. Keputusan tetap dan batas pekerjaan

| Keputusan pengguna | Kontrak |
|---|---|
| Basis repository | `Salsabiil08/SuratDigitalSIA`; pertahankan aplikasi production. Tidak ada rekonsiliasi ke `SIAdocs` sekarang. |
| Kategori review awal | Permohonan dan Laporan wajib; Pemberitahuan opsional. Pertimbangkan jenis surat dan konfigurasi kewenangan perusahaan. Status awal belum tervalidasi perusahaan. |
| Reviewer | Memberi catatan, menyetujui hasil pemeriksaan, atau meminta revisi. **Tidak mengedit isi, metadata substansial, lampiran atau berkas surat.** Pembuat yang membuat koreksi/versi baru. |
| Surat internal | Dikirim dan diterima melalui Kotak Masuk SIADocs; akses penerima setelah pengiriman resmi. |
| Disposisi | Selesai hanya setelah pemberi memeriksa dan menerima hasil. |
| Balasan resmi | Surat baru yang terhubung ke surat asal; bukan menimpa naskah asal atau memakai ulang nomornya. |
| Perlindungan baseline | Pertahankan fitur production dan identitas visual. Jangan mengubah otomatis 13 surat lama tanpa versi dokumen. |
| Tahap aktif | PR-00–05 dalam draft; PR-06 Balasan Surat Resmi diizinkan untuk implementasi/pengujian lokal. PR-07 menunggu persetujuan baru. Database production, merge dan deployment selalu memerlukan persetujuan tersendiri. |

## 2. Cakupan dan invarian SIA

Pertahankan editor format/pratinjau, dua jalur CREATE/UPLOAD, tanggal surat sesuai kewenangan dan audit, koreksi draft/versi, nomor eksplisit/idempoten, TTD gambar/unggahan basah, jalur luar aplikasi tanpa kewajiban unggah, stempel opsional, disposisi dua arah, pembatalan berotorisasi, Auth/Storage privat, dan audit append-only. Nama menu utama tetap **Dashboard** dan UI tetap berbahasa Indonesia yang mudah dipahami.

- Internal biasa dapat tanpa TTD; formal maksimal satu TTD. Satu penerima utama dari organisasi.
- Eksternal wajib identitas penerima luar dan satu SM/Direktur yang sah.
- Tagihan dibuat oleh pengguna Finance, minimal dua rincian dan lampiran; dua persetujuan/pengesahan SM lalu Direktur sesuai kewenangan. SM berlaku lintas organisasi, bukan nama jabatan khusus Finance.
- Nomor hanya setelah tindakan eksplisit dan seluruh syarat yang berlaku. Format/counter per seri dan tahun WIB, nomor lama, pembatalan, dan audit tidak diubah. Pengulangan pemulihan memakai nomor yang sama.
- Gambar TTD tidak diklaim sebagai TTE tersertifikasi. Tanpa OCR, penempatan nomor/TTD sembarang, atau editor universal untuk PDF/DOCX impor.
- Super Admin tidak otomatis penyetuju, penandatangan atau pembaca isi surat. Hak administratif berbeda dari kewenangan bisnis.

CC/tembusan, share/forward berlapis, universal approver, integrasi HRIS, laporan performa NDO, QR publik, dan editor tabel/gambar ala NDO bukan tambahan otomatis ke cakupan ini.

## 3. Kebijakan review jenis–kategori

Bedakan **jenis surat** (`letter_types`: internal, eksternal, tagihan) dari **kategori dokumen** (`document_categories`: Permohonan, Pemberitahuan, Laporan).

| Kategori | Default awal | Penyesuaian berdasarkan jenis surat | Validasi perusahaan |
|---|---|---|---|
| Permohonan | Wajib review | Konfigurasi pasangan jenis–kategori bila ditetapkan pejabat berwenang | Belum |
| Laporan | Wajib review | Konfigurasi pasangan jenis–kategori bila ditetapkan pejabat berwenang | Belum |
| Pemberitahuan | Opsional | Dapat diwajibkan untuk jenis tertentu melalui konfigurasi berotorisasi | Belum |

**Resolusi target:** aturan aktif spesifik `(jenis, kategori)` yang telah disahkan → default kategori aktif yang telah disahkan. Tidak ada pengecualian per jenis yang diasumsikan pada PR-00. Default tabel ini adalah konfigurasi awal untuk perancangan/pengujian lokal atau staging, bukan izin mengaktifkannya di production atau menyatakannya sebagai kebijakan perusahaan final.

Konfigurasi memuat status draf/tervalidasi, pihak pengesah perusahaan, waktu/masa berlaku, alasan perubahan dan riwayat. Peran pengesah kebijakan ditetapkan perusahaan; jangan menebak nama/ID atau memberikan kewenangan itu otomatis kepada Super Admin. Pengelola teknis dapat menyiapkan konfigurasi sesuai izin, tetapi persetujuan bisnis tetap tercatat terpisah.

Pada pengajuan baru, kategori dan jenis harus valid agar kategori kosong tidak menjadi jalan melewati review wajib. Snapshot aturan dan versi dokumen disimpan saat pengajuan. Perubahan master tidak mengubah persetujuan/review surat terbit secara retroaktif. Draft lama mengikuti aturan aktif ketika diajukan kembali, tanpa backfill otomatis di PR-00.

Review opsional yang dipilih menjadi prasyarat pengajuan tersebut; review yang diwajibkan tidak dapat dilewati lewat UI, API, penggantian aktor atau pengosongan field. Jika reviewer/aturan wajib belum sah atau belum tersedia, pengajuan ditahan dengan pesan yang jelas, bukan dianggap lolos. Pengesahan kebijakan production tetap di luar persetujuan PR-00.

## 4. Tahap pemeriksaan dan persetujuan

Alur target:

1. Buat Surat/Ambil Nomor → simpan draft → pratinjau versi terkini.
2. Review jika dipilih atau diwajibkan oleh kebijakan.
3. Persetujuan bisnis yang dipilih/diwajibkan menurut aturan SIA.
4. Siap Diberi Nomor → tindakan eksplisit Terbitkan Nomor Surat.
5. Pengesahan bila diperlukan → finalisasi dokumen.
6. Pengiriman → penerimaan → balasan/disposisi bila diperlukan → penyelesaian alur.

Reviewer hanya membaca versi penugasan yang sah, memberi catatan, menyetujui hasil pemeriksaan, atau meminta revisi dengan catatan wajib. Tidak ada tombol/endpoint reviewer yang mengubah naskah. Revisi dilakukan pembuat dan menghasilkan versi baru; hasil pemeriksaan dan approval terdampak harus diperoleh kembali. Catatan dan keputusan lama tidak dihapus. Menyetujui review tidak sama dengan persetujuan bisnis dan tidak menerbitkan nomor.

Penyetuju pilihan, reviewer dan penandatangan tidak disamakan. Jangan menambahkan seluruh atasan secara otomatis. Pejabat wajib tetap memenuhi aturan surat. Bila pembuat juga pejabat berwenang, deduplikasi tahap persetujuan terhadap aktor yang sama dengan mencatat dasar kewenangan pembuat pada versi tersebut; jangan membuat satu orang menyetujui pengajuan yang sama dua kali. Ini tidak membebaskan review wajib, pejabat lain yang wajib, konfirmasi penerbitan maupun tindakan TTD. Pada tagihan, deduplikasi tidak boleh menghilangkan kewenangan SM/Direktur yang berbeda atau mengubah urutan TTD.

## 5. Status terpisah dan arti penyelesaian

Kontrak berikut adalah **semantik target**, bukan enum atau kolom baru yang sudah diterapkan.

| Dimensi | Contoh label target | Bukti yang diperlukan |
|---|---|---|
| Pemeriksaan | Tidak perlu pemeriksaan / Menunggu pemeriksaan / Perlu perbaikan / Pemeriksaan selesai | Aturan, reviewer sah, versi dan keputusan |
| Persetujuan/proses | Draft / Menunggu persetujuan / Ditolak / Siap diberi nomor / Sudah bernomor | Tahap dan aktor yang sah; tidak memalsukan nomor |
| Pengesahan | Tidak diperlukan / Menunggu TTD / Pengesahan dalam aplikasi lengkap / Di luar aplikasi | Sesuai jalur, versi/hash dan konfirmasi yang benar |
| Finalitas dokumen | Belum final / Dokumen final–siap dikirim | Dokumen bernomor dan syarat TTD lengkap, versi terkunci |
| Pengiriman | Belum dikirim / Terkirim | Transaksi kirim dan snapshot versi/hash/penerima |
| Penerimaan | Belum dibaca / Dibaca / Diterima | Dibaca berbeda dari tindakan penerimaan oleh penerima |
| Penyelesaian surat | Menunggu tindak lanjut / Selesai alur | Syarat kirim/terima dan tindak lanjut yang berlaku |

`finalized_at` tetap menyatakan penguncian dokumen. Jangan menggunakannya sebagai bukti pengiriman atau membuat semua surat final otomatis “Selesai alur”. Unduh bukan kirim; dibaca bukan diterima; membuat draft balasan bukan memenuhi kewajiban balas. Surat dibatalkan tetap bernomor bila sudah terbit dan riwayatnya dipertahankan.

Untuk internal tanpa tindak lanjut wajib, alur dapat selesai setelah diterima. Bila ada balasan/disposisi wajib, penyelesaian menunggu pemenuhannya. Definisi kewajiban balas, apakah balasan harus diterima untuk menutupnya, dan bukti penerimaan eksternal masih perlu penetapan bisnis sebelum PR terkait; jangan mengarang penerimaan. Pengiriman eksternal/tagihan dicatat melalui kanal luar sesuai aturan SIA, bukan otomatis mengirim email.

## 6. Hak baca dan pengiriman resmi

- Hak baca sebagai **penerima** baru ada setelah pengiriman resmi ke penerima utama yang benar. Status bernomor/final saja tidak cukup.
- Penerima hanya membaca snapshot dokumen/versi yang dikirim dan lampiran yang diizinkan; jangan membuka seluruh draft atau versi koreksi lewat relasi surat.
- Reviewer, penyetuju dan penandatangan dapat membaca sesuai penugasan sah sebelum pengiriman. Jika orang tersebut juga penerima, dasar aksesnya tetap penugasan, bukan hak penerima yang dibuka lebih awal.
- Pengirim dan penerima diambil dari sesi terverifikasi. Penerima lain, admin tanpa kewenangan bisnis, dan pengguna tidak aktif tidak dapat mengaku sebagai penerima atau mengonfirmasi terima.
- Kirim/terima harus idempoten dan atomik bersama audit serta event notifikasi. UI tidak boleh mengaku berhasil ketika write gagal.
- Menghubungkan surat asal–balasan/disposisi tidak otomatis memperluas hak baca dokumen asal.

## 7. Balasan dan disposisi

Balasan adalah `letters` baru dengan relasi yang jelas ke surat asal. Ikuti review, persetujuan, nomor, TTD, pengiriman dan penerimaan yang berlaku. Nomor baru hanya terbit saat balasan memenuhi syarat; surat asal tidak diubah, dan `copied_from_id` tidak diperlakukan sebagai pengganti relasi balasan.

Pertahankan alur disposisi dua arah yang sudah berfungsi. Aksi dari Kotak Masuk menggunakan surat diterima sebagai acuan. Penerima mengerjakan dan mengirim hasil kepada pemberi; pemberi memeriksa lalu menerima atau meminta perbaikan. Hanya penerimaan pemberi menyelesaikan disposisi. Bila hasil wajib berupa surat, syarat versi final/pengesahan dan pengiriman hasil mengikuti kontrak yang ditetapkan; jangan menutup saat draft baru dibuat. Perbaikan atas surat final menggunakan surat baru berelasi, tanpa mengubah nomor atau dokumen final lama.

## 8. Data lama dan keputusan yang belum ditetapkan

Jangan mengubah otomatis 13 surat bernomor tanpa `current_version_id`, nomor/counter, status lama, versi/hash, atau audit. Jangan menandai surat lama sebagai sudah direview/dikirim/diterima. Data lama yang belum cukup bukti diberi kondisi eksplisit pada implementasi berikutnya. Pengisian dokumen asli hanya melalui prosedur berotorisasi yang disetujui terpisah.

Masih perlu validasi perusahaan: siapa/lingkup reviewer yang sah; pengesah kebijakan jenis–kategori dan masa berlakunya; pengecualian per jenis; kewajiban balas/tenggat; bukti penerimaan eksternal; dan kriteria penutupan balasan. Keputusan repo, default kategori dan larangan reviewer mengedit **sudah diputuskan pengguna** dan tidak ditanyakan ulang.

## 9. Gerbang implementasi

Rincian migrasi dan pembagian PR ada di [rencana migrasi](../plans/R04_NDO_MIGRATION_PLAN.md). PR-00 selesai pada dokumentasi dan hasil pemeriksaan; tidak membuat SQL baru, menjalankan backfill, mengubah alur runtime, merge, atau deploy. PR-01 selesai dalam draft, dan PR-02 kini diizinkan terpisah. Lihat [hasil PR-02](../plans/PR02_VALIDATION.md); PR-03 kemudian diizinkan secara eksplisit; lihat [hasil PR-03](../plans/PR03_VALIDATION.md). PR-04 kemudian diizinkan secara eksplisit; lihat [hasil PR-04](../plans/PR04_VALIDATION.md). PR-05 kemudian diizinkan secara eksplisit; lihat [hasil PR-05](../plans/PR05_VALIDATION.md). PR-06 kemudian diizinkan secara eksplisit; lihat [hasil PR-06](../plans/PR06_VALIDATION.md). PR-07 tidak dimulai sampai persetujuan berikutnya.
