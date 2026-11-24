import {it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {generateLetterDocx} from '../src/lib/docx-generator';
import {inspectDocument,applyDocumentImages,fillOfficialNumber} from '../src/lib/letter-document';
import {validateBillingItems} from '../src/domain/billing';
const item={documentNumber:'1900000110',description:'Biaya operasional pengurusan perpanjangan IUP OP kegiatan MPP Peduli Layanan Terpadu',payeeName:'Penerima Pengujian',bankName:'BSI',accountNumber:'7636363008',amount:10000000};
it('renders payment request metadata, a seven-column table and correctly mapped signature slots',async()=>{
 const bytes=await generateLetterDocx({officialNumber:'{{OFFICIAL_NUMBER}}',subject:'Permintaan Pembayaran',letterDate:'23 November 2026',signatureCount:2,signaturePlaceholders:true,
 signers:[{name:'Pejabat SM Uji',title:'SM Finance & Accounting'},{name:'Pejabat Direktur Uji',title:'Direktur Utama'}],
 billing:{bankName:'Bank Mandiri',accountNumber:item.accountNumber,accountHolder:item.payeeName,fromTitle:'SM Finance & Accounting PT Semen Indonesia Aceh',toTitle:'Direktur Utama PT Semen Indonesia Aceh',items:[item]}});
 await inspectDocument(bytes,'DOCX',2,[],true);
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')!.async('string');
 for(const label of ['SURAT PENGANTAR TAGIHAN','Kepada Yth','Dari','Tanggal','No Dokumen','Keterangan','Penerima','Bank','No Rekening','Nominal (Rp)','1900000110','BSI','10.000.000','Sepuluh juta rupiah'])expect(xml).toContain(label);
 expect(xml).toContain('<w:tcBorders>');expect(xml).toContain('w:color="333333"');expect(xml).toContain('w:fill="FFFFFF"');
 expect(xml).not.toContain('di Tempat');expect(xml).not.toContain('Rincian tagihan:');
 expect(xml.indexOf('Disetujui oleh,')).toBeLessThan(xml.indexOf('Diajukan oleh,'));
 expect(xml.indexOf('{{SIGNATURE_2}}')).toBeLessThan(xml.indexOf('{{SIGNATURE_1}}'));
 expect(xml.split('{{STAMP}}')).toHaveLength(2);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const first=await applyDocumentImages(bytes,'DOCX',[{marker:'{{SIGNATURE_1}}',bytes:png},{marker:'{{STAMP}}',bytes:png}]);
 const firstXml=await (await JSZip.loadAsync(first)).file('word/document.xml')!.async('string');expect(firstXml).toContain('{{SIGNATURE_2}}');expect(firstXml).not.toContain('{{SIGNATURE_1}}');
 const signed=await applyDocumentImages(first,'DOCX',[{marker:'{{SIGNATURE_2}}',bytes:png}]);
 expect(await (await JSZip.loadAsync(signed)).file('word/document.xml')!.async('string')).not.toMatch(/\{\{SIGNATURE_/);
 await mkdir('test-results/billing',{recursive:true});await writeFile('test-results/billing/payment-request.docx',await fillOfficialNumber(bytes,'DOCX','073-Tag/FIN/SIA/11.2026',false));
});
it('accepts one complete payment, rejects zero, missing fields, nonfinite and negative amounts',()=>{
 expect(()=>validateBillingItems([item])).not.toThrow();
 for(const items of [[],[{...item,documentNumber:''}],[{...item,amount:NaN}],[{...item,amount:-1}],[{...item,payeeName:''}]])expect(()=>validateBillingItems(items)).toThrow();
});
it('escapes payment data and retains distinct beneficiaries in multiple rows',async()=>{
 const bytes=await generateLetterDocx({signatureCount:2,billing:{bankName:'Bank',accountNumber:'1',accountHolder:'A',fromTitle:'SM',toTitle:'Direktur',items:[item,{...item,documentNumber:'DOK-2',description:'A & B <uji>',payeeName:'Penerima kedua',accountNumber:'000045',amount:2000000}]}});
 const xml=await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string');expect(xml).toContain('A &amp; B &lt;uji&gt;');expect(xml).toContain('Penerima kedua');expect(xml).toContain('000045');expect(xml).toContain('12.000.000');
});
