> Dokumen historis: rancangan R.04 sebelum adaptasi NDO. Untuk keputusan aktif gunakan [spesifikasi target 08](08-alur-ndo-r04.md) dan [revisi production 00](00-revisi-alur.md). Aturan lama yang bertentangan tidak boleh dipakai untuk menghapus fitur production atau menganggap target baru sudah tersedia.

# Model Data

Dari kamus data Blueprint R.03 yang disesuaikan ke R.04 (Bab 4). Perubahan R.04 yang harus dimigrasi: `letters.source` (`CREATE`/`UPLOAD`), kolom status pengiriman tidak dipakai, `dispositions.requires_letter`, `letter_id`, `followup_note`, penerbitan satu transaksi. Tabel `letter_templates`, `letter_distributions`, `push_subscriptions` diarsipkan di `docs/arsip-R03/`. Skema SQL ada di `supabase/migrations/`. Bila ada perbedaan, blueprint menjadi acuan dan perbedaan itu dicatat sebagai temuan.


## profiles

Pengguna aplikasi (satu baris per akun login).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK; sama dengan id akun Supabase Auth |
| full_name | text | Nama pegawai |
| email | text | Email, unik |
| system_role | enum | `USER` atau `SUPER_ADMIN`. Super Admin adalah peran administratif terpisah dari hierarki persetujuan |
| is_active | boolean | Status aktif; akun nonaktif tidak dapat masuk |
| created_at | timestamptz | Waktu dibuat |

## organizational_units

Unit kerja dinamis. Nama dan kode unit dikelola Super Admin sesuai struktur resmi.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Kode unit, unik; contoh konfigurasi: ACH. Kode tidak boleh ditebak dari nama unit |
| name | text | Nama unit kerja |
| parent_id | uuid | FK organizational_units; unit induk (opsional) |
| head_assignment_id | uuid | FK user_assignments; penugasan kepala unit (dipakai untuk otorisasi pembatalan surat internal) |
| is_active | boolean | Status aktif |

## positions

Jabatan dan level. Level menggambarkan hierarki, bukan satu-satunya penentu persetujuan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Kode jabatan, unik; contoh konfigurasi: DIR, SM |
| name | text | Nama jabatan |
| level | integer | 1 Staff/PIC, 2 GM/Kepala Unit atau Departemen, 3 Senior Manager, 4 Direktur Utama; angka lebih besar berarti lebih tinggi |
| role_id | uuid | FK roles; kelompok peran organisasi untuk jabatan ini |
| is_active | boolean | Status aktif |

## user_assignments

Penugasan pengguna pada unit dan jabatan, termasuk hubungan atasan dan kewenangan pejabat.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| profile_id | uuid | FK profiles |
| unit_id | uuid | FK organizational_units |
| position_id | uuid | FK positions |
| supervisor_assignment_id | uuid | FK user_assignments; atasan langsung; kosong hanya untuk jabatan level tertinggi |
| is_official_signer | boolean | Benar bila penugasan berwenang sebagai penandatangan resmi; hanya untuk jabatan Senior Manager atau Direktur Utama |
| start_date | date | Masa berlaku penugasan; `end_date` kosong bila masih berlaku |
| end_date | date | Masa berlaku penugasan; `end_date` kosong bila masih berlaku |
| is_active | boolean | Status aktif |

## roles

Kelompok peran organisasi (Direktur Utama, Senior Manager, GM/Kepala Unit atau Departemen, Staff/PIC).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Kode peran, unik |
| name | text | Nama peran |

## permissions

Daftar kewenangan sistem yang dapat diberikan kepada peran (mis. membuat surat, menerbitkan, menandatangani, mengelola master).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Kode kewenangan, unik |
| description | text | Penjelasan |

## role_permissions

Tabel relasi peran dan kewenangan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| role_id | uuid | FK roles; bagian dari kunci utama |
| permission_id | uuid | FK permissions; bagian dari kunci utama |

## authority_delegations

