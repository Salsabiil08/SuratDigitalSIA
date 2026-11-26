import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { CANONICAL_HEADER_SHA256, LETTERHEAD_SVG } from '@/lib/letterhead-preview';
import { hashBytes } from '@/server/letter-workflow';

const resolve = createRequire(import.meta.url).resolve;

export async function renderFinalPdf(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  const header = await archive.file('word/header1.xml')?.async('uint8array');
  const body = await archive.file('word/document.xml')?.async('string') || '';
  const rels = await archive.file('word/_rels/document.xml.rels')?.async('string') || '';
  const refs = Array.from(body.matchAll(/<w:headerReference\b[^>]*r:id="([^"]+)"/g), match => match[1]);
  const canonical = !!header && hashBytes(header)===CANONICAL_HEADER_SHA256 && refs.length>0
    && refs.every(ref=>ref==='rId12') && /<Relationship\b(?=[^>]*Id="rId12")(?=[^>]*Target="header1.xml")[^>]*\/>/.test(rels);

  const [puppeteer, bundle, zipBundle] = await Promise.all([
    import('puppeteer-core'),
    readFile(join(dirname(resolve('docx-preview')), 'docx-preview.min.js'), 'utf8'),
    readFile(join(dirname(resolve('jszip')), '../dist/jszip.min.js'), 'utf8'),
  ]);
  // Local CI can point to its installed Chromium. Production uses the binary
  // bundled with the function and never downloads a browser at request time.
  const localPath = process.env.VERCEL ? undefined : process.env.SIADOCS_CHROMIUM_PATH;
  const chromium = localPath ? null : (await import('@sparticuz/chromium')).default;
  const browser = await puppeteer.launch({
    executablePath: localPath || await chromium!.executablePath(),
    args: [...(chromium?.args || []),'--disable-background-networking','--disable-sync','--disable-extensions','--no-proxy-server'],
    headless:true, timeout:15000, protocolTimeout:25000, pipe:true,
    env:{PATH:process.env.PATH,LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH,FONTCONFIG_PATH:process.env.FONTCONFIG_PATH,HOME:'/tmp'},
  });
  try {
    const page=await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request',request=>{
      void (/^(data:|blob:|about:blank$)/.test(request.url())?request.continue():request.abort()).catch(()=>{});
    });
    await page.setContent('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data: blob:; base-uri \'none\'; form-action \'none\'"><main></main>');
    await page.addScriptTag({content:zipBundle});
    await page.addScriptTag({content:bundle});
    const count=await page.evaluate(async (base64,logo)=>{
      const docx=(window as unknown as {docx:{renderAsync:(input:Uint8Array,body:HTMLElement,style:undefined,options:Record<string,boolean>)=>Promise<void>}}).docx;
      await docx.renderAsync(Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),document.querySelector('main')!,undefined,{
        renderComments:false,renderAltChunks:false,useBase64URL:true,ignoreFonts:true,
      });
      const sections=Array.from(document.querySelectorAll<HTMLElement>('.docx-wrapper>section'));
      if(sections.length<1||sections.length>40) throw new Error('Dokumen harus berisi 1 sampai 40 halaman.');
      const texts=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      let text:Node|null;
      while((text=texts.nextNode()))text.textContent=text.textContent?.replace(/\{\{(?:SIGNATURE_\d+|STAMP(?:_\d+)?)\}\}/g,'')||'';
      for(const anchor of document.querySelectorAll<HTMLElement>('div[style]')){
        if(anchor.style.width==='0px'&&anchor.style.height==='0px'&&anchor.style.position==='relative'){
          Object.assign(anchor.style,{display:'inline-block',verticalAlign:'top',zIndex:'2'});
        }
      }
      if(logo) for(const section of sections){
        const header=section.querySelector('header');
        if(!header)continue;
        header.replaceChildren();
        section.style.position='relative';
        const image=document.createElement('img');
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(logo);
        Object.assign(image.style,{position:'absolute',top:'0',left:'0',width:'100%',height:'auto'});
        section.append(image);
      }
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(image=>image.decode()));
      const layout=document.createElement('style');
      layout.textContent='html,body {margin:0;padding:0;background:white}.docx-wrapper{display:block!important;padding:0!important;background:white!important}.docx-wrapper>section{margin:0!important;box-shadow:none!important;break-after:page}.docx-wrapper>section:last-child{break-after:auto}';
      document.head.append(layout);
      for(const [index,section] of sections.entries()){
        const bounds=section.getBoundingClientRect();
        if(bounds.width<100||bounds.height<100||bounds.width>2500||bounds.height>4000)throw new Error('Ukuran halaman di luar batas PDF.');
        const name='letter'+index;
        section.style.setProperty('page',name);
        // Add a fraction of a pixel so print rounding does not create another page.
        layout.append(document.createTextNode('@page '+name+'{size:'+(bounds.width+.1)+'px '+(bounds.height+.1)+'px;margin:0}'));
      }
      return sections.length;
    },Buffer.from(bytes).toString('base64'),canonical?LETTERHEAD_SVG:'');
    const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true,timeout:15000});
    const parsed=await PDFDocument.load(pdf,{updateMetadata:false});
    if(parsed.getPageCount()!==count)throw new Error('Jumlah halaman PDF berbeda dari pratinjau.');
    return pdf;
  } finally { await browser.close(); }
}
