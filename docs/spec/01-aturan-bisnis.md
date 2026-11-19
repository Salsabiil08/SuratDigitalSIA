> Dokumen historis: rancangan R.04 sebelum adaptasi NDO. Untuk keputusan aktif gunakan [spesifikasi target 08](08-alur-ndo-r04.md) dan [revisi production 00](00-revisi-alur.md). Aturan lama yang bertentangan tidak boleh dipakai untuk menghapus fitur production atau menganggap target baru sudah tersedia.

# Aturan Bisnis

Ringkasan Blueprint R.04 bab 5 dan 6. Rujukan penuh: `docs/blueprint/Blueprint_R04_SIADocs.pdf`.

## Peran dan struktur
- Struktur dinamis (Master Organisasi): Direktur Utama (level 4), Senior Manager (3), GM/Kepala Unit atau Departemen (2), Staff/PIC (1). Level menggambarkan hierarki, bukan satu-satunya penentu persetujuan.
- Unit awal contoh: Accounting, Reporting, Finance. Kode unit dan jabatan adalah contoh konfigurasi.
- Super Admin mengelola master, seri, pengaturan, dan melihat Log History. Tidak otomatis berhak menyetujui, menandatangani, atau membatalkan, dan tidak otomatis melihat isi surat.

## Jenis surat (satu entitas `letters`)
| Jenis | Kode contoh | Penerima | Persetujuan | Tanda tangan (jalur dipilih pembuat) |
|---|---|---|---|---|
| Internal | IN | satu pengguna SIA | default tidak wajib; boleh dipilih; wajib konfirmasi pejabat bila memakai nama atau kewenangannya | tidak wajib; 1 bila memerlukan pengesahan |
| Eksternal | KRE | satu pihak eksternal (nama dan instansi) | fleksibel; persetujuan final penandatangan wajib | 1 oleh Senior Manager atau Direktur Utama |
| Pengantar Tagihan | Tag | sesuai tujuan surat | wajib: SM Finance (pengaju) lalu Direktur Utama (penyetuju) | 2 berurutan: SM Finance lalu Direktur Utama |

Surat Pengantar Tagihan hanya dapat dibuat pengguna aktif pada unit Finance (kolom `letter_types.creator_unit_id`). Rincian tagihan minimal 2 baris, satu bank dan satu penerima pembayaran per surat, lampiran minimal satu, total dan terbilang otomatis. Kode jenis tidak boleh ditebak dari nama.

## Persetujuan (bagian 6.4 dan 6.5)
1. Pembuat menentukan kebutuhan persetujuan: tanpa, satu, atau beberapa berurutan (maksimal 3 pilihan pembuat di luar penyetuju wajib). Sistem memvalidasi kewenangan dan menambahkan syarat wajib tanpa menggandakan tahap.
2. Pejabat yang namanya atau kode jabatannya dipakai wajib memberi persetujuan final sebelum nomor terbit. Tidak perlu konfirmasi tambahan. Bila pembuat adalah pejabat penandatangan, tidak ada persetujuan ganda, tetapi konfirmasi penerbitan tetap wajib.
3. Ajukan: status `IN_REVIEW`, penyetuju aktif diberi notifikasi, lampiran terkunci.
4. Penyetuju: Setujui, Minta Revisi (catatan wajib), Tolak (alasan wajib). Penyetuju tidak mengedit isi.
5. Persetujuan terakhir: `READY_TO_ISSUE`. Tidak ada penerbitan otomatis.
6. Minta Revisi: `REVISION_REQUESTED`, pembuat memperbaiki (versi baru) dan mengajukan ulang. Perubahan substansi membuat persetujuan terdampak diulang, persetujuan lama berstatus `SUPERSEDED` dan tetap tersimpan.
7. Tolak: `REJECTED`, status akhir, pembuat dapat menyalin sebagai draft baru. Berbeda dari `CANCELLED`.
8. Tarik kembali: `IN_REVIEW` kembali `DRAFT` selama penyetuju aktif belum memutuskan.
9. Perubahan substansi setelah `READY_TO_ISSUE` mengembalikan ke `DRAFT`.
10. Surat internal ke level yang sama atau lebih rendah, termasuk antarunit, dapat terbit tanpa persetujuan bila tidak memakai kewenangan pejabat lain dan tidak memerlukan pengesahan.

## Konfirmasi penerbitan (6.13)
Sebelum nomor diterbitkan sistem menampilkan ringkasan: dokumen, penerima, perihal, penandatangan, metode pengesahan, persetujuan. Tombol Terbitkan Nomor Surat aktif hanya bila validasi dan persetujuan wajib lengkap. Setelah konfirmasi dokumen dikunci secara substansial.

## Versi dokumen (6.14)
Jenis dokumen pada surat: bukti `DRAFT` (diunggah pembuat sebelum nomor), kop bernomor (unduhan sistem), akhir `NUMBERED` (diunggah pembuat setelah menyalin nomor), `SIGNED` (diunggah penandatangan, hanya jalur `IN_APP`). SIADocs tidak menyisipkan nomor ke dokumen dan tidak ada editor isi.

## Disposisi (6.9)
Instruksi atasan kepada bawahan, satu pemberi, satu penerima, satu tingkat. Tidak bernomor dan tidak mengubah status surat. Prioritas Biasa, Penting, Segera. Status Baru, Diproses, Selesai dengan catatan tindak lanjut. Dapat dikaitkan ke surat (`letter_id`). Bila `requires_letter`, Selesai ditolak sebelum surat terkait `NUMBERED`. Belum ada dokumen: Buat Surat. Sudah ada: Ambil Nomor. Tanpa penerusan berlapis.

## Pembatalan (6.12)
- Draft: dapat dibatalkan pembuat (`CANCELLED`, tanpa nomor).
- Surat bernomor: alasan wajib dan otorisasi sesuai kewenangan. Pengaju: pembuat atau pejabat berwenang. Eksekusi oleh sistem setelah otorisasi lengkap, bukan tombol Super Admin.
- Otorisasi: Internal = kepala unit pemilik surat atau pejabat dengan delegasi resmi tercatat (1); Eksternal = pejabat penandatangan (1); Tagihan = SM Finance dan Direktur Utama (2, keduanya wajib).
- Delegasi hanya untuk otorisasi pembatalan (`authority_delegations`, rujukan dokumen dan masa berlaku).
- Nomor tidak dipakai ulang dan tidak dikembalikan ke urutan. Dokumen tetap dapat dilihat dengan penanda DIBATALKAN. Pihak terkait diberi notifikasi. Seluruh proses tercatat pada audit.

## Notifikasi dan lampiran
- Notifikasi dalam aplikasi (Supabase Realtime) utama. Tanpa isi dokumen.
- Lampiran maksimal 25 MB total per surat (nilai awal, dapat diubah Super Admin), tidak digabung ke PDF surat, dapat ditambah atau dihapus pada `DRAFT` dan `REVISION_REQUESTED`.
