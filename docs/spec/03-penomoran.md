# Penomoran

Implementasi: fungsi SQL `issue_letter_number`, `complete_number_issuance`, `build_official_number` (`supabase/migrations/20261111000003_functions.sql`) dan `src/domain/numbering.ts`. Kedua implementasi harus identik.

## Token pola
`{URUT}` nomor urut, minimal 3 digit (001), digit bertambah bila lebih dari 999 · `{TGL}` tanggal terbit 2 digit, menempel di belakang `{URUT}` · `{BLN}` bulan 2 digit · `{THN}` tahun 4 digit · `{UNIT}` kode unit pembuat · `{JABATAN}` kode jabatan penandatangan · `{JENIS}` kode jenis dokumen.

## Seri awal (contoh konfigurasi)
| Seri | Pola | Contoh | Penentu seri |
|---|---|---|---|
| Surat Eksternal | `{URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}` | 00105/KRE.DIR/01.2027 | jabatan penandatangan (DIR atau SM) |
| Surat Pengantar Tagihan | `{URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}` | 00105-Tag/ACH/SIA/01.2027 | unit pembuat |
| Surat Internal | `{URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}` | 00105-IN/ACH/SIA/01.2027 | jenis dan unit pembuat |

Tahun 2027 hanya ilustrasi. Tahun operasional pertama mengikuti tanggal go-live.

## Aturan
1. Nomor terbit hanya saat pengguna berwenang menekan Terbitkan Nomor Surat setelah semua validasi dan persetujuan wajib terpenuhi. Status prasyarat: `READY_TO_ISSUE`. Draft tidak menampilkan nomor, dan pengguna tidak dapat melihat atau mengambil nomor berikutnya.
2. Seri dipilih otomatis dari penentu seri jenis surat. Bila tidak ada seri aktif, penerbitan ditunda dan Super Admin diberi notifikasi (`NO_ACTIVE_SERIES`).
3. Atomik di PostgreSQL: dalam satu transaksi kunci baris surat, kunci `number_counters` (seri dan tahun), tambah satu, simpan `number_issuances` dan audit. Gagal berarti tidak ada nomor ganda atau terbuang.
4. Idempoten: panggilan ulang untuk surat yang sama mengembalikan penerbitan yang sama (kunci `idempotency_key`, unik `letter_id`). Klik ganda dan retry tidak menghasilkan nomor kedua.
5. Nomor urut per seri dan per tahun (Asia/Jakarta). Tidak ada urutan bersama lintas seri. Baris tahun baru dibuat otomatis saat nomor pertama tahun itu. Tidak ada tombol mengubah nomor urut, tidak ada impor register.
6. Tanggal terbit mengikuti waktu server Asia/Jakarta dan tidak dapat diubah atau dimundurkan.
7. Satu nomor untuk satu surat, tidak dapat diedit, tidak dipakai ulang walau surat dibatalkan (tetap tersimpan, `CANCELLED`).
8. Tidak ada nomor tanpa dokumen bukti: surat tidak dapat `READY_TO_ISSUE` sebelum surat bukti diunggah. `NUMBERED` dan `official_number` terisi dalam transaksi penerbitan yang sama (tanpa tahap `ALLOCATED` dan `COMPLETED`).
9. Seri dan format pada surat terbit dipertahankan sebagai snapshot (`pattern_snapshot`) walau master diubah.

## Alur teknis (server)
1. Tombol Terbitkan Nomor Surat memanggil `issue_letter_number(letter_id, actor, idempotency_key)` (service role).
2. Satu transaksi: kunci surat dan counter, tambah satu, simpan `number_issuances`, ubah status ke `NUMBERED`, isi `official_number`, catat audit.
3. SIADocs tidak membuat atau menyisipkan nomor ke dokumen. Pengguna menyalin nomor atau mengunduh kop bernomor.
4. Panggilan ulang untuk surat yang sama mengembalikan penerbitan yang sama.
