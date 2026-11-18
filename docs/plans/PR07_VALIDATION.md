# PR-07 — Integrasi Disposisi dengan Kotak Masuk dan Surat Hasil

18 November 2026 (WIB). Repository `Salsabiil08/SuratDigitalSIA`, branch `feat/pr-07-disposition-integration`, basis PR-06 `54279cee429f611dee257246c6bc96ada664e0fc`. Merge, perubahan database production dan deployment tidak diizinkan. PR-08 tidak dimulai.

## File dan migrasi

| Area | File/perubahan |
|---|---|
| Migrasi aditif | `supabase/migrations/20261118085257_disposition_inbox_results.sql`: source_dispatch_id nullable; tabel operasi, relasi hasil, lampiran, snapshot pengajuan/file, keputusan; indeks/FK/unique/RLS/ACL/guard; wrapper workflow/save draft dan RPC baca |
| Navigasi/konteks | `src/server/disposition-integration.ts`, `src/components/letters/disposition-letter-panel.tsx`, actions/workflow dan detail surat: hak tindakan/tautan ke tugas serta surat terkait yang boleh dibaca |
| Disposisi existing | actions/dispositions, halaman/rute dan disposisi-client: sumber terpilih sah, bukti kirim, upload/pilih lampiran, riwayat hasil/perbaikan, tautan ke hasil; CREATE/START/SUBMIT/RETURN/ACCEPT existing dipertahankan |
| Editor existing | prepared-letter-editor, letter-editor, domain/workflow, letter-workflow: seed tugas sah, penerima pemberi, type/recipient terkunci, intent draf dan cleanup retry, tanpa alur nomor/TTD baru |
| Lampiran | API POST `/api/dispositions/[id]/attachments`, GET `.../[fileId]`: Auth/RLS, PDF/DOCX 1 MB per file, total 25 MB, hash/path privat, upload tanpa upsert, proxy unduh no-store tanpa signed URL |
| Invalidation | actions/delivery menginvalidasi disposisi setelah pengiriman, actions/dispositions menginvalidasi detail; daftar/error memakai data sesi |
| Pengujian | `07_disposition_integration_test.sql`, helper fixture, postgres-fixtures, test-db dan test-db-concurrency; tiga berkas tes server/UI/API baru |
| Dokumentasi/pengaman | AGENTS/panduan agen/README/indeks/spesifikasi/rencana/backlog/FINDINGS, laporan ini; vercel.json menambah auto-deploy=false khusus branch PR-07 |

Satu migrasi baru dibuat dengan CLI `supabase@2.58.5 migration new disposition_inbox_results`. Tidak mengubah 20 migrasi baseline, dependensi, lockfile atau workflow CI. Tidak ada backfill pada 13 surat tanpa versi atau disposisi lama.

## Alur yang dihubungkan