Delegasi resmi yang tercatat untuk pejabat yang ditunjuk. Terbatas pada otorisasi pembatalan; bukan fitur pelimpahan wewenang atau pengganti atasan secara umum.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| grantor_assignment_id | uuid | FK user_assignments; pejabat pemberi delegasi |
| grantee_assignment_id | uuid | FK user_assignments; pejabat yang ditunjuk |
| scope_unit_id | uuid | FK organizational_units; unit yang dicakup |
| authority_type | enum | `LETTER_CANCELLATION` |
| basis_reference | text | Rujukan dokumen delegasi resmi (nomor/tanggal); wajib diisi |
| valid_from | date | Masa berlaku delegasi |
| valid_until | date | Masa berlaku delegasi |
| recorded_by | uuid | FK profiles; pencatat delegasi |
| is_active | boolean | Status aktif |

## letter_types

Definisi jenis surat. Kode adalah contoh konfigurasi.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Mis. KRE, Tag, IN |
| name | text | Nama jenis surat |
| category | enum | `INTERNAL`, `EXTERNAL`, atau `BILLING` |
| series_basis | enum | `SIGNER_POSITION` (jabatan penandatangan) atau `CREATOR_UNIT` (unit pembuat) |
| creator_unit_id | uuid | FK organizational_units; bila terisi hanya pengguna yang ditugaskan pada unit tersebut yang boleh membuat (mis. Finance untuk tagihan) |
| required_attachment | boolean | Benar untuk Surat Pengantar Tagihan |
| default_signature_count | integer | 0, 1, atau 2; nilai bawaan jumlah tanda tangan (internal 0, eksternal 1, tagihan 2) |
| is_active | boolean | Status aktif |

## document_categories

Kategori atau klasifikasi isi surat; berbeda dari jenis surat.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| code | text | Kode kategori |
| name | text | Nama kategori |
| is_active | boolean | Status aktif |

## letters

Entitas utama surat (Internal, Eksternal, Tagihan). Mencakup identitas, status, penerima, dan nomor resmi.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key; juga identitas internal draft (draft tidak memiliki nomor resmi) |
| letter_type_id | uuid | FK letter_types |
| category_id | uuid | FK document_categories; opsional |
| creation_method | enum | `EDITOR` atau `UPLOAD` |
| status | enum | `DRAFT`, `IN_REVIEW`, `REVISION_REQUESTED`, `REJECTED`, `READY_TO_ISSUE`, `NUMBERED`, `CANCELLED`; status proses tidak memuat tahap pengesahan |
| signature_mode | enum | `IN_APP` (dikelola melalui SIADocs) atau `EXTERNAL` (di luar SIADocs); jawaban pertanyaan Kelola pengesahan tanda tangan melalui SIADocs?; kosong bila surat tidak memerlukan tanda tangan; dapat diubah sebelum NUMBERED dan dikunci setelah nomor terbit |
| signature_status | enum | `NOT_STARTED` (sebelum bernomor), `NOT_REQUIRED`, `WAITING` (menunggu unggahan; hanya IN_APP), `UPLOADED` (seluruh dokumen bertanda tangan terunggah; hanya IN_APP), `EXTERNAL` (di luar sistem; bukan bukti penandatanganan); terpisah dari status proses dan status pengiriman |
| distribution_status | enum | `NOT_SENT`, `SENT`, `RECEIVED`; terpisah dari status proses |
| subject | text | Perihal, wajib |
| creator_id | uuid | FK profiles; pembuat |
| creator_unit_id | uuid | FK organizational_units; unit pembuat (snapshot saat dibuat) |
| signer_id | uuid | FK profiles; penandatangan resmi; wajib untuk eksternal dan tagihan (SM Finance sebagai pengaju), kosong untuk internal tanpa pengesahan |
| recipient_type | enum | `INTERNAL_USER` atau `EXTERNAL`; satu penerima utama per surat |
| recipient_user_id | uuid | FK profiles bila penerima internal |
| recipient_external_name | text | Nama dan instansi bila penerima eksternal (metadata, bukan akun) |
| recipient_external_org | text | Nama dan instansi bila penerima eksternal (metadata, bukan akun) |
| required_signature_count | integer | 0, 1, atau 2 sesuai jenis dan kebutuhan pengesahan; menentukan jumlah area tanda tangan pada dokumen bernomor pada kedua jalur |
| current_version_id | uuid | FK letter_versions; versi dokumen terbaru |
| official_number | text | Nomor resmi, unik; kosong sebelum status NUMBERED |
| issued_at | timestamptz | Waktu penerbitan nomor (Asia/Jakarta); tidak dapat diubah |
| status_reason | text | Alasan Tolak atau Minta Revisi terakhir atau alasan pembatalan |
| copied_from_id | uuid | FK letters; asal salinan bila dibuat dengan Salin sebagai draft baru |
| created_at | timestamptz | Waktu dibuat dan diperbarui |
| updated_at | timestamptz | Waktu dibuat dan diperbarui |

