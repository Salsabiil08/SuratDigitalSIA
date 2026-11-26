import JSZip from 'jszip';
import { expect, it } from 'vitest';
import { generateLetterDocx, type LetterDocxData } from '../src/lib/docx-generator';

async function documentXml(data: LetterDocxData) {
  const zip = await JSZip.loadAsync(await generateLetterDocx(data));
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

it('renders internal official sender and user-written content without default greetings', async () => {
  const xml = await documentXml({
    r05: { kind: 'INTERNAL', senderName: 'Pengirim Resmi', senderTitle: 'General Manager' },
    letterDate: '27 November 2026', signatureCount: 0, contentText: 'Isi buatan pengguna.',
  });
  expect(xml).toContain('Pengirim Resmi');
  expect(xml).toContain('27 November 2026');
  expect(xml).toContain('Isi buatan pengguna.');
  expect(xml).not.toMatch(/Dengan hormat|Demikian|Aceh Besar|SIGNATURE_/);
});

it('formats the external city and date together', async () => {
  const xml = await documentXml({
    r05: { kind: 'EXTERNAL', city: 'Banda Aceh', senderName: 'Pejabat', senderTitle: 'Direktur Utama' },
    letterDate: '27 November 2026', signatureCount: 1,
  });
  expect(xml).toContain('Banda Aceh, 27 November 2026');
  expect(xml).not.toMatch(/Dengan hormat|Demikian/);
});

it('uses neutral wording for multiple banks and keeps director on the left', async () => {
  const xml = await documentXml({
    r05: { kind: 'BILLING', senderName: 'Pejabat SM', senderTitle: 'SM Finance & Accounting' },
    signatureCount: 2, signaturePlaceholders: true,
    signers: [{ name: 'Pejabat SM', title: 'Senior Manager' }, { name: 'Pejabat DIR', title: 'Direktur Utama' }],
    billing: {
      bankName: 'Bank Pertama', accountNumber: '', accountHolder: '', fromTitle: 'SM Finance & Accounting', toTitle: 'Direktur Utama',
      items: [
        { documentNumber: 'SAP-1', description: 'Biaya A', amount: 500, bankName: 'Bank Pertama' },
        { documentNumber: 'SAP-2', description: 'Biaya B', amount: 1500, bankName: 'Bank Kedua' },
      ],
    },
  });
  expect(xml).toContain('No Document');
  expect(xml).toContain('melalui bank sesuai rincian berikut');
  expect(xml).toContain('Bank Kedua');
  expect(xml.indexOf('{{SIGNATURE_2}}')).toBeLessThan(xml.indexOf('{{SIGNATURE_1}}'));
});
