"use client";
import {PdfCanvas} from './pdf-canvas';
import {Button} from '@/components/ui/button';
import {ActionNotice} from "@/components/ui/action-notice";
import { useEffect, useRef, useState } from "react";
export function DocumentPreview({
  url,
  format,
  onLoaded,
  onLayoutCopy,
  compact = false,
}: {
  url: string;
  format: string;
  compact?: boolean;
  onLoaded?: () => void;
  onLayoutCopy?: (isCopy: boolean) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [pdfBlob,setPdfBlob]=useState<Blob|null>(null);
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
  const [attempt,setAttempt]=useState(0);
  const [loading,setLoading]=useState(false);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const controller = new AbortController();
    let stopDocxFit:(()=>void)|undefined;
    setPdfBlob(null);

    setError("");
    setLoading(true);
    async function show() {
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok)
          throw new Error((await res.json()).error || "Pratinjau gagal.");
        onLayoutCopy?.(res.headers.get("X-SIADocs-Layout-Copy")==="1");
        const blob = await res.blob();
        if (!alive) return;
        if (format === 'PDF') {setPdfBlob(blob);return;}
        if (!frame.current) return;
        const {renderDocxInFrame}=await import('@/lib/render-docx-preview');
        const stopFit=await renderDocxInFrame(blob,frame.current);
        if (alive) {stopDocxFit=stopFit;onLoaded?.();}
        else stopFit();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Pratinjau gagal.");
      } finally {if(alive)setLoading(false);}
    }
    void show();
    return () => {
      alive = false;
      controller.abort();
      stopDocxFit?.();

    };
    // Parent callbacks report load/copy state; they are notifications, not render dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, format, visible, attempt]);
  return (
    <div ref={container} className={compact?"h-36 min-w-0 overflow-hidden rounded-xl border bg-neutral-50":"min-w-0 max-w-full space-y-2"}>
      {loading&&<p role="status" className="text-sm text-neutral-600">Pratinjau sedang disiapkan.</p>}
      {error && <><ActionNotice>{error}</ActionNotice><Button variant="secondary" onClick={()=>setAttempt(n=>n+1)}>Muat Ulang Pratinjau</Button></>}
        {format==='PDF'?(!error&&pdfBlob&&<div className="w-full h-[680px] overflow-auto bg-neutral-200 rounded-xl border p-2 sm:p-4"><PdfCanvas blob={pdfBlob} onLoaded={onLoaded}/></div>):<iframe
          hidden={!!error}
          ref={frame}
          sandbox="allow-same-origin"
          title="Pratinjau dokumen surat"
          className={compact?"h-[680px] w-full pointer-events-none":"w-full h-[680px] bg-neutral-100 border rounded-xl"}
          tabIndex={compact ? -1 : undefined}
        />}

    </div>
  );
}
