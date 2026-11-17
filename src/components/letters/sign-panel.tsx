"use client";
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
  const [method, setMethod] = useState("IMAGE");
  const [signature, setSignature] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [hash, setHash] = useState("");
  const [format, setFormat] = useState("DOCX");
  const [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setHash("");
    setConfirmed(false);
    setLoaded(false);
  }
  async function send(isPreview: boolean) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("method", method);
      form.set("requestId", request.id);
      form.set("revision", String(letter.revision));
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
      } else onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menandatangani.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="font-bold">Tanda Tangani — tahap {request.sign_order}</h2>
      <p className="text-sm">
        Gambar TTD diterapkan hanya setelah tindakan Anda dikonfirmasi. Ini
        merupakan tanda tangan gambar, bukan tanda tangan elektronik
        tersertifikasi.
      </p>
      <Field label="Mekanisme TTD" htmlFor="sign-method">
        <Select
          id="sign-method"
          value={method}
          onChange={(e) => {
            reset();
            setMethod(e.target.value);
          }}
        >
          <option value="IMAGE">Gambar TTD PNG pada area tervalidasi</option>
          <option value="WET_UPLOAD">Unggah hasil tanda tangan basah</option>
        </Select>
      </Field>
      {method === "IMAGE" ? (
        <>
          <Field
            label="Gambar TTD milik Anda (PNG, maks. 512 KB)"
            htmlFor="sig-file"
          >
            <Input
              id="sig-file"
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
      <Button variant="secondary" onClick={() => send(true)} isLoading={busy}>
        Preview Hasil TTD dan Stempel
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
            disabled={!confirmed || !loaded}
            isLoading={busy}
            onClick={() => send(false)}
          >
            Tanda Tangani dan Simpan
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
