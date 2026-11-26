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

it.runIf(!!process.env.SIADOCS_TEST_PDF)('renders the numbered tagihan with both signature assets and distinct row banks',async()=>{
  const {applyDocumentImages}=await import('../src/lib/letter-document');
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  const draft=await generateLetterDocx({
    r05:{kind:'BILLING',senderName:'SM Finance',senderTitle:'Senior Manager'},
    officialNumber:'0201-Tag/FIN/SIA/11.2026',letterDate:'27 November 2026',
    signatureCount:2,signaturePlaceholders:true,
    signers:[{name:'Pengaju Finance',title:'Senior Manager'},{name:'Penyetuju',title:'Direktur Utama'}],
    billing:{
      fromTitle:'SM Finance & Accounting',toTitle:'Direktur Utama',
      bankName:'Bank A',accountHolder:'Penerima A',accountNumber:'001',
      items:[
        {documentNumber:'SAP-1',description:'Rincian A',amount:1000,bankName:'Bank A',accountNumber:'001'},
        {documentNumber:'SAP-2',description:'Rincian B',amount:2000,bankName:'Bank B',accountNumber:'002'},
      ],
    },
  });
  const signed=await applyDocumentImages(draft,'DOCX',[
    {marker:'{{SIGNATURE_1}}',bytes:image},{marker:'{{STAMP_1}}',bytes:image},
    {marker:'{{SIGNATURE_2}}',bytes:image},
  ]);
  const pdf=await PDFDocument.load(await renderFinalPdf(signed));
  expect(pdf.getPageCount()).toBe(1);
},45000);