## letter_versions

Versi dokumen. Draft, dokumen bernomor, dan dokumen bertanda tangan adalah versi berbeda dari surat yang sama.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| version_no | integer | Nomor versi berurutan per surat |
| version_kind | enum | `DRAFT`, `NUMBERED`, atau `SIGNED` |
| content_html | text | Isi dokumen bila dibuat melalui editor |
| storage_path | text | Lokasi berkas pada bucket privat (PDF/DOCX) |
| file_format | enum | `PDF` atau `DOCX` |
| file_hash | text | Hash berkas untuk memeriksa keutuhan dokumen |
| number_position_mode | enum | Cara posisi nomor ditentukan: `TEMPLATE`, `MARKER` (penanda posisi nomor pada DOCX), atau `COORDINATE` (area PDF dari isian angka atau area tersimpan); kosong bila belum ditentukan |
| number_position | jsonb | Halaman, koordinat, dan ukuran area nomor (PDF); kosong untuk DOCX dan template |
| position_checked_at | timestamptz | Waktu posisi nomor terakhir lolos pemeriksaan sistem |
| is_substantive_change | boolean | Penanda perubahan substansi terhadap versi sebelumnya; memicu persetujuan ulang untuk persetujuan yang terdampak |
| created_by | uuid | FK profiles; pembuat versi (untuk versi `SIGNED`: pejabat yang mengunggah) |
| is_current | boolean | Benar untuk versi terbaru |
| created_at | timestamptz | Waktu dibuat |

## letter_attachments

Lampiran dokumen.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| file_name | text | Nama asli berkas |
| storage_path | text | Lokasi di storage privat |
| mime_type | text | Tipe berkas (PDF, XLSX, DOCX, JPG, PNG) |
| size_bytes | bigint | Ukuran dalam byte |
| uploaded_by | uuid | FK profiles |
| created_at | timestamptz | Waktu unggah |


## number_series

Seri dan pola nomor. Setiap seri memiliki nomor urut sendiri.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_type_id | uuid | FK letter_types |
| unit_id | uuid | FK organizational_units; terisi bila penentu seri unit pembuat |
| position_id | uuid | FK positions; terisi bila penentu seri jabatan penandatangan |
| pattern | text | Pola dengan token `{URUT}`, `{TGL}`, `{BLN}`, `{THN}`, `{UNIT}`, `{JABATAN}`, `{JENIS}` |
| status | enum | `ACTIVE` atau `INACTIVE` |

## number_counters

Nomor urut per seri dan per tahun. Tidak ada nomor urut bersama lintas seri.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| series_id | uuid | FK number_series |
| year | integer | Tahun penerbitan menurut zona waktu Asia/Jakarta; unik bersama series_id |
| last_value | integer | Nomor urut terakhir yang terpakai; baris tahun baru dibuat otomatis dan dimulai dari 001 pada nomor pertama; tidak dapat diubah dari antarmuka |

## number_issuances

