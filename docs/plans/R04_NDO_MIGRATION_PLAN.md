# Rencana migrasi aditif dan pembagian PR — R.04 adaptasi NDO

Status: **rencana bertahap; PR-02 diizinkan untuk implementasi dan pengujian lokal, bukan production**. PR-00 tidak membuat atau menjalankan migrasi. Basis: [baseline production](../baselines/production-2026-11-18.md) dan [keputusan target](../spec/08-alur-ndo-r04.md). Persetujuan saat ini berhenti pada PR-02; merge, database production dan deployment belum diizinkan.

## 1. Syarat sebelum menulis/menerapkan migrasi berikutnya

1. Peroleh persetujuan PR terkait. Gunakan branch baru dari basis yang telah ditinjau; jangan merekonsiliasi repo `SIAdocs`.
2. Bedakan izin implementasi, merge, perubahan database production dan deployment. Approval satu tindakan tidak otomatis mengizinkan tindakan lain. Jika merge memicu deploy otomatis, jangan merge sebelum deploy juga diizinkan atau pengaman yang disetujui tersedia.
3. Bandingkan schema nyata, history, fungsi, constraint, indeks, RLS, grant, bucket dan dependensi secara baca saja. Audit mencatat 14 file lokal versus 8 history revisi production; baseline tabel sudah ada. Jangan menyimpulkan harus mengeksekusi ulang enam file awal, melakukan migration repair, reset atau mengubah history otomatis.
4. Buat snapshot/backup yang dapat diverifikasi sebelum perubahan production yang kelak disetujui. Jangan menyimpan dump surat/secret ke repo. PR-00 hanya menyimpan manifest kode/migrasi, bukan backup data production.
5. Bangun database uji lokal dari migrasi dan fixture. Uji forward migration pada salinan schema/metadata yang telah disanitasi di staging agar tidak sekadar lolos pada database kosong. Staging menggunakan project/key/bucket terpisah dari production.
6. Buat file migrasi baru lewat CLI pada tahap yang disetujui; jangan menyunting migrasi terpakai. Tinjau data quality dan rencana pemulihan, jalankan uji negatif/RLS/konkurensi. Perubahan production tetap menunggu persetujuan baru.

## 2. Permukaan database yang direncanakan

Nama di bawah merupakan rancangan untuk PR berikutnya, bukan tabel/kolom yang diklaim sudah dibuat.

| Area | Perubahan aditif yang diusulkan | Pelindung dan batas |
|---|---|---|
| Kebijakan review | Kebijakan berversi berdasarkan kategori, dengan override jenis–kategori, status draf/tervalidasi, pengesah, waktu efektif dan alasan; snapshot pada siklus pengajuan | Default Permohonan/Laporan wajib dan Pemberitahuan opsional hanya konfigurasi awal belum tervalidasi perusahaan. Tanpa aktivasi production di PR-00; master baru tidak menulis ulang surat terbit. |
| Penugasan reviewer | `review_steps`/siklus dengan aktor sah, urutan yang ditetapkan, version_id/hash, keputusan/catatan/waktu; penanda status pemeriksaan terpisah | Reviewer tidak mempunyai write isi/metadata/lampiran. Kategori kosong tidak melewati review wajib; perubahan substansi mengulang konfirmasi terdampak dan mempertahankan history. |
| Persetujuan | Perluasan konfigurasi/RPC approval untuk penyetuju pilihan dan pejabat wajib, terikat versi dan dasar kewenangan | Jangan menghitung keberhasilan hanya dari jumlah signer. Deduplikasi pembuat-pejabat tanpa menghilangkan pihak wajib lain, penerbitan eksplisit atau TTD. |
| Pengiriman | Perluasan `letter_distributions` atau event pengiriman terkait surat, versi/hash final, penerima dan pengirim sah, waktu/kanal dan kunci idempoten | Gunakan snapshot yang benar-benar dikirim. Satu transaksi kirim + audit + notifikasi; tidak ada read penerima hanya karena surat NUMBERED. Kanal luar tidak mengklaim email terkirim/bukti terima tanpa dukungan. |
| Penerimaan | Receipt penerima sah dengan received_at/received_by terpisah dari read_at; constraint/deduplikasi terhadap delivery | Pengirim/admin tidak dapat mengaku sebagai penerima. RLS dan akses Storage melalui versi terkirim; penugasan reviewer/approver/signer diperiksa terpisah. |
| Finalitas dan penyelesaian | Penanda pengiriman/penerimaan/tindak lanjut terpisah dari finalized_at dan status persetujuan | Dokumen final tetap terkunci. Tidak menandai semua data lama sebagai sudah direview/terkirim/diterima/selesai. Semantik enum/kolom final ditinjau sebelum PR terkait. |
| Balasan dan relasi | Relasi surat asal–balasan (misalnya `letter_relations`, tipe REPLY), actor/waktu, FK dan constraint tanpa relasi ke diri sendiri | Surat baru dengan versi/nomor/persetujuan/pengesahan sendiri. Jangan memakai copied_from_id untuk memalsukan balasan atau memberikan akses otomatis ke asal. |
| Disposisi | Perluasan hubungan acuan/hasil dan tindakan dari Inbox; pertahankan response_letter_id/history lama | Hanya giver menerima/menutup. Tidak mengganti mekanisme dua arah yang sudah berjalan atau mengubah surat final lama. |
| Notifikasi dan audit | Helper internal yang tidak menjadi Server Action publik tanpa otorisasi; event dari transaksi alur sah, label Indonesia | Append-only audit, tanpa isi/secret/TTD mentah. Gagal write tidak boleh dilaporkan sukses. Helper yang belum aman tetap temuan sampai PR-01 disetujui/dikerjakan. |

