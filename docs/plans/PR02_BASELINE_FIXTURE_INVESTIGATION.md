# Investigasi terpisah — fixture penomoran PostgreSQL baseline

18 November 2026. Investigasi ini bukan perubahan aturan penomoran atau perbaikan otomatis production.

## Penyebab yang direproduksi

CI PR-00/PR-01 berhenti pada `supabase/tests/01_numbering_test.sql:106`; konteks DO menunjuk pemanggilan pertama `issue_letter_number(l1, prof_a, 'k1')`.

Fixture menyisipkan surat dengan status `READY_TO_ISSUE`, tetapi tanpa `current_version_id` dan tanpa versi dokumen. Guard yang sudah ada pada `20261117204405_revision_workflow.sql` menolak jika versi tidak ada, status belum siap, atau jumlah signer berbeda. Karena itu pesan **Surat belum siap diterbitkan.** benar; status siap saja tidak membuktikan dokumen siap.

`tests/baseline-numbering-fixture.test.ts` membangun baseline hingga PR-01 tanpa migrasi PR-02, menjalankan fixture SQL asli, dan mereproduksi pesan tersebut. Setelah rollback, tidak ada nomor terbit. Kasus kedua mengisolasi surat READY tanpa versi dan memastikan counter tidak berubah. Ini reproduksi PGlite, bukan klaim suite PostgreSQL penuh lulus.

## Masalah lanjutan yang terlihat dari sumber

- Fixture eksternal juga belum menyediakan versi serta approval yang terikat versi dan signer; membuat versi dummy saja tidak cukup untuk memperbaiki suite dengan benar.
- Kasus pembatalan memakai tindakan lama, sedangkan pengesahan pembatalan sekarang memerlukan kewenangan dan tahap yang sah.
- Kasus disposisi menulis DONE langsung, bertentangan dengan pengiriman hasil dan penerimaan oleh pemberi pada alur production saat ini.
- Fixture konkurensi membuat akun tanpa penugasan aktif, menyisipkan surat siap secara langsung tanpa versi, dan memakai pola seri lama. Setelah kegagalan pertama diperbaiki, area ini juga harus diselaraskan dengan setup nyata.

## Perbaikan yang direkomendasikan terpisah

Gunakan helper fixture yang membuat akun/penugasan sah, menyimpan draft dan versi melalui RPC, melakukan pratinjau/pengajuan, menyelesaikan review bila diwajibkan dan approval, lalu memanggil penerbitan. Pisahkan seri/tahun antar pengujian dan uji idempotensi/konkurensi sesudah semua prasyarat terpenuhi. Pembatalan dan disposisi mengikuti RPC baru, dengan kasus negatif yang memastikan bypass ditolak.

PR-02 mempertahankan SQL test, skrip konkurensi, dan guard penomoran baseline. Wrapper PR-02 hanya menambahkan syarat review; tidak melonggarkan guard. Perbaikan fixture penuh tetap pekerjaan terpisah yang perlu ditinjau; CI PostgreSQL tidak dilaporkan hijau hanya karena reproduksi kegagalan berhasil.

## Perbedaan CI setelah PR-02

CI PR-02 run 44251004155 berhasil menerapkan 16 migrasi. Fixture yang sama lalu tertahan gate kategori/review baru dengan pesan **Pemeriksaan versi terkini belum selesai atau kewenangan berubah.** sebelum guard versi baseline. Karena fixture juga belum menyiapkan kategori/review, penyesuaian fixture pada branch terbaru harus memenuhi kedua prasyarat tersebut. Dua tes reproduksi sengaja dibangun hanya sampai PR-01 agar penyebab baseline tetap terisolasi.