1. Kotak Masuk PR-05 → detail surat → **Buat Disposisi**. RPC sesi hanya mengizinkan sumber internal NUMBERED dengan pengiriman resmi dan PRIMARY berwenang. CREATE mengulang validasi Auth/server/database serta hierarki baseline: level pemberi > penerima, GM dalam unit sendiri, SM/Direktur sesuai penugasan lintas organisasi. Super Admin tanpa penugasan/mandat dan CC tanpa mandat tidak memperoleh kewenangan dari akses baca.
2. Tautan membawa ke formulir disposisi yang sudah ada dengan sumber sah terpilih. Alur manual tanpa acuan dan acuan eksternal yang sebelumnya sah tetap tersedia. Tidak membuat workflow tugas paralel. Instruksi, prioritas, pemberi/penerima, waktu, tenggat bila diisi, requires_letter eksplisit dan audit disimpan transaksi existing.
3. Pelaksana membuka tugas, memberi catatan dan dapat menyiapkan lampiran PDF/DOCX atau surat hasil baru. Catatan selalu wajib saat pengajuan. Surat wajib hanya bila pemberi menentukannya secara eksplisit; checkbox awal tidak otomatis mewajibkan surat. Tenggat kosong secara default, bukan tanggal jatuh tempo yang dikarang.
4. Surat hasil baru memakai editor/rich text/lampiran, kategori, preview, review/approval, nomor, TTD dan finalisasi existing. Penerima dikunci ke pemberi tugas. Tidak menyalin nomor, isi, keputusan atau TTD asal. Relasi permanen mencatat task, asal, hasil, pembuat, waktu dan intent; perbaikan dokumen final menggunakan surat/nomor baru, relasi lama tetap ada.
5. Bila tugas mewajibkan surat **atau surat hasil telah dibuat**, hasil baru bisa diajukan setelah surat final dan pengiriman resmi kepada pemberi berhasil. Draf/nomor/final tanpa dispatch ditolak. Penyimpanan draf tidak menyelesaikan tugas. Untuk tugas tanpa surat, catatan yang jelas dapat diajukan, beserta lampiran yang dipilih bila ada.
6. Pengajuan menyimpan snapshot catatan, ID hasil/dispatch, file yang dipilih, aktor, waktu dan revisi. Workflow existing mengubah status ke Menunggu Pemeriksaan dan mengirim notifikasi/audit dalam transaksi sama. Gagal snapshot/file/notifikasi/audit/operasi => rollback keseluruhan.
7. Hanya pemberi aktif boleh RETURN atau ACCEPT. RETURN wajib catatan, status Perlu Perbaikan. Pengajuan/perbaikan berikutnya dan keputusan dicatat sebagai baris immutable baru; field ringkasan existing boleh menunjukkan hasil terbaru, riwayat tidak ditimpa. ACCEPT menghasilkan DONE hanya sesudah bukti pengajuan sah. Pelaksana tidak bisa menerima sendiri.
8. Detail surat ↔ disposisi melalui tautan tugas; tugas → surat hasil bila dapat dibaca; hasil → tugas/asal atau surat terkait sesuai hak masing-masing. Relasi tersembunyi tidak menghasilkan tautan dokumen privat.

## Otorisasi, histori dan pemisahan status

- Session client/RPC SECURITY INVOKER untuk daftar sumber dan konteks, tanpa actor parameter browser/service role sebagai pembaca daftar tugas/hasil. Mutasi tetap pola existing server-only: requireUser mengambil identitas sesi, service RPC mengulang seluruh pemeriksaan bisnis. Authenticated/anon tidak dapat menulis tabel hasil/keputusan atau menjalankan mutasi RPC.
- SELECT dispositions diberikan eksplisit kepada authenticated untuk RPC/UI dengan RLS peserta aktif (giver/recipient), bukan baca global. Tabel baru RLS; operasi idempotensi tidak mempunyai grant baca pengguna. Semua tabel bukti immutable terhadap UPDATE/DELETE.
- PRIMARY tidak otomatis menjadi pemberi: hierarki dan organisasi tetap diperiksa. Mandat delegasi pemeriksa belum disahkan; tidak ada akses ACCEPT lewat Super Admin, CC, delegasi pengiriman atau orang lain. Pengiriman dan pemeriksaan hasil adalah kewenangan berbeda.
- Tugas integrasi baru memakai source_dispatch_id. Cabang disposisi sebagai dasar akses pada helper lama **tidak berlaku bagi tugas baru ini**. Source/draft/versi/approval/TTD/Storage hanya melalui hak independen yang sah dan snapshot dispatch PR-04. Pelaksana yang tidak boleh membaca dokumen asal hanya melihat instruksi/metadata tugas, bukan dokumennya. Pemberi tidak otomatis melihat draf surat hasil; setelah pengiriman sah hanya snapshot final, bukan arsip versi/workflow privat.
- Relasi hasil RLS memerlukan peserta tugas serta hak baca kedua surat. Konteks tugas dapat ditelusuri secara terpisah tanpa membuka asal. Lampiran hasil adalah berkas tugas yang sengaja diajukan: pelaksana dapat membaca berkasnya; pemberi baru mendapat berkas yang dipilih ke snapshot pengajuan. Akun lain/CC/admin tidak otomatis boleh. Bucket tetap privat/restrictive; proxy menguji Auth/RLS lalu hash dan ukuran, tidak mencatat receipt/read surat.
- Kunci CREATE/aksi UUID + hash payload + lock transaksi mencegah duplicate retry; key sama dengan payload berbeda ditolak. Revisi optimistis tetap berlaku untuk intent berbeda. Snapshot pengajuan/keputusan, audit dan notifikasi konsisten transaksi. Draf hasil dengan key sama kembali ke identitas surat yang sama, bukan versi/nomor baru. Upload biasa melakukan preflight key/hash/ukuran; retry bersamaan tidak membuat bukti tugas ganda.
- Surat hasil adalah jenis relasi tersendiri, bukan official_reply_links PR-06. Mengirim hasil tidak membuat official_reply_sends; menerima disposisi tidak menandai kewajiban balasan surat. Balasan resmi PR-06 tetap melalui tindakan/alur terpisah.
- Disposisi historis tanpa source_dispatch_id tidak ditulis ulang atau diberi bukti hasil/status selesai fiktif. Perilaku workflow historis dipertahankan, bukan disimpulkan sudah memenuhi semua aturan integrasi baru. Rekonsiliasi historis tetap memerlukan keputusan/berkas asli dan izin terpisah.