Catatan penerbitan nomor. Setiap surat memiliki paling banyak satu penerbitan; nomor tetap terikat pada surat yang sama bila pembuatan dokumen gagal dan diulang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters; unik |
| series_id | uuid | FK number_series |
| year | integer | Tahun dan nomor urut; unik bersama series_id |
| sequence_number | integer | Tahun dan nomor urut; unik bersama series_id |
| official_number | text | Nomor resmi hasil penyusunan pola; unik |
| pattern_snapshot | text | Salinan pola dan kode (unit, jabatan, jenis) saat diterbitkan |
| status | enum | `ALLOCATED` (nomor dialokasikan), `COMPLETED` (dokumen bernomor dibuat dan diperiksa), `CANCELLED` (surat dibatalkan; nomor tetap tidak dipakai ulang) |
| idempotency_key | text | Kunci unik per upaya penerbitan; mencegah dua nomor pada klik ganda atau retry |
| issued_by | uuid | FK profiles |
| issued_at | timestamptz | Waktu penerbitan (Asia/Jakarta) |
| verified_at | timestamptz | Waktu nomor pada dokumen diperiksa sama dengan nomor pada database |

## approval_steps

Langkah persetujuan. Riwayat persetujuan lama tidak dihapus.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| cycle | integer | Putaran pengajuan; bertambah setiap diajukan ulang |
| step_order | integer | Urutan langkah pada siklus |
| approver_id | uuid | FK profiles |
| step_source | enum | `CREATOR_SELECTED`, `SIGNER_CONFIRMATION` (persetujuan final pejabat), `BILLING_SUBMITTER` (SM Finance), `BILLING_APPROVER` (Direktur Utama) |
| status | enum | `WAITING` (belum giliran), `PENDING` (aktif), `APPROVED`, `REVISION_REQUESTED`, `REJECTED`, `SUPERSEDED` (perlu diulang karena perubahan substansi) |
| decision_note | text | Wajib bila Minta Revisi atau Tolak |
| version_id | uuid | FK letter_versions; versi dokumen yang diputuskan |
| decided_at | timestamptz | Waktu keputusan |

## signature_requests

Permintaan unggah dokumen bertanda tangan oleh pejabat setelah nomor terbit; hanya dibuat bila signature_mode = IN_APP.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| numbered_version_id | uuid | FK letter_versions; dokumen bernomor yang ditandatangani |
| signer_id | uuid | FK profiles; pejabat yang harus mengunggah dari akunnya |
| sign_order | integer | Urutan pengesahan; pada tagihan 1 = SM Finance, 2 = Direktur Utama |
| signer_role | text | Label pada dokumen: Penandatangan, Diajukan oleh, atau Disetujui oleh |
| status | enum | `WAITING`, `PENDING`, `UPLOADED`, `SUPERSEDED`, `CANCELLED` |
| signed_version_id | uuid | FK letter_versions; versi `SIGNED` hasil unggahan |
| stamp_included | boolean | Stempel opsional pada dokumen yang diunggah |
| uploaded_at | timestamptz | Waktu unggah |

## cancellation_requests

Permohonan pembatalan surat bernomor. Eksekusi dilakukan sistem setelah otorisasi lengkap.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters |
| requested_by | uuid | FK profiles; pembuat atau pejabat berwenang |
| reason | text | Alasan pembatalan, wajib |
| status | enum | `PENDING`, `EXECUTED`, `DECLINED`, `WITHDRAWN` |
| created_at | timestamptz | Waktu dibuat dan dieksekusi |
| executed_at | timestamptz | Waktu dibuat dan dieksekusi |

## cancellation_authorizations

Otorisasi atas permohonan pembatalan sesuai kewenangan bisnis.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| request_id | uuid | FK cancellation_requests |
| authorizer_id | uuid | FK profiles |
| authority_basis | enum | `UNIT_HEAD`, `DESIGNATED_OFFICIAL`, `SIGNING_OFFICIAL`, `SM_FINANCE`, `DIRECTOR` |
| delegation_id | uuid | FK authority_delegations; wajib untuk `DESIGNATED_OFFICIAL` |
| decision | enum | `APPROVED`, `DECLINED` |
| note | text | Catatan |
| decided_at | timestamptz | Waktu keputusan |

