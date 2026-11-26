import type { LetterDocxData } from './docx-generator';
import { richTextDocx } from './rich-docx';
import { terbilangRupiah } from '../domain/terbilang';

const xml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function paragraph(text: string, opts: {bold?:boolean;italic?:boolean;center?:boolean;underline?:boolean;size?:number;after?:number} = {}) {
  return `<w:p><w:pPr>${opts.center?'<w:jc w:val="center"/>':''}<w:spacing w:after="${opts.after??120}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="SIG Text" w:hAnsi="SIG Text"/><w:sz w:val="${opts.size??22}"/>${opts.bold?'<w:b/>':''}${opts.italic?'<w:i/>':''}${opts.underline?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}
function cell(text: string,width:number,bold=false){return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders>${['top','bottom','left','right'].map(e=>`<w:${e} w:val="single" w:sz="4" w:color="333333"/>`).join('')}</w:tcBorders><w:shd w:fill="FFFFFF"/></w:tcPr>${paragraph(text,{size:18,bold,after:50})}</w:tc>`;}
export function billingLetterBody(data: LetterDocxData, sectPr: string) {
  const b=data.billing!;
  const widths=[400,1100,2700,1300,900,1600,1497];
  const grid=widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('');
  const headers=['No',data.r05?'No Document':'No Dokumen','Keterangan','Penerima','Bank','No Rekening','Nominal (Rp)'];
  const rows=b.items.map((item,i)=>`<w:tr>${[String(i+1),item.documentNumber||'',item.description,item.payeeName||b.accountHolder,item.bankName||b.bankName,item.accountNumber||b.accountNumber,item.amount.toLocaleString('id-ID',{maximumFractionDigits:2})].map((v,j)=>cell(v,widths[j]!)).join('')}</w:tr>`).join('');
  const borders=['top','left','bottom','right','insideH','insideV'].map(edge=>`<w:${edge} w:val="single" w:sz="4" w:color="333333"/>`).join('');
  const table=`<w:tbl><w:tblPr><w:tblW w:w="9497" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h,i)=>cell(h,widths[i]!,true)).join('')}</w:tr>${rows}</w:tbl>`;
  const meta: [string,string][]=[['Kepada Yth',b.toTitle],['Dari',b.fromTitle],['Tanggal',data.letterDate||''],['Perihal',data.subject||'Permintaan Pembayaran']];
  const metadata=`<w:tbl><w:tblPr><w:tblW w:w="9497" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(e=>`<w:${e} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1900"/><w:gridCol w:w="7597"/></w:tblGrid>${meta.map(([label,value])=>`<w:tr><w:tc><w:tcPr><w:tcW w:w="1900" w:type="dxa"/></w:tcPr>${paragraph(label,{after:30})}</w:tc><w:tc><w:tcPr><w:tcW w:w="7597" w:type="dxa"/></w:tcPr>${paragraph(': '+value,{after:30,bold:label==='Perihal'})}</w:tc></w:tr>`).join('')}</w:tbl>`;
  function signature(index:number,label:string){
    const signer=data.signers?.[index];
    // Spatial order differs from approval order: DIR left (slot 2), SM right (slot 1).
    const marker=data.signaturePlaceholders?`<w:p><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr>${index===0?'<w:r><w:t>{{STAMP}}</w:t></w:r>':''}<w:r><w:t>{{SIGNATURE_${index+1}}}</w:t></w:r></w:p>`:'<w:p><w:pPr><w:spacing w:after="900"/></w:pPr></w:p>';
    return `<w:tc><w:tcPr><w:tcW w:w="4748" w:type="dxa"/></w:tcPr>${paragraph(label)}${marker}${paragraph(signer?.name||'[Nama pejabat]',{bold:true,after:20})}${paragraph(signer?.title||'[Jabatan]',{after:0})}</w:tc>`;
  }
  const signatures=`<w:tbl><w:tblPr><w:tblW w:w="9497" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(e=>`<w:${e} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4748"/><w:gridCol w:w="4749"/></w:tblGrid><w:tr>${signature(1,'Disetujui oleh,')}${signature(0,'Diajukan oleh,')}</w:tr></w:tbl>`;
  const banks = new Set(b.items.map(item => (item.bankName || b.bankName).trim()).filter(Boolean));
  const paymentIntroduction = banks.size === 1
    ? `Mohon dapat disetujui pembayaran melalui ${[...banks][0]}, sebagai berikut:`
    : 'Mohon dapat disetujui pembayaran melalui bank sesuai rincian berikut:';
  const content=data.r05 ? paragraph(paymentIntroduction) : data.contentHtml?richTextDocx(data.contentHtml):paragraph(data.contentText||`Mohon dapat disetujui pembayaran melalui ${b.bankName}, sebagai berikut:`);
  const total=b.items.reduce((sum,item)=>sum+Math.round(item.amount*100),0)/100;
  return `<w:body>${paragraph('SURAT PENGANTAR TAGIHAN',{center:true,bold:true,underline:true,after:30})}${paragraph('No: '+(data.officialNumber||'{{OFFICIAL_NUMBER}}'),{center:true,after:300})}${metadata}<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4"/></w:pBdr><w:spacing w:after="300"/></w:pPr></w:p>${paragraph('Dengan hormat,')}${content}${table}${paragraph('Total: Rp '+total.toLocaleString('id-ID',{maximumFractionDigits:2}),{bold:true,after:180})}${paragraph('Terbilang: “'+terbilangRupiah(total)+'”',{bold:true,italic:true,after:220})}${paragraph('Demikianlah disampaikan, atas perhatiannya diucapkan terima kasih.',{after:400})}${signatures}${sectPr}</w:body>`;
}
