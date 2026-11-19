"use client";
import {ActionNotice} from "@/components/ui/action-notice";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Textarea } from "@/components/ui/field";
import {
  approveStepAction,
  requestRevisionAction,
  rejectLetterAction,
  getPendingApprovalsAction,
  PendingApprovalData,
} from "@/server/actions/approvals";

export function PersetujuanClient({
  initialData,
}: {
  initialData: PendingApprovalData[];
}) {
  const [approvals, setApprovals] =
    React.useState<PendingApprovalData[]>(initialData);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const selectedItem = approvals[selectedIndex];

  const handleApprove = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setMsg(null);
    try {
      const res = await approveStepAction(selectedItem.id, note);
      if (res.success) {
        setMsg({
          text: `Surat "${selectedItem.subject}" berhasil disetujui.`,
          type: "success",
        });
        setApprovals((prev) => prev.filter((_, idx) => idx !== selectedIndex));
        setSelectedIndex(0);
        setNote("");
      } else {
        setMsg({ text: res.error || "Gagal menyetujui surat.", type: "error" });
      }
    } catch (err: any) {
      setMsg({
        text: err.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedItem) return;
    if (!note.trim()) {
      setMsg({
        text: "Catatan revisi wajib diisi untuk meminta perbaikan surat.",
        type: "error",
      });
      return;
    }
    setIsSubmitting(true);
    setMsg(null);
    try {
      const res = await requestRevisionAction(selectedItem.id, note);
      if (res.success) {
        setMsg({
          text: `Permintaan revisi surat "${selectedItem.subject}" berhasil dikirim.`,
          type: "success",
        });
        setApprovals((prev) => prev.filter((_, idx) => idx !== selectedIndex));
        setSelectedIndex(0);
        setNote("");
      } else {
        setMsg({ text: res.error || "Gagal meminta revisi.", type: "error" });
      }
    } catch (err: any) {
      setMsg({
        text: err.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!note.trim()) {
      setMsg({
        text: "Alasan penolakan wajib diisi untuk menolak surat.",
        type: "error",
      });
      return;
    }
    setIsSubmitting(true);
    setMsg(null);
    try {
      const res = await rejectLetterAction(selectedItem.id, note);
      if (res.success) {
        setMsg({
          text: `Surat "${selectedItem.subject}" berhasil ditolak.`,
          type: "success",
        });
        setApprovals((prev) => prev.filter((_, idx) => idx !== selectedIndex));
        setSelectedIndex(0);
        setNote("");
      } else {
        setMsg({ text: res.error || "Gagal menolak surat.", type: "error" });
      }
    } catch (err: any) {
      setMsg({
        text: err.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Persetujuan Masuk" />

      {msg && <ActionNotice eventKey={msg} kind={msg.type}>{msg.text}</ActionNotice>}

      {approvals.length === 0 ? (
        <Card className="p-12 text-center text-neutral-500 space-y-3">
          <div className="text-3xl">✓</div>
          <div className="text-sm font-semibold text-neutral-800">
            Semua Persetujuan Sudah Selesai
          </div>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Tidak ada naskah surat yang sedang menunggu persetujuan Anda saat
            ini.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Daftar Surat di Kiri */}
          <div className="lg:col-span-1 space-y-3">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider px-1">
              Antrean Persetujuan ({approvals.length})
            </div>
            {approvals.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedIndex(idx);
                  setNote("");
                  setMsg(null);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? "border-brand-red bg-[#FFF4EC] shadow-sm"
                    : "border-[#EEEEEA] bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Chip variant="blue">{item.letterType}</Chip>
                  <span className="text-[11px] font-semibold text-neutral-500">
                    Tahap {item.stepOrder} / {item.totalSteps}
                  </span>
                </div>
                <div className="font-bold text-sm text-neutral-900 leading-snug">
                  {item.subject}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  Pengaju: {item.creatorName}
                </div>
              </div>
            ))}
          </div>

          {/* Panel Rincian & Keputusan di Kanan */}
          {selectedItem && (
            <Card className="lg:col-span-2 p-6 space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EEEEEA]">
                <div>
                  <div className="text-xs text-neutral-500">
                    {selectedItem.letterType} &bull; Tahap{" "}
                    {selectedItem.stepOrder}
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900 mt-0.5">
                    {selectedItem.subject}
                  </h2>
                  <div className="text-xs text-neutral-600 mt-1">
                    Kepada:{" "}
                    <span className="font-semibold">
                      {selectedItem.recipientName}
                    </span>{" "}
                    &bull; Pengaju:{" "}
                    <span className="font-semibold">
                      {selectedItem.creatorName}
                    </span>
                  </div>
                </div>
                <Link href={`/surat/${selectedItem.letterId}`}>
                  <Button variant="outline" size="sm">
                    Buka Dokumen Penuh &rarr;
                  </Button>
                </Link>
              </div>

              <div className="text-sm text-neutral-600">
                <Link
                  className="text-brand-red underline"
                  href={`/surat/${selectedItem.letterId}`}
                >
                  Pratinjau dokumen dan berikan keputusan pada versi terkini →
                </Link>
              </div>

              {/* Input Catatan / Alasan */}
              <Field
                label="Catatan / Alasan Keputusan"
                htmlFor="approval-note"
                hint="Wajib diisi jika Anda memilih Minta Revisi atau Tolak."
              >
                <Textarea
                  id="approval-note"
                  rows={3}
                  placeholder="Tuliskan catatan arahan, butir perbaikan, atau alasan penolakan..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>

              {/* Tombol Keputusan (Sesuai Blueprint R.04: Setujui, Minta Revisi, Tolak) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EEEEEA]">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    isLoading={isSubmitting}
                    onClick={handleReject}
                    className="text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400"
                  >
                    Tolak Surat
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    isLoading={isSubmitting}
                    onClick={handleRequestRevision}
                  >
                    Minta Revisi
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  onClick={() => {
                    window.location.href = `/surat/${selectedItem.letterId}`;
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 font-bold"
                >
                  Pratinjau dan Setujui
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
