"use client";
import {CANONICAL_HEADER_SHA256,LETTERHEAD_SVG} from "@/lib/letterhead-preview";
import { useEffect, useRef, useState } from "react";
export function DocumentPreview({
  url,
  format,
  onLoaded,
}: {
  url: string;
  format: string;
  onLoaded?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const pdfReady = useRef(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const controller = new AbortController();
    pdfReady.current = false;
    let blobUrl = "";
    setError("");
    async function show() {
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok)
          throw new Error((await res.json()).error || "Pratinjau gagal.");
        const blob = await res.blob();
        if (!alive || !frame.current) return;
        if (format === "PDF") {
          blobUrl = URL.createObjectURL(blob);
          pdfReady.current = true;
          frame.current.src = blobUrl;
          return;
        }
        const doc = frame.current.contentDocument;
        if (!doc) throw new Error("Pratinjau tidak dapat dimuat.");
        doc.open();
        doc.write(
          `<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:;"><style>body{margin:0;background:#f3f4f6}.docx-wrapper{padding:12px!important}.docx-wrapper>section{margin-bottom:12px!important}</style></head><body><main></main></body></html>`,
        );
        doc.close();
        const { renderAsync } = await import("docx-preview");
        if (!alive) return;
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
        if (alive) onLoaded?.();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Pratinjau gagal.");
      }
    }
    void show();
    return () => {
      alive = false;
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // onLoaded is intentionally a notification, not a render dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, format, visible]);
  return (
    <div ref={container} className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
        <iframe
          hidden={!!error}
          ref={frame}
          sandbox="allow-same-origin"
          title="Pratinjau dokumen surat"
          className="w-full h-[680px] bg-neutral-100 border rounded-xl"
          onLoad={() => {
            if (format === "PDF" && pdfReady.current) onLoaded?.();
          }}
        />
      {format === 'DOCX' && <p className="text-xs text-neutral-500">Tata letak pratinjau dapat sedikit berbeda dari Word.</p>}
    </div>
  );
}
