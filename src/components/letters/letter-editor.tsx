"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DraftInput, SignatureArea, jakartaDate } from "@/domain/workflow";
import {
  getWorkflowOptions,
  getWorkflowLetter,
} from "@/server/actions/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { terbilangRupiah } from "@/domain/terbilang";

const emptyArea = (): SignatureArea => ({
  page: 1,
  x: 340,
  y: 620,
  width: 140,
  height: 55,
});
export function LetterEditor({
  source = "CREATE",
  billing = false,
  id,
  dispositionId,
}: {
  source?: "CREATE" | "UPLOAD";
  billing?: boolean;
  id?: string;
  dispositionId?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof getWorkflowOptions>
  > | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState<DraftInput>({
    source,
    dispositionId,
    letterTypeCode: billing ? "Tag" : "IN",
    subject: "",
    letterDate: jakartaDate(),
    dateReason: "",
    recipientUserId: "",
    recipientName: "",
    recipientOrg: "",
    recipientAddress: "",
    content: "",
    signatureMode: "IN_APP",
    signerIds: [],
    areas: [],
    billing: billing
      ? {
          bankId: "",
          bankName: "",
          accountNumber: "",
          accountHolder: "",
          items: [
            { description: "", amount: 0 },
            { description: "", amount: 0 },
          ],
        }
      : undefined,
  });
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [currentFormat, setCurrentFormat] = useState("DOCX");
  const [oldDate, setOldDate] = useState("");
  const [formal, setFormal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const opts = await getWorkflowOptions();
        if (!live) return;
        setOptions(opts);
        if (id) {
          const data = await getWorkflowLetter(id);
          const l = data.letter;
          if (
            !data.isCreator ||
            !["DRAFT", "REVISION_REQUESTED"].includes(l.status)
          )
            throw new Error("Surat ini sudah terkunci untuk pengeditan.");
          const v = data.versions.find((v) => v.id === l.current_version_id);
          const draft: DraftInput = {
            id: l.id,
            revision: l.revision,
            source: l.source,
            letterTypeCode: l.type.code,
            subject: l.subject,
            letterDate: l.letter_date || "",
            dateReason: l.date_change_reason || "",
            recipientUserId: l.recipient_user_id || "",
            recipientName: l.recipient_external_name || "",
            recipientOrg: l.recipient_external_org || "",
            recipientAddress: l.recipient_external_address || "",
            content: v?.content_html || "",
            signatureMode: l.signature_mode,
            signerIds: l.signer_ids,
            areas: l.signature_areas || [],
            stampArea: l.stamp_area || undefined,
            numberArea: l.number_area || undefined,
          };
          if (data.billing)
            draft.billing = {
              bankId: data.billing.bank_id,
              accountNumber: data.billing.account_number,
              accountHolder: data.billing.payee_name,
              items: data.items,
            };
          if (live) {
            setInput(draft);
            setFormal(l.signer_ids.length > 0);
            setCurrentFormat(v?.file_format || "DOCX");
            setOldDate(l.letter_date || "");
          }
        }
        if (live) setReady(true);
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Gagal memuat formulir.");
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);
  function change<K extends keyof DraftInput>(key: K, value: DraftInput[K]) {
    setInput((x) => ({ ...x, [key]: value }));
  }
  function setType(type: DraftInput["letterTypeCode"]) {
    setInput((x) => ({
      ...x,
      letterTypeCode: type,
      signerIds: [],
      areas: [],
      recipientUserId: "",
      recipientName: "",
      recipientOrg: "",
      recipientAddress: "",
    }));
    setFormal(false);
  }
  const internal = input.letterTypeCode === "IN";
  const isBill = input.letterTypeCode === "Tag";
  const count = internal ? (formal ? 1 : 0) : isBill ? 2 : 1;
  const signers = options?.people.filter((p) => p.signer) || [];
  function updateSigner(index: number, value: string) {
    const ids = [...input.signerIds];
    ids[index] = value;
    change("signerIds", ids.slice(0, count));
  }
  async function save(preview: boolean) {
    setBusy(true);
    setError("");
    try {
      const ids = input.signerIds.slice(0, count);
      if (ids.length !== count || ids.some((id) => !id))
        throw new Error("Pilih seluruh pejabat penandatangan wajib.");
      const data = {
        ...input,
        signerIds: ids,
        areas: currentFormat === "PDF" ? input.areas.slice(0, count) : [],
      };
      const form = new FormData();
      form.set("data", JSON.stringify(data));
      if (file) form.set("file", file);
      if (attachment) form.set("attachment", attachment);
      const res = await fetch("/api/letters/draft", {
        method: "POST",
        body: form,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      router.push(`/surat/${result.id}${preview ? "?preview=1" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <Card className="p-6">
        <p role={error ? "alert" : undefined}>
          {error || "Memuat formulir dan struktur organisasi…"}
        </p>
      </Card>
    );
  const canBackdate = ["GM", "SM", "DIR"].includes(
    options?.user.position?.code || "",
  );
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title={
          id
            ? "Edit Draft"
            : isBill
              ? "Surat Pengantar Tagihan"
              : input.source === "UPLOAD"
                ? "Import Surat / Ambil Nomor"
                : "Buat Surat"
        }
      />
      <p className="text-sm text-neutral-600">
        Buat/Import → Preview dan Koreksi → Persetujuan → Nomor Resmi → TTD →
        Finalisasi
      </p>
      {error && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200"
        >
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        className="space-y-5"
      >
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Data Surat</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Jenis Surat" htmlFor="letter-type">
              <Select
                id="letter-type"
                value={input.letterTypeCode}
                disabled={!!id || isBill}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="IN">Internal</option>
                <option value="KRE">Eksternal</option>
                {isBill && <option value="Tag">Surat Pengantar Tagihan</option>}
              </Select>
            </Field>
            <Field label="Unit Pengirim">
              <p className="py-3 text-sm">
                {options?.user.unit?.name || "Belum ditugaskan"} —{" "}
                {options?.user.fullName}
              </p>
            </Field>
          </div>
          <Field
            label="Tanggal Surat"
            htmlFor="letter-date"
            required
            hint={
              canBackdate
                ? "Tanggal sebelumnya diizinkan dengan alasan dan dicatat dalam audit."
                : "Tanggal mundur hanya untuk GM/SM/Direktur berwenang. Hubungi kepala unit bila diperlukan."
            }
          >
            <Input
              id="letter-date"
              type="date"
              value={input.letterDate}
              onChange={(e) => change("letterDate", e.target.value)}
              required
            />
          </Field>
          {(input.letterDate < jakartaDate() ||
            (input.letterDate !== oldDate && !!oldDate)) && (
            <Field
              label="Alasan penetapan/perubahan tanggal"
              htmlFor="date-reason"
              required
            >
              <Textarea
                id="date-reason"
                value={input.dateReason}
                onChange={(e) => change("dateReason", e.target.value)}
              />
            </Field>
          )}
          {internal ? (
            <Field
              label="Penerima Internal"
              htmlFor="recipient-user"
              required
              hint="Pilih pegawai beserta jabatan dan unit dari struktur organisasi."
            >
              <Select
                id="recipient-user"
                value={input.recipientUserId}
                onChange={(e) => change("recipientUserId", e.target.value)}
                required
              >
                <option value="">Pilih penerima</option>
                {options?.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.title} / {p.unitName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Nama Penerima Eksternal"
                htmlFor="recipient-name"
                required
              >
                <Input
                  id="recipient-name"
                  value={input.recipientName}
                  onChange={(e) => change("recipientName", e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Instansi / Perusahaan"
                htmlFor="recipient-org"
                required
              >
                <Input
                  id="recipient-org"
                  value={input.recipientOrg}
                  onChange={(e) => change("recipientOrg", e.target.value)}
                  required
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Alamat Penerima Eksternal"
                  htmlFor="recipient-address"
                  required
                >
                  <Textarea
                    id="recipient-address"
                    value={input.recipientAddress}
                    onChange={(e) => change("recipientAddress", e.target.value)}
                    required
                  />
                </Field>
              </div>
            </div>
          )}
          <Field label="Perihal" htmlFor="letter-subject" required>
            <Input
              id="letter-subject"
              value={input.subject}
              onChange={(e) => change("subject", e.target.value)}
              required
              maxLength={500}
            />
          </Field>
        </Card>
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Dokumen dan Isi</h2>
          {input.source === "CREATE" ? (
            <>
              <Field
                label="Isi Surat"
                htmlFor="letter-content"
                required
                hint="Naskah pada template berkop. Koreksi dapat dilakukan selama Draft/Perlu Revisi."
              >
                <Textarea
                  id="letter-content"
                  rows={12}
                  value={input.content}
                  onChange={(e) => change("content", e.target.value)}
                  required
                />
              </Field>
              <a
                className="text-brand-red underline text-sm"
                href="/api/kop/unduh"
              >
                Unduh kop DOCX untuk penyusunan di luar aplikasi
              </a>
            </>
          ) : (
            <>
              <Field
                label={
                  id
                    ? "Ganti Dokumen Impor (opsional)"
                    : "Dokumen Impor (PDF/DOCX, maks. 3 MB)"
                }
                htmlFor="document-file"
                hint="Untuk mengubah isi impor, unduh lalu edit di Word/editor PDF, kemudian unggah versi koreksi selama Draft. DOCX memerlukan {{OFFICIAL_NUMBER}}, {{SIGNATURE_1}} dan {{SIGNATURE_2}} untuk dua TTD. Tambahkan {{STAMP}} bila memakai stempel."
              >
                <Input
                  id="document-file"
                  type="file"
                  accept=".pdf,.docx"
                  required={!id}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    if (f)
                      setCurrentFormat(
                        f.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX",
                      );
                  }}
                />
              </Field>
              {id && (
                <a
                  className="text-brand-red underline text-sm"
                  href={`/api/letters/${id}/document?download=1`}
                >
                  Unduh versi impor untuk koreksi
                </a>
              )}
            </>
          )}
          <Field
            label={
              isBill
                ? "Lampiran bukti tagihan (wajib, PDF/DOCX, maks. 1 MB)"
                : "Lampiran tambahan (opsional, PDF/DOCX, maks. 1 MB)"
            }
            htmlFor="attachment-file"
          >
            <Input
              id="attachment-file"
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
          </Field>
        </Card>
        {isBill && input.billing && (
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Rincian Tagihan — khusus Finance</h2>
            <Field label="Bank" htmlFor="bank" required>
              <Select
                id="bank"
                value={input.billing.bankId}
                onChange={(e) =>
                  change("billing", {
                    ...input.billing!,
                    bankId: e.target.value,
                  })
                }
              >
                <option value="">Isi nama bank / pilih bank terdaftar</option>
                {options?.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!input.billing.bankId && (
              <Field label="Nama Bank" htmlFor="new-bank" required>
                <Input
                  id="new-bank"
                  value={input.billing.bankName || ""}
                  onChange={(e) =>
                    change("billing", {
                      ...input.billing!,
                      bankName: e.target.value,
                    })
                  }
                  required
                />
              </Field>
            )}
            <Field label="Nomor Rekening" htmlFor="account" required>
              <Input
                id="account"
                value={input.billing.accountNumber}
                onChange={(e) =>
                  change("billing", {
                    ...input.billing!,
                    accountNumber: e.target.value,
                  })
                }
                required
              />
            </Field>
            <Field label="Atas Nama Rekening" htmlFor="payee" required>
              <Input
                id="payee"
                value={input.billing.accountHolder}
                onChange={(e) =>
                  change("billing", {
                    ...input.billing!,
                    accountHolder: e.target.value,
                  })
                }
                required
              />
            </Field>
            {input.billing.items.map((item, index) => (
              <div className="grid sm:grid-cols-2 gap-3" key={index}>
                <Field label={`Uraian ${index + 1}`} htmlFor={`item-${index}`}>
                  <Input
                    id={`item-${index}`}
                    required
                    value={item.description}
                    onChange={(e) => {
                      const items = [...input.billing!.items];
                      items[index] = { ...item, description: e.target.value };
                      change("billing", { ...input.billing!, items });
                    }}
                  />
                </Field>
                <Field
                  label={`Nominal ${index + 1}`}
                  htmlFor={`amount-${index}`}
                >
                  <Input
                    id={`amount-${index}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={item.amount || ""}
                    onChange={(e) => {
                      const items = [...input.billing!.items];
                      items[index] = {
                        ...item,
                        amount: Number(e.target.value),
                      };
                      change("billing", { ...input.billing!, items });
                    }}
                  />
                </Field>
              </div>
            ))}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  change("billing", {
                    ...input.billing!,
                    items: [
                      ...input.billing!.items,
                      { description: "", amount: 0 },
                    ],
                  })
                }
              >
                Tambah Rincian
              </Button>
              {input.billing.items.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    change("billing", {
                      ...input.billing!,
                      items: input.billing!.items.slice(0, -1),
                    })
                  }
                >
                  Hapus Baris Terakhir
                </Button>
              )}
            </div>
            <p className="text-sm">
              Total: Rp{" "}
              {input.billing.items
                .reduce((s, i) => s + i.amount, 0)
                .toLocaleString("id-ID")}{" "}
              —{" "}
              {terbilangRupiah(
                input.billing.items.reduce((s, i) => s + i.amount, 0),
              )}
            </p>
          </Card>
        )}
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Persetujuan dan Tanda Tangan</h2>
          {internal && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formal}
                onChange={(e) => {
                  setFormal(e.target.checked);
                  change("signerIds", []);
                }}
              />
              Perlu pengesahan formal (1 TTD). Komunikasi sesama level dapat
              tanpa TTD.
            </label>
          )}
          {!internal && (
            <p className="text-sm">
              {isBill
                ? "Dua persetujuan dan TTD berurutan: Senior Manager lalu Direktur."
                : "Satu persetujuan dan TTD wajib oleh SM atau Direktur."}
            </p>
          )}
          {Array.from({ length: count }, (_, index) => (
            <Field
              key={index}
              label={
                isBill
                  ? index === 0
                    ? "Senior Manager (tahap 1)"
                    : "Direktur (tahap 2)"
                  : "Pejabat Penyetuju dan Penandatangan"
              }
              htmlFor={`signer-${index}`}
              required
            >
              <Select
                id={`signer-${index}`}
                value={input.signerIds[index] || ""}
                onChange={(e) => updateSigner(index, e.target.value)}
                required
              >
                <option value="">Pilih pejabat</option>
                {signers
                  .filter(
                    (p) =>
                      !isBill ||
                      (index === 0
                        ? p.position === "SM" && p.unitId === options?.financeUnitId
                        : p.position === "DIR"),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.title}
                    </option>
                  ))}
              </Select>
            </Field>
          ))}
          {count > 0 && (
            <Field label="Jalur TTD" htmlFor="signature-mode">
              <Select
                id="signature-mode"
                value={input.signatureMode}
                onChange={(e) => change("signatureMode", e.target.value as any)}
              >
                <option value="IN_APP">
                  Melalui SIADocs — gambar TTD atau unggah hasil basah
                </option>
                <option value="EXTERNAL">
                  Di luar SIADocs — unduh dan tanda tangan basah
                </option>
              </Select>
            </Field>
          )}
          {currentFormat === "PDF" && input.source === "UPLOAD" && (
            <div className="space-y-4">
              <p className="text-sm">
                Tentukan area TTD pada PDF. Koordinat memakai satuan point (1/72
                inci), dihitung dari kiri atas halaman. Preview menampilkan
                kotak area sebelum diajukan.
              </p>
              <AreaEditor
                label="Area nomor resmi"
                value={
                  input.numberArea || {
                    page: 1,
                    x: 80,
                    y: 180,
                    width: 350,
                    height: 24,
                  }
                }
                onChange={(area) => change("numberArea", area)}
              />
              {Array.from({ length: count }, (_, i) => (
                <AreaEditor
                  key={i}
                  label={`Area TTD ${i + 1}`}
                  value={input.areas[i] || emptyArea()}
                  onChange={(area) => {
                    const areas = [...input.areas];
                    areas[i] = area;
                    change("areas", areas);
                  }}
                />
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!input.stampArea}
                  onChange={(e) =>
                    change(
                      "stampArea",
                      e.target.checked ? emptyArea() : undefined,
                    )
                  }
                />
                Siapkan area stempel opsional
              </label>
              {input.stampArea && (
                <AreaEditor
                  label="Area stempel"
                  value={input.stampArea}
                  onChange={(area) => change("stampArea", area)}
                />
              )}
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Gambar TTD dan stempel hanya diterapkan oleh pejabat aktif setelah
            preview dan konfirmasi. Bukan TTE tersertifikasi. Nomor diterbitkan
            setelah persetujuan, tanpa mengubah tanggal surat.
          </p>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={busy}>
            Simpan Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={busy}
            onClick={() => save(true)}
          >
            Simpan dan Preview
          </Button>
          <Link
            href={id ? `/surat/${id}` : "/surat"}
            className="text-sm underline py-3"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
export function AreaEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SignatureArea;
  onChange: (a: SignatureArea) => void;
}) {
  return (
    <fieldset className="border rounded-xl p-3">
      <legend className="text-sm font-semibold px-2">{label}</legend>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(["page", "x", "y", "width", "height"] as const).map((key) => (
          <Field
            key={key}
            label={
              {
                page: "Halaman",
                x: "Kiri (x)",
                y: "Atas (y)",
                width: "Lebar",
                height: "Tinggi",
              }[key]
            }
            htmlFor={`${label}-${key}`}
          >
            <Input
              id={`${label}-${key}`}
              type="number"
              value={value[key]}
              min={key === "page" ? 1 : 0}
              onChange={(e) =>
                onChange({ ...value, [key]: Number(e.target.value) })
              }
            />
          </Field>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...value })}
      >
        Gunakan Area Ini
      </Button>
    </fieldset>
  );
}
