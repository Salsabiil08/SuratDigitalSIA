# PR-04 — pengiriman dan penerimaan surat internal

18 November 2026 (WIB). Repository `Salsabiil08/SuratDigitalSIA`, branch `feat/pr-04-internal-delivery`, basis PR-03 `6e57882121425839ca1e5cd8bc672c1271f215cb`. Tidak ada izin merge, perubahan database production, deployment atau PR-05.

## Hasil dan file utama

| Area | File/hasil |
|---|---|
| Migrasi aditif baru | `supabase/migrations/20261118071330_internal_dispatch_receipts.sql` |
| Snapshot dan hak penerima | internal_dispatches (satu per surat), dispatch_recipients (PRIMARY/CC, baca/receipt terpisah), dispatch_authorizations, delivery_policy_managers dan internal_delivery_settings |
| Server Action | `src/server/actions/delivery.ts`: kirim/terima, aktor dari requireUser/Supabase Auth; key stabil; bytes/hash diverifikasi sebelum dispatch RPC |
| Pembaca workflow | `src/server/actions/workflow.ts`: context terotorisasi dan opsi CC bila policy sah aktif |
| API dokumen | `src/app/api/letters/[id]/document/route.ts`: pilih versi sesuai hak, tolak blank untuk receiver-only, sajikan bytes final tanpa regenerasi; READ sesudah bytes/hash sah, tidak pernah RECEIVE |
| UI detail | `src/app/(dashboard)/surat/[id]/letter-detail-client.tsx`: kartu status final/kirim/baca/terima terpisah, konfirmasi kirim dan tombol penerimaan PRIMARY; CC hanya jika diaktifkan |
| Label | `src/domain/notification-events.ts`, `src/domain/display-labels.ts`: label Indonesia tanpa isi dokumen di notifikasi |
| PostgreSQL | `supabase/tests/00_stub_storage.sql`, `04_internal_delivery_test.sql`, `scripts/test-db.sh`, `scripts/test-db-concurrency.sh` |
| Otomatis/API | `tests/internal-delivery-db.test.ts`, `delivery-api.test.ts`, `delivery-actions.test.ts`, `postgres-fixtures.test.ts` |
| Dokumen/pengaman | AGENTS/CLAUDE/README/panduan historis, docs/INDEX/FINDINGS/spec/plans/backlog; vercel.json hanya menambah disable branch PR-04 |

Tidak menambah route Inbox/Outbox. Indeks penerima/status baca/receipt dan pengirim/waktu disiapkan agar struktur ini dapat dipakai PR-05 kelak. Kolom distribution_status serta letter_distributions existing tidak dipakai untuk memalsukan status baru atau mengklaim penerimaan eksternal.

## Aturan yang ditegakkan

- Surat harus INTERNAL, bernomor, final, mempunyai issuance sah dan bukti FINALIZE terikat versi. Bukti approval pada versi sumber pengajuan, hash dan siklus diperiksa, termasuk pemeriksaan bila diwajibkan dan TTD dalam aplikasi yang lengkap. Tidak menyamakan versi DRAFT approval dengan file NUMBERED/SIGNED yang dimaterialisasi; bukti masing-masing dicocokkan melalui versi yang tercatat.
- Bukti review/approval yang sudah sah saat penerbitan tidak ditulis ulang karena master berubah sesudah finalisasi. Kewenangan pengirim/delegasi saat kirim tetap diperiksa. Pengesahan EXTERNAL tanpa berkas TTD tersimpan untuk internal formal ditahan, bukan diklaim sebagai file bertanda tangan siap kirim.
- Pembuat aktif dapat mengirim; delegasi hanya lewat grant unit/masa berlaku yang ditetapkan pengelola perusahaan. Jabatan tinggi/Super Admin tidak otomatis menjadi pengirim. Delegasi hanya mendapat dokumen final sesuai lingkup, bukan arsip draft atau riwayat approval/TTD privat.
- Snapshot memuat versi/hash/path/format, nomor, sender, primary recipient, waktu dan key. Tabel snapshot immutable; retry surat yang sama dengan snapshot/set penerima yang sama kembali ke satu dispatch. Key sender yang sudah digunakan surat lain ditolak. Row lock surat dan unique constraint mencegah pengiriman ganda.
- Snapshot, baris penerima, notifikasi penerima dan audit satu transaksi. Receipt juga mengubah baris dan menulis notifikasi/audit satu transaksi. Kegagalan wajib tidak diklaim sukses. READ hanya mencatat pertama kali API siap menyajikan dokumen; bukan bukti pengguna memahami isi dan bukan receipt. HEAD tidak mencatat READ. Receipt tidak mengisi READ atau menyelesaikan alur surat.
- Penerima mendapat hanya versi terkirim, bukan semua letter_versions atau metadata workflow privat. Hak penugasan reviewer/approver/signer/creator yang sah diperiksa terpisah; seseorang dengan peran lain dapat mempunyai hak baca dari penugasan tersebut sebelum kirim. Pengiriman tidak menjadi sumber hak tambahan atas arsip.
- Relasi copied_from_id/FK tidak menjadi otorisasi. Akses acuan disposisi internal sebagai penerima tidak membuka dokumen sebelum pengiriman. Hak pemeriksaan hasil disposisi yang sah sebagai giver terpisah dipertahankan; bila hanya penerima surat utama, akses tetap menunggu pengiriman.
- PRIMARY mengonfirmasi terima atas namanya sendiri. Pembuat/admin/penerima lain tidak dapat mengaku sebagai PRIMARY. CC tidak boleh mencatat receipt utama dan requires_response selalu false untuk CC. Tidak ada kewajiban balasan baru yang dibuat pada PR-04.

## Konfigurasi aman dan keputusan perusahaan pending

