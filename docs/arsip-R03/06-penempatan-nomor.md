# Unggah Surat dan Penempatan Nomor

Implementasi acuan: `src/domain/numberPlacement.ts`.

## Cakupan
| Kemampuan | Status |
|---|---|
| Template resmi dengan penanda posisi nomor | MVP |
| DOCX unggahan: penanda `{{NOMOR_SURAT}}` (tepat satu) | MVP |
| PDF unggahan: isian koordinat (halaman, kiri, atas, lebar, tinggi dalam mm) atau area tersimpan | MVP |
| Pemeriksaan posisi dan pratinjau dengan nomor contoh (bukan nomor asli) | MVP |
| Menyeret kotak pada pratinjau PDF | tahap berikutnya, belum tersedia |
| OCR atau AI untuk mengenali posisi | tidak ada |

Surat hasil unggahan mengikuti jalur yang sama dengan surat editor (aturan jenis, persetujuan, dan Terbitkan Nomor Surat). Tidak ada jalur langsung bernomor. Unggahan tidak langsung menghasilkan nomor.

## Berkas yang tidak sesuai
DOCX tanpa penanda atau dengan lebih dari satu penanda, PDF tanpa area valid (halaman di luar jangkauan, area melewati tepi), atau berkas rusak: sistem menampilkan petunjuk perbaikan, pengguna memperbaiki atau mengunggah berkas yang sesuai. Nomor belum diambil pada tahap ini.

## Pemeriksaan nomor pada dokumen bernomor
- Nomor yang ditulis berasal dari `official_number` di database.
- DOCX: penanda sudah hilang dan nomor resmi muncul tepat sekali pada teks dokumen.
- PDF: hanya teks pada area nomor dibaca dan dibandingkan dengan nomor resmi. Tidak ada OCR.
- Pemeriksaan tidak diasumsikan sempurna. Bila gagal: tidak ada nomor baru, nomor tetap terikat pada surat, pembuatan diulang dengan nomor yang sama, setelah gagal berulang penerbitan ditandai tertunda dengan notifikasi pembuat dan Super Admin. Terbitkan Nomor Surat berikutnya melanjutkan penerbitan yang sama.

Kolom `letter_versions`: `number_position_mode` (`TEMPLATE`, `MARKER`, `COORDINATE`), `number_position` (jsonb), `position_checked_at`.