## Pengujian lokal dan rencana CI

- `npm run check`: **234/234 tes**, 28 berkas dan typecheck lulus, termasuk regresi PR-00–06. Baru: enam tes server, enam API lampiran, empat UI, satu fixture SQL integrasi.
- Fixture SQL melalui PGlite: PRIMARY GM sah, CC SM/admin/staf ditolak, GM lintas unit ditolak, source dan hasil privat tidak bocor lewat surat/versi/relasi/Storage; draf/final tanpa kirim menahan submit; nomor hasil baru; upload privat sebelum submit, pilih lampiran dan akses sesudah submit; catatan-only sah tanpa tenggat otomatis; pelaksana/admin tidak ACCEPT; RETURN → hasil baru → SUBMIT → ACCEPT, riwayat dua pengajuan/keputusan/relasi tetap ada.
- Fault injection pada notifications/audit/operasi CREATE, snapshot/file/notifikasi/audit/operasi SUBMIT, dan keputusan ACCEPT membuktikan rollback tanpa status/audit palsu. Retry key sama tidak menggandakan kejadian; payload key berbeda ditolak.
- API: auth/aktor/RLS sebelum Storage, format/ukuran, retry tanpa upload baru, cleanup saat RPC gagal, proxy download hash/ukuran/no-store tanpa signed URL atau mutasi status. UI: tindakan hanya dari konteks sah, query error terpisah dari sukses kosong, sumber privat tanpa tautan, draf menahan hasil, riwayat perbaikan tetap tampil.
- Suite PostgreSQL nyata ditambah fixture 07 dan konkurensi 20 retry CREATE/SUBMIT/ACCEPT dan 20 retry draf hasil (satu surat/versi/relasi, tugas belum selesai). Konkurensi nomor, pengiriman/receipt dan balasan PR-06 tetap berjalan. PostgreSQL nyata juga lulus di CI run #41 (bukti di bawah).
- `npm run build` lulus kompilasi/typecheck dan pembangkitan 23 halaman, termasuk dua endpoint lampiran baru. Sintaks shell, tautan Markdown dan diff diperiksa sebelum publikasi. Build bukan deployment. UAT browser/Supabase staging belum dijalankan.

## Risiko dan keputusan pending

