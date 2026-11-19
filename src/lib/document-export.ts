import type {ExportFormat} from '@/domain/document-export';
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_PAGES=40;
export async function convertDocument(blob:Blob,from:ExportFormat,to:ExportFormat):Promise<Blob>{
  if(from===to)return blob;
  return from==='DOCX'?docxToPdf(blob):pdfToDocx(blob);
}
async function docxToPdf(blob:Blob){
  const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.title='Menyiapkan unduhan surat';
  Object.assign(frame.style,{position:'fixed',left:'-12000px',top:'0',width:'1000px',height:'1000px',border:'0'});document.body.appendChild(frame);
  try{
    const [{renderDocxInFrame},{default:html2canvas},{jsPDF}]=await Promise.all([import('./render-docx-preview'),import('html2canvas'),import('jspdf')]);
    await renderDocxInFrame(blob,frame);
    const doc=frame.contentDocument!;await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(i=>i.decode()));
    const pages=Array.from(doc.querySelectorAll<HTMLElement>('.docx-wrapper>section'));
    if(!pages.length||pages.length>MAX_PAGES)throw new Error(`Konversi mendukung maksimal ${MAX_PAGES} halaman. Unduh format asli untuk dokumen ini.`);
    let pdf:InstanceType<typeof jsPDF>|undefined;
    for(const page of pages){
      const width=page.offsetWidth*0.75,height=page.offsetHeight*0.75;
      if(!width||!height||page.offsetWidth*page.offsetHeight>16000000)throw new Error('Ukuran halaman terlalu besar untuk konversi. Unduh DOCX asli.');
      const orientation=width>height?'landscape':'portrait';
      if(!pdf)pdf=new jsPDF({unit:'pt',format:[width,height],orientation,compress:true});else pdf.addPage([width,height],orientation);
      const canvas=await html2canvas(page,{scale:Math.min(2,2400/Math.max(page.offsetWidth,page.offsetHeight)),backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false});
      pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',0,0,width,height,undefined,'FAST');canvas.width=0;canvas.height=0;
    }
    return pdf!.output('blob');
  }finally{frame.remove();}
}
async function pdfToDocx(blob:Blob){
  const [pdfjs,{default:JSZip}]=await Promise.all([import('pdfjs-dist'),import('jszip')]);
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
  const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true});
  try{
    const pdf=await task.promise;
    if(pdf.numPages>MAX_PAGES)throw new Error(`Konversi mendukung maksimal ${MAX_PAGES} halaman. Unduh PDF asli untuk dokumen ini.`);
    const zip=new JSZip(),sections:string[]=[],relations:string[]=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),size=page.getViewport({scale:1});
      if(size.width>1584||size.height>1584)throw new Error('Ukuran halaman PDF melebihi batas Word. Unduh PDF asli.');
      const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(size.width,size.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvas,viewport}).promise;
      const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Halaman PDF belum dapat dikonversi.')),'image/jpeg',0.96));
      zip.file(`word/media/page${n}.jpg`,await image.arrayBuffer());canvas.width=0;canvas.height=0;page.cleanup();
      relations.push(`<Relationship Id="page${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${n}.jpg"/>`);
      const scale=Math.min(1,(size.height-4)/size.height),cx=Math.round(size.width*scale*12700),cy=Math.round(size.height*scale*12700);
      const section=`<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="${Math.round(size.width*20)}" w:h="${Math.round(size.height*20)}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0"/></w:sectPr>`;
      sections.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/>${n<pdf.numPages?section:''}</w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Halaman ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="Halaman ${n}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="page${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>${n===pdf.numPages?section:''}`);
    }
    zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+relations.join('')+'</Relationships>');
    zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+sections.join('')+'</w:body></w:document>');
    return new Blob([await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'})],{type:DOCX_MIME});
  }finally{await task.destroy();}
}
