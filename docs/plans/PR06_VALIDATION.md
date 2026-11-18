# PR-06 — Balasan Surat Resmi dan Relasi Surat Asal–Balasan

18 November 2026 (WIB), repository `Salsabiil08/SuratDigitalSIA`. Branch `feat/pr-06-official-replies`, basis PR-05 `e86466c9fafdb59ab24d85dc5cee61df086bd210`. Tidak ada izin merge, perubahan database production atau deployment. PR-07 tidak dimulai.

## Implementasi dan file

| Area | Perubahan |
|---|---|
| Migrasi | `supabase/migrations/20261118081550_official_letter_replies.sql`: tabel official_reply_links, official_reply_sends, FK/unique/check/index, RLS/ACL, trigger validasi/immutable/kirim, wrapper save draft dan RPC baca konteks |
| Domain | `src/domain/official-replies.ts`: tipe/konstruksi draf/referensi HTML aman/kunci UUID. `workflow.ts` menambah replyToDispatchId/replyKey; mailbox.ts menambah replied_at opsional |
| Server | `src/server/official-replies.ts`: baca konteks melalui sesi/RLS. `src/server/actions/official-replies.ts`: Auth, preflight idempotensi, saveDraft biasa. `letter-workflow.ts`: bersihkan unggahan yang tidak digunakan saat retry bersamaan; workflow.ts memuat konteks detail |
| UI | `src/components/letters/official-reply-panel.tsx`: tindakan, hubungan dua arah, nomor/identitas/aktor/waktu/tautan aman. Detail surat memakai panel/status per penerima dan refresh; editor tetap rich text/lampiran, penerima referensi dikunci |
| Pengiriman/status | Trigger kirim mencatat bukti balasan; mailbox RPC/UI menampilkan replied_at per PRIMARY, bukan status dokumen Selesai. delivery action menginvalidasi detail asal/balasan |
| Tes | `tests/official-replies.test.ts`, `official-replies-server.test.ts`, `official-replies-ui.test.tsx`, tambahan postgres-fixtures, `supabase/tests/06_official_replies_test.sql`, helper fixture dan scripts/test-db(-concurrency).sh |
| Dokumen/pengaman | AGENTS, panduan agen/README/indeks/rencana/spesifikasi/backlog/FINDINGS; vercel.json menambah larangan auto-deploy khusus branch PR-06 |

CLI 2.58.5 yang dipin digunakan untuk `migration new official_letter_replies`; tidak upgrade CLI/dependensi/CI. Changelog dan panduan RLS Supabase ditinjau; perubahan CLI v3 tidak diadopsi. Satu migrasi baru; 19 migrasi baseline tidak ditulis ulang. Tidak ada backfill/DML terhadap surat lama. History audit tetap append-only.

## Alur nyata