1. UAT staging lintas akun nyata: PRIMARY pimpinan → bawahan → pemberi, CC/admin tanpa mandat, pergantian akun/grant/penugasan dicabut, tautan detail/tugas/hasil dan URL lampiran langsung. Uji hasil yang hanya catatan, lampiran terpilih, surat biasa/formal dan perbaikan berulang pada desktop/mobile.
2. Perusahaan menetapkan delegasi pemeriksa, aturan tenggat, kategori/siapa pemeriksa/penyetuju dan kapan hasil harus berupa surat. Saat ini hanya pemberi menerima, tidak ada delegasi/penjadwalan/kewajiban otomatis baru. Instruksi dapat mewajibkan surat secara eksplisit melalui kewenangan pemberi existing.
3. Menugaskan seseorang tidak otomatis memberi akses dokumen asal. Jika pelaksana membutuhkan dokumen sumber yang belum boleh dibaca, perlu kebijakan distribusi/akses perusahaan tersendiri; jangan menyiasatinya dengan membuka RLS. Setelah surat hasil dibuat, jalur aman menuntut penyelesaian/kirim surat tersebut sebelum submit; pelepasan surat hasil yang dibatalkan belum dirancang.
4. Storage dan DB tidak satu transaksi. Bila DB gagal, unggahan dibersihkan; gangguan cleanup masih dapat menyisakan objek yatim. Tidak menghasilkan submission/status palsu. UAT jaringan/retry/berkas bermasalah dan proses cleanup staging diperlukan.
5. Volume besar: uji rencana query/index dan daftar riwayat/lampiran di staging. Daftar disposisi existing belum diubah menjadi modul pagination baru pada PR ini. Penguncian/idempotensi dan intent sessionStorage perlu diuji lintas tab/jaringan; tidak ada polling/tampilan Memuat baru.
6. Sebelum production: izin terpisah, backup dan staging yang disanitasi, pemeriksaan selisih history/schema (baseline historis production 8 versus file migrasi branch). Jangan replay baseline, repair/reset atau backfill otomatis. 13 surat lama dan nomor/counter/audit lama dipertahankan.

Berhenti setelah Draft PR dan bukti pengujian untuk tinjauan pengguna. Tidak merge, mengubah database production atau deploy. PR-08 tidak dimulai.

## Bukti publikasi dan CI

- [Draft PR #8](https://github.com/Salsabiil08/SuratDigitalSIA/pull/8), base PR-06 `54279cee429f611dee257246c6bc96ada664e0fc`; commit implementasi `edb3d4f12b661a564f75f84370f3e12b3fbd673f`. 35 berkas berubah termasuk dokumentasi/pengaman.
- [CI run #41](https://github.com/Salsabiil08/SuratDigitalSIA/actions/runs/44303723466): **success**, job check dan db lulus. Check 234/234 tes/typecheck. PostgreSQL nyata menjalankan 21 migrasi dan fixture 01–07, kemudian seluruh konkurensi. Log: `konkurensi: 40|40|1|40`, `PENGIRIMAN/PEMBACAAN/PENERIMAAN KONKUREN LULUS`, `BALASAN KONKUREN LULUS`, `DISPOSISI KONKUREN LULUS: 20 retry buat/ajukan/terima, satu tugas/pengajuan/keputusan/event`, `DRAF HASIL KONKUREN LULUS: 20 retry, satu surat/versi/relasi; tugas belum selesai`, `UJI DATABASE LULUS`.
- Seluruh 20 blob migrasi baseline identik, dependensi/lockfile/CI tidak diubah. Build lokal lulus; tautan Markdown, sintaks shell dan diff valid. tsconfig.tsbuildinfo lokal tidak dimasukkan ke PR.
- Pemeriksaan metadata Supabase read-only: tabel disposition_submissions/disposition_operations belum ada di production, history tetap 8 entri. Tidak ada apply_migration, seed, DML, repair/reset atau perubahan Auth/Storage production.
- Vercel branch PR-07 **0 deployment**. Production tetap READY `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc` pada main `4e0c0c661af58dd6db729c202643cd6629f7eb07`; main tidak diubah. PR tetap draft dan belum di-merge.
- Commit penutup hanya memperbarui dokumentasi bukti. UAT Supabase Auth/Storage/browser staging tetap belum dijalankan; CI bukan pengganti UAT perusahaan. Berhenti sebelum PR-08.
