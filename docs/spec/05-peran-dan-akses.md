# Peran dan Hak Akses

Akses ditegakkan di database (RLS, `supabase/migrations/20261111000004_rls.sql`) dan di server. Menyembunyikan tombol saja tidak cukup.

| Pihak | Melihat | Tindakan |
|---|---|---|
| Pembuat | seluruh status surat miliknya | ubah draft atau `REVISION_REQUESTED`; ajukan; tarik kembali; terbitkan nomor bila berwenang; unduh; batalkan draft; ajukan pembatalan surat bernomor; salin surat `REJECTED` |
| Penyetuju aktif | sejak surat diajukan kepadanya | Setujui, Minta Revisi, Tolak dengan catatan; tidak mengedit isi |
| Pejabat penandatangan | sejak surat melibatkannya | persetujuan final bila namanya dipakai; unduh dokumen bernomor; unggah dokumen bertanda tangan (hanya jalur `IN_APP`); otorisasi pembatalan sesuai kewenangan |
| Pemegang otorisasi pembatalan | surat yang dimohonkan | setujui atau tolak permohonan pembatalan |
| Pemberi dan penerima disposisi | surat terkait disposisi | penerima ubah status disposisi; pemberi lihat status |
| Super Admin | Log History (metadata audit); tidak otomatis isi dokumen | kelola master, seri, pengaturan; tidak edit isi, tidak batalkan atas nama pejabat |

- Tidak ada unggah gambar tanda tangan atau stempel pada profil.
- Riwayat surat (persetujuan, versi, penerbitan) dapat dilihat pengguna berwenang melalui Detail Surat. Halaman Log History khusus Super Admin.
- Pembuat Surat Pengantar Tagihan: pengguna aktif yang ditugaskan pada unit Finance.
- Hak akses dibatasi pada keterlibatan pada surat dan cakupan unit.
