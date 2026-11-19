# Release SIADocs R.04 — hanya setelah persetujuan eksplisit

Status **HOLD / NO-GO**. Dokumen ini bukan izin menjalankan tindakan production. Semua SHA, schema, history, environment dan backup harus diverifikasi ulang pada hari release.

## 1. Tutup gerbang staging/perusahaan

1. Sediakan Supabase staging terpisah; jangan mengaktifkan project TaskManager atau memakai key production. Konfigurasi `.env.staging.example` secara aman di project Vercel `siadocs-r04-staging` (Node 22, belum terkoneksi Git). Jalankan `node scripts/readiness/verify-staging.mjs`. Tidak menaruh secret di chat/repo/artefak CI.
2. Rekonstruksi baseline schema yang sudah dibandingkan di staging, dengan Auth/Storage Supabase asli; gunakan akun/data sintetis dan policy uji berlabel jelas. Jangan menjalankan `seed.sql` produksi atau stub Auth/Storage pada project managed. Uji delapan file forward dari manifest, bukan replay fondasi/history.
3. Siapkan akun uji kuat untuk pembuat, reviewer independen, approver, signer, pengirim/delegasi bila diaktifkan, PRIMARY, CC bila diaktifkan, pemberi/pelaksana disposisi dan admin tanpa mandat. SMTP keluar tidak diperlukan untuk akun uji yang disiapkan admin secara sah.
4. Jalankan/rekam ID surat, versi/hash, nomor/seri, dispatch, receipt, relasi, task/submission/decision dan aktor/waktu pada: internal biasa/formal, eksternal, tagihan; review/revisi/approval/nomor/TTD/kirim/baca/terima; Inbox/Outbox/balasan; disposisi/hasil/RETURN/perbaikan/ACCEPT. Uji desktop/mobile, logout/pergantian akun, offline/retry/konkurensi, grant dicabut, query/API/Storage ilegal. Hanya isi hasil PASS setelah benar-benar dijalankan.
5. Lengkapi penetapan wajib dalam readiness dan backup/restore drill staging. Jika ada kegagalan, perbaiki pada PR-08 yang sama dan ulangi tes terkait serta seluruh gerbang release; tidak membuat fase PR-09.

## 2. Urutan integrasi PR-00–PR-08

Rantai sumber sudah berurutan: PR-00 #1 → PR-01 #2 → PR-02 #3 → PR-03 #4 → PR-04 #5 → PR-05 #6 → PR-06 #7 → PR-07 #8 → PR-08 FINAL. Head setiap tahap adalah ancestor tahap berikutnya; basis PR-08 tetap PR-07.

**Jalur yang direkomendasikan: satu merge commit dari Draft PR-08 integrasi ke main**, sesudah seluruh perubahan 00–07 yang sudah ditinjau dan delta 08 disetujui serta CI pada target main lulus. Jangan squash/rebase yang membuang ancestry. Ini memasukkan urutan commit 00–08 bersama-sama, bukan melewati CI historis merah PR-00–02. Jangan merge ulang PR lama; setelah verifikasi main memuat seluruh SHA, arsipkan/utup draft lama sebagai sudah tercakup dengan persetujuan pemilik. Alternatif merge satu-per-satu memerlukan rencana restack/status check yang sah; jangan menonaktifkan required CI agar PR lama merah bisa lewat.

Sebelum merge apa pun:

- Setelah diizinkan, **bekukan auto-deploy project production** dengan Ignored Build Step `exit 0` (nilai awal diamati `null`) atau mekanisme provider setara, lalu pastikan tidak ada deployment queued/building yang dapat mempromosikan kode lama. Guard branch di vercel.json hanya melindungi branch draft, bukan merge ke main.
- Rekam deployment production awal, seluruh env/config tanpa mencetak secret, commit release dan checksum bundle; branch PR-00–08 tetap deploymentEnabled=false. Jangan menghubungkan staging ke database production.
- Verifikasi `git merge-tree --write-tree origin/main origin/feat/pr-08-production-readiness`, ancestry seluruh head draft, diff dan CI. Tidak ada merge dilakukan oleh pekerjaan readiness ini.

## 3. Backup dan maintenance

- Tetapkan PIC, jendela maintenance, penghentian penulisan/penerbitan nomor, dan kanal komunikasi. Old runtime dapat tidak kompatibel dengan SQL baru; jangan membiarkannya menulis selama transisi.
- Ambil backup DB terverifikasi (public/app, ledger migrasi dan metadata Storage), inventaris/backup **byte objek Storage**, Auth/config/grant terpisah secara aman. Catat timestamp, checksum, lokasi terenkripsi, akses PIC dan hasil restore drill staging. Snapshot/dump schema saja bukan backup dokumen.
- Rekam fingerprint/read-only daftar 13 historis tanpa versi, counter, nomor/issuance, versi/hash/path, audit dan jumlah baris. Jangan membuat bukti historis untuk meluluskan pemeriksaan.

