# Impor surat sederhana — keputusan pengguna 24 November 2026

Impor: unggah PDF/DOCX dahulu, isi metadata pencatatan, pilih pengesahan, pratinjau, persetujuan bila diperlukan, nomor eksplisit, lalu TTD/unduh. Tidak ada editor isi maupun pengisian ulang rincian pembayaran pada jalur UPLOAD. Buat Surat (CREATE) tetap menyusun isi dan memvalidasi rincian lengkap.

- Impor tagihan tetap khusus unit Finance, dua penyetuju/penandatangan SM lalu Direktur, dan lampiran bukti wajib. Tanpa membuat data bank/rekening/nominal palsu untuk memenuhi schema. Data rincian historis tidak dihapus.
- PDF tetap membutuhkan area nomor tervalidasi. Area TTD hanya wajib pada jalur IN_APP; EXTERNAL memakai penandatanganan di luar aplikasi. DOCX tetap membutuhkan penanda nomor yang disiapkan dalam dokumen. Tidak ada OCR atau penempatan nomor sembarangan.
- API dokumen tidak menerapkan koreksi tata letak legacy pada UPLOAD. Snapshot asli dan hash tetap diverifikasi; materialisasi hanya pada tempat nomor/TTD yang disiapkan.
- Tidak ada perubahan nomor lama, dokumen final, persetujuan, pengiriman, atau kewenangan pemeriksa.

Migrasi: 20261124133555_simplify_uploaded_billing.sql. Terapkan sebelum frontend. Verifikasi lokal: typecheck dan 359 tes lulus, termasuk impor tanpa rincian, validasi CREATE, urutan persetujuan, lampiran, serta larangan penyesuaian format impor. UAT lintas akun nyata tidak diklaim.

Verifikasi hosted: hash agregat surat, versi dokumen, billing_details, dan billing_items serta jumlah audit tetap sama sebelum/sesudah migrasi. Hak eksekusi langsung authenticated pada core tetap ditolak.
