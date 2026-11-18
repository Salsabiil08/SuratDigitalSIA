# Indeks dokumentasi SIADocs

## Dokumen aktif — R.04 adaptasi NDO (18 November 2026)

| Kebutuhan | Baca |
|---|---|
| Mulai bekerja dan batas persetujuan | [AGENTS.md](../AGENTS.md), [backlog aktif](../tasks/BACKLOG.md) |
| Repo/deployment yang dijadikan baseline | [Baseline production](baselines/production-2026-11-18.md), [manifest](baselines/production-2026-11-18.json) |
| Aturan target dan keputusan reviewer | [08-alur-ndo-r04.md](spec/08-alur-ndo-r04.md) |
| Fitur production yang wajib dipertahankan | [00-revisi-alur.md](spec/00-revisi-alur.md), baseline |
| Rencana database, PR dan uji penerimaan | [R04_NDO_MIGRATION_PLAN.md](plans/R04_NDO_MIGRATION_PLAN.md) |
| Perubahan dan validasi PR-02 | [PR02_VALIDATION.md](plans/PR02_VALIDATION.md), [investigasi fixture baseline](plans/PR02_BASELINE_FIXTURE_INVESTIGATION.md) |
| Perubahan dan validasi PR-01 | [PR01_VALIDATION.md](plans/PR01_VALIDATION.md) |
| Perubahan dan validasi PR-00 | [PR00_VALIDATION.md](plans/PR00_VALIDATION.md) |
| Temuan dan keterbatasan | [FINDINGS.md](FINDINGS.md), [laporan tes baseline](REVISION_TEST_REPORT.md) |

**Urutan acuan:** keputusan pengguna terbaru → spesifikasi target 08 + revisi production 00 → invarian SIA dari Blueprint R.03 yang tidak direvisi. NDO menjadi referensi alur; tidak seluruh fiturnya diadopsi. Kode/migrasi menjelaskan implementasi aktual, bukan bukti target sudah selesai.

## Sumber referensi

- Blueprint R.03 tersimpan di [arsip R.03](arsip-R03/README.md). Baca bagian yang relevan untuk invarian SIA; penyebutan arsip tidak membatalkan aturan yang tetap dipertahankan di dokumen target.
- [User Guide NDO Enhancement](https://chatgpt.com/library?file_id=libfile_29f6318c60e481919e64e95e1aef50b7&account_id=personal): reviewer §2.4.7, approval §2.4.8, receive/reply §2.4.9–10, disposisi §2.4.12, relasi §2.4.26.
- [Audit GAP 18 November](https://chatgpt.com/library?file_id=libfile_463a79354cd08191b250893e16a9fd2f&account_id=personal): 25 area, beserta bukti dan pembagian PR. Keputusan pengguna setelah audit dicatat dalam spesifikasi 08; usulan audit yang sudah diputuskan tidak perlu ditanyakan ulang.

## Dokumen historis / panduan lama

`docs/spec/01` sampai `07`, `docs/perubahan-R03-ke-R04.md`, PDF/DOCX `docs/blueprint/Blueprint_R04_SIADocs.*`, `ANTIGRAVITY.md` dan salinannya di `.agent/rules/` memuat rancangan R.04 lama. Batasan lama yang meniadakan editor, penyisipan nomor tervalidasi, gambar TTD/stempel, pengiriman, Kotak Masuk atau pemeriksaan hasil disposisi tidak mengalahkan keputusan terbaru. Blueprint biner tidak ditulis ulang oleh PR-00.

Dokumen lama dipertahankan untuk jejak sejarah; gunakan penanda dan tautan aktif sebelum menjadikannya aturan implementasi. Klaim checklist/tes terdahulu harus dinilai terhadap cakupan dan bukti waktunya.
