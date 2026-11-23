import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateLetterDocx } from '../src/lib/docx-generator';

describe('Docx Generator with Master Kop Surat & Font SIG', () => {
  it('berhasil menghasilkan berkas Word (.docx) dengan kop surat resmi SIG', async () => {
    const buffer = await generateLetterDocx({
      officialNumber: '00115-IN/ACH/SIA/11.2026',
      subject: 'Undangan Rapat Kerja Triwulan',
      recipientName: 'Siti Rahma',
      recipientOrg: 'SM Finance',
      contentHtml: '<p>Dengan ini kami mengundang Bapak/Ibu untuk hadir pada rapat <b>evaluasi anggaran</b>.</p><p style="text-align: right">Catatan: Tepat waktu.</p>',
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(50000); // Master template memiliki aset grafis kop > 100KB

    // Verifikasi berkas DOCX merupakan ZIP yang valid
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('word/document.xml')).not.toBeNull();
    expect(zip.file('word/header1.xml')).not.toBeNull(); // Kop surat asli tetap ada
    expect(zip.file('word/footer1.xml')).not.toBeNull(); // Footer surat asli tetap ada

    // Verifikasi naskah di document.xml
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('00115-IN/ACH/SIA/11.2026');
    expect(docXml).toContain('Undangan Rapat Kerja Triwulan');
    expect(docXml).toContain('Siti Rahma');
    expect(docXml).toContain('evaluasi anggaran');
    expect(docXml).toContain('SIG Text');

    // Verifikasi fontTable.xml memuat font SIG Text
    const fontTableXml = await zip.file('word/fontTable.xml')!.async('string');
    expect(fontTableXml).toContain('SIG Text');
  });

  it('dapat menghasilkan template kop kosong dengan benar', async () => {
    const buffer = await generateLetterDocx({});
    expect(buffer).toBeDefined();

    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('PT SEMEN INDONESIA ACEH');
  });

  it('menghasilkan ruang tanda tangan sesuai jumlah penandatangan (0 TTD, 1 TTD, 2 TTD)', async () => {
    // 0 TTD: Surat Internal
    const buf0 = await generateLetterDocx({
      officialNumber: '00115-IN/ACH/SIA/11.2026',
      signatureCount: 0,
      signerName: 'Rina Dewi',
      signerTitle: 'Staff Accounting',
    });
    const zip0 = await JSZip.loadAsync(buf0);
    const docXml0 = await zip0.file('word/document.xml')!.async('string');
    expect(docXml0).not.toContain('Unit Pengirim,');
    expect(docXml0).not.toContain('Rina Dewi');
    expect(docXml0).not.toContain('Staff Accounting');
    expect(docXml0).not.toContain('{{SIGNATURE_');
    expect(docXml0).not.toContain('{{STAMP}}');
    expect(docXml0).toContain('00115-IN/ACH/SIA/11.2026');

    // 1 TTD: Surat Eksternal
    const buf1 = await generateLetterDocx({
      officialNumber: '00317/KRE.DIR/11.2026',
      signatureCount: 1,
      signerName: 'Budi Hartono',
      signerTitle: 'Direktur Utama',
    });
    const zip1 = await JSZip.loadAsync(buf1);
    const docXml1 = await zip1.file('word/document.xml')!.async('string');
    expect(docXml1).toContain('Hormat kami,');
    expect(docXml1).toContain('Budi Hartono');
    expect(docXml1).toContain('Direktur Utama');

    // 2 TTD: Surat Pengantar Tagihan
    const buf2 = await generateLetterDocx({
      officialNumber: '00117-Tag/FIN/SIA/11.2026',
      signatureCount: 2,
      signers: [
        { name: 'Siti Rahma', title: 'Senior Manager Finance', role: 'Disiapkan / Diverifikasi oleh,' },
        { name: 'Budi Hartono', title: 'Direktur Utama', role: 'Mengetahui / Menyetujui,' },
      ],
    });
    const zip2 = await JSZip.loadAsync(buf2);
    const docXml2 = await zip2.file('word/document.xml')!.async('string');
    expect(docXml2).toContain('Disiapkan / Diverifikasi oleh,');
    expect(docXml2).toContain('Siti Rahma');
    expect(docXml2).toContain('Mengetahui / Menyetujui,');
    expect(docXml2).toContain('Budi Hartono');
  });
});
