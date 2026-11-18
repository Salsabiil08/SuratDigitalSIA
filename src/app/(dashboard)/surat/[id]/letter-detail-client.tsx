"use client";
import { displayLabel } from "@/domain/display-labels";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getWorkflowLetter,
  reviewLetterAction,
  finalizeLetterAction,
} from "@/server/actions/workflow";
import { issueLetterNumberAction } from "@/server/actions/approvals";
import { cancellationAction } from "@/server/actions/cancellations";
import { workflowLabel } from "@/domain/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "@/components/letters/document-preview";
import { SignPanel } from "@/components/letters/sign-panel";
export function LetterDetailClient({
  id,
  initialData,
}: {
  id: string;
  initialData: Awaited<ReturnType<typeof getWorkflowLetter>>;
}) {
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getWorkflowLetter>>>(initialData);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [external, setExternal] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [note, setNote] = useState("");
  const reload = useCallback(async () => {
    try {
      const result = await getWorkflowLetter(id);
      setData(result);
      setPreviewed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Surat tidak tersedia.");
    }
  }, [id]);
  async function act(
    fn: () => Promise<{ success: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await fn();
      if (!r.success) throw new Error(r.error);
      setMsg(success);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proses gagal.");
    } finally {
      setBusy(false);
    }
  }
  const l = data.letter;
  const v = data.versions.find((v) => v.id === l.current_version_id);
  const editable =
    data.isCreator && ["DRAFT", "REVISION_REQUESTED"].includes(l.status);
  const activeApproval = data.approvals.find(
    (a) => a.approver_id === data.userId && a.status === "PENDING",
  );
  const signing = data.signatures.find(
    (s) => s.signer_id === data.userId && s.status === "PENDING",
  );
  const documentUrl = `/api/letters/${id}/document?areas=1&revision=${l.revision}`;
  return (
    <div className="max-w-5xl space-y-5">
      <Link className="text-brand-red text-sm underline" href="/surat">
        Kembali ke Surat Saya
      </Link>
      <PageHeader title={l.subject} />
      {error && (
        <p
          role="alert"
          className="p-3 rounded-xl border bg-red-50 text-red-800"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="p-3 rounded-xl border bg-emerald-50 text-emerald-800"
        >
          {msg}
        </p>
      )}
      <Card className="p-5 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <span className="text-sm font-bold rounded-full px-3 py-1 bg-orange-100 text-orange-900">
            {workflowLabel(l)}
          </span>
          <span className="text-sm">{l.type.name}</span>
        </div>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-500">Nomor resmi</dt>
            <dd className="font-mono font-bold">
              {l.official_number || "Belum diterbitkan"}
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
      <Card className="p-5 space-y-4">
        <h2 className="font-bold">Pratinjau Dokumen</h2>
        {v ? (
          <>
            <DocumentPreview
              url={documentUrl}
              format={v.file_format}
              onLoaded={() => setPreviewed(true)}
            />
            <div className="flex gap-4 flex-wrap">
              <a
                className="text-brand-red underline text-sm"
                href={`/api/letters/${id}/document?download=1`}
              >
                Unduh Dokumen {v.file_format}
              </a>
              <a
                className="text-brand-red underline text-sm"
                href={`/api/letters/${id}/document?download=1&blank=1`}
              >
                Unduh untuk TTD Basah (area kosong)
              </a>
            </div>
            <p className="text-xs text-neutral-500">
              Versi dokumen {v.version_no}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-800">
            Dokumen surat lama belum tersimpan. Pengelola perlu memeriksa
            kelengkapannya; sistem tidak membuat dokumen atau TTD pengganti.
          </p>
        )}
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <>
            <Link href={`/surat/${id}/edit`}>
              <Button variant="secondary">Edit / Koreksi Draft</Button>
            </Link>
            <Button
              variant="secondary"
              disabled={!previewed}
              isLoading={busy}
              onClick={() =>
                act(
                  () => reviewLetterAction(id, "PREVIEW", l.revision),
                  "Pratinjau versi terkini tercatat. Anda dapat mengajukan persetujuan.",
                )
              }
            >
              Konfirmasi Pratinjau
            </Button>
            <Button
              disabled={l.previewed_revision !== l.revision}
              isLoading={busy}
              onClick={() =>
                act(
                  () => reviewLetterAction(id, "SUBMIT", l.revision),
                  "Surat berhasil diajukan sesuai alur kewenangan.",
                )
              }
            >
              Ajukan Persetujuan
            </Button>
          </>
        )}
        {data.isCreator && l.status === "READY_TO_ISSUE" && (
          <Button
            isLoading={busy}
            onClick={() =>
              act(
                () => issueLetterNumberAction(id),
                "Nomor resmi berhasil diterbitkan. Tanggal surat tetap.",
              )
            }
          >
            Terbitkan Nomor Surat
          </Button>
        )}
      </div>
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
                disabled={!previewed}
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
        <Card className="p-5">
          <SignPanel
            key={`${l.revision}-${signing.id}`}
            letter={l}
            request={signing}
            onSaved={() => {
              setMsg("Tanda tangan dan versi hasil tersimpan di Supabase.");
              void reload();
            }}
          />
        </Card>
      )}
      {data.isCreator && l.status === "NUMBERED" && !l.finalized_at && (
        <Card className="p-5 space-y-4">
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
            isLoading={busy}
            onClick={() =>
              act(
                () => finalizeLetterAction(id, l.revision, external),
                "Surat selesai dan dokumen final terkunci.",
              )
            }
          >
            Finalisasi dan Kunci Dokumen
          </Button>
        </Card>
      )}
      {(editable || l.status === "NUMBERED") && (
        <Card className="p-5 space-y-3">
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
              isLoading={busy}
              onClick={() =>
                act(
                  () =>
                    cancellationAction(
                      id,
                      editable ? "CANCEL_DRAFT" : "REQUEST",
                      note,
                    ),
                  "Permohonan pembatalan diproses sesuai kewenangan.",
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
        </Card>
      )}
      <Card className="p-5 space-y-3">
        <h2 className="font-bold">Riwayat Persetujuan dan TTD</h2>
        {data.approvals.map((a) => (
          <p key={a.id} className="text-sm border-b py-2">
            Siklus {a.cycle}, tahap {a.step_order}:{" "}
            {(a.approver as any)?.full_name} — {displayLabel(a.status)}
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
              ? "(gambar TTD, bukan TTE tersertifikasi)"
              : s.method === "WET_UPLOAD"
                ? "(unggahan hasil TTD basah)"
                : ""}
            {s.stamp_included ? " · Dengan stempel" : ""}
            {s.uploaded_at
              ? ` · ${new Date(s.uploaded_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
              : ""}
          </p>
        ))}
        {data.approvals.length === 0 && (
          <p className="text-sm text-neutral-500">
            Belum ada tahapan persetujuan.
          </p>
        )}
      </Card>
    </div>
  );
}