## 4. Migrasi forward — tidak memakai db push umum

1. Baca ulang `scripts/readiness/catalog.sql` melalui koneksi production **read-only** dan history; cocokkan dengan snapshot yang ditinjau. Jika drift, history bertambah, atau data kualitas berubah: STOP dan tinjau ulang. Enam fondasi yang tidak tercatat history tidak boleh diaplikasikan ulang/ditandai applied otomatis.
2. Dari commit release yang telah disetujui:
   ```bash
   node scripts/readiness/prepare-forward.mjs test-results/release-forward.sql
   ```
   Tinjau `release-forward.sql.manifest.json` (8 file: PR-01–07 + migrasi grant PR-08), SQL dan backup. Generator tidak mengeksekusi DB.
3. Hanya sesudah persetujuan migrasi production, jalankan dengan koneksi postgres yang disimpan aman (jangan paste secret ke log/chat):
   ```bash
   psql "$SIADOCS_APPROVED_DATABASE_URL" -v ON_ERROR_STOP=1 -f test-results/release-forward.sql
   ```
   Bundle memeriksa history tepat 8 entri dan definisi fungsi baseline, mengunci ledger/data relevan, menerapkan delapan migrasi + pencatatan history **dalam satu transaksi**, kemudian memeriksa fingerprint kolom lama surat/versi/nomor/counter/audit. Kegagalan membatalkan transaksi. History hasil 16; enam fondasi tetap dicatat sebagai pengecualian terverifikasi, bukan repair terselubung.
4. Pastikan 13 historis tetap tanpa versi buatan, tidak ada pengiriman/relasi fiktif, counter/nomor/audit lama sama, bucket privat, RLS aktif, privilege mutation/TRUNCATE tertutup, event/receipt/grant tepat. Jalankan advisors dan pemeriksaan API dengan akun yang ditetapkan. Jangan mengeksekusi fixture/test SQL pada production.

## 5. Deployment pinned dan smoke

- Main harus sama dengan commit integrasi release yang ditinjau; gunakan build Node **22.x**, `npm ci`, Next 15.5.29/PostCSS 8.5.33 dari lockfile; alat tes Vitest 5.1.1/Vite 8.3.8 memerlukan Node >=22.12. Pertahankan API tes nonaktif dan glob build dari source terkontrol, pantau patch picomatch untuk 12 high dev/build yang belum punya patch upstream. Production env `SIADOCS_ENV=production`, `NEXT_PUBLIC_SIADOCS_ENV=production`; URL/key tetap project production yang disetujui, service key server-only. Auth site/redirect URLs benar, bucket privat, kredensial sementara sudah ditangani.
- Setelah DB siap dan seluruh deployment lama dibatalkan, pulihkan Ignored Build Step ke nilai sebelumnya yang dicatat, lalu buat **satu deployment production manual dari SHA release yang tepat**. Jangan memakai ref bergerak atau mempromosikan build staging/dummy backend. Pastikan build/deployment READY, SHA dan config cocok sebelum mengakhiri maintenance.
- Smoke: root/route tanpa sesi → login; akun sah → modul sesuai mandat; daftar/preview berotorisasi, HEAD/akses ilegal ditolak, status existing dan notifikasi benar. **Tidak menerbitkan nomor, approval, TTD atau receipt uji fiktif pada production.** Validasi bisnis mutatif telah dilakukan di staging.
- Pantau error rate/5xx/latensi Auth/PostgREST/Storage, penolakan otorisasi, antrean review/approval/sign, duplikasi event/key dan integritas counter. Notifikasi error tidak boleh menyimpan isi surat/secret. PIC memantau 24 jam pertama; buka penulisan setelah smoke/sign-off.

## 6. Recovery

- Sebelum transaksi commit: kegagalan SQL otomatis rollback; pastikan history/data/snapshot tetap semula dan jangan lanjut deploy.
- Setelah commit tetapi sebelum penulisan dibuka: tetap maintenance. Prioritaskan perbaikan forward; restore snapshot hanya bila disetujui, mencakup DB dan Storage/Auth secara konsisten dan telah didrill. Deployment lama **tidak diasumsikan kompatibel** dengan SQL R.04.
- Setelah nomor/surat baru diterbitkan: **jangan mengembalikan counter atau memakai ulang nomor**, menghapus audit, atau melakukan PITR otomatis yang menghilangkan surat/dispatch sah. Hentikan penulisan, lakukan rekonsiliasi oleh PIC dan recovery forward yang mempertahankan seluruh nomor/bukti.
- Jika build gagal/healthcheck gagal: jangan membuka maintenance; bekukan deploy lagi, simpan log/manifest tanpa secret, verifikasi deployment aktif, dan mintakan keputusan recovery yang konkret.
