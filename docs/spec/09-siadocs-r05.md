# SIADocs R.05

Keputusan pembina pada permintaan R.05 adalah acuan implementasi aktif. Aturan R.04 yang berbeda tetap menjadi riwayat dan aturan untuk dokumen yang sudah final.

| Jenis | Pengirim resmi dan persetujuan | Pengesahan |
| --- | --- | --- |
| Internal | Pembuat untuk penerima setara atau di bawahnya. Untuk penerima lebih tinggi, pejabat dalam hierarki pembuat pada level penerima menjadi pengirim dan penyetuju. Pengirim tidak boleh sama dengan penerima. Jika tidak ada kandidat sah, pengajuan diblokir. | Tanpa TTD dan stempel |
| Eksternal | Pengirim resmi SM atau Dirut sekaligus penyetuju. Pengirim yang juga pembuat mengonfirmasi finalisasi dan TTD. | Satu TTD melalui Setujui & Tanda Tangani, stempel opsional |
| Tagihan | Finance saja. SM Finance & Accounting mengajukan, lalu Dirut menyetujui. Lampiran wajib. | Dua TTD melalui SIADocs, stempel opsional |

Kategori tidak menentukan tahap review. Penyetuju memeriksa isi, memberi catatan, meminta revisi, menyetujui, atau menolak. Revisi memerlukan versi naskah baru. Dari persetujuan terakhir atau konfirmasi finalisasi (surat tanpa persetujuan), nomor existing diterbitkan satu kali, lalu TTD yang sudah diotorisasi dipasang. Simpan PDF final hanya jika semua pengesahan dan pembuatan dokumen berhasil. Pengiriman tetap tindakan tersendiri.

Master kop, tanda tangan, stempel, bank, dan rekening memakai infrastruktur existing. Aset dan rekening dibatasi aksesnya. Register membaca penerbitan nomor beserta pembatalan, dengan filter dan ekspor Excel. Ambil Nomor mempertahankan dokumen impor serta memvalidasi perubahan yang diperlukan untuk penomoran dan pengesahan.

## Progres cabang feat/r05

- R05-01: From internal/eksternal terhubung melalui form, server, migrasi, dan perencanaan persetujuan. Surat internal R.05 tanpa aset pengesahan, dan hanya From yang dapat mengirim. Pengesahan gabungan eksternal serta uji browser lintas akun masih diperlukan.
- R05-02: jalur render DOCX R.05 untuk internal/eksternal tersedia. Master, otorisasi, dan PDF final masih diperlukan.
- R05-03: Form tagihan mendukung tujuan pembayaran bersama atau isi bank/rekening per rincian. DOCX baru memakai format tabel dan kalimat bank tunggal/jamak. Master rekening Finance dan pilihan rekening tersimpan terhubung. Pengelolaan kode bank serta penguncian dua tindakan pengesahan masih diperlukan.
- R05-04: Register terhubung ke nomor terbit dan nomor batal, dengan pencarian, filter, dan ekspor XLSX. Penomoran otomatis dan finalisasi PDF masih diperlukan.
- R05-05: jangan promosikan cabang ini ke produksi sebelum seluruh tahap dan pengujian alur selesai.
