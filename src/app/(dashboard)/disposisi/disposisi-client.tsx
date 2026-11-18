"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import {
  getDispositionsAction,
  createDispositionAction,
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
}: {
  initialData: DispositionsData;
  initialError?: string;
}) {
  const [data, setData] = useState(initialData),
    [tab, setTab] = useState<"INBOX" | "OUTBOX">(
      initialData.canReceiveDisposition ? "INBOX" : "OUTBOX",
    );
  const [show, setShow] = useState(false),
    [selected, setSelected] = useState<DispositionItem | null>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialError || "");
  const [subject, setSubject] = useState(""),
    [instruction, setInstruction] = useState(""),
    [recipientId, setRecipient] = useState(""),
    [unit, setUnit] = useState(""),
    [priority, setPriority] = useState<"NORMAL" | "IMPORTANT" | "URGENT">(
      "NORMAL",
    ),
    [dueDate, setDue] = useState(""),
    [requiresLetter, setRequires] = useState(true),
    [letterId, setLetter] = useState("");
  async function refresh() {
    const res = await getDispositionsAction();
    if (!res.success) throw new Error(res.error);
    setData(res.data);
  }
  async function act(
    d: DispositionItem,
    action: "START" | "SUBMIT" | "ACCEPT" | "RETURN",
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await updateDispositionStatusAction({
        dispositionId: d.id,
        revision: d.revision,
        action,
        note,
      });
      if (!r.success) throw new Error(r.error);
      setSelected(null);
      setNote("");
      await refresh();
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
      setMessage(e instanceof Error ? e.message : "Proses gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await createDispositionAction({
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
      setSubject("");
      setInstruction("");
      setLetter("");
      setRequires(true);
      setTab("OUTBOX");
      await refresh();
      setMessage(
        "Disposisi dikirim. Penerima dapat membuat surat tindak lanjut dari tugas ini.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal mengirim disposisi.");
    } finally {
      setBusy(false);
    }
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
            <Button size="sm" onClick={() => setShow(true)}>
              + Buat Disposisi
            </Button>
          ) : undefined
        }
      />
      <p className="text-sm text-neutral-600">
        Penerima mengerjakan arahan dan membuat surat tindak lanjut. Hasil
        dikirim kembali kepada pemberi untuk diperiksa, diperbaiki bila perlu,
        lalu diterima.
      </p>
      {message && (
        <div role="status" className="rounded-xl border bg-white p-3 text-sm">
          {message}
        </div>
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
      {!list.length && (
        <Card className="p-8 text-center text-sm text-neutral-500">
          Belum ada disposisi {tab === "INBOX" ? "masuk" : "keluar"}.
        </Card>
      )}
      {list.map((d) => (
        <Card key={d.id} className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <b>{d.subject}</b>
            <Chip variant={d.status === "DONE" ? "green" : "blue"}>
              {labels[d.status]}
            </Chip>
            <Chip variant={d.priority === "URGENT" ? "red" : "gray"}>
              {priorities[d.priority]}
            </Chip>
          </div>
          <p className="text-sm whitespace-pre-wrap">{d.instruction}</p>
          <p className="text-xs text-neutral-500">
            Pemberi: {d.giverName} · Penerima: {d.recipientName}
            {d.dueDate &&
              ` · Batas waktu: ${new Date(d.dueDate + "T00:00:00").toLocaleDateString("id-ID")}`}
          </p>
          {d.letterId && (
            <Link
              className="text-sm text-brand-red underline"
              href={`/surat/${d.letterId}`}
            >
              Lihat surat acuan {d.letterNumber}
            </Link>
          )}
          {d.responseLetterId && (
            <div>
              <Link
                className="text-sm text-brand-red underline"
                href={`/surat/${d.responseLetterId}`}
              >
                Lihat surat tindak lanjut
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
            <p className="rounded-lg bg-amber-50 p-3 text-sm">
              <b>Catatan pemeriksaan:</b> {d.reviewNote}
            </p>
          )}
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
                    disabled={busy || (d.requiresLetter && !d.responseFinal)}
                    onClick={() => {
                      setSelected(d);
                      setNote(d.followUpNote || "");
                    }}
                  >
                    Kirim Hasil untuk Diperiksa
                  </Button>
                  {d.requiresLetter && !d.responseFinal && (
                    <p className="w-full text-xs text-neutral-500">
                      Simpan, ajukan, dan selesaikan surat tindak lanjut
                      terlebih dahulu. Nomor serta pengesahan mengikuti alur
                      surat biasa.
                    </p>
                  )}
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
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"
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
            <Field
              label={
                tab === "INBOX"
                  ? "Catatan hasil pekerjaan"
                  : "Catatan pemeriksaan (wajib bila perlu perbaikan)"
              }
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={5000}
              />
            </Field>
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
                  isLoading={busy}
                  onClick={() => act(selected, "SUBMIT")}
                >
                  Kirim kepada Pemberi
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    disabled={busy || !note.trim()}
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
            aria-label="Buat disposisi"
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6"
          >
            <h2 className="font-bold">Buat Disposisi</h2>
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
            <div className="grid grid-cols-2 gap-3">
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
            <p className="text-xs text-neutral-500">
              Penerima membuat surat baru dari disposisi ini. Setelah surat
              selesai, hasil kembali kepada Anda untuk diperiksa.
            </p>
            <Field label="Surat acuan (opsional)">
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
            </Field>
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
                Kirim Disposisi
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
