# PR-03 — approver terpisah dan penghapusan persetujuan duplikat

18 November 2026 (WIB). Repo `Salsabiil08/SuratDigitalSIA`, branch `feat/pr-03-independent-approval`, basis PR-02 `5056f2625f28769663fee66cc32093719d0e10d1`. PR-00–02 belum di-merge. Tidak ada izin production atau PR-04.

## Hasil implementasi

1. Form memisahkan **penyetuju wajib**, **penyetuju tambahan**, **pemeriksa** dan **penandatangan**. Pejabat wajib dapat berbeda dari signer. Jika belum diubah, pilihan wajib mengikuti signer agar alur existing kompatibel, tetapi disimpan dan diperiksa terpisah. Tidak menambahkan semua atasan otomatis.
2. Internal biasa tanpa TTD tidak mempunyai approval wajib; tambahan hanya bila dipilih dan berwenang. Internal formal/eksternal membutuhkan satu approver formal SM/Direktur yang aktif dan sah. Tagihan memerlukan approver SM dengan mandat Finance lalu Direktur, serta dua TTD sesuai aturan existing. SM tetap jabatan umum; mandat Finance dapat berasal dari penugasan SM pada unit pengaju tagihan yang ditetapkan master, atau grant eksplisit jenis/unit yang disahkan perusahaan untuk SM lintas unit. Direktur tidak menggantikan tahap Finance.
3. `approval_plan` menggabungkan peran aktor yang sama, menyimpan urutan, versi dan siklus. Tambahan yang sama dengan wajib tidak membuat langkah duplikat. Grant tambahan memerlukan `approver_authorizations`; Super Admin/reviewer tidak otomatis berwenang. Pejabat wajib tetap tunduk pada peran bisnisnya.
4. Pembuat yang juga approver sah harus mengonfirmasi **versi ini** saat pengajuan. RPC terpisah `submit_letter_for_approval` memerlukan konfirmasi eksplisit, mengambil aktor dari sesi server, dan mencatat origin CREATOR_SUBMISSION, waktu, versi/hash dan audit. Tidak memakai login atau pembuatan draft sebagai keputusan palsu. Bila giliran pembuat setelah pejabat lain, status tetap WAITING sampai tahap sebelumnya selesai; bukti konfirmasinya baru berlaku sesuai urutan. Nomor dan TTD tetap tindakan terpisah.
5. Review PR-02 tetap menjadi gate terpisah. Lolos pemeriksaan tidak membuat approval. Keputusan approval menyimpan versi/hash, required_roles dan origin; pemeriksaan kewenangan diulang saat keputusan dan penerbitan. Jumlah keputusan tidak lagi disamakan dengan jumlah TTD. Allocator/seri/counter/format/tahun WIB/idempotensi dan antrean tanda tangan dipertahankan.
6. Pembuat dapat **Tarik untuk Koreksi** sebelum nomor, dengan alasan dan revision terkini. Surat kembali bisa diedit dan wajib disimpan sebagai versi baru; plan lama tidak berlaku. Keputusan APPROVED lama dipertahankan, tugas belum diputuskan ditandai digantikan. Penugasan approval dan hak baca tidak mengikuti keputusan lama ke naskah baru. Dokumen final/bernomor tidak bisa ditarik melalui jalur ini.
7. Ringkasan syarat penerbitan menampilkan data plan/keputusan/versi nyata, menggantikan centang statis. Tidak mengklaim bytes Storage sudah terverifikasi hanya karena ada metadata; pemeriksaan integritas tetap di server penerbitan existing.
8. Migrasi baru `20261118064534_independent_approval_roles.sql` menambah tabel penetapan manager/grant approver, kolom plan/keputusan dan wrapper/RLS/guard. Tidak UPDATE/backfill surat atau approval historis. Semua 16 migrasi terdahulu tetap identik; 13 surat lama tidak dibuatkan dokumen/approval/TTD palsu.

## Kebutuhan keputusan perusahaan

| Area | Penetapan yang diperlukan |
|---|---|
| Reviewer | Validasi default kategori/override jenis, daftar pemeriksa beserta unit/jenis/masa berlaku; dukungan awal satu pemeriksa per siklus seperti PR-02 |
| Pengelola review | Penunjukan pada review_policy_managers, terpisah dari role teknis Super Admin |
| Pengelola approval tambahan | Penunjukan approval_policy_managers; tidak diwarisi dari reviewer manager atau Super Admin |
| Approver tambahan | Pemberian/pencabutan grant jenis/unit/masa berlaku melalui authorize_letter_approver dengan alasan dan audit; tidak ada grant perusahaan otomatis di migrasi |
| Pejabat wajib dan Finance | Verifikasi master penugasan, official signer, unit pengaju tagihan, mandat Finance lintas unit dan Direktur yang sah; konfirmasi pejabat formal yang dipilih sebelum pengajuan |
| Konfirmasi pembuat | Peninjauan perusahaan terhadap penggunaan tindakan pengajuan eksplisit sebagai satu keputusan pembuat pada versi yang sama; bukti asal/urutan tersedia untuk audit, bukan pengesahan TTD |

