# Perubahan R.03 ke R.04

R.04 (14 Nov 2026) menyederhanakan R.03: SIADocs menjadi sistem penomoran dan kewenangan surat. Bila spec lain di folder ini berbeda dengan R.04, R.04 yang berlaku, dan perbedaan dicatat di sini.

## Tetap berlaku
- Nomor tidak terbit saat draft. Hanya lewat Terbitkan Nomor Surat setelah validasi dan persetujuan wajib.
- Nomor atomik, unik, idempoten, tidak dipakai ulang, tetap tersimpan pada surat dibatalkan.
- Tiga format nomor, reset tahunan Asia/Jakarta, seri mulai 001.
- Persetujuan menurut jenis surat, REJECTED berbeda dari CANCELLED, dua jalur pengesahan (IN_APP, EXTERNAL), Log History hanya Super Admin, pembatalan bernomor perlu otorisasi.

## Berubah
| Area | R.03 | R.04 |
|---|---|---|
| Tujuan | Siklus hidup surat | Nomor dan kewenangan |
| Buat Surat | Editor dan template isi | Isi data, unduh kop, susun surat di luar, unggah bukti |
| Ambil Nomor | Metode unggah di Buat Surat | Layanan tersendiri; nomor disalin pengguna |
| Status pengiriman | NOT_SENT, SENT, RECEIVED | Dihapus |
| Penerbitan nomor | ALLOCATED lalu COMPLETED (buat dokumen bernomor) | Satu transaksi: READY_TO_ISSUE menjadi NUMBERED |
| Disposisi | Instruksi terpisah | Satu pemberi, satu penerima; `requires_letter`, `letter_id`; tidak Selesai sebelum surat NUMBERED |
| Dokumen | DRAFT, NUMBERED, SIGNED (dibuat sistem) | Bukti, kop bernomor, akhir (unggahan), bertanda tangan |

## Keluar dari lingkup (jangan dihapus sebelum audit ketergantungan)
Editor, template isi, penyisipan nomor otomatis (`numberPlacement.ts`; spec lama dipindah ke `docs/arsip-R03/`), distribusi (`letter_distributions`), Kotak Masuk, Konfirmasi Terima, arsip, push (`push_subscriptions`), `letter_templates`.

## Dampak ke kode
- `src/domain/status.ts`: hapus DistributionStatus; ISSUE_NUMBER langsung ke NUMBERED.
- Migrasi dan fungsi SQL: sederhanakan `issue_letter_number` (tanpa `complete_number_issuance`); tes ikut diubah.
- Disposisi: tambah aturan penyelesaian dan tesnya.

## Perlu verifikasi perusahaan
Catatan pengiriman oleh penandatangan (hanya keterangan), tahun go-live, kode unit, target ketersediaan.

## Status repo
Spec (`docs/spec/`), `AGENTS.md`, `README.md`, dan `tasks/BACKLOG.md` sudah R.04. Yang belum: migrasi SQL, `src/domain`, dan tes (dikerjakan M1).
