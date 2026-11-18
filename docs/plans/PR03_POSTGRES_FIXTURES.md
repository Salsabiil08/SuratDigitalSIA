# PR-03 — perbaikan fixture PostgreSQL terpisah

18 November 2026. Hanya database uji sementara; tidak ada migrasi/seed production yang menjalankan file di `supabase/tests`.

## Penyebab dan perubahan fixture

Fixture lama membuat status READY_TO_ISSUE secara langsung tanpa versi, preview, kategori/review atau approval sah. Fixture RLS juga mengharapkan pembuat bisa UPDATE langsung, padahal production sudah menggunakan RPC server-only. Fixture konkurensi membuat akun tanpa penugasan aktif dan memakai pola seri lama. Mematikan guard bukan penyelesaian yang benar.

- Salinan `01_numbering_test.pr02.sql` disimpan di `supabase/tests/archive/`. Tes reproduksi baseline tetap memuat migrasi sampai PR-01 dan arsip ini, sehingga kegagalan awal tidak dihapus dari bukti.
- `00_workflow_fixtures.sql` menyediakan helper khusus test untuk menyimpan draft/versi dan attachment, memilih kategori, preview dan pengajuan, lalu menerbitkan/materialisasi dokumen melalui RPC. Isi/path/hash sintetis ditandai fixture; bukan bukti file Storage live atau data historis.
- `01_numbering_test.sql` menguji draft ditolak, seri/unit/signer, urutan, idempotensi, pembatalan melalui permintaan/otorisasi, dan penyelesaian disposisi oleh pemberi melalui RPC.
- `02_rls_test.sql` memakai grant SELECT sempit, bukan GRANT ALL. Pengguna membaca miliknya sesuai RLS dan tidak boleh memanggil RPC sensitif langsung. Super Admin tidak otomatis membaca isi.
- `03_approval_test.sql` menguji approver berbeda dari signer, deduplikasi, urutan wajib/tambahan, RLS tahap WAITING/PENDING, konfirmasi pembuat, tagihan dua pihak, review terpisah serta koreksi sebelum nomor. Penugasan reviewer/policy manager/approver dibuat eksplisit hanya pada database test.
- Skrip konkurensi menyiapkan 40 draft sah dengan versi/preview/pengajuan melalui helper, tanpa mengubah seri/counter/status untuk memaksa kelulusan. Memanggil allocator untuk 40 surat serentak dan 10 retry satu surat, memeriksa 40 nomor unik 1..40 dan counter tetap 40.

Perubahan fixture dipisahkan dari implementasi runtime dalam commit tersendiri pada Draft PR-03. SQL allocator inti tidak dilonggarkan; wrapper allocator hanya mengganti gate jumlah approval-versus-TTD dengan pemeriksaan plan approval per versi/hash. Perbandingan sumber membuktikan bagian seri, counter, tahun WIB, format, idempotensi dan antrean TTD tetap sama.

## Bukti dan batas

Tiga fixture SQL aktif dijalankan di PGlite dalam `tests/postgres-fixtures.test.ts`. Tes arsip mereproduksi kegagalan baseline semula. Suite PostgreSQL asli dan konkurensi dijalankan melalui job CI `db`; hasil sesungguhnya dicatat pada laporan PR-03 setelah job selesai. Lingkungan lokal tidak memiliki initdb/pg_ctl/psql; jangan menyamakan kelulusan PGlite dengan konkurensi PostgreSQL nyata.

Seluruh helper test harus tetap di luar migrasi production. Jangan memakai fixture untuk memperbaiki 13 surat lama atau mengisi keputusan historis.