## dispositions

Disposisi atasan kepada bawahan. Tidak bernomor dan tidak mengubah status surat.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters; kosong bila berdiri sendiri |
| giver_id | uuid | FK profiles; pemberi tugas |
| recipient_id | uuid | FK profiles; bawahan penerima |
| subject | text | Perihal |
| instruction | text | Isi instruksi, wajib |
| priority | enum | `NORMAL` (Biasa), `IMPORTANT` (Penting), `URGENT` (Segera) |
| due_date | date | Tenggat opsional; hanya informasi |
| status | enum | `NEW` (Baru), `IN_PROGRESS` (Diproses), `DONE` (Selesai) |
| follow_up_note | text | Catatan tindak lanjut penerima |
| read_at | timestamptz | Waktu pertama dibuka; metadata tampilan, bukan status |
| created_at | timestamptz | Waktu dibuat dan diselesaikan |
| completed_at | timestamptz | Waktu dibuat dan diselesaikan |

## billing_details

Data tambahan Surat Pengantar Tagihan (satu baris per surat).

| Kolom | Tipe | Keterangan |
|---|---|---|
| letter_id | uuid | PK dan FK letters |
| bank_id | uuid | FK master_bank; satu bank pembayaran per surat |
| payee_name | text | Nama penerima pembayaran (tingkat surat) |
| account_number | text | Nomor rekening, hanya angka; data sensitif |
| total_amount | numeric(18,2) | Jumlah seluruh nominal baris; dihitung server |
| total_in_words | text | Terbilang dari total, dihitung server |
| sap_reference | text | Nomor referensi SAP, opsional, teks bebas dengan batas panjang; tanpa validasi 10 digit dan tanpa integrasi SAP |

## billing_items

Baris rincian tagihan. Minimal dua baris saat diajukan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| letter_id | uuid | FK letters (jenis tagihan) |
| line_no | integer | Nomor baris |
| description | text | Keterangan, wajib |
| amount | numeric(18,2) | Nominal, harus lebih dari nol |

## master_bank

Daftar bank pembayaran.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| name | text | Nama bank |
| is_active | boolean | Status aktif |

## notifications

Notifikasi pengguna; tidak memuat isi dokumen.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| recipient_id | uuid | FK profiles |
| letter_id | uuid | FK letters; boleh kosong |
| disposition_id | uuid | FK dispositions; boleh kosong |
| event_type | text | Jenis peristiwa ({T:notif}) |
| title | text | Teks ringkas tanpa isi dokumen |
| is_read | boolean | Status dan waktu baca |
| read_at | timestamptz | Status dan waktu baca |
| channels_sent | jsonb | Kanal yang berhasil: `in_app` selalu; `push` dan `email` bila diaktifkan |
| created_at | timestamptz | Waktu dibuat |


## audit_logs

Jejak audit; hanya ditambah, tidak dapat diubah atau dihapus oleh pengguna biasa.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | Primary key |
| occurred_at | timestamptz | Waktu kejadian |
| actor_id | uuid | FK profiles; pengguna |
| letter_id | uuid | FK letters; boleh kosong untuk aktivitas master |
| action | text | Aktivitas |
| entity_type | text | Objek yang diubah |
| entity_id | text | Objek yang diubah |
| status_before | text | Status sebelum dan sesudah |
| status_after | text | Status sebelum dan sesudah |
| official_number | text | Nomor resmi bila tersedia |
| version_id | uuid | FK letter_versions; versi dokumen |
| reason | text | Alasan revisi, penolakan, atau pembatalan |
| metadata | jsonb | Nilai sebelum dan sesudah pada perubahan master |

## system_settings

Pengaturan global.

| Kolom | Tipe | Keterangan |
|---|---|---|
| key | text | Primary key, mis. `max_attachment_total_mb`, `docx_number_placeholder`, `pdf_number_area` |
| value | text | Nilai pengaturan (batas lampiran; aturan penempatan nomor sesuai {S:penempatan}) |
| description | text | Penjelasan |

