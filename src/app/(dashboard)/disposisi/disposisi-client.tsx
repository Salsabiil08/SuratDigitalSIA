"use client";
import {DispositionStatusBanner} from '@/components/letters/disposition-status-banner';
import {startLiveUpdates} from '@/domain/live-updates';
import {ActionNotice} from "@/components/ui/action-notice";
import React,{ useState,useEffect,useRef } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import {
  getDispositionsAction,
  createDispositionAction,
  updateDispositionAction,
  updateDispositionStatusAction,
  DispositionItem,
  DispositionsData,
} from "@/server/actions/dispositions";
const labels: Record<DispositionItem["status"], string> = {
  NEW: "Baru",
  IN_PROGRESS: "Sedang dikerjakan",
  IN_REVIEW: "Menunggu pemeriksaan pemberi",
  REVISION_REQUESTED: "Perlu perbaikan",
  DONE: "Selesai — hasil diterima",
};
const priorities = { NORMAL: "Biasa", IMPORTANT: "Penting", URGENT: "Segera" };
export function DisposisiClient({
  initialData,
  initialError,
  sourceLetterId,
  selectedTaskId,
}: {
  initialData: DispositionsData;
  initialError?: string;
  sourceLetterId?:string;
  selectedTaskId?:string;
}) {
  const [data, setData] = useState(initialData),
    [tab, setTab] = useState<"INBOX" | "OUTBOX">(
      selectedTaskId&&initialData.outbox.some(d=>d.id===selectedTaskId)?"OUTBOX":initialData.canReceiveDisposition ? "INBOX" : "OUTBOX",
    );
  const source=initialData.availableLetters.find(l=>l.id===sourceLetterId);
  const [show, setShow] = useState(!!source),
    [editing, setEditing] = useState<DispositionItem | null>(null),
    [selected, setSelected] = useState<DispositionItem | null>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialError || "");
  const [messageKind,setMessageKind]=useState<"success"|"error">("error");
  const [subject, setSubject] = useState(source?`Tindak lanjut: ${source.subject}`:""),
    [instruction, setInstruction] = useState(""),
    [recipientId, setRecipient] = useState(""),
    [unit, setUnit] = useState(""),
    [priority, setPriority] = useState<"NORMAL" | "IMPORTANT" | "URGENT">(
      "NORMAL",
    ),
    [dueDate, setDue] = useState(""),
    [requiresLetter, setRequires] = useState(false),
    [letterId, setLetter] = useState(source?.id||"");
  const [attachmentIds,setAttachmentIds]=useState<string[]>([]);
  function intent(scope:string,payload:unknown){const slot=`siadocs-disp-${scope}`;const value=JSON.stringify(payload);const old=JSON.parse(sessionStorage.getItem(slot)||'null');if(old?.value===value&&old?.key)return old.key as string;const key=crypto.randomUUID();sessionStorage.setItem(slot,JSON.stringify({key,value}));return key;}
  useEffect(()=>{setData(initialData);},[initialData]);
  useEffect(()=>{if(selectedTaskId)document.getElementById(`disposisi-${selectedTaskId}`)?.scrollIntoView({block:'center'});},[selectedTaskId]);
  const busyRef=useRef(false), pauseRefresh=useRef(false);pauseRefresh.current=busy||!!selected;
  const [syncError,setSyncError]=useState('');
  const [loadFailed,setLoadFailed]=useState(!!initialError);
  useEffect(()=>{let alive=true;const stop=startLiveUpdates({poll:true,blocked:()=>pauseRefresh.current,onError:()=>{if(alive)setSyncError('Pembaruan disposisi tertunda. Data terakhir tetap ditampilkan.');},refresh:async()=>{const res=await getDispositionsAction(sourceLetterId);if(!res.success)throw new Error(res.error);if(alive){setData(res.data);setLoadFailed(false);setSyncError('');setMessage(previous=>previous===initialError?'':previous);}}}, {window,document,navigator});return()=>{alive=false;stop();};},[sourceLetterId,initialError]);
  async function refresh() {
    const res = await getDispositionsAction(sourceLetterId);
    if (!res.success) throw new Error(res.error);
    setData(res.data);
  }
  async function act(
    d: DispositionItem,
    action: "START" | "SUBMIT" | "ACCEPT" | "RETURN",
  ) {
    if(busyRef.current)return;busyRef.current=true;
    setBusy(true);
    setMessage("");
    let saved=false;
    try {
      const r = await updateDispositionStatusAction({
        dispositionId: d.id,
        revision: d.revision,
        action,
        note,
        operationKey:intent(`action-${d.id}`,{revision:d.revision,action,note,attachmentIds}),
        attachmentIds,
      });
      if (!r.success) throw new Error(r.error);
      saved=true;
      setSelected(null);
      setNote("");setAttachmentIds([]);
      await refresh();
      setMessageKind("success");
      setMessage(
        action === "SUBMIT"
          ? "Hasil dikirim kepada pemberi untuk diperiksa."
          : action === "ACCEPT"
            ? "Hasil diterima. Disposisi selesai."
            : action === "RETURN"
              ? "Arahan perbaikan dikirim kepada penerima."
              : "Disposisi mulai dikerjakan.",
      );
    } catch (e) {
      setMessageKind(saved?"success":"error");
      setMessage(saved?"Tindakan berhasil. Status terbaru belum dapat dimuat. Buka kembali halaman disposisi.":e instanceof Error ? e.message : "Proses gagal.");
    } finally {
      busyRef.current=false;
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload={recipientId,subject,instruction,priority,dueDate:dueDate||undefined,requiresLetter,letterId:letterId||undefined};
      const r = editing
        ? await updateDispositionAction({
            dispositionId: editing.id,
            revision: editing.revision,
            operationKey: intent(`edit-${editing.id}`, {revision:editing.revision,...payload}),
            recipientId,
            subject,
            instruction,
            priority,
            dueDate: dueDate || undefined,
            requiresLetter,
          })
        : await createDispositionAction({
            operationKey:intent('create',payload),
            recipientId,
            subject,
            instruction,
            priority,
            dueDate: dueDate || undefined,
            requiresLetter,
            letterId: letterId || undefined,
          });
      if (!r.success) throw new Error(r.error);
      setShow(false);
      setEditing(null);
      if(!editing){setSubject("");setInstruction("");setLetter("");setRequires(false);sessionStorage.removeItem('siadocs-disp-create');}
      setTab("OUTBOX");
      await refresh();
      setMessageKind("success");
      setMessage(editing?"Perubahan disposisi tersimpan.":"Disposisi dikirim. Penerima dapat membuat surat tindak lanjut dari tugas ini.");
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : editing?"Gagal memperbarui disposisi.":"Gagal mengirim disposisi.");
    } finally {
      setBusy(false);
    }
  }
  function openCreate() {
    setEditing(null);
    setSubject(source?`Tindak lanjut: ${source.subject}`:"");
    setInstruction("");
    setRecipient("");
    setUnit("");
    setPriority("NORMAL");
    setDue("");
    setRequires(false);
    setLetter(source?.id||"");
    setShow(true);
  }
  function openEdit(d:DispositionItem) {
    setEditing(d);
    setSubject(d.subject);
    setInstruction(d.instruction);
    setRecipient(d.recipientId);
    setUnit(data.availableProfiles.find(p=>p.id===d.recipientId)?.unitCode||"");
    setPriority(d.priority);
    setDue(d.dueDate||"");
    setRequires(d.requiresLetter);
    setShow(true);
  }
  const list = tab === "INBOX" ? data.inbox : data.outbox;
  const units = Array.from(
    new Map(
      data.availableProfiles.map((p) => [p.unitCode, p.unitName]),
    ).entries(),
  );
  return (
    <div className="space-y-4">
      <PageHeader
        title="Disposisi"
        actions={
          data.canCreateDisposition ? (
            <Button size="sm" onClick={openCreate}>
              + Buat Disposisi
            </Button>
          ) : undefined
        }
      />
      {sourceLetterId&&!source&&<ActionNotice>Surat ini tidak tersedia untuk dibuatkan disposisi oleh akun Anda.</ActionNotice>}
      {selectedTaskId&&![...data.inbox,...data.outbox].some(d=>d.id===selectedTaskId)&&<ActionNotice>Disposisi tidak tersedia untuk akun Anda.</ActionNotice>}
      {message && (
        <ActionNotice kind={messageKind}>
          {message}
        </ActionNotice>
      )}
      <div className="flex flex-wrap gap-2">
        {data.canReceiveDisposition && (
          <Button
            variant={tab === "INBOX" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("INBOX")}
          >
            Disposisi Masuk ({data.inbox.length})
          </Button>
        )}
        {data.canCreateDisposition && (
          <Button
            variant={tab === "OUTBOX" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("OUTBOX")}
          >
            Disposisi Keluar ({data.outbox.length})
          </Button>
        )}
      </div>
      {!list.length && !loadFailed && (
        <Card className="p-8 text-center text-sm text-neutral-500">
          Belum ada disposisi {tab === "INBOX" ? "masuk" : "keluar"}.
        </Card>
      )}
      {syncError&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{syncError}</p>}
      {list.map((d) => (
        <Card id={`disposisi-${d.id}`} key={d.id} className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <b>{d.subject}</b>
            <Chip variant={d.priority === "URGENT" ? "red" : "gray"}>
              {priorities[d.priority]}
            </Chip>
          </div>
          <DispositionStatusBanner task={d}/>
          <p className="text-sm whitespace-pre-wrap">{d.instruction}</p>
          {d.dueDate&&<p className="text-xs text-neutral-500">Batas waktu: {new Date(d.dueDate+'T00:00:00+07:00').toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})}</p>}
          {d.letterId && (
            <Link
              className="text-sm text-brand-red underline"
              href={`/surat/${d.letterId}`}
            >
              Lihat surat acuan {d.letterNumber}
            </Link>
          )}
          {!d.sourceAccessible&&d.integrated&&<p className="text-xs text-neutral-500">Akses dokumen acuan diperiksa terpisah; penugasan tidak otomatis membukanya.</p>}
          {d.responseLetterId && (
            <div>
              <Link
                className="text-sm text-brand-red underline"
                href={`/surat/${d.responseLetterId}`}
              >
                Buka Surat Tindak Lanjut
                {d.responseLabel ? ` — ${d.responseLabel}` : ""}
              </Link>
            </div>
          )}
          {d.followUpNote && (
            <p className="rounded-lg bg-green-50 p-3 text-sm">
              <b>Hasil pekerjaan:</b> {d.followUpNote}
            </p>
          )}
          {d.reviewNote && (
            <p className={`rounded-lg p-3 text-sm ${d.status==='REVISION_REQUESTED'?'bg-amber-50':'bg-neutral-50'}`}>
              <b>{d.status==='REVISION_REQUESTED'?'Perbaikan yang diminta:':'Catatan pemeriksaan terdahulu:'}</b> {d.reviewNote}
            </p>
          )}
          {d.integrated&&<div className="space-y-2 text-sm">
          {d.files.map(f=><p key={f.id}><a className="text-brand-red underline" href={`/api/dispositions/${d.id}/attachments/${f.id}`}>Unduh lampiran hasil — {f.file_name}</a></p>)}
          {tab==='INBOX'&&['NEW','IN_PROGRESS','REVISION_REQUESTED'].includes(d.status)&&<label className="block">Tambah lampiran (semua jenis file, maks. 1 MB)<input type="file" className="block w-full min-w-0 max-w-full" disabled={busy} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setMessage("");setBusy(true);try{const form=new FormData();form.set('file',f);form.set('key',intent(`upload-${d.id}`,{name:f.name,size:f.size,modified:f.lastModified}));const res=await fetch(`/api/dispositions/${d.id}/attachments`,{method:'POST',body:form});const j=await res.json();if(!res.ok)throw new Error(j.error);await refresh();setMessageKind('success');setMessage('Lampiran hasil tersimpan; belum diajukan untuk pemeriksaan.');}catch(err){setMessageKind('error');setMessage(err instanceof Error?err.message:'Unggah gagal.');}finally{setBusy(false);e.target.value='';}}}/></label>}
          {d.submissions.length>0&&<details><summary className="cursor-pointer font-semibold">Riwayat hasil dan pemeriksaan</summary>
          {d.submissions.map(s=><div key={s.id} className="border rounded-xl p-3"><p>Hasil diajukan: {new Date(s.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB — {s.note}</p>{s.decision&&<p>{s.decision.decision==='RETURN'?'Perbaikan diminta':'Diterima / Selesai'}: {s.decision.note||'Hasil diterima'} — {new Date(s.decision.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p>}</div>)}</details>}
          </div>}
          <div className="flex flex-wrap gap-2">
            {tab === "INBOX" &&
              ["NEW", "IN_PROGRESS", "REVISION_REQUESTED"].includes(
                d.status,
              ) && (
                <>
                  {d.status === "NEW" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => act(d, "START")}
                    >
                      Mulai Kerjakan
                    </Button>
                  )}
                  {(!d.responseLetterId ||
                    (!d.responseEditable &&
                      d.status === "REVISION_REQUESTED")) && (
                    <Link
                      className="inline-flex items-center rounded-full bg-brand-red px-4 py-2 text-sm text-white"
                      href={`/surat/buat?disposisi=${d.id}`}
                    >
                      {d.responseLetterId
                        ? "Buat Surat Perbaikan"
                        : "Buat Surat Tindak Lanjut"}
                    </Link>
                  )}
                  {d.responseEditable && (
                    <Link
                      className="inline-flex items-center rounded-full border px-4 py-2 text-sm"
                      href={`/surat/${d.responseLetterId}/edit`}
                    >
                      Lanjutkan Draft Surat
                    </Link>
                  )}
                  <Button
                    size="sm"
                    disabled={busy || ((d.requiresLetter || (d.integrated&&!!d.responseLetterId)) && !d.responseFinal)}
                    disabledReason={(d.requiresLetter || (d.integrated&&!!d.responseLetterId)) && !d.responseFinal ? (d.integrated ? "Surat tindak lanjut belum siap. Selesaikan finalisasi dan pengiriman kepada pemberi disposisi." : "Selesaikan finalisasi surat tindak lanjut terlebih dahulu.") : undefined}
                    onClick={() => {
                      setSelected(d);
                      setNote(d.followUpNote || "");setAttachmentIds(d.files.map(f=>f.id));
                    }}
                  >
                    Kirim Hasil untuk Diperiksa
                  </Button>
                </>
              )}
            {tab === "OUTBOX" && d.status === "IN_REVIEW" && (
              <Button
                size="sm"
                onClick={() => {
                  setSelected(d);
                  setNote("");
                }}
              >
                Periksa Hasil
              </Button>
            )}
            {tab === "OUTBOX" && d.editable && (
              <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                Edit Disposisi
              </Button>
            )}
          </div>
        </Card>
      ))}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              tab === "INBOX"
                ? "Kirim hasil pekerjaan"
                : "Periksa hasil pekerjaan"
            }
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4 rounded-2xl bg-white p-6"
          >
            <h2 className="font-bold">
              {tab === "INBOX"
                ? "Kirim Hasil Pekerjaan"
                : "Periksa Hasil Pekerjaan"}
            </h2>
            <p className="text-sm">{selected.subject}</p>
            {selected.responseLetterId && (
              <Link
                target="_blank"
                className="text-brand-red underline"
                href={`/surat/${selected.responseLetterId}`}
              >
                Buka surat tindak lanjut untuk diperiksa
              </Link>
            )}
            {selected.followUpNote && tab === "OUTBOX" && (
              <p className="text-sm whitespace-pre-wrap">
                Hasil: {selected.followUpNote}
              </p>
            )}
            <Field required={tab === "INBOX"}
              label={
                tab === "INBOX"
                  ? "Catatan hasil pekerjaan"
                  : "Catatan perbaikan — wajib untuk meminta perbaikan"
              }
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={5000}
              />
            </Field>
            {tab==='INBOX'&&selected.integrated&&selected.files.length>0&&<fieldset className="text-sm"><legend>Lampiran yang disertakan pada pengajuan ini</legend>{selected.files.map(f=><label key={f.id} className="block"><input type="checkbox" checked={attachmentIds.includes(f.id)} onChange={e=>setAttachmentIds(ids=>e.target.checked?[...ids,f.id]:ids.filter(id=>id!==f.id))}/> {f.file_name}</label>)}</fieldset>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Tutup
              </Button>
              {tab === "INBOX" ? (
                <Button
                  disabledReason={!note.trim()?"Isi catatan hasil pekerjaan terlebih dahulu.":undefined}
                  isLoading={busy} loadingLabel="Mengirim hasil…"
                  onClick={() => act(selected, "SUBMIT")}
                >
                  Kirim kepada Pemberi
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    disabled={busy || !note.trim()} disabledReason={!note.trim()?"Isi catatan perbaikan untuk mengaktifkan tombol Minta Perbaikan.":undefined}
                    onClick={() => act(selected, "RETURN")}
                  >
                    Minta Perbaikan
                  </Button>
                  <Button
                    isLoading={busy}
                    onClick={() => act(selected, "ACCEPT")}
                  >
                    Terima Hasil dan Selesaikan
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={create}
            role="dialog"
            aria-modal="true"
            aria-label={editing?"Edit disposisi":"Buat disposisi"}
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6"
          >
            <h2 className="font-bold">{editing?"Edit Disposisi":"Buat Disposisi"}</h2>
            <Field label="Perihal" required>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={250}
              />
            </Field>
            <Field label="Unit penerima">
              <Select
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setRecipient("");
                }}
              >
                <option value="">Semua unit</option>
                {units.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Penerima" required>
              <Select
                value={recipientId}
                onChange={(e) => setRecipient(e.target.value)}
                required
              >
                <option value="">Pilih penerima</option>
                {editing && !data.availableProfiles.some(p=>p.id===editing.recipientId) && <option value={editing.recipientId}>{editing.recipientName} — Penerima saat ini</option>}
                {data.availableProfiles
                  .filter((p) => !unit || p.unitCode === unit)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} — {p.roleInfo}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Arahan pekerjaan" required>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                required
                maxLength={5000}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prioritas">
                <Select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as typeof priority)
                  }
                >
                  {Object.entries(priorities).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Batas waktu">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDue(e.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requiresLetter}
                onChange={(e) => setRequires(e.target.checked)}
              />
              Wajib membuat surat tindak lanjut
            </label>
            {!editing&&<Field label="Surat acuan (opsional)">
              <Select
                value={letterId}
                onChange={(e) => setLetter(e.target.value)}
              >
                <option value="">Tanpa surat acuan</option>
                {data.availableLetters.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.officialNumber} — {l.subject} ({l.status})
                  </option>
                ))}
              </Select>
            </Field>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setShow(false)}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={busy}>
                {editing?"Simpan Perubahan":"Kirim Disposisi"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
