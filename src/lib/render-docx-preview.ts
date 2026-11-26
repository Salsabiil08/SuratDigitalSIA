import {CANONICAL_HEADER_SHA256,LETTERHEAD_SVG} from "./letterhead-preview";

export async function renderDocxInFrame(blob:Blob,frame:HTMLIFrameElement):Promise<()=>void>{
        const doc = frame.contentDocument;
        if (!doc) throw new Error("Pratinjau tidak dapat dimuat.");
        doc.open();
        doc.write(
          `<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:;"><style>body{margin:0;background:#f3f4f6}.docx-wrapper{padding:12px!important}.docx-wrapper>section{margin-bottom:12px!important}</style></head><body><main></main></body></html>`,
        );
        doc.close();
        const { renderAsync } = await import("docx-preview");
        // The iframe cannot run scripts or navigate the parent. Do not resolve external relationships.
        await renderAsync(blob, doc.querySelector("main")!, undefined, {
          renderComments: false,
          renderAltChunks: false,
          useBase64URL: true,
          ignoreFonts: true,
        });
        // Hide technical signing markers in the display copy only; stored bytes remain intact.
        const textNodes=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        while ((textNode=textNodes.nextNode())) {
          textNode.textContent=textNode.textContent?.replace(/\{\{(?:SIGNATURE_\d+|STAMP(?:_\d+)?)\}\}/g,'') || '';
        }
        // Word grouped vector logos are unsupported by docx-preview. Only the exact existing SIA header gets this visual fallback.
        const {default:JSZip}=await import('jszip');
        const zip=await JSZip.loadAsync(await blob.arrayBuffer());
        // Recognize only the seven-column billing detail grid; metadata/signature tables stay borderless.
        const billingHeaders=['No','No Dokumen','Keterangan','Penerima','Bank','No Rekening','Nominal (Rp)'];
        for(const table of Array.from(doc.querySelectorAll<HTMLTableElement>('table'))){
          const cells=Array.from(table.rows[0]?.cells||[]);
          if(cells.length!==billingHeaders.length || !cells.every((cell,i)=>{const label=cell.textContent?.replace(/\s+/g,' ').trim();return label===billingHeaders[i]||(i===1&&label==='No Document');}))continue;
          table.style.borderCollapse='collapse';
          for(const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>('td,th'))){cell.style.border='0.5pt solid #333333';cell.style.backgroundColor='#ffffff';}
        }
        const header=await zip.file('word/header1.xml')?.async('uint8array');
        if(header){
          const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(header)))).map(b=>b.toString(16).padStart(2,'0')).join('');
          const body=await zip.file('word/document.xml')?.async('string')||'';
          const rels=await zip.file('word/_rels/document.xml.rels')?.async('string')||'';
          const references=Array.from(body.matchAll(/<w:headerReference\b[^>]*r:id="([^"]+)"/g),m=>m[1]);
          const canonicalReference=references.length>0&&references.every(id=>id==='rId12')&&/<Relationship\b(?=[^>]*Id="rId12")(?=[^>]*Target="header1.xml")[^>]*\/>/.test(rels);
          if(digest===CANONICAL_HEADER_SHA256&&canonicalReference){
            for(const section of Array.from(doc.querySelectorAll<HTMLElement>('.docx-wrapper>section'))){
              const el=section.querySelector('header');if(!el)continue;
              el.replaceChildren();section.style.position='relative';
              const logo=doc.createElement('img');logo.alt='Kop resmi PT Semen Indonesia Aceh';logo.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(LETTERHEAD_SVG);
              Object.assign(logo.style,{position:'absolute',top:'0',left:'0',width:'100%',height:'auto',pointerEvents:'none'});section.appendChild(logo);
              await logo.decode();
            }
          }
        }
        for(const anchor of Array.from(doc.querySelectorAll<HTMLElement>('div[style]'))){
          if(anchor.style.width==='0px'&&anchor.style.height==='0px'&&anchor.style.position==='relative'){
            anchor.style.display='inline-block';anchor.style.verticalAlign='top';anchor.style.zIndex='2';
          }
        }
        const pages=Array.from(doc.querySelectorAll<HTMLElement>('.docx-wrapper>section'));
        const wrapper=doc.querySelector<HTMLElement>('.docx-wrapper');
        const main=doc.querySelector<HTMLElement>('main');
        // Scale the fixed Word page as a whole. CSS zoom on body changes its layout
        // viewport and can center/crop the page on narrow mobile browsers.
        const pageWidth=Math.max(0,...pages.map(page=>page.offsetWidth));
        const fitMobile=()=>{
          if(!wrapper||!main)return;
          const available=doc.documentElement.clientWidth||frame.clientWidth;
          const mobile=available<640&&pageWidth>0;
          const naturalWidth=pageWidth+24;
          const scale=mobile?Math.min(1,Math.max(1,available)/naturalWidth):1;
          wrapper.style.width=mobile?`${naturalWidth}px`:'';
          wrapper.style.boxSizing=mobile?'border-box':'';
          wrapper.style.transformOrigin='top left';
          wrapper.style.transform=mobile?`scale(${scale})`:'';
          main.style.height=mobile?`${wrapper.offsetHeight*scale}px`:'';
          main.style.overflow=mobile?'hidden':'';
          doc.documentElement.style.overflowX=mobile?'hidden':'';
          doc.body.style.overflowX=mobile?'hidden':'';
        };
        fitMobile();
        if(typeof ResizeObserver==='undefined'){
          window.addEventListener('resize',fitMobile);
          return ()=>window.removeEventListener('resize',fitMobile);
        }
        const observer=new ResizeObserver(fitMobile);
        observer.observe(frame);
        if(wrapper)observer.observe(wrapper);
        observer.observe(doc.documentElement);
        return ()=>observer.disconnect();
}
