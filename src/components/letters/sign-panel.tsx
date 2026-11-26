"use client";
import {ActionNotice} from "@/components/ui/action-notice";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DocumentPreview } from "./document-preview";
export function SignPanel({
  letter,
  request,
  onSaved,
}: {
  letter: any;
  request: any;
  onSaved: () => void;
}) {
  const imageAvailable=letter.source!=="UPLOAD" || !!letter.signature_areas?.[request.sign_order-1];
  const [method, setMethod] = useState(imageAvailable?"IMAGE":"WET_UPLOAD");
  const [storedSignature,setStoredSignature]=useState(false);
  const [storedStamp,setStoredStamp]=useState(false);
  const [signature, setSignature] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [hash, setHash] = useState("");
  const [format, setFormat] = useState("DOCX");
  const [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved,setSaved]=useState(false);
  const [error, setError] = useState("");
  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setHash("");
    setConfirmed(false);
    setLoaded(false);
  }
  async function send(isPreview: boolean) {
    if(busy||saved)return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("method", method);
      form.set("requestId", request.id);
      form.set("revision", String(letter.revision));
      if (storedSignature) form.set("useStoredSignature","1");
      if (storedStamp) form.set("useStoredStamp","1");
      if (signature) form.set("signature", signature);
      if (stamp) form.set("stamp", stamp);
      if (document) form.set("document", document);
      form.set("preview", isPreview ? "1" : "0");
      form.set("confirmed", confirmed ? "1" : "0");
      form.set("previewHash", hash);
      const res = await fetch(`/api/letters/${letter.id}/sign`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      if (isPreview) {
        reset();
        setFormat(
          res.headers.get("content-type") === "application/pdf"
            ? "PDF"
            : "DOCX",
        );
        setHash(res.headers.get("X-Document-Hash") || "");
        setPreview(URL.createObjectURL(await res.blob()));
      } else {setSaved(true);onSaved();}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menandatangani.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="font-bold">Tanda Tangani — tahap {request.sign_order}</h2>
      <details className="text-sm text-neutral-600"><summary className="cursor-pointer">Tentang tanda tangan</summary><p>Gambar tanda tangan diterapkan setelah Anda mengonfirmasi. Bukan tanda tangan elektronik tersertifikasi.</p></details>
      <Field label="Cara menandatangani" htmlFor="sign-method">
        <Select
          id="sign-method"
          value={method}
          onChange={(e) => {
            reset();
            setMethod(e.target.value);
          }}
        >
          {imageAvailable&&<option value="IMAGE">Gunakan gambar tanda tangan (PNG)</option>}
          <option value="WET_UPLOAD">Unggah dokumen yang sudah ditandatangani</option>
        </Select>
      </Field>
      {method === "IMAGE" ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={storedSignature} onChange={e=>{reset();setStoredSignature(e.target.checked);}}/>
            Gunakan TTD tersimpan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={storedStamp} onChange={e=>{reset();setStoredStamp(e.target.checked);}}/>
            Gunakan stempel tersimpan
          </label>
          <Field
            label="Gambar TTD milik Anda (PNG, maks. 512 KB)"
            htmlFor="sig-file"
          >
            <Input
              id="sig-file"
              disabled={storedSignature}
              type="file"
              accept="image/png"
              onChange={(e) => {
                reset();
                setSignature(e.target.files?.[0] || null);
              }}
            />
          </Field>
          <Field
            label="Stempel opsional (PNG, maks. 512 KB)"
            htmlFor="stamp-file"
            hint="Hanya pejabat penandatangan aktif dapat menerapkan stempel. Posisi wajib terlihat di preview."
          >
            <Input
              id="stamp-file"
              disabled={storedStamp}
              type="file"
              accept="image/png"
              onChange={(e) => {
                reset();
                setStamp(e.target.files?.[0] || null);
              }}
            />
          </Field>
        </>
      ) : (
        <Field
          label="Dokumen bertanda tangan (PDF/DOCX, maks. 3 MB)"
          htmlFor="wet-document"
        >
          <Input
            id="wet-document"
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              reset();
              setDocument(e.target.files?.[0] || null);
            }}
          />
        </Field>
      )}
      <Button variant="secondary" disabled={saved} disabledReason={saved?"Tanda tangan berhasil disimpan. Menunggu status terbaru.":undefined} onClick={() => send(true)} isLoading={busy}>
        Pratinjau Hasil TTD dan Stempel
      </Button>
      {preview && (
        <>
          <DocumentPreview
            url={preview}
            format={format}
            onLoaded={() => setLoaded(true)}
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Saya berwenang menandatangani, telah memeriksa hasil, dan menyatakan
            dokumen sesuai naskah yang disetujui tanpa perubahan isi.
          </label>
          <Button
            disabled={saved || !confirmed || !loaded} disabledReason={saved?"Tanda tangan berhasil disimpan. Menunggu status terbaru.":!loaded?"Tunggu pratinjau selesai dimuat.":!confirmed?"Centang konfirmasi setelah memeriksa hasil tanda tangan.":undefined} loadingLabel="Menandatangani…"
            isLoading={busy}
            onClick={() => send(false)}
          >
            Tanda Tangani dan Simpan
          </Button>
        </>
      )}
      {error && (
        <ActionNotice>
          {error}
        </ActionNotice>
      )}
    </section>
  );
}