1. Detail hanya menawarkan Balas dengan Surat Resmi jika konteks sesi membaca surat asal NUMBERED yang sudah mempunyai pengiriman resmi dengan akun sebagai PRIMARY. CC/pengirim/admin tidak otomatis mendapat tindakan tersebut. Database mengulang pemeriksaan saat penyimpanan.
2. Tindakan membuat dokumen draf melalui generator/Storage/saveDraft yang ada; isi awal hanya referensi nomor/perihal, tanpa menyalin isi/lampiran/TTD. ID surat dan versi baru, nomor kosong, tanggal hari ini WIB. Relasi disimpan dalam transaksi yang sama dengan draf/versi/audit.
3. Penerima awal adalah **pengirim resmi dalam snapshot asal** (dapat berbeda dari pembuat bila pengiriman memakai delegasi). Identitas ini dikunci di UI dan database; pengalihan tujuan ke pihak lain memerlukan rancangan/keputusan tersendiri. Kategori awal mengikuti asal, tetap bisa dikoreksi pembuat. Reviewer, approver dan signer tidak disalin; pembuat melengkapinya berdasarkan aturan yang berlaku. Tidak ada shortcut submit/nomor/TTD.
4. Pengguna dibawa ke editor SIADocs yang ada, melengkapi isi, kategori, lampiran, pemeriksa/persetujuan/TTD. Draf harus dipratinjau/diajukan sesuai alur biasa. Pemeriksaan bukan approval; koreksi versi tidak mewarisi keputusan sah versi lama. Nomor hanya tindakan eksplisit setelah semua gate.
5. official_reply_links permanen merekam dispatch/surat asal, penerima yang membalas, surat balasan, aktor, waktu dan kunci intent UUID. Balasan baru saja boleh dihubungkan, bukan surat lama dengan payload id. Relasi sendiri/cross-account/CC/sumber palsu ditolak. Setiap surat balasan punya satu asal; beberapa balasan tambahan dapat dibuat dengan intent baru yang disengaja.
6. Trigger AFTER INSERT pengiriman PR-04 menambah official_reply_sends dan audit OFFICIAL_REPLY_SENT. Ini masih di dalam transaksi yang sama dengan snapshot, penerima, notifikasi dan audit pengiriman. Gagal di salah satu tahap wajib membatalkan semuanya. Retry dispatch tidak menjalankan INSERT kedua; unique constraint dan lock penerima pada pembuatan mencegah surat/relasi/audit ganda untuk intent sama.
7. Draf/review/approval/nomor/TTD/final belum menjadi Sudah Dibalas. Hanya timestamp official_reply_sends memberi status per origin dispatch + recipient. Baca/receipt tidak diubah; CC tidak mendapat kewajiban atau status PRIMARY. Kewajiban balasan dan tenggat **belum disahkan perusahaan**: requires_response tetap false dan tidak ada due date otomatis.

## Akses dan konsistensi

- Auth getUser/requireUser tetap sumber aktor. Pembaca konteks memakai createClient sesi dan RPC SECURITY INVOKER tanpa parameter actor, bukan service role. RPC mutasi tetap pola server-only PR-04: aktor terverifikasi di server dan pemeriksaan bisnis database; authenticated/anon tidak diberi execute save RPC atau write tabel relasi/status.
- RLS relasi mensyaratkan app.can_read_letter pada **kedua** surat. Relasi tidak disentuhkan ke helper otorisasi surat, versi, API atau Storage. Mengetahui UUID tidak membuka dokumen. Pengirim asal biasanya baru melihat hubungan setelah balasan dikirim, sementara pembuat balasan dapat menelusuri asal sejak draf. Hak independen reviewer/approver/signer tidak dihapus.
- Status penerima melalui helper SECURITY DEFINER terikat auth.uid(), search_path public,pg_temp, hanya timestamp untuk recipient sendiri atau Outbox sah dan tetap hak baca asal. Tidak mengeluarkan ID/hash/path/isi balasan yang tersembunyi. RLS relasi tetap diperlukan untuk tautan/identitas surat lain. Super Admin tidak otomatis masuk lingkup tersebut.
- SELECT katalog document_categories diberikan eksplisit kepada authenticated untuk seed kategori RPC; katalog master bersama ini **sudah memiliki RLS/master read policy**. Tidak menambah akses write atau hak dokumen. RPC konteks ditolak untuk anon/service_role.
- Status kirim balasan immutable, relasi immutable, penerima/jenis/creator balasan dijaga trigger. Guard dokumen final, penomoran dan otorisasi PR-00–05 dipertahankan. Snapshot asal tidak disentuh.
- Kunci intent disimpan di sessionStorage sebelum tindakan; kegagalan/retry memakai key sama, bukan state status surat. Preflight menghindari unggahan baru untuk retry biasa; RPC tetap otoritas untuk permintaan bersamaan. Berkas baru yang tidak dipakai pada retry dibersihkan. Storage dan DB tetap dua sistem; kegagalan jaringan saat cleanup dapat menyisakan berkas yatim, bukan relasi/status terkirim palsu.
- Refresh detail eksplisit dan sinkronisasi props server menjaga konteks baru; pengiriman menginvalidasi detail/daftar. Tidak ada polling atau tampilan Memuat baru. Tautan relasi tidak diprefetch sebagai dokumen.

