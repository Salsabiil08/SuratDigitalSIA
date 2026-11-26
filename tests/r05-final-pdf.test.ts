import {expect,it,vi} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {generateLetterDocx} from '../src/lib/docx-generator';
vi.mock('@/server/letter-workflow',async()=>{
  const {createHash}=await import('node:crypto');
  return {hashBytes:(input:Uint8Array)=>createHash('sha256').update(input).digest('hex')};
});
import {renderFinalPdf} from '../src/server/render-final-pdf';

it.runIf(!!process.env.SIADOCS_TEST_PDF)('renders a numbered DOCX to an A4 PDF in Chromium',async()=>{
  const doc=await generateLetterDocx({
    r05:{kind:'INTERNAL',senderName:'Pengirim Uji',senderTitle:'Direktur Utama'},
    officialNumber:'0101-IN/ACH/SIA/11.2026',letterDate:'27 November 2026',
    signatureCount:0,subject:'Pengujian dokumen',contentText:'Isi surat yang harus tampil.',
  });
  const pdf=await PDFDocument.load(await renderFinalPdf(doc));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(590);
  expect(pdf.getPage(0).getWidth()).toBeLessThan(600);
},45000);
