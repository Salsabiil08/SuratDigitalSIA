import { documentFinality, DOCUMENT_FINALITY_LABEL } from "./status";
export interface SignatureArea {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DraftInput {
  mandatoryApproverIds?: string[];
  additionalApproverIds?: string[];
  categoryCode?: string;
  reviewerId?: string;
  dispositionId?: string;
  replyToDispatchId?: string;
  replyKey?: string;
  id?: string;
  revision?: number;
  source: "CREATE" | "UPLOAD";
  letterTypeCode: "IN" | "KRE" | "Tag";
  subject: string;
  letterDate: string;
  dateReason?: string;
  recipientUserId?: string;
  recipientName?: string;
  recipientOrg?: string;
  recipientAddress?: string;
  content?: string;
  contentFormat?: "TEXT" | "HTML";
  signatureMode: "IN_APP" | "EXTERNAL";
  signerIds: string[];
  areas: SignatureArea[];
  stampArea?: SignatureArea;
  numberArea?: SignatureArea;
  billing?: {
    bankId: string;
    bankName?: string;
    accountNumber: string;
    accountHolder: string;
    items: { description: string; amount: number }[];
  };
}
export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validateLetterDate(
  date: string,
  canBackdate: boolean,
  reason = "",
  today = jakartaDate(),
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw new Error("Tanggal surat tidak valid.");
  if (date < today && (!canBackdate || !reason.trim()))
    throw new Error(
      "Tanggal mundur memerlukan kewenangan GM/SM/Direktur dan alasan.",
    );
}
export function validateArea(
  area: SignatureArea,
  sizes: { width: number; height: number }[],
) {
  const size = sizes[area.page - 1];
  if (
    !Number.isInteger(area.page) ||
    !size ||
    ![area.x, area.y, area.width, area.height].every(Number.isFinite) ||
    area.x < 0 ||
    area.y < 0 ||
    area.width < 20 ||
    area.height < 10 ||
    area.x + area.width > size.width ||
    area.y + area.height > size.height
  )
    throw new Error("Area TTD/stempel berada di luar halaman PDF.");
}
export function workflowLabel(letter: {
  status: string;
  signature_status?: string;
  finalized_at?: string | null;
  review_status?: string | null;
}) {
  if (letter.status === "CANCELLED") return "Dibatalkan";
  if (documentFinality(letter.finalized_at) === "FINAL") return DOCUMENT_FINALITY_LABEL.FINAL;
  if (letter.review_status === "WAITING") return "Menunggu Pemeriksaan";
  if (letter.status === "READY_TO_ISSUE") return "Disetujui";
  if (letter.status === "NUMBERED" && letter.signature_status === "WAITING")
    return "Menunggu TTD";
  return (
    (
      {
        DRAFT: "Draft",
        IN_REVIEW: "Menunggu Persetujuan",
        REVISION_REQUESTED: "Perlu Revisi",
        REJECTED: "Ditolak",
        NUMBERED: "Menunggu Finalisasi",
        CANCELLED: "Dibatalkan",
      } as Record<string, string>
    )[letter.status] || "Belum diketahui"
  );
}
