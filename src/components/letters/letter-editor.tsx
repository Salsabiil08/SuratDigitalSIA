"use client";
import {ActionNotice} from "@/components/ui/action-notice";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { plainTextHtml, sanitizeLetterHtml } from "@/domain/rich-text";
import { DraftInput, SignatureArea, jakartaDate } from "@/domain/workflow";
import {
  getWorkflowOptions,
  getWorkflowLetter,
} from "@/server/actions/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {peerInternal} from "@/domain/peer-internal";
import { higherReviewer } from "@/domain/reviewer-hierarchy";
import { terbilangRupiah } from "@/domain/terbilang";

function draftFromData(
  data: Awaited<ReturnType<typeof getWorkflowLetter>>,
): DraftInput {
  const l = data.letter,
    v = data.versions.find((v) => v.id === l.current_version_id);
  return {
    id: l.id,
    categoryCode: l.document_category?.code || "",
    reviewerId: l.reviewer_id || "",
    reviewRequested: l.review_requested ?? !!l.reviewer_id,
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
    content:
      v?.content_format === "HTML"
        ? sanitizeLetterHtml(v.content_html || "")
        : plainTextHtml(v?.content_html || ""),
    contentFormat: "HTML",
    signatureMode: l.signature_mode,
    signerIds: l.signer_ids || [],
    mandatoryApproverIds: l.mandatory_approver_ids || l.signer_ids || [],
    additionalApproverIds: l.additional_approver_ids || [],
    areas: l.signature_areas || [],
    stampArea: l.stamp_area || undefined,
    numberArea: l.number_area || undefined,
    billing: data.billing
      ? {
          bankId: data.billing.bank_id,
          accountNumber: data.billing.account_number,
          accountHolder: data.billing.payee_name,
          items: data.items,
        }
      : undefined,
  };
}
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
  dispositionSeed,
  initialOptions,
  initialData,
}: {
  source?: "CREATE" | "UPLOAD";
  billing?: boolean;
  id?: string;
  dispositionId?: string;
  dispositionSeed?:{dispositionId:string;recipientId:string;subject:string};
  initialOptions: Awaited<ReturnType<typeof getWorkflowOptions>>;
  initialData?: Awaited<ReturnType<typeof getWorkflowLetter>>;
}) {
  const router = useRouter();
  const options = initialOptions;
  const [input, setInput] = useState<DraftInput>(() =>
    initialData
      ? draftFromData(initialData)
      : {
          source,
          categoryCode: "",
          reviewerId: "",
          reviewRequested: false,
          dispositionId,
          letterTypeCode: billing ? "Tag" : "IN",
          subject: dispositionSeed?.subject||(billing ? "Permintaan Pembayaran" : ""),
          letterDate: jakartaDate(),
          dateReason: "",
          recipientUserId: dispositionSeed?.recipientId||"",
          recipientName: "",
          recipientOrg: "",
          recipientAddress: "",
          content: billing ? "<p>Mohon dapat disetujui pembayaran melalui bank yang tercantum, sebagai berikut:</p>" : "",
          contentFormat: "HTML",
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
                  { description: "", amount: 0, documentNumber: "", payeeName: "", bankName: "", accountNumber: "" },
                ],
              }
            : undefined,
        },
  );
  const changeContent = useCallback((content: string) => {
    setInput(x => x.content === content ? x : { ...x, content, contentFormat: "HTML" });
  }, []);
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [currentFormat, setCurrentFormat] = useState(
    initialData?.versions.find(
      (v) => v.id === initialData.letter.current_version_id,
    )?.file_format || "DOCX",
  );
  const [oldDate] = useState(initialData?.letter.letter_date || "");
  const [formal, setFormal] = useState(
    !!initialData?.letter.signer_ids?.length,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function change<K extends keyof DraftInput>(key: K, value: DraftInput[K]) {
    setInput((x) => ({ ...x, [key]: value }));
  }
  function setType(type: DraftInput["letterTypeCode"]) {
    setInput((x) => ({
      ...x,
      letterTypeCode: type,
      signerIds: [],
      reviewerId: "",
      mandatoryApproverIds: [],
      additionalApproverIds: [],
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
  const recipient=options.people.find(p=>p.id===input.recipientUserId);
  const peer=peerInternal(input.letterTypeCode,options.user.position?.level||0,recipient?.level||0);
  const count = internal ? (peer ? 0 : formal ? 1 : 0) : isBill ? 2 : 1;
  const reviewers = options.people.filter(p => p.id !== options.user.id && higherReviewer(options.user.position?.level || 0,p.level) && options.reviewerGrants.some(g => g.reviewerId === p.id && (!g.typeCode || g.typeCode === input.letterTypeCode)));
  const signers = options?.people.filter((p) => p.signer) || [];
  function updateSigner(index: number, value: string) {
    const ids = [...input.signerIds];
    ids[index] = value;
    setInput(x=>({...x,signerIds:ids.slice(0,count),mandatoryApproverIds:differentSigners?(x.mandatoryApproverIds||[]):ids.slice(0,count)}));
  }
  const [differentSigners,setDifferentSigners]=useState(()=>!!initialData?.letter.mandatory_approver_ids?.some((value:string,i:number)=>value!==initialData.letter.signer_ids?.[i]));
  useEffect(()=>{
    if(peer || count===0)return;
    setInput(old=>{
      const signerIds=Array.from({length:count},(_,i)=>{const eligible=signers.filter(p=>!isBill||(i===0?p.position==='SM':p.position==='DIR'));return old.signerIds[i] || (eligible.length===1?eligible[0]!.id:'');});
      const mandatoryApproverIds=Array.from({length:count},(_,i)=>{const eligible=signers.filter(p=>!isBill||(i===0?p.position==='SM':p.position==='DIR'));return differentSigners?(old.mandatoryApproverIds?.[i] || (eligible.length===1?eligible[0]!.id:'')):signerIds[i]!;});
      if(JSON.stringify(signerIds)===JSON.stringify(old.signerIds)&&JSON.stringify(mandatoryApproverIds)===JSON.stringify(old.mandatoryApproverIds))return old;
      return {...old,signerIds,mandatoryApproverIds};
    });
  },[peer,count,isBill,differentSigners,options.people]);
  const canChooseDifferentSigners = differentSigners || Array.from({length:count},(_,i)=>signers.filter(p=>!isBill||(i===0?p.position==='SM':p.position==='DIR')).length).some(n=>n>1);
  const additionalApprovers=options.people.filter(p=>options.approverGrants.some(g=>g.approverId===p.id&&(!g.typeCode||g.typeCode===input.letterTypeCode)));
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
        mandatoryApproverIds: input.mandatoryApproverIds?.slice(0,count) || ids,
        additionalApproverIds: peer ? [] : input.additionalApproverIds,
        stampArea: peer ? undefined : input.stampArea,
        areas: currentFormat === "PDF" ? input.areas.slice(0, count) : [],
      };
      if(dispositionSeed&&!input.id){const keyName=`siadocs-disposition-draft-${dispositionSeed.dispositionId}`;let key=sessionStorage.getItem(keyName);if(!key){key=crypto.randomUUID();sessionStorage.setItem(keyName,key);}data.dispositionDraftKey=key;}
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
      if(dispositionSeed)sessionStorage.removeItem(`siadocs-disposition-draft-${dispositionSeed.dispositionId}`);
      router.push(`/surat/${result.id}${preview ? "?preview=1" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  const canBackdate = ["GM", "SM", "DIR"].includes(
    options?.user.position?.code || "",
  );
  return (
    <div className="max-w-6xl w-full space-y-5">
      <PageHeader
        title={
          id
            ? "Edit Draft"
            : isBill
              ? "Surat Pengantar Tagihan"
              : input.source === "UPLOAD"
                ? "Impor Surat / Ambil Nomor"
                : "Buat Surat"
        }
      />
      {dispositionSeed&&<p className="text-sm border rounded-xl p-3">Surat hasil baru untuk pemberi disposisi. Selesaikan alur surat dan kirim resmi sebelum mengajukan hasil. <Link className="text-brand-red underline" href={`/disposisi?tugas=${dispositionSeed.dispositionId}`}>Kembali ke Disposisi</Link></p>}
      {initialData?.replyContext.links.filter(r=>r.direction==='ORIGIN').map(r=><p key={r.id} className="text-sm border rounded-xl p-3">Balasan untuk surat {r.officialNumber||r.letterId}. Penerima tetap pengirim resmi surat asal. <Link prefetch={false} className="text-brand-red underline" href={`/surat/${r.letterId}`}>Buka Surat Asal</Link></p>)}
      {error && (
        <ActionNotice>
          {error}
        </ActionNotice>
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
          <Field label="Perlu pemeriksaan isi?" htmlFor="letter-review-needed">
            <Select id="letter-review-needed" value={input.reviewRequested ? 'yes' : 'no'} onChange={e=>setInput(old=>({...old,reviewRequested:e.target.value==='yes',reviewerId:e.target.value==='yes'?old.reviewerId:''}))}>
              <option value="no">Tidak</option><option value="yes">Ya</option>
            </Select>
          </Field>
          {input.reviewRequested && <Field label="Pemeriksa Surat" htmlFor="letter-reviewer">
            <Select id="letter-reviewer" disabled={reviewers.length===0} value={input.reviewerId || ''} onChange={e=>change('reviewerId',e.target.value)}>
              <option value="">Pilih pemeriksa</option>
              {reviewers.map(p=><option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}
            </Select>
            <p className="text-xs text-neutral-600">{reviewers.length===0?'Pemeriksa belum tersedia. Hubungi Super Admin. Draf tetap dapat disimpan.':'Pilih pemeriksa sebelum mengajukan surat.'}</p>
          </Field>}
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
                disabled={!!dispositionSeed||!!initialData?.dispositionContext.tasks.some(t=>t.isResult)||!!initialData?.replyContext.links.some(r=>r.direction==='ORIGIN')}
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
          ) : isBill ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-sm">Kepada: Direktur Utama PT Semen Indonesia Aceh. Dari: SM pengaju yang dipilih pada bagian pengesahan. Penerima pembayaran diisi pada rincian tagihan.</p>
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
                label={isBill ? "Kalimat Pengantar Pembayaran" : "Isi Surat"}
                htmlFor="letter-content"
                required
              >
                <RichTextEditor
                  value={input.content || ""}
                  onChange={changeContent}
                />
              </Field>
              <a
                className="text-brand-red underline text-sm"
                href="/api/kop/unduh"
              >
                Unduh kop DOCX
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
                hint="Gunakan template SIADocs agar nomor dan area tanda tangan dapat dikenali. Untuk mengoreksi dokumen impor, edit berkas di luar aplikasi lalu unggah kembali selama masih draf."
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
            <h2 className="font-bold">Rincian Permintaan Pembayaran</h2>
            <p className="text-sm text-neutral-600">Setiap baris akan ditampilkan sebagai tabel pada surat. Isi bank penyalur serta rekening masing-masing penerima.</p>
            <Field label="Bank Penyalur Pembayaran" htmlFor="bank" required>
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
            {input.billing.items.map((item, index) => (
              <div className="grid sm:grid-cols-2 gap-3" key={index}>
                <div className="sm:col-span-2 font-semibold">Rincian {index + 1}</div>
                {([{key:'documentNumber',label:'No Dokumen'},{key:'payeeName',label:'Penerima Pembayaran'},{key:'bankName',label:'Bank Penerima'},{key:'accountNumber',label:'No Rekening Penerima'}] as const).map(({key,label})=>(
                  <Field key={key} label={label} htmlFor={`${key}-${index}`} required>
                    <Input id={`${key}-${index}`} value={item[key] || ''} required maxLength={key==='documentNumber'?120:500} onChange={e=>{const items=[...input.billing!.items];items[index]={...item,[key]:e.target.value};change('billing',{...input.billing!,items});}}/>
                  </Field>
                ))}
                <Field label={`Keterangan ${index + 1}`} htmlFor={`item-${index}`}>
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
                      { description: "", amount: 0, documentNumber: "", payeeName: input.billing!.accountHolder, bankName: options.banks.find(b=>b.id===input.billing!.bankId)?.name||input.billing!.bankName||"", accountNumber: input.billing!.accountNumber },
                    ],
                  })
                }
              >
                Tambah Rincian
              </Button>
              {input.billing.items.length > 1 && (
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
        {internal && !recipient && <Card className="p-5"><p className="text-sm text-neutral-600">Pilih penerima untuk melihat kebutuhan persetujuan dan tanda tangan.</p></Card>}
        {peer && <Card className="p-5"><p className="text-sm">Surat ini tidak memerlukan persetujuan atau tanda tangan.</p></Card>}
        {(!internal || !!recipient) && !peer && <>
        {(count > 0 || additionalApprovers.length > 0) && <Card className="p-5 space-y-4">

          <h2 className="font-bold">{differentSigners?"Persetujuan Surat":"Persetujuan dan Tanda Tangan"}</h2>
          
          {Array.from({length:count},(_,index)=><Field key={`approval-${index}`} label={isBill?(index===0?'SM pengaju':'Direktur'):differentSigners?'Penyetuju surat':'Penyetuju dan penandatangan'} required>
            <OfficialChoice people={signers.filter(p=>!isBill||(index===0?p.position==='SM':p.position==='DIR'))} value={input.mandatoryApproverIds?.[index] || input.signerIds[index] || ''} onChange={value=>{if(!differentSigners){updateSigner(index,value);return;}const ids=[...(input.mandatoryApproverIds||[])];ids[index]=value;change('mandatoryApproverIds',ids);}} />
          </Field>)}
          {additionalApprovers.length > 0 && <Field label="Penyetuju tambahan (opsional)">
            {additionalApprovers.map(p=><label key={p.id} className="flex gap-2 text-sm"><input type="checkbox" checked={input.additionalApproverIds?.includes(p.id)||false} onChange={e=>change('additionalApproverIds',e.target.checked?[...(input.additionalApproverIds||[]),p.id]:(input.additionalApproverIds||[]).filter(id=>id!==p.id))}/>{p.name} — {p.title}</label>)}
          </Field>}
        </Card>}
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Cara Penandatanganan</h2>
          {count>0&&canChooseDifferentSigners&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={differentSigners} onChange={e=>setDifferentSigners(e.target.checked)}/>Penandatangan berbeda dari penyetuju</label>}

          {internal && !peer && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formal}
                onChange={(e) => {
                  setFormal(e.target.checked);
                  change("signerIds", []);
                }}
              />
              Surat ini memerlukan satu tanda tangan.
            </label>
          )}
          {!internal && (
            <p className="text-sm">
              {isBill
                ? "Dua tanda tangan berurutan: SM pengaju, lalu Direktur."
                : "Surat eksternal memerlukan satu tanda tangan SM atau Direktur."}
            </p>
          )}
          {differentSigners && Array.from({ length: count }, (_, index) => (
            <Field
              key={index}
              label={
                isBill
                  ? index === 0
                    ? "Senior Manager (tahap 1)"
                    : "Direktur (tahap 2)"
                  : "Pejabat Penandatangan"
              }
              htmlFor={`signer-${index}`}
              required
            >
              <OfficialChoice id={`signer-${index}`} people={signers.filter(p=>!isBill||(index===0?p.position==='SM':p.position==='DIR'))} value={input.signerIds[index] || ''} onChange={value=>updateSigner(index,value)} />
            </Field>
          ))}
          {count > 0 && (
            <Field label="Cara penandatanganan" htmlFor="signature-mode">
              <Select
                id="signature-mode"
                value={input.signatureMode}
                onChange={(e) => change("signatureMode", e.target.value as any)}
              >
                <option value="IN_APP">
                  Melalui SIADocs
                </option>
                <option value="EXTERNAL">
                  Di luar SIADocs — unduh surat
                </option>
              </Select>
            </Field>
          )}

        </Card>
        </>}
        {currentFormat === "PDF" && input.source === "UPLOAD" && <Card className="p-5 space-y-4">
          {currentFormat === "PDF" && input.source === "UPLOAD" && (
            <div className="space-y-4">
              <p className="text-sm">
                Tentukan posisi nomor pada dokumen. Jika tanda tangan diperlukan, tentukan juga areanya. Periksa hasilnya pada pratinjau.
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
              {count > 0 && <label className="flex items-center gap-2 text-sm">
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
              </label>}
              {count > 0 && input.stampArea && (
                <AreaEditor
                  label="Area stempel"
                  value={input.stampArea}
                  onChange={(area) => change("stampArea", area)}
                />
              )}
            </div>
          )}
        </Card>}
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
            Simpan dan Pratinjau
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

function OfficialChoice({people,value,onChange,id}:{people:{id:string;name:string;title:string}[];value:string;onChange:(value:string)=>void;id?:string}){
 if(people.length===1 && (!value||value===people[0]!.id))return <p className="py-2 text-sm font-semibold">{people[0]!.name}</p>;
 if(!people.length)return <p className="text-sm text-amber-800">Belum ada pejabat berwenang. Hubungi pengelola.</p>;
 return <Select id={id} value={value} onChange={e=>onChange(e.target.value)} required><option value="">Pilih pejabat</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}</Select>;
}
