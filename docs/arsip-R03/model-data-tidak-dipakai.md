# Tabel tidak dipakai pada R.04

## letter_templates

Template isi dokumen.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_type_id | uuid | FK letter_types |
| category_id | uuid | FK document_categories; opsional |
| unit_id | uuid | FK organizational_units; opsional |
| name | text | Nama template |
| content_html | text | Isi awal template, termasuk penanda posisi nomor yang tervalidasi |
| version | integer | Versi template |
| is_active | boolean | Status aktif |

## letter_distributions

Pencatatan distribusi dan penerimaan surat.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| method | enum | `IN_APP`, `EMAIL`, `PRINT`, `COURIER`, `HAND_DELIVERY`, `OTHER` |
| distributed_at | timestamptz | Tanggal dan waktu pengiriman |
| recorded_by | uuid | FK profiles |
| proof_attachment_id | uuid | FK letter_attachments; bukti pengiriman opsional |
| received_at | timestamptz | Konfirmasi Terima surat internal (pencatatan penerimaan, bukan persetujuan) |
| received_by | uuid | Konfirmasi Terima surat internal (pencatatan penerimaan, bukan persetujuan) |
| note | text | Catatan |

## push_subscriptions

Langganan push browser; hanya dibuat bila Web Push diaktifkan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| profile_id | uuid | FK profiles |
| endpoint | text | Alamat layanan push |
| keys | text | Kunci enkripsi langganan |
| created_at | timestamptz | Waktu dibuat |