Setiap tabel baru memerlukan RLS, FK, indeks dan ACL sempit. RPC mutasi sensitif tetap server-only dengan aktor dari Auth terverifikasi dan pengulangan cek kewenangan di database. Jangan menyelesaikan masalah akses dengan grant UPDATE luas atau mempercayai actor/status dari browser.

## 3. Urutan PR dan izin

| PR | Hasil yang dituju | File/area utama | Gerbang penerimaan | Izin saat ini |
|---|---|---|---|---|
| PR-00 | Baseline, kontrak R.04, rencana aditif dan catatan GAP | Dokumen/AGENTS/README/backlog; pengaman auto-deploy branch PR-00 | Diff aplikasi/migrasi/dependensi kosong; tautan/kontrak benar; check baseline | Selesai, draft PR #1 belum di-merge |
| PR-01 | Otorisasi helper/event notifikasi dan kerangka status | src/server/actions/notifications.ts, server/notifications.ts, modul event internal, domain label/status | Caller arbitrer ditolak; audit/event tidak palsu; kegagalan ditangani | Selesai, draft PR #2 belum di-merge |
| PR-02 | Kategori + reviewer independen | DraftInput, editor/persiapan, actions/workflow, reviewer UI, migrasi baru | Review wajib/opsional sesuai policy; reviewer tidak bisa edit; versi baru mengulang review; konfigurasi awal belum diklaim final perusahaan | **Implementasi PR-02 disetujui; lihat laporan PR-02** |
| PR-03 | Approval pilihan/pejabat wajib dan deduplikasi self-signer | approvals/workflow/editor/detail/halaman konfirmasi nomor; migrasi baru | Pejabat sah tetap wajib, tanpa approval duplikat; nomor tidak otomatis; ringkasan syarat memakai data nyata | Menunggu |
| PR-04 | Pengiriman + penerimaan transaksi | Modul distribusi/domain, API privat dokumen, RPC/RLS aditif | Final/TTD lengkap; kirim/terima idempoten; penerima pra-kirim dan aktor salah ditolak | Menunggu |
| PR-05 | Kotak Masuk/Keluar dan status alur | Rute baru, sidebar, dashboard, detail, notifikasi | Dokumen terkirim hanya ke penerima; dibaca ≠ diterima; final ≠ selesai alur | Menunggu |
| PR-06 | Balasan resmi berelasi | Editor/detail/relasi/workflow, FK/RLS aditif | Asal utuh, balasan surat/nomor baru, hak baca tidak bocor, draft bukan pemenuhan kewajiban | Menunggu |
| PR-07 | Integrasi disposisi dari Inbox dan hasil berelasi | Inbox/detail/disposisi dan perluasan RPC | RETURN → perbaikan → ACCEPT oleh pemberi; hasil belum sah ditolak; nomor/dokumen final lama utuh | Menunggu |
| PR-08 | UAT lintas akun, regresi dan panduan hasil | Tes review/distribusi/balasan/workflow/dokumen dan laporan | Seluruh actor dan jalur negatif, concurrency PostgreSQL, data lama terlindungi | Menunggu |

Ketergantungan: PR-00 → PR-01 → PR-02 → PR-03 → PR-04 → PR-05 → PR-06/PR-07 → PR-08. PR-02 dimulai setelah persetujuan eksplisit pengguna; menyelesaikan PR-02 tidak mengizinkan PR-03. Setiap branch berikutnya juga harus menghormati larangan deploy otomatis sampai diizinkan.

## 4. Perlindungan khusus 13 surat lama

