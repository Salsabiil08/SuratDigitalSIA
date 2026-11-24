import {PDFDocument,StandardFonts} from 'pdf-lib';import {writeFileSync,mkdirSync} from 'node:fs';
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
for(let i=0;i<2;i++){const page=doc.addPage([595,842]);page.drawText('SIADocs - PDF uji tanpa data pengguna',{x:45,y:790,size:16,font});page.drawText('Halaman '+(i+1),{x:45,y:755,size:12,font});}
mkdirSync('test-results/pdf-placement',{recursive:true});writeFileSync('test-results/pdf-placement/fixture.pdf',await doc.save());
