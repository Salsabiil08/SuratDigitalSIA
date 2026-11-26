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
import {PdfPlacement} from './pdf-placement';
import { RupiahInput } from "@/components/ui/rupiah-input";
import {peerInternal} from "@/domain/peer-internal";
import { roleReviewer, REVIEWER_ROLE_ORDER } from "@/domain/reviewer-hierarchy";
import { terbilangRupiah } from "@/domain/terbilang";

function draftFromData(
  data: Awaited<ReturnType<typeof getWorkflowLetter>>,
): DraftInput {
  const l = data.letter,
    v = data.versions.find((v) => v.id === l.current_version_id);
  return {
    manualNumberId:l.manual_number_reservation_id || undefined,
    manualNumberConfirmed:false,
    id: l.id,
    categoryCode: l.document_category?.code || "",
    reviewerId: "",
    approvalRequired: l.content_approval_required || false,
    reviewRequested: false,
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
export function LetterEditor({
  manualReservation,
  source = "CREATE",
  billing = false,
  id,
  dispositionId,
  dispositionSeed,
  initialOptions,
  initialData,
}: {
  manualReservation?:import("@/server/manual-numbers").ManualNumber;
  source?: "CREATE" | "UPLOAD";
  billing?: boolean;
  id?: string;
  dispositionId?: string;
  dispositionSeed?:{dispositionId:string;recipientId:string;subject:string};
  initialOptions: Awaited<ReturnType<typeof getWorkflowOptions>>;
  initialData?: Awaited<ReturnType<typeof getWorkflowLetter>>;
}) {
  const router = useRouter();
  const manualNumber=manualReservation || initialData?.manualNumber;
  const options = initialOptions;
  const [input, setInput] = useState<DraftInput>(() =>
    initialData
      ? draftFromData(initialData)
      : {
          manualNumberId:manualReservation?.id,
          manualNumberConfirmed:false,
          source,
          categoryCode: "",
          reviewerId: "",
          reviewRequested: false,
          dispositionId,
          letterTypeCode: manualReservation?.typeCode || (billing ? "Tag" : "IN"),
          subject: manualReservation?.subject || dispositionSeed?.subject||(billing ? "Permintaan Pembayaran" : ""),
          letterDate: jakartaDate(),
          dateReason: "",
          recipientUserId: dispositionSeed?.recipientId||"",
          recipientName: "",
          recipientOrg: "",
          recipientAddress: "",
          content: billing ? "<p>Mohon dapat disetujui pembayaran melalui bank yang tercantum, sebagai berikut:</p>" : "",
          contentFormat: "HTML",
          signatureMode: manualReservation ? "EXTERNAL" : "IN_APP",
          signerIds: manualReservation?.reserved_signer_id ? [manualReservation.reserved_signer_id] : [],
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
  const [stampPrepared,setStampPrepared]=useState(!!initialData?.letter.stamp_area);
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
      billing: type==='Tag' ? (x.billing || {bankId:'',bankName:'',accountNumber:'',accountHolder:'',items:[{description:'',amount:0,documentNumber:'',payeeName:'',bankName:'',accountNumber:''}]}) : undefined,
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
  const canImportBilling=input.source==='UPLOAD' && !!options.financeUnitId && options.user.unit?.id===options.financeUnitId;
  const recipient=options.people.find(p=>p.id===input.recipientUserId);
  const peer=peerInternal(input.letterTypeCode,options.user.position?.level||0,recipient?.level||0);
  const count = internal ? (peer ? 0 : formal ? 1 : 0) : isBill ? 2 : 1;
  const approvers=options.people.filter(p=>p.id!==options.user.id&&roleReviewer(options.user.position?.code||'',p.position)&&(p.position!=='GM'||p.unitId===options.user.unit?.id)).sort((a,b)=>(REVIEWER_ROLE_ORDER[a.position]||0)-(REVIEWER_ROLE_ORDER[b.position]||0)||a.name.localeCompare(b.name,'id'));
  const signers = options?.people.filter((p) => p.signer) || [];
  function updateSigner(index: number, value: string) {
    const ids = [...input.signerIds];
    ids[index] = value;
    setInput(x=>({...x,signerIds:ids.slice(0,count),mandatoryApproverIds:differentSigners?(x.mandatoryApproverIds||[]):ids.slice(0,count)}));
  }
  const [differentSigners,setDifferentSigners]=useState(()=>!isBill||!!initialData?.letter.mandatory_approver_ids?.some((id:string,i:number)=>id!==initialData.letter.signer_ids?.[i]));
  useEffect(()=>setDifferentSigners(!isBill||!!initialData?.letter.mandatory_approver_ids?.some((id:string,i:number)=>id!==initialData.letter.signer_ids?.[i])),[isBill]);
  useEffect(()=>{
    if(peer || count===0)return;
    setInput(old=>{
      const signerIds=Array.from({length:count},(_,i)=>{const eligible=signers.filter(p=>!isBill||(i===0?p.position==='SM':p.position==='DIR'));return old.signerIds[i] || (eligible.length===1?eligible[0]!.id:'');});
      const mandatoryApproverIds=Array.from({length:count},(_,i)=>{const eligible=isBill?signers.filter(p=>i===0?p.position==='SM':p.position==='DIR'):approvers;return differentSigners?(eligible.some(p=>p.id===old.mandatoryApproverIds?.[i])?old.mandatoryApproverIds![i]!:(eligible.length===1?eligible[0]!.id:'')):signerIds[i]!;});
      if(JSON.stringify(signerIds)===JSON.stringify(old.signerIds)&&JSON.stringify(mandatoryApproverIds)===JSON.stringify(old.mandatoryApproverIds))return old;
      return {...old,signerIds,mandatoryApproverIds};
    });
  },[peer,count,isBill,differentSigners,options.people]);

  const additionalApprovers=approvers;
  async function save(preview: boolean) {
    setBusy(true);
    setError("");
    try {
      if(manualNumber && !input.manualNumberConfirmed)throw new Error("Konfirmasi nomor pada dokumen unggahan terlebih dahulu.");
      const ids = input.signerIds.slice(0, count);
      if (ids.length !== count || ids.some((id) => !id))
        throw new Error("Pilih seluruh pejabat penandatangan wajib.");
      const data = {
        ...input,
        signerIds: ids,
        mandatoryApproverIds: options.user.position?.code==='DIR'&&!isBill ? ids : input.mandatoryApproverIds?.slice(0,count) || ids,
        additionalApproverIds: peer || options.user.position?.code==='DIR' ? [] : input.additionalApproverIds,
        approvalRequired:!peer&&options.user.position?.code!=='DIR'&&!!input.approvalRequired,
        stampArea: peer || input.signatureMode==='EXTERNAL' ? undefined : input.stampArea,
        areas: currentFormat === 'PDF' && input.signatureMode==='IN_APP' ? input.areas.slice(0, count) : [],
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
        {manualNumber && <Card className="p-5 space-y-3"><h2 className="font-bold">Nomor Surat</h2><p className="font-mono break-all">{manualNumber.official_number}</p><label className="flex gap-2 text-sm"><input type="checkbox" required checked={!!input.manualNumberConfirmed} onChange={e=>change("manualNumberConfirmed",e.target.checked)}/>Saya sudah mencantumkan nomor ini pada dokumen yang diunggah.</label></Card>}
        {input.source==='UPLOAD' && <Card className="p-5 space-y-4"><h2 className="font-bold">Unggah Surat</h2>
              <Field
                label={
                  id
                    ? "Ganti Dokumen Impor (opsional)"
                    : "Dokumen Impor (PDF/DOCX, maks. 3 MB)"
                }
                htmlFor="document-file"
                hint={manualNumber ? "Unggah surat yang sudah Anda beri nomor. Isi dokumen dipertahankan." : "Isi dan format surat dipertahankan. DOCX memerlukan tempat nomor otomatis; untuk dokumen tanpa tempat tersebut, unggah PDF dan tentukan area nomor."}
              >
                <Input
                  id="document-file"
                  type="file"
                  accept=".pdf,.docx"
                  required={!id}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    change("manualNumberConfirmed",false);
                    if(f){setInput(old=>({...old,numberArea:undefined,areas:[],stampArea:undefined}));setStampPrepared(false);}
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

        </Card>}
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Data Surat</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Jenis Surat" htmlFor="letter-type">
              <Select
                id="letter-type"
                value={input.letterTypeCode}
                disabled={!!id || billing || !!manualNumber}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="IN">Internal</option>
                <option value="KRE">Eksternal</option>
                {(isBill || canImportBilling) && <option value="Tag">Surat Penagihan</option>}
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
          <h2 className="font-bold">{input.source==='UPLOAD'?'Lampiran':'Dokumen dan Isi'}</h2>
          {input.source === "CREATE" && (
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
          )}
          <Field
            label={
              isBill
                ? "Lampiran bukti tagihan (wajib, semua jenis file, maks. 1 MB)"
                : "Lampiran tambahan (opsional, semua jenis file, maks. 1 MB)"
            }
            htmlFor="attachment-file"
          >
            <Input
              id="attachment-file"
              type="file"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
          </Field>
        </Card>
        {isBill && input.source==='CREATE' && input.billing && (
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Rincian Permintaan Pembayaran</h2>
            <p className="text-sm text-neutral-600">Isi rincian pembayaran yang akan dicantumkan pada surat.</p>
            <Field label="Bank Penyalur Pembayaran" htmlFor="bank" required>
              <Select
                id="bank"
                value={input.billing.bankId}
                onChange={(e) =>
                  change("billing", {
                    ...input.billing!,
                    bankId: e.target.value,
                    items:input.billing!.items.map(item=>({...item,bankName:options.banks.find(bank=>bank.id===e.target.value)?.name||input.billing!.bankName||''})),
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
                      items:input.billing!.items.map(item=>({...item,bankName:e.target.value})),
                    })
                  }
                  required
                />
              </Field>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Penerima Pembayaran" htmlFor="payment-payee" required><Input id="payment-payee" value={input.billing.accountHolder} required maxLength={500} onChange={e=>change('billing',{...input.billing!,accountHolder:e.target.value,items:input.billing!.items.map(item=>({...item,payeeName:e.target.value}))})}/></Field>
              <Field label="No. Rekening Penerima" htmlFor="payment-account" required><Input id="payment-account" value={input.billing.accountNumber} required maxLength={500} onChange={e=>change('billing',{...input.billing!,accountNumber:e.target.value,items:input.billing!.items.map(item=>({...item,accountNumber:e.target.value}))})}/></Field>
            </div>
            {input.billing.items.map((item, index) => (
              <div className="grid sm:grid-cols-3 gap-3" key={index}>
                <div className="sm:col-span-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Rincian {index + 1}</h3>{input.billing!.items.length>1 && <Button type="button" variant="ghost" size="sm" aria-label={`Hapus rincian ${index+1}`} onClick={()=>change('billing',{...input.billing!,items:input.billing!.items.filter((_,i)=>i!==index)})}>Hapus</Button>}</div>
                <Field label="No. Dokumen" htmlFor={`documentNumber-${index}`} required>
                  <Input id={`documentNumber-${index}`} value={item.documentNumber||''} required maxLength={120} onChange={e=>{const items=[...input.billing!.items];items[index]={...item,documentNumber:e.target.value};change('billing',{...input.billing!,items});}}/>
                </Field>
                <Field label={`Keterangan ${index + 1}`} htmlFor={`item-${index}`} required>
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
                <Field label={`Nominal ${index + 1} (Rp)`} htmlFor={`amount-${index}`} required>
                  <RupiahInput id={`amount-${index}`} value={item.amount} onValueChange={amount=>{const items=[...input.billing!.items];items[index]={...item,amount};change('billing',{...input.billing!,items});}}/>
                </Field>
              </div>
            ))}
            <div className="min-w-0 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  change("billing", {
                    ...input.billing!,
                    items: [
                      ...input.billing!.items,
                      { description: "", amount: 0, documentNumber: "", payeeName: "", bankName: "", accountNumber: "" },
                    ],
                  })
                }
              >
                Tambah Rincian
              </Button>

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
        {((count > 0 && (isBill || options.user.position?.code!=='DIR')) || additionalApprovers.length > 0) && <Card className="p-5 space-y-4">

          <h2 className="font-bold">{differentSigners?"Persetujuan Surat":"Persetujuan dan Tanda Tangan"}</h2>
          
          {Array.from({length:isBill||options.user.position?.code!=='DIR'?count:0},(_,index)=><Field key={`approval-${index}`} label={isBill?(index===0?'SM pengaju':'Direktur'):differentSigners?'Penyetuju surat':'Penyetuju dan penandatangan'} required>
            <OfficialChoice people={isBill?signers.filter(p=>index===0?p.position==='SM':p.position==='DIR'):approvers} value={input.mandatoryApproverIds?.[index] || input.signerIds[index] || ''} onChange={value=>{if(!differentSigners){updateSigner(index,value);return;}const ids=[...(input.mandatoryApproverIds||[])];ids[index]=value;change('mandatoryApproverIds',ids);}} />
          </Field>)}
          {count===0 && additionalApprovers.length>0 && <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.approvalRequired||false} onChange={e=>setInput(old=>({...old,approvalRequired:e.target.checked,additionalApproverIds:e.target.checked?(additionalApprovers.length===1?[additionalApprovers[0]!.id]:[]):[]}))}/>Perlu persetujuan?</label>
            {input.approvalRequired&&<Field label="Pemberi persetujuan" required htmlFor="content-approver"><Select id="content-approver" required value={input.additionalApproverIds?.[0]||''} onChange={e=>change('additionalApproverIds',e.target.value?[e.target.value]:[])}><option value="">Pilih pemberi persetujuan</option>{additionalApprovers.map(p=><option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}</Select></Field>}
          </>}
        </Card>}
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">Cara Penandatanganan</h2>
          {isBill&&signers.filter(p=>p.position==='SM').length>1&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={differentSigners} onChange={e=>setDifferentSigners(e.target.checked)}/>Penandatangan berbeda dari penyetuju</label>}


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
          {(differentSigners||!isBill) && Array.from({ length: count }, (_, index) => (
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
                  {input.source==='UPLOAD'?"Melalui SIADocs — unggah hasil TTD / gambar TTD":"Melalui SIADocs"}
                </option>
                <option value="EXTERNAL">
                  Di luar SIADocs — unduh surat
                </option>
              </Select>
            </Field>
          )}

        </Card>
        </>}
        {currentFormat==='PDF' && input.source==='UPLOAD' && (!manualNumber || input.signatureMode==='IN_APP' && count>0) && <Card className="p-5">
          <PdfPlacement omitNumber={!!manualNumber} file={file} url={id?`/api/letters/${id}/document?original=1&revision=${initialData?.letter.revision||0}`:undefined}
            numberArea={input.numberArea} signatureAreas={input.areas}
            signatureLabels={input.signatureMode==='IN_APP'?Array.from({length:count},(_,i)=>isBill?(i===0?'TTD SM':'TTD Dirut'):'Tanda Tangan'):[]}
            stampArea={input.stampArea} stampEnabled={stampPrepared && input.signatureMode==='IN_APP' && count>0}
            onStampEnabled={enabled=>{setStampPrepared(enabled);if(!enabled)change('stampArea',undefined);}}
            onPlace={(key,area)=>setInput(old=>{if(key==='number')return {...old,numberArea:area};if(key==='stamp')return {...old,stampArea:area};const index=Number(key.split('-')[1]);const areas=[...old.areas];areas[index]=area;return {...old,areas};})}
            onReset={()=>setInput(old=>({...old,numberArea:undefined,areas:[],stampArea:undefined}))}/>
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
function OfficialChoice({people,value,onChange,id}:{people:{id:string;name:string;title:string}[];value:string;onChange:(value:string)=>void;id?:string}){
 if(people.length===1 && (!value||value===people[0]!.id))return <p className="py-2 text-sm font-semibold">{people[0]!.name}</p>;
 if(!people.length)return <p className="text-sm text-amber-800">Belum ada pejabat berwenang. Hubungi pengelola.</p>;
 return <Select id={id} value={value} onChange={e=>onChange(e.target.value)} required><option value="">Pilih pejabat</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}</Select>;
}
