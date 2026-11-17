# Status dan Transisi

Implementasi acuan: `src/domain/status.ts` (diuji di `tests/domain.test.ts`).

## A. Status proses (`letters.status`)
| Kode | Label | Arti |
|---|---|---|
| DRAFT | Draft | disiapkan pembuat, tanpa nomor |
| IN_REVIEW | Menunggu Persetujuan | pada penyetuju aktif |
| REVISION_REQUESTED | Perlu Revisi | dikembalikan dengan catatan |
| REJECTED | Ditolak | status akhir, tanpa nomor |
| READY_TO_ISSUE | Siap Diberi Nomor | prasyarat lengkap, nomor belum terbit |
| NUMBERED | Sudah Bernomor | nomor terbit (satu transaksi) |
| CANCELLED | Dibatalkan | status akhir, nomor (bila ada) tidak dipakai ulang |

| Aksi | Dari | Ke | Syarat |
|---|---|---|---|
| SUBMIT | DRAFT | IN_REVIEW | data lengkap dan surat bukti terunggah |
| MARK_READY | DRAFT | READY_TO_ISSUE | tidak ada persetujuan wajib, dokumen valid |
| WITHDRAW | IN_REVIEW | DRAFT | penyetuju aktif belum memutuskan |
| APPROVE_LAST | IN_REVIEW | READY_TO_ISSUE | penyetuju terakhir menyetujui |
| REQUEST_REVISION | IN_REVIEW | REVISION_REQUESTED | catatan wajib |
| REJECT | IN_REVIEW | REJECTED | alasan wajib |
| RESUBMIT | REVISION_REQUESTED | IN_REVIEW | versi baru |
| SUBSTANTIVE_CHANGE | READY_TO_ISSUE | DRAFT | persetujuan terdampak diulang |
| ISSUE_NUMBER | READY_TO_ISSUE | NUMBERED | aksi Terbitkan Nomor Surat, surat bukti terunggah |
| CANCEL_DRAFT | DRAFT, REVISION_REQUESTED | CANCELLED | oleh pembuat |
| CANCEL_NUMBERED | NUMBERED | CANCELLED | alasan dan otorisasi lengkap |

Tahap Menunggu Tanda Tangan dan Siap Dikirim BUKAN status proses (digantikan status pengesahan).

## B. Status pengesahan (`letters.signature_status`)
`NOT_STARTED` (belum bernomor), `NOT_REQUIRED` (tidak perlu tanda tangan), `WAITING` (menunggu unggahan, hanya `IN_APP`), `UPLOADED` ("Dokumen Bertanda Tangan Terunggah", hanya `IN_APP`), `EXTERNAL` ("Di Luar Sistem", hanya `EXTERNAL`, bukan bukti penandatanganan).
Setelah nomor terbit: jumlah TTD 0 → `NOT_REQUIRED`; `IN_APP` → `WAITING`; `EXTERNAL` → `EXTERNAL`. `UPLOADED` setelah seluruh unggahan wajib terpenuhi.

## Aturan silang
- Surat tanpa nomor selalu `NOT_STARTED`.
- Unduh kop bernomor atau dokumen tidak mengubah status pengesahan.
- Status pengiriman dihapus pada R.04 (tidak ada distribusi).