## Pengujian

- `npm run check`: **217/217**, 25 berkas, typecheck lulus. Seluruh regresi baseline/editor/nomor/review/approval/TTD/disposisi/dispatch/receipt/mailbox tetap lulus.
- Baru: domain 2, server 9, UI SSR 3, satu fixture SQL baru. Fixture melalui PGlite menjalankan alur RPC sah, RLS lintas akun, CC/admin/pengirim ditolak, idempotensi draf, hubungan tersembunyi sebelum kirim, query langsung versi/relasi/status, self-link/tamper, nomor berbeda, receipt/read independen, dan rollback draft maupun kirim.
- Balasan formal Laporan diuji: pemeriksa sah PASS tetap belum approval, aktor lain tidak boleh approve, koreksi menghasilkan versi baru dan memerlukan keputusan baru, nomor ditahan sebelum gate selesai, final ditolak sebelum TTD, penandatangan salah ditolak, TTD basah unggah sah kemudian final/kirim berhasil.
- Fault injection pada relasi/audit pembuatan dan official_reply_sends/penerima/notifikasi/audit pengiriman membuktikan transaksi rollback. Tidak menghasilkan status Sudah Dibalas atau audit palsu.
- Fixture 06 ditambahkan ke suite PostgreSQL nyata. Skrip konkurensi mempertahankan 40 alokasi nomor unik dan 20 retry kirim/READ/RECEIVE, lalu menambah 20 retry buat balasan (satu surat/versi/relasi/audit) dan 20 retry kirim balasan (satu status/event).
- `npm run build`: kompilasi/typecheck dan 23 halaman lulus. Build bukan deployment. `git diff --check` dan sintaks shell diperiksa. Hasil PostgreSQL/CI publikasi dicatat sesudah run.

## Production, risiko dan UAT staging

Metadata production dibaca saja: official_reply_links dan internal_dispatches belum ada; migration history tetap 8. Advisor security pada baseline hanya menyebut [leaked password protection belum diaktifkan](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); ini bukan penilaian migrasi PR-06 yang belum diterapkan. Tidak mengubah Auth atau mengklaim advisor production memvalidasi schema branch.

Sebelum produksi tetap perlu izin terpisah, backup terverifikasi dan rekonsiliasi history/schema staging yang disanitasi; jangan replay baseline/repair otomatis. 13 surat lama tanpa versi tidak dibuatkan relasi/delivery/receipt/balasan fiktif.

UAT staging belum dijalankan:

- Login lintas akun nyata: PRIMARY, CC, pembuat/pengirim/delegasi, reviewer, approver, signer dan admin; sebelum/sesudah kirim, akun/grant dicabut dan sesi berganti. Tautan asal/balasan harus diperiksa lagi oleh server/API/RLS/Storage.
- Dua pengguna menguji buat → edit rich text/lampiran → preview → review/revisi → approval → nomor → TTD → final → kirim; asal melihat hubungan sesudah berhak. Baca dan penerimaan tetap terpisah dari balasan.
- Double-click/retry sesudah gangguan jaringan, storage cleanup gagal, pergantian tab/back/refresh dan pesan error; desktop/mobile dengan subjek/nomor/identitas panjang.
- Volume relasi dan latency query mailbox/status, rencana indeks, serta forward migration pada schema staging bukan hanya database kosong.
- Perusahaan menetapkan kewajiban/tenggat, kategori/reviewer/approver yang sah, delegasi/CC dan kebijakan tujuan jika pengirim resmi berupa delegasi. Tidak ada asumsi bisnis baru untuk PR-07.

Berhenti setelah Draft PR dan bukti CI ditinjau. Tidak merge, migrasi production atau deployment. Integrasi disposisi PR-07 tidak dikerjakan.
