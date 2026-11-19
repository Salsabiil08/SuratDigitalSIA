import {CANONICAL_HEADER_SHA256,LETTERHEAD_SVG} from "./letterhead-preview";

export async function renderDocxInFrame(blob:Blob,frame:HTMLIFrameElement){
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
        // Word grouped vector logos are unsupported by docx-preview. Only the exact existing SIA header gets this visual fallback.
        const {default:JSZip}=await import('jszip');
        const zip=await JSZip.loadAsync(await blob.arrayBuffer());
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
}
