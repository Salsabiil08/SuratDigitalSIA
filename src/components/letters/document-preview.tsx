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
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let blobUrl = "";
    setError("");
    async function show() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
          throw new Error((await res.json()).error || "Pratinjau gagal.");
        const blob = await res.blob();
        if (!alive || !frame.current) return;
        if (format === "PDF") {
          blobUrl = URL.createObjectURL(blob);
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
        // The iframe cannot run scripts or navigate the parent. Do not resolve external relationships.
        await renderAsync(blob, doc.querySelector("main")!, undefined, {
          renderComments: false,
          renderAltChunks: false,
          useBase64URL: true,
          ignoreFonts: true,
        });
        if (alive) onLoaded?.();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Pratinjau gagal.");
      }
    }
    void show();
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // onLoaded is intentionally a notification, not a render dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, format]);
  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <iframe
          ref={frame}
          sandbox="allow-same-origin"
          title="Pratinjau dokumen surat"
          className="w-full h-[680px] bg-neutral-100 border rounded-xl"
          onLoad={() => {
            if (format === "PDF") onLoaded?.();
          }}
        />
      )}
      <p className="text-xs text-neutral-500">
        Periksa isi, tanggal, dan area TTD/stempel. Tata letak DOCX di Word
        dapat sedikit berbeda; gunakan unduhan untuk pemeriksaan akhir.
      </p>
    </div>
  );
}
