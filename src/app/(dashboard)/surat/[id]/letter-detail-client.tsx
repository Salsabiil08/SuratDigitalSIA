"use client";
import {LetterCommentsPanel} from "@/components/letters/letter-comments-panel";
import {responseLabel} from "@/domain/letter-comments";
import {ActionNotice} from "@/components/ui/action-notice";
import {DispositionLetterPanel} from "@/components/letters/disposition-letter-panel";
import {OfficialReplyPanel} from "@/components/letters/official-reply-panel";
import { decideReviewAction } from "@/server/actions/reviews";
import { sendInternalLetterAction,receiveInternalLetterAction } from "@/server/actions/delivery";
import {useSearchParams} from "next/navigation";
import { displayLabel } from "@/domain/display-labels";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getWorkflowLetter,
  reviewLetterAction,
  finalizeLetterAction,
  restartApprovalAction,
} from "@/server/actions/workflow";
import { issueLetterNumberAction } from "@/server/actions/approvals";
import { cancellationAction } from "@/server/actions/cancellations";
import { workflowLabel } from "@/domain/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentDownloads } from "@/components/letters/document-downloads";
import { DocumentPreview } from "@/components/letters/document-preview";
import {startLiveUpdates} from "@/domain/live-updates";
import {letterNextStep} from "@/domain/letter-next-step";
import { RefreshStatusButton } from "@/components/letters/refresh-status-button";
import { SignPanel } from "@/components/letters/sign-panel";
export function LetterDetailClient({
  id,
  initialData,
}: {
  id: string;
  initialData: Awaited<ReturnType<typeof getWorkflowLetter>>;
}) {
  const params=useSearchParams();const origin=params.get('asal');
  const backTo=origin==='kotak-masuk'?'/kotak-masuk':origin==='kotak-keluar'?'/kotak-keluar':'/surat';
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getWorkflowLetter>>>(initialData);
  useEffect(()=>setData(initialData),[initialData]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [external, setExternal] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [confirmSelf,setConfirmSelf]=useState(false);
  const [sendConfirmed,setSendConfirmed]=useState(false);
  const [ccIds,setCcIds]=useState<string[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => { setPreviewed(false); }, [data.letter.current_version_id,data.letter.revision]);
  const reload = useCallback(async () => {
    const result = await getWorkflowLetter(id);
    setData(previous=>JSON.stringify(previous)===JSON.stringify(result)?previous:result);
  }, [id]);
  async function act(
    fn: () => Promise<{ success: boolean; error?: string }>,
    success: string,
  ) {
    if (busyRef.current) return;
    busyRef.current=true;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await fn();
      if (!r.success) throw new Error(r.error);
      setMsg(success);
      try {await reload();}catch{setSyncError("Tindakan berhasil. Status terbaru belum dapat dimuat. Gunakan Perbarui status.");}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proses gagal.");
    } finally {
      busyRef.current=false;
      setBusy(false);
    }
  }
  const busyRef=useRef(busy);busyRef.current=busy;
  const [syncError,setSyncError]=useState('');
  useEffect(()=>{
    let active=true;
    const waiting=['IN_REVIEW','READY_TO_ISSUE','NUMBERED'].includes(data.letter.status)||data.letter.review_status==='WAITING';
    const stop=startLiveUpdates({poll:waiting,blocked:()=>busyRef.current,onError:()=>setSyncError('Pembaruan otomatis tertunda. Sambungan akan dicoba kembali.'),refresh:async()=>{
      const result=await getWorkflowLetter(id);if(active){setData(previous=>JSON.stringify(previous)===JSON.stringify(result)?previous:result);setSyncError('');}
    }},{window,document,navigator});
    return ()=>{active=false;stop();};
  },[id,data.letter.status,data.letter.review_status]);
  const l = data.letter;
  const v = data.versions.find((v) => v.id === l.current_version_id);
  const editable =
    data.isCreator && ["DRAFT", "REVISION_REQUESTED"].includes(l.status);
  const creatorApprovalRequired = [...(l.mandatory_approver_ids || l.signer_ids || []),...(l.additional_approver_ids || [])].includes(data.userId);
  const activeReview = data.reviews.find(r => r.reviewer_id === data.userId && r.status === 'PENDING' && r.version_id === l.current_version_id && l.review_status === 'WAITING');
  const activeApproval = data.approvals.find(
    (a) => a.approver_id === data.userId && a.status === "PENDING" && a.version_id===l.current_version_id && a.cycle===l.approval_cycle,
  );
  const signing = data.signatures.find(
    (s) => s.signer_id === data.userId && s.status === "PENDING",
  );
  const [hasLayoutCopy,setHasLayoutCopy]=useState(false);
  useEffect(()=>setHasLayoutCopy(false),[id]);
  const next=letterNextStep(l,{creator:data.isCreator,review:!!activeReview,approval:!!activeApproval,signing:!!signing,sent:!!data.delivery?.dispatch,recipient:!!data.delivery?.recipientRole,received:!!data.delivery?.recipients.find((r:any)=>r.profile_id===data.userId)?.received_at});
  const pendingSigner = data.signatures.find(s=>s.status==='PENDING')?.signer as unknown as {full_name?:string}|{full_name?:string}[]|undefined;
  const pendingSignerName = Array.isArray(pendingSigner)?pendingSigner[0]?.full_name:pendingSigner?.full_name;
  const waitingName = !data.delivery?.dispatch && !activeReview && !activeApproval && !signing ? (
    data.reviews.find(r=>r.status==='PENDING'&&r.version_id===l.current_version_id)?.reviewer?.full_name ||
    data.approvals.find(a=>a.status==='PENDING'&&a.version_id===l.current_version_id&&a.cycle===l.approval_cycle)?.approver?.full_name ||
    pendingSignerName
  ) : null;
  const documentUrl = `/api/letters/${id}/document?areas=1&revision=${l.revision}`;
  return (
    <div className="max-w-6xl w-full space-y-5">
      <Link className="text-brand-red text-sm underline" href={backTo}>
        Kembali ke {origin==='kotak-masuk'?'Kotak Masuk':origin==='kotak-keluar'?'Kotak Keluar':'Surat Saya'}
      </Link>
      <PageHeader title={l.subject} actions={<RefreshStatusButton refresh={reload} disabled={busy}/>}/>
      {next.target && !(data.delivery?.dispatch && (!data.delivery?.recipientRole || data.delivery?.recipientRole==='CC' || data.delivery?.recipients.find((r:any)=>r.profile_id===data.userId)?.received_at)) && <a href={`#${next.target}`} className="inline-flex rounded-full bg-brand-red text-white px-4 py-2 text-sm font-semibold">{next.title}</a>}
      {syncError&&<p role="status" className="text-sm text-amber-800">{syncError}</p>}
      {error && (
        <ActionNotice>
          {error}
        </ActionNotice>
      )}
      {msg && (
        <ActionNotice kind="success">
          {msg}
        </ActionNotice>
      )}
      <Card className="p-5 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <span className="text-sm font-bold rounded-full px-3 py-1 bg-orange-100 text-orange-900">
            {workflowLabel(l)}
          </span>
          <span className="text-sm">{l.type.name}</span>
        </div>
        {waitingName&&<p className="text-sm font-semibold">Menunggu: {waitingName}</p>}
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-500">Nomor resmi</dt>
            <dd className="font-mono font-bold">
              {l.official_number || data.manualNumber?.official_number || "Belum diterbitkan"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Tanggal surat</dt>
            <dd>{l.letter_date || "Belum tercatat pada data lama"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Penerima</dt>
            <dd>
              {l.recipient?.full_name ||
                [
                  l.recipient_external_name,
                  l.recipient_external_org,
                  l.recipient_external_address,
                ]
                  .filter(Boolean)
                  .join(" — ")}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Pembuat</dt>
            <dd>
              {l.creator?.full_name} / {l.unit?.name}
            </dd>
          </div>
        </dl>
        <p className="text-sm">
          Pengesahan:{" "}
          {l.required_signature_count === 0
            ? "Tidak memerlukan TTD"
            : `${l.required_signature_count} TTD — ${l.signature_mode === "IN_APP" ? "melalui SIADocs" : "tanda tangan basah di luar sistem"}`}
          .
        </p>
        {l.status_reason && (
          <p className="text-sm">Catatan: {l.status_reason}</p>
        )}
        {l.finalized_at && (
          <p className="text-sm font-semibold">
            Dokumen final terkunci sejak{" "}
            {new Date(l.finalized_at).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB.
          </p>
        )}
      </Card>
      {l.type.category==='INTERNAL' && <Card id="delivery" className="p-5 space-y-3 scroll-mt-24">
        <h2 className="font-bold">Pengiriman dan Penerimaan</h2>
        {!data.delivery?.dispatch && <p className="text-sm">Belum dikirim</p>}
        {data.delivery?.dispatch && <>
          <p className="text-sm">Dikirim pada {new Date(data.delivery.dispatch.sent_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB.</p>
          {(data.delivery.recipients as {profile_id:string;recipient_role:string;read_at:string|null;received_at:string|null}[]).map(r=><p key={r.profile_id} className="text-sm">{r.recipient_role==='PRIMARY'?'Penerima utama':'Tembusan'} · {r.read_at?'Dibaca pada '+new Date(r.read_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Belum dibaca'} · {r.recipient_role==='CC'?'Salinan, tanpa konfirmasi penerimaan utama':r.received_at?'Penerimaan dikonfirmasi':'Belum ada konfirmasi penerimaan'}</p>)}
          <p className="text-xs text-neutral-600">Membuka surat tidak mengonfirmasi penerimaan.</p>
          {data.delivery.recipientRole==='PRIMARY' && !data.delivery.recipients.find((r:any)=>r.profile_id===data.userId)?.received_at && <Button isLoading={busy} onClick={()=>act(()=>receiveInternalLetterAction(data.delivery.dispatch.id),'Penerimaan Anda telah dicatat.')}>Konfirmasi Terima Surat</Button>}
        </>}
        {data.delivery?.canDispatch && l.finalized_at && l.status==='NUMBERED' && !data.delivery.dispatch && <>
          {data.delivery.ccEnabled&&<fieldset className="space-y-1"><legend className="text-sm font-semibold">Tembusan (opsional)</legend>{data.ccOptions.filter(p=>p.id!==l.recipient_user_id).map(p=><label key={p.id} className="flex gap-2 text-sm"><input type="checkbox" checked={ccIds.includes(p.id)} onChange={e=>setCcIds(e.target.checked?[...ccIds,p.id]:ccIds.filter(id=>id!==p.id))}/>{p.full_name}</label>)}</fieldset>}
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={sendConfirmed} onChange={e=>setSendConfirmed(e.target.checked)}/>Saya mengirim dokumen final ini kepada {l.recipient?.full_name||'penerima utama yang tercatat'}. Pengiriman resmi dicatat dan penerima mendapat akses.</label>
          <Button disabled={!sendConfirmed} disabledReason={!sendConfirmed?"Centang konfirmasi pengiriman terlebih dahulu.":undefined} loadingLabel="Mengirim…" isLoading={busy} onClick={()=>act(()=>sendInternalLetterAction(id,ccIds),'Surat resmi telah dikirim. Penerimaan menunggu konfirmasi penerima.')}>Kirim Surat Internal</Button>
        </>}
      </Card>}
      <Card id="preview" className="p-5 space-y-4 scroll-mt-24">
        <h2 className="font-bold">Pratinjau Dokumen</h2>
        {v ? (
          <>
            <DocumentPreview
              url={documentUrl}
              format={v.file_format}
              onLayoutCopy={setHasLayoutCopy}
              onLoaded={() => {setPreviewed(true);void reload().catch(()=>setSyncError("Status pembacaan belum dapat diperbarui. Gunakan Perbarui status."));}}
            />
            <DocumentDownloads id={id} current={v}
              unsigned={data.versions.find(version => version.version_kind === 'NUMBERED')}
              signatureCount={l.required_signature_count}
              fullVersionAccess={!!data.delivery?.fullVersionAccess} />

          </>
        ) : (
          <p className="text-sm text-amber-800">
            Dokumen surat lama belum tersimpan. Pengelola perlu memeriksa
            kelengkapannya; sistem tidak membuat dokumen atau TTD pengganti.
          </p>
        )}
      </Card>
      {editable && l.review_status==='NOT_STARTED' && !l.reviewer_id && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Pemeriksa wajib belum dipilih. <Link className="font-semibold text-red-800 underline" href={`/surat/${id}/edit`}>Lengkapi Pemeriksa</Link>. Jika daftar kosong, hubungi pengelola. Draf tetap tersimpan.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <>
            <Link href={`/surat/${id}/edit`}>
              <Button variant="secondary">Edit / Koreksi Draft</Button>
            </Link>
            {creatorApprovalRequired && ["PASSED","NOT_REQUIRED"].includes(l.review_status) && <label className="text-sm flex items-start gap-2"><input type="checkbox" checked={confirmSelf} onChange={e=>setConfirmSelf(e.target.checked)}/>Saya mengajukan dan menyetujui versi ini sesuai kewenangan saya. Persetujuan pejabat lain, nomor resmi, dan tanda tangan tetap melalui tahapnya.</label>}
            <Button
              disabled={!previewed} disabledReason={!previewed?"Tunggu pratinjau selesai dimuat, lalu periksa dokumen.":l.review_status==='NOT_STARTED'&&!l.reviewer_id?"Pilih pemeriksa melalui Edit / Koreksi Draft. Jika daftar kosong, hubungi pengelola.":creatorApprovalRequired&&!confirmSelf&&["PASSED","NOT_REQUIRED"].includes(l.review_status)?"Centang persetujuan sesuai kewenangan Anda sebelum mengajukan.":undefined}
              isLoading={busy} loadingLabel="Mengajukan…"
              onClick={() =>
                act(
                  async () => {
                    if(l.previewed_revision!==l.revision){const checked=await reviewLetterAction(id,"PREVIEW",l.revision);if(!checked.success)return checked;}
                    return reviewLetterAction(id,"SUBMIT",l.revision,undefined,confirmSelf);
                  },
                  "Surat berhasil diajukan sesuai alur kewenangan.",
                )
              }
            >
              {l.review_status === "PASSED" ? ((l.mandatory_approver_ids||l.signer_ids||[]).length+(l.additional_approver_ids||[]).length===0?"Lanjutkan ke Penomoran":"Ajukan Persetujuan") : "Ajukan Surat"}
            </Button>
          </>
        )}
        {data.isCreator && l.status === "READY_TO_ISSUE" && (
          <Button id="number"
            isLoading={busy}
            onClick={() =>
              act(
                () => issueLetterNumberAction(id),
                l.manual_number_reservation_id ? "Dokumen bernomor siap dilanjutkan." : "Nomor resmi berhasil diterbitkan. Tanggal surat tetap.",
              )
            }
          >
            {l.manual_number_reservation_id ? "Lanjutkan Dokumen Bernomor" : "Terbitkan Nomor Surat"}
          </Button>
        )}
      </div>
      {activeReview && <Card className="p-5 space-y-4">
        <h2 className="font-bold">Hasil Pemeriksaan Naskah</h2>
        <p className="text-sm">Beri catatan pemeriksaan. Perubahan isi dilakukan pembuat surat.</p>
        <label htmlFor="review-note" className="block text-sm">Catatan (wajib untuk memberi catatan atau meminta perbaikan)</label>
        <textarea id="review-note" className="w-full border rounded-xl p-3" value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex gap-3 flex-wrap">{([['COMMENT','Simpan Catatan'],['PASS','Lolos Pemeriksaan'],['REQUEST_REVISION','Minta Perbaikan']] as const).map(([action,label]) =>
          <Button key={action} disabled={!previewed} disabledReason={!previewed?"Tunggu pratinjau selesai dimuat, lalu periksa dokumen.":action!=='PASS'&&!note.trim()?"Isi catatan pemeriksaan terlebih dahulu.":undefined} isLoading={busy} variant={action === 'PASS' ? 'primary' : 'secondary'} onClick={() => act(() => decideReviewAction(activeReview.id, activeReview.version_id, l.revision, action, note), 'Hasil pemeriksaan tersimpan.')}>{label}</Button>)}</div>
      </Card>}

      {data.isCreator && !l.official_number && !l.finalized_at && ['IN_REVIEW','READY_TO_ISSUE'].includes(l.status) && <Card className="p-5 space-y-3"><h2 className="font-bold">Koreksi Pengajuan</h2><p className="text-sm">Tarik pengajuan untuk menyimpan versi koreksi. Keputusan lama tetap tercatat dan tidak berlaku untuk versi baru.</p><textarea aria-label="Alasan koreksi" className="border rounded-xl p-3 w-full" value={note} onChange={e=>setNote(e.target.value)}/><Button variant="secondary" isLoading={busy} onClick={()=>act(()=>restartApprovalAction(id,l.revision,note),'Pengajuan ditarik. Edit dan simpan versi baru sebelum mengajukan kembali.')}>Tarik untuk Koreksi</Button></Card>}
      {activeApproval && (
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">
            Keputusan Persetujuan — tahap {activeApproval.step_order}
          </h2>
          <label className="block text-sm" htmlFor="approval-note">
            Catatan / alasan (wajib untuk revisi atau penolakan)
          </label>
          <textarea
            id="approval-note"
            className="w-full border rounded-xl p-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["APPROVE", "Setujui"],
                ["REQUEST_REVISION", "Minta Revisi"],
                ["REJECT", "Tolak"],
              ] as const
            ).map(([action, label]) => (
              <Button
                key={action}
                variant={action === "APPROVE" ? "primary" : "secondary"}
                disabled={!previewed} disabledReason={!previewed?"Tunggu pratinjau selesai dimuat, lalu periksa dokumen.":action!=="APPROVE"&&!note.trim()?"Isi catatan alasan terlebih dahulu.":undefined}
                isLoading={busy}
                onClick={() =>
                  act(
                    () => reviewLetterAction(id, action, l.revision, note),
                    "Keputusan tersimpan.",
                  )
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {signing && (
        <Card id="signing" className="p-5 scroll-mt-24">
          <SignPanel
            key={`${l.revision}-${signing.id}`}
            letter={l}
            request={signing}
            onSaved={() => {
              setMsg("Surat berhasil ditandatangani.");
              void reload().catch(()=>setError("Status belum dapat diperbarui. Coba lagi."));
            }}
          />
        </Card>
      )}
      {data.isCreator && l.status === "NUMBERED" && !l.finalized_at && (
        <Card id="finalize" className="p-5 space-y-4 scroll-mt-24">
          <h2 className="font-bold">Finalisasi</h2>
          <p className="text-sm">
            Periksa dokumen resmi sebelum mengunci. Dokumen final tidak dapat
            diedit melalui alur biasa.
          </p>
          {l.signature_mode === "EXTERNAL" &&
            l.required_signature_count > 0 && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={external}
                  onChange={(e) => setExternal(e.target.checked)}
                />
                Saya mengonfirmasi seluruh TTD wajib pada dokumen sudah
                diselesaikan di luar SIADocs. Ini pernyataan pembuat, bukan
                verifikasi TTD oleh sistem.
              </label>
            )}
          <Button
            disabled={
              !previewed ||
              (l.signature_mode === "IN_APP" &&
                l.required_signature_count > 0 &&
                l.signature_status !== "UPLOADED")
            }
            disabledReason={!previewed ? "Tunggu pratinjau selesai dimuat, lalu periksa dokumen." : l.signature_mode==='IN_APP' && l.required_signature_count>0 && l.signature_status!=='UPLOADED' ? "Tunggu seluruh tanda tangan wajib selesai." : l.signature_mode==='EXTERNAL'&&l.required_signature_count>0&&!external ? "Centang konfirmasi bahwa tanda tangan di luar SIADocs telah selesai." : undefined}
            isLoading={busy} loadingLabel="Memfinalisasi…"
            onClick={() =>
              act(
                () => finalizeLetterAction(id, l.revision, external),
                "Dokumen berhasil difinalisasi dan dikunci.",
              )
            }
          >
            Finalisasi dan Kunci Dokumen
          </Button>
        </Card>
      )}
      {(editable || l.status === "NUMBERED") && (
        <details><summary className="cursor-pointer text-sm text-neutral-600">Opsi pembatalan surat</summary><Card className="p-5 space-y-3">
          <h2 className="font-bold">Pembatalan Surat</h2>
          <p className="text-sm">
            Nomor resmi tetap disimpan dan tidak dipakai ulang. Surat bernomor
            memerlukan otorisasi kepala unit/delegasi (internal), penandatangan
            (eksternal), atau Senior Manager dan Direktur (tagihan).
          </p>
          <label className="text-sm block" htmlFor="cancel-reason">
            Alasan / catatan pembatalan
          </label>
          <textarea
            id="cancel-reason"
            className="w-full border rounded-xl p-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {data.isCreator && (
            <Button
              variant="secondary"
              disabledReason={!note.trim()?"Isi alasan pembatalan terlebih dahulu.":undefined}
              isLoading={busy}
              onClick={() =>
                act(
                  () =>
                    cancellationAction(
                      id,
                      editable ? "CANCEL_DRAFT" : "REQUEST",
                      note,
                    ),
                  editable ? "Draf berhasil dibatalkan." : "Permohonan pembatalan berhasil diajukan.",
                )
              }
            >
              {editable ? "Batalkan Draft" : "Ajukan Pembatalan Resmi"}
            </Button>
          )}
          {data.cancellations.map((r: any) => (
            <div className="text-sm space-y-2" key={r.id}>
              <p>
                {displayLabel(r.status)} — {r.reason}
              </p>
              {r.status === "PENDING" &&
                r.cancellation_authorizations?.some(
                  (a: any) => a.authorizer_id === data.userId && !a.decision,
                ) && (
                  <div className="flex gap-3">
                    <Button
                      isLoading={busy}
                      onClick={() =>
                        act(
                          () => cancellationAction(id, "APPROVE", note),
                          "Keputusan otorisasi tersimpan.",
                        )
                      }
                    >
                      Setujui Pembatalan
                    </Button>
                    <Button
                      variant="secondary"
                      isLoading={busy}
                      onClick={() =>
                        act(
                          () => cancellationAction(id, "DECLINE", note),
                          "Penolakan pembatalan tersimpan.",
                        )
                      }
                    >
                      Tolak Pembatalan
                    </Button>
                  </div>
                )}
            </div>
          ))}
        </Card></details>
      )}
      <LetterCommentsPanel letterId={id} context={data.commentContext} onChanged={()=>{void reload().catch(()=>setSyncError("Komentar terkirim. Status tanggapan belum dapat diperbarui."));}}/>
      <OfficialReplyPanel letterId={id} context={data.replyContext}/>
      <DispositionLetterPanel letterId={id} context={data.dispositionContext}/>
      {(hasLayoutCopy || data.reviews.length>0 || data.approvals.length>0 || data.signatures.length>0) && <details id="history" className="rounded-xl border bg-white p-5 space-y-3"><summary className="cursor-pointer font-bold">Riwayat Surat</summary>
        {hasLayoutCopy&&<a className="inline-block text-sm text-brand-red underline" href={`${documentUrl}&original=1&download=1`}>Unduh dokumen sebelum penyesuaian format</a>}
        {data.reviews.map(r => <div key={r.id} className="text-sm border-b pb-2">
          <p>{r.reviewer?.full_name} — {r.status === 'PASSED' ? 'Lolos pemeriksaan' : r.status === 'REVISION_REQUESTED' ? 'Perlu perbaikan' : 'Menunggu pemeriksaan'}{r.version_id !== l.current_version_id ? ' (pemeriksaan naskah sebelum perubahan dokumen)' : ''}</p>
          {r.decision_note && <p>Catatan: {r.decision_note}</p>}
          {r.comments.map((c: { id: string; note: string }) => <p key={c.id}>Catatan pemeriksa: {c.note}</p>)}
        </div>)}
        {data.approvals.map((a) => (
          <p key={a.id} className="text-sm border-b py-2">
            Pengajuan {a.cycle}, tahap {a.step_order}:{" "}
            {(a.approver as any)?.full_name} — {displayLabel(a.status)}
            {a.version_id!==l.current_version_id && <span className="text-neutral-500"> · {a.cycle===l.approval_cycle && a.version_id===l.approval_plan_version ? "Naskah sebelum penomoran" : "Versi sebelumnya"}</span>}
            {a.decision_note ? ` · ${a.decision_note}` : ""}
            {a.decided_at
              ? ` · ${new Date(a.decided_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
              : ""}
          </p>
        ))}
        {data.signatures.map((s) => (
          <p key={s.id} className="text-sm border-b py-2">
            TTD {s.sign_order}: {(s.signer as any)?.full_name} —{" "}
            {displayLabel(s.status)}{" "}
            {s.method === "IMAGE"
              ? "· Gambar tanda tangan"
              : s.method === "WET_UPLOAD"
                ? "· Unggahan tanda tangan basah"
                : ""}
            {s.stamp_included ? " · Dengan stempel" : ""}
            {s.uploaded_at
              ? ` · ${new Date(s.uploaded_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
              : ""}
          </p>
        ))}
      </details>}
    </div>
  );
}