- PR-00 tidak memuat UPDATE/INSERT/DELETE/backfill/seed atau skrip pemulihan untuk surat itu.
- Jangan menyunting official_number, issuance/counter, status, current_version_id, file/hash, penandatangan atau audit lama secara otomatis.
- Tidak boleh membuat dokumen pengganti dari metadata, menyisipkan bukti review/TTD/pengiriman fiktif, atau menerbitkan nomor baru untuk menutupi kekurangan berkas.
- Rekonsiliasi terpisah: inventaris baca saja → verifikasi berkas asli dan kewenangan → rencana per kasus → persetujuan → unggah/tautan dokumen asli berotorisasi dengan audit → pemeriksaan. Jangan mengeksekusinya sebagai seed atau side effect migrasi alur baru.
- Bila bukti belum ada, fitur yang memerlukannya ditahan dengan pesan jelas pada implementasi berikutnya; jangan mengubah data historis untuk membuat UAT terlihat lulus.

## 5. Strategi perluasan dan pemulihan

**Perluasan dulu:** tambahkan struktur/kebijakan/RPC yang diuji, pertahankan pembaca/data baseline. Aktifkan alur baru hanya pada lingkungan/kelompok yang disetujui. Jangan melakukan drop/rename destruktif, perubahan format nomor, rewrite dokumen final atau upgrade stack bersamaan.

**Verifikasi sebelum aktivasi:** periksa constraint/FK, RLS lintas akun, ACL service-only, storage privat, siklus review/approval, snapshot terkirim, audit dan idempotensi. Data baru memakai kategori/aturan yang sah; data lama tidak otomatis dianggap memenuhi review/pengiriman.

**Pemulihan:** jika gagal, hentikan aktivasi fitur baru dan pertahankan bukti transaksi. Gunakan perbaikan maju yang ditinjau; jangan menurunkan counter, menggunakan ulang nomor, menghapus audit, atau mengembalikan dokumen final ke draft. Pemulihan production memerlukan persetujuan dan rencana teruji; tidak ada rollback SQL yang dijalankan PR-00.

## 6. Risiko dan bukti pengujian yang diperlukan

| Risiko | Uji/pengendalian sebelum PR dinyatakan selesai |
|---|---|
| Review/approval memakai versi lama | Ubah isi oleh pembuat, pastikan keputusan versi lama tidak membuka penerbitan/kirim; reviewer tidak bisa PATCH isi/metadata/lampiran |
| Kategori kosong/override tidak sah | Permohonan/Laporan tidak bisa skip review; Pemberitahuan opsional; pasangan jenis–kategori dan perubahan policy berotorisasi/tercatat |
| Persetujuan duplikat atau pihak wajib hilang | Pembuat = SM/Direktur, pembuat berbeda dari pejabat, tagihan dua pihak dan penyetuju pilihan; penerbitan tetap eksplisit |
| Draft/versi internal bocor | Coba recipient sebelum kirim, pengguna lain, lintas unit, admin tanpa hak, link relasi dan akses langsung Storage |
| Finalisasi disalahartikan | Dokumen final belum terkirim tetap belum diterima/selesai; unduh dan baca tidak mengonfirmasi terima |
| Write separuh / klik ganda | Fault injection dan konkurensi PostgreSQL nyata untuk nomor, delivery, receipt, TTD dan audit; ulangi dengan kunci yang sama |
| Data lama dipalsukan oleh migrasi | Bandingkan metadata/nomor/hash/counter/audit sebelum/sesudah pada staging; 13 surat tidak dimodifikasi otomatis |
| Regresi editor/pengesahan | Font/perataan/bold/italic, teks lama, HTML berbahaya, marker/koordinat PDF/DOCX, gambar/basah, jalur luar tanpa unggah dan stempel opsional |
| Penutupan disposisi sepihak | Penerima tidak bisa ACCEPT/DONE; pemberi RETURN/ACCEPT sah; koreksi final memakai surat baru |
| Status palsu / event arbitrer | Payload actor/status palsu, penugasan kedaluwarsa, akun nonaktif, kegagalan notifikasi dan mutasi dari aktor tidak sah |

UAT target melibatkan pembuat, reviewer, approver, signer, pengirim, penerima serta pemberi/penerima disposisi. Laporan harus memisahkan unit/domain, PGlite, PostgreSQL nyata, API, browser, bukti historis dan keterbatasan. 69 tes baseline bukan tanda fitur baru sudah lulus.

## 7. Validasi perusahaan dan keputusan tersisa

Sudah diputuskan: repo live dipakai tanpa rekonsiliasi; default kategori awal; reviewer tidak mengedit. Belum tervalidasi perusahaan: pejabat pengesah policy, lingkup/jumlah/urutan reviewer dan override per jenis, masa berlaku, kewajiban balas/tenggat, bukti penerimaan eksternal dan penutupan balasan. Catat sebagai keputusan tertunda sebelum PR yang bergantung padanya; jangan menanyakan ulang keputusan yang sudah final.
