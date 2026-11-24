import JSZip from 'jszip';
import {parseDocument} from 'htmlparser2';
import {Element,type AnyNode} from 'domhandler';

const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const p=(value:string,bold=false,center=false)=>`<w:p><w:pPr>${center?'<w:jc w:val="center"/>':''}<w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="SIG Text" w:hAnsi="SIG Text"/><w:sz w:val="22"/>${bold?'<w:b/>':''}${bold&&center?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${escape(value)}</w:t></w:r></w:p>`;
const elements=(node:AnyNode):Element[]=>'children' in node?node.children.filter((n):n is Element=>n instanceof Element):[];
function find(node:AnyNode,name:string):Element|undefined{for(const child of elements(node)){if(child.name===name)return child;const found=find(child,name);if(found)return found;}}
function text(node:AnyNode|undefined):string {if(!node)return '';if(node instanceof Element&&node.name==='w:t')return node.children.map(c=>'data' in c?c.data:'').join('');return elements(node).map(text).join('');}
const widths=[400,1200,2400,1200,1200,1600,1497];
function table(rows:string[][],columns:number[]=widths,borders=true){return `<w:tbl><w:tblPr><w:tblW w:w="9497" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','bottom','left','right','insideH','insideV'].map(e=>`<w:${e} w:val="${borders?'single':'nil'}" w:sz="4"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${columns.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((row,i)=>`<w:tr>${row.map((value,j)=>`<w:tc><w:tcPr><w:tcW w:w="${columns[j]}" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>${borders?p(value,i===0).replace('w:val="22"','w:val="18"').replace('w:after="120"','w:after="50"'):p(value)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;}
function cents(value:string){if(!/^\d[\d.]*(?:,\d{1,2})?$/.test(value))return null;const [whole,fraction='']=value.replaceAll('.','').split(',');return BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));}

/** Presentation-only correction of the recognized old billing template. Original evidence is untouched. */
export async function correctLegacyBillingOutput(bytes:Uint8Array,letter:{type?:{category?:string};required_signature_count?:number},format:string):Promise<{bytes:Uint8Array;corrected:boolean}>{
 const original={bytes,corrected:false};
 if(format!=='DOCX'||letter.type?.category!=='BILLING'||letter.required_signature_count!==2)return original;
 const zip=await JSZip.loadAsync(bytes),part=zip.file('word/document.xml');if(!part)return original;
 const xml=await part.async('string');
 if(!xml.includes('<!-- 2 Tanda Tangan: Surat Penagihan / 2 Pejabat Berdampingan -->'))return original;
 const doc=parseDocument(xml,{xmlMode:true,withStartIndices:true,withEndIndices:true});const body=find(doc,'w:body');if(!body)return original;
 const nodes=elements(body),tables=nodes.filter(n=>n.name==='w:tbl');if(tables.length!==2)return original;
 const raw=(n:AnyNode)=>n.startIndex!=null&&n.endIndex!=null?xml.slice(n.startIndex,n.endIndex+1):'';
 const meta=tables[0]!,signature=tables[1]!;
 const rows=elements(meta).filter(n=>n.name==='w:tr');if(rows.length!==3)return original;const first=elements(rows[0]!).filter(n=>n.name==='w:tc'),last=elements(rows[2]!).filter(n=>n.name==='w:tc');
 if(first.length!==4||last.length!==3||text(first[0]!)!=='Nomor'||text(last[0]!)!=='Perihal')return original;
 const paragraphs=nodes.filter(n=>n.name==='w:p'),words=paragraphs.map(n=>text(n).trim());
 const hello=words.indexOf('Dengan hormat,'),details=words.indexOf('Rincian tagihan:'),total=words.findIndex(w=>/^Total: Rp /.test(w)),bank=words.findIndex(w=>/^Bank: /.test(w)),account=words.findIndex(w=>/^Rekening: /.test(w));
 if(hello<0||details<=hello||total<=details||bank<=total||account<=bank)return original;
 const accountMatch=words[account]!.match(/^Rekening:\s*(.*?)\s+a\.n\.\s+(.+)$/);if(!accountMatch)return original;
 const totalMatch=words[total]!.match(/^Total: Rp ([\d.,]+)\s*\((.+)\)$/);if(!totalMatch)return original;
 const lines=words.slice(details+1,total).filter(Boolean).map(w=>w.match(/^(\d+)\.\s+(.+): Rp ([\d.,]+)$/));
 if(!lines.length||lines.length>100||lines.some((m,i)=>!m||Number(m[1])!==i+1||cents(m[3]!)===null))return original;
 const totalValue=cents(totalMatch[1]!);if(totalValue===null||lines.reduce((sum,m)=>sum+cents(m![3]!)!,0n)!==totalValue)return original;
 const signatureRow=elements(signature).find(n=>n.name==='w:tr');if(!signatureRow)return original;
 const cells=elements(signatureRow).filter(n=>n.name==='w:tc');if(cells.length!==3)return original;
 const leftParagraphs=elements(cells[0]!).filter(n=>n.name==='w:p');const rightParagraphs=elements(cells[2]!).filter(n=>n.name==='w:p');
 if(leftParagraphs.length<4||rightParagraphs.length<4||!/Senior Manager|\bSM\b/i.test(text(leftParagraphs[leftParagraphs.length-1]))||!/Direktur/i.test(text(rightParagraphs[rightParagraphs.length-1])))return original;
 if(text(leftParagraphs[0]!)!=='Disiapkan / Diverifikasi oleh,'||text(rightParagraphs[0]!)!=='Mengetahui / Menyetujui,')return original;
 // Move complete existing cells, including their original image relationships and anchors.
 function signatureCell(cell:Element,label:string){const first=elements(cell).find(n=>n.name==='w:p');if(!first)return '';let result=raw(cell).replace(raw(first),p(label)).replace(/w:w="(?:4600|297)"/g,'w:w="4748"');for(const item of elements(cell).filter(n=>n.name==='w:p'))if(text(item)==='PT SEMEN INDONESIA ACEH'&&!raw(item).includes('<w:drawing'))result=result.replace(raw(item),'');return result.replaceAll('<w:jc w:val="center"/>','<w:jc w:val="left"/>');}
 const signatureTable=`<w:tbl><w:tblPr><w:tblW w:w="9497" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4748"/><w:gridCol w:w="4749"/></w:tblGrid><w:tr>${signatureCell(cells[2]!,'Disetujui oleh,')}${signatureCell(cells[0]!,'Diajukan oleh,')}</w:tr></w:tbl>`;
 const recipientStart=words.indexOf('Kepada Yth.');if(recipientStart<0||recipientStart>=hello)return original;
 const recipient=words.slice(recipientStart+1,hello).filter(w=>w&&w!=='di Tempat').join('\n');
 const metadata=table([['Kepada Yth',': '+recipient],['Dari',': '+text(leftParagraphs[leftParagraphs.length-1]!)+' PT Semen Indonesia Aceh'],['Tanggal',': '+text(first[3]!)],['Perihal',': '+text(last[2]!)],['Lampiran',': '+text(elements(rows[1]!).filter(n=>n.name==='w:tc')[2]!) ]],[1900,7597],false);
 const detailsTable=table([['No','No Dokumen','Keterangan','Penerima','Bank','No Rekening','Nominal (Rp)'],...lines.map(m=>[m![1]!,'',m![2]!,accountMatch[2]!,words[bank]!.slice(6),accountMatch[1]!,m![3]!])]);
 const section=nodes.find(n=>n.name==='w:sectPr');if(!section)return original;
 const result=`<w:body>${p('SURAT PENGANTAR TAGIHAN',true,true)}${p('No: '+text(first[2]!),false,true)}${metadata}<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4"/></w:pBdr><w:spacing w:after="200"/></w:pPr></w:p>${paragraphs.slice(hello,details).filter(n=>text(n).trim()).map(raw).join('')}${detailsTable}${p('Total: Rp '+totalMatch[1],true)}${p('Terbilang: '+totalMatch[2],true)}${paragraphs.slice(account+1).filter(n=>text(n).trim()).map(raw).join('')}${signatureTable}${raw(section)}</w:body>`;
 zip.file('word/document.xml',xml.slice(0,body.startIndex!)+result+xml.slice(body.endIndex!+1));
 return {bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),corrected:true};
}