1. CC default **nonaktif** sesuai acuan SIA sebelumnya tanpa tembusan. Struktur dan pengujian PRIMARY/CC tersedia, tetapi aktivasi dilakukan hanya oleh delivery_policy_managers yang ditunjuk, dengan alasan/audit. Cakupan/aturan CC perlu disahkan; tidak ada pengelola atau grant perusahaan otomatis di migrasi.
2. Delegasi pengiriman memerlukan profil, unit dan masa berlaku yang disahkan. Konfigurasi melalui RPC service-only configure_internal_delivery; tidak ada UI administrasi kebijakan baru. Super Admin teknis bukan otomatis pengesah bisnis.
3. Internal formal menggunakan TTD di luar aplikasi tanpa mengunggah hasil belum punya snapshot dokumen bertanda tangan. Pengiriman jalur ini ditahan sambil menunggu keputusan perusahaan. Jalur finalisasi/unduh existing tidak dihapus. Untuk pengiriman dengan bukti file di aplikasi, jalur IN_APP mendukung unggahan TTD basah atau gambar yang sah.
4. Aktivasi tidak memberi kewajiban balasan otomatis kepada PRIMARY maupun CC. Definisi tindak lanjut tetap tahap bisnis berikutnya; PR-05 belum dimulai.

## Bukti pengujian lokal

- `npm run check`: typecheck dan **187/187 tes**, 19 berkas. Regresi penomoran/review/approval/TTD/disposisi PR-03 tetap berjalan.
- 14 kasus DB pengiriman: pra-kirim, snapshot/hash salah, tidak memutasi surat/counter/versi, hanya versi terkirim, relasi, default/aktivasi CC, delegasi sah, key/idempotensi, receipt tidak palsu, Storage/Snapshot immutable, ACL RPC, eksternal, receipt tanpa read dan jalur luar pending.
- 9 kasus API: query preview/download/blank/version pra-kirim ditolak; bytes final snapshot persis; tidak ada RECEIVE dari GET; blank receiver ditolak; mismatch/hash/error READ menahan response; HEAD bukan READ.
- 4 kasus Server Action: actor sesi, hash/versi terverifikasi dan key stabil, auth/hash gagal tidak mengirim, receipt eksplisit dan write gagal tidak sukses.
- Fixture PostgreSQL baru dijalankan juga di PGlite: rollback saat insert penerima/notifikasi/audit gagal, rollback receipt, akses lintas akun/Storage, delegasi dan CC. PostgreSQL nyata/konkurensi dicatat sesudah CI; jangan menyamakan PGlite dengan concurrency nyata.
- Integritas sumber: 17 migrasi baseline, dependensi dan CI utuh; 45 tautan relatif aktif diperiksa; auto-deploy hanya dinonaktifkan untuk lima branch PR.
- `npm run build`: lulus kompilasi, typecheck dan pembangkitan 21 halaman; bukan deployment. Bash syntax dan batas diff diperiksa.
- Forward-migration test 13 surat bernomor lama tanpa versi tetap melindungi seluruh nilai kolom lama dan audit. Tidak ada backfill dokumen/approval/pengiriman/receipt.

Skrip PostgreSQL nyata tetap menguji 40 nomor serentak dan 10 retry penomoran. Tambahan PR-04 menembakkan 20 send, 20 READ dan 20 RECEIVE serentak atas satu surat final, lalu menguji satu snapshot, satu penerima, satu event/audit setiap jenis, dan tanpa duplikasi. Ini berjalan hanya pada klaster sementara CI/test.

## Storage, staging dan risiko

Metadata production diperiksa baca-saja: bucket letter-documents/signature-assets privat, tanpa policy objects; tabel pengiriman baru belum ada dan history tetap 8 entri. Tidak ada perubahan production. Migrasi menambah policy Storage SELECT restrictive untuk bucket dokumen/lampiran/aset TTD, sehingga policy permisif lain tidak membuka akses langsung. Bila bucket dilaporkan publik, migrasi gagal aman; tidak diam-diam mengubah setelan production.

SIA memakai API proxy dengan sesi aktif, RLS versi dan verifikasi hash, tanpa URL Storage/signed URL baru yang diberikan ke browser. Objek final tetap referensi immutable ke berkas tersimpan, bukan duplikasi bytes baru. Bila objek dihapus/diubah oleh operator di luar alur, pembacaan ditahan saat hash/file tidak cocok; perlu retensi/backup operasional.

Sebelum penerapan kelak perlu persetujuan terpisah, backup/snapshot, staging sesuai schema/grant/policy Storage production dan tinjauan history 8 entri versus 17 file baseline. Jangan replay baseline/repair otomatis. UAT staging wajib memakai akun creator/delegate/PRIMARY/CC/reviewer/approver/signer/admin, mencoba URL langsung dan URL lama yang mungkin pernah diterbitkan di luar repo, preview/unduh, akun nonaktif, grant dicabut, serta kegagalan Storage. Signed URL historis bila ada perlu penanganan umur token; PR ini tidak mengklaim bisa mencabut bearer URL yang sudah terbit secara retroaktif.

Tiga belas surat lama tanpa versi tidak dapat dikirim dengan bukti buatan. Surat lama bernomor/final yang tidak memiliki plan/version/issuance yang diperlukan ditahan untuk penanganan berotorisasi terpisah, bukan dibackfill. Eksternal/tagihan tidak dibuatkan dispatch/receipt internal dan tidak dianggap diterima karena pencatatan luar.

## Titik berhenti

Draft PR berbasis PR-03, tanpa merge/migrasi production/deployment. Tidak membangun PR-05. Hasil CI dan publikasi ditambahkan setelah run selesai, kemudian berhenti untuk peninjauan pengguna.
