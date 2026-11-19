"use client";
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
        const {renderDocxInFrame}=await import('@/lib/render-docx-preview');
        await renderDocxInFrame(blob,frame.current);
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