Konfigurasi manager/grant adalah RPC server-only; belum ada halaman pengelolaan kewenangan bisnis baru. Provisioning perusahaan harus disetujui dan diaudit terpisah pada staging/production. UI menjelaskan bila belum ada grant tambahan. Default reviewer INITIAL tetap belum dianggap tervalidasi perusahaan.

## Pengujian

- `npm run check`: **typecheck dan 159/159 tes lulus**, 16 berkas. Hasil PostgreSQL nyata dicatat terpisah setelah CI.
- Tambahan 16 kasus DB approval: internal biasa/formal/eksternal, signer berbeda, tambahan/duplikat, konfirmasi pembuat, tagihan SM/Direktur dan pembuat Direktur menunggu SM, mandat Finance, review terpisah, versi/hash/restart, RLS, grant/akun berubah, rollback event/audit nomor.
- Empat kasus Server Action: aktor sesi, konfirmasi eksplisit/default false, tanpa akun aktif, gagal RPC tidak sukses palsu.
- Tiga fixture SQL aktif dijalankan melalui PGlite; dua tes reproduksi baseline tetap memuat fixture arsip sebelum PR-02. [Perbaikan PostgreSQL terpisah](PR03_POSTGRES_FIXTURES.md) mencatat perubahan data uji tanpa melemahkan guard.
- Forward migration pada 13 surat bernomor sintetis tanpa versi: seluruh nilai kolom lama dan audit identik sebelum/sesudah; kolom baru tidak diisi bukti palsu. Ini uji lokal, bukan mutasi/read isi surat production.
- 42 tautan relatif aktif diperiksa; empat branch PR saja dinonaktifkan auto-deploy. Dependensi/CI dan seluruh 16 migrasi baseline tetap utuh.
- `npm run build` lulus kompilasi, typecheck dan pembangkitan 21 halaman. `bash -n` skrip DB/konkurensi lulus. `git diff --check` dan integritas sumber migrasi baseline diperiksa.
- Lingkungan lokal tidak mempunyai binari PostgreSQL; `npm run test:db` menolak dengan pesan jelas. Job CI db menjadi bukti PostgreSQL dan konkurensi nyata. Jangan mengklaimnya lulus sebelum hasil tersedia.

Metadata production diperiksa baca-saja: tabel approval_steps masih schema baseline, belum ada tabel approval baru dan history tetap 8 entri. Tidak ada apply_migration, DDL/DML, seed, repair, merge atau perintah deploy ke production. vercel.json hanya menambahkan larangan auto-deploy branch PR-03.

## Risiko regresi dan penerapan kelak

- Pengajuan lama belum bernomor yang tidak memiliki plan baru tidak diadopsi secara otomatis. Pembuat memakai Tarik untuk Koreksi lalu menyimpan versi asli/koreksi yang sah dan mengajukan ulang; jangan menciptakan keputusan historis. Surat bernomor tetap memakai issuance/idempotensi existing; 13 surat tanpa versi tetap perlu penanganan berotorisasi terpisah.
- Mandat Finance dan grant tambahan harus benar sebelum aktivasi. Perubahan kewenangan setelah approval dapat menahan penerbitan; tersedia koreksi/pengajuan ulang sebelum nomor. Jangan memulihkan dengan grant luas, melewati tahap lain atau menurunkan counter.
- UI ringkasan bukan otorisasi; RPC mengulang pemeriksaan aktor, tahap, kewenangan dan versi. UAT browser lintas akun dengan Auth/Storage staging masih diperlukan, terpisah dari tes DB/CI.
- Sebelum produksi: validasi perusahaan, backup/snapshot, uji staging schema/grant/data metadata yang disanitasi, tinjauan history 8 versus 16 file baseline, lalu persetujuan migrasi/deployment tersendiri. Jangan replay migrasi atau repair history otomatis.
- Pengiriman/receipt/balasan dan GAP penerima pra-kirim tetap PR-04 dan seterusnya, belum diizinkan. Fitur itu tidak diklaim selesai oleh PR-03.

## Titik berhenti

Draft PR berbasis PR-02, dengan implementasi dan perbaikan fixture pada commit terpisah. Tidak merge, tidak mengubah database production, tidak deploy dan tidak memulai PR-04. Publikasi/CI terbaru dicatat di PR dan laporan ini.
