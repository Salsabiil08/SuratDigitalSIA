# Baseline production SIADocs — 18 November 2026

Status: **baseline terkunci untuk PR-00**, bukan klaim target R.04 adaptasi NDO telah diimplementasikan.

| Identitas | Nilai |
|---|---|
| Repository yang disetujui | `Salsabiil08/SuratDigitalSIA` |
| Baseline main/production | `4e0c0c661af58dd6db729c202643cd6629f7eb07` |
| Tree baseline | Lihat [manifest](production-2026-11-18.json) |
| Website | https://suratdigital-sig.vercel.app/ |
| Project Vercel | `suratdigital-sig` / `prj_2MolQrrsOlzIjJgg3cZDphrv9O4u` |
| Deployment terverifikasi sebelum PR-00 | `dpl_4aVP7FGF4i9eJhqARNu65dZtckZc`, production READY, source repo dan SHA sesuai baseline |
| Supabase yang terkait | `ixrpdgkrxlsxbwttujvz` |
| Branch PR-00 | `docs/pr-00-r04-ndo-baseline`, diturunkan dari SHA baseline |
| Repo `Salsabiil08/SIAdocs` | Tidak menjadi basis dan tidak direkonsiliasi saat ini |

SHA baseline tidak diganti dengan SHA commit dokumentasi PR-00. Tree sumber/runtime dan digest migrasi pada manifest memungkinkan peninjau memeriksa bahwa PR-00 tidak mengubah aplikasi atau migrasi. Manifest tidak memuat secret, kredensial, isi surat, atau dump data production.

## Fitur yang dilindungi

- Login email/sandi nyata; akun demo/dropdown dihapus.
- Dashboard dan identitas visual SIADocs; formulir berbahasa Indonesia.
- Draft, editor format dan pratinjau, koreksi/versi, impor PDF/DOCX tervalidasi; data awal halaman dari server.
- Internal/eksternal/tagihan dengan ketentuan SIA, SM lintas organisasi.
- Persetujuan nyata per akun/versi; penerbitan nomor eksplisit, atomik/idempoten, tanggal nomor WIB.
- Dua jalur pengesahan, gambar TTD/unggahan basah, stempel opsional, hash dan Storage privat; bukan TTE tersertifikasi.
- Penguncian dokumen final, pembatalan berotorisasi dan audit append-only.
- Disposisi dua arah: hasil → pemeriksaan pemberi → perbaikan/penerimaan.

## Bukti audit dan batasnya

Audit terdahulu pada SHA baseline: 69 tes lulus (20 kasus database PGlite dan 49 domain/dokumen). GET website dan unduh DOCX privat juga diperiksa; log E2E terdahulu mencatat alur surat dan disposisi. Ini berbeda dari UAT lintas peran target baru. Hasil pemeriksaan yang diulang khusus PR-00 dicatat di [PR00_VALIDATION.md](../plans/PR00_VALIDATION.md).

Snapshot metadata saat audit: 22 surat, 21 bernomor, 8 dokumen final, 0 baris distribusi, 2 disposisi DONE, tanpa nomor duplikat yang ditemukan. **13 surat bernomor belum mempunyai versi dokumen tersimpan.** Angka ini merupakan bukti waktu audit, bukan SELECT baru atau perintah memperbarui data pada PR-00. Jangan menganggap data uji sebagai bukti transaksi perusahaan.

History migrasi production yang diamati memuat 8 revisi (lihat manifest); repository memiliki 14 file termasuk enam baseline lama. Tabel baseline sudah ada. Selisih history tidak membuktikan enam migrasi awal belum diterapkan dan bukan izin menjalankannya ulang atau melakukan migration repair.

## GAP tetap terbuka

Reviewer independen/kebijakan kategori, approver tambahan, self-signer duplikat, pengiriman/Kotak Masuk/penerimaan, balasan resmi berelasi, pemisahan “dokumen final” dari “selesai alur”, dan akses penerima sebelum pengiriman belum diperbaiki oleh PR-00. Notifikasi berkode, helper notifikasi tanpa guard, dan ringkasan penerbitan lama yang statis juga masih temuan, bukan pekerjaan PR-00.

Dokumen audit: [Audit GAP R.04](https://chatgpt.com/library?file_id=libfile_463a79354cd08191b250893e16a9fd2f&account_id=personal). Keputusan yang menyelesaikan pertanyaan audit sudah dicatat di [spesifikasi target](../spec/08-alur-ndo-r04.md).

## Pengaman PR-00

`vercel.json` hanya mematikan deployment otomatis untuk nama branch PR-00. Main dan pengaturan project production tidak diubah. Dasar konfigurasi: [Vercel git.deploymentEnabled](https://vercel.com/docs/project-configuration/git-configuration). Verifikasi tidak ada deployment untuk SHA/branch PR-00 dilakukan setelah branch/PR dibuka; PR tetap tidak di-merge.
