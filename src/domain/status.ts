/** Status proses/pengesahan baseline tetap kompatibel dengan database.
 * Finalitas dokumen bukan bukti pengiriman, penerimaan atau selesai alur.
 * Review independen dan transaksi distribusi diterapkan pada PR berikutnya.
 */

export const LETTER_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'REVISION_REQUESTED',
  'REJECTED',
  'READY_TO_ISSUE',
  'NUMBERED',
  'CANCELLED',
] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const SIGNATURE_STATUSES = [
  'NOT_STARTED',
  'NOT_REQUIRED',
  'WAITING',
  'UPLOADED',
  'EXTERNAL',
] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export type SignatureMode = 'IN_APP' | 'EXTERNAL';

export const LETTER_SOURCES = ['CREATE', 'UPLOAD'] as const;
export type LetterSource = (typeof LETTER_SOURCES)[number];

/** Status Disposisi (R.04) */
export const DISPOSITION_STATUSES = ['NEW', 'IN_PROGRESS', 'DONE'] as const;
export type DispositionStatus = (typeof DISPOSITION_STATUSES)[number];

/** Label tampilan (bahasa Indonesia). Kode status di database tetap bahasa Inggris. */
export const STATUS_LABEL: Record<LetterStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'Menunggu Persetujuan',
  REVISION_REQUESTED: 'Perlu Revisi',
  REJECTED: 'Ditolak',
  READY_TO_ISSUE: 'Siap Diberi Nomor',
  NUMBERED: 'Sudah Bernomor',
  CANCELLED: 'Dibatalkan',
};

export const SIGNATURE_STATUS_LABEL: Record<SignatureStatus, string> = {
  NOT_STARTED: 'Belum Bernomor',
  NOT_REQUIRED: 'Tidak Perlu Pengesahan',
  WAITING: 'Menunggu Pengesahan',
  UPLOADED: 'Dokumen Bertanda Tangan Terunggah',
  EXTERNAL: 'Di Luar Sistem',
};

export type LetterAction =
  | 'SUBMIT'
  | 'WITHDRAW'
  | 'APPROVE_LAST'
  | 'REQUEST_REVISION'
  | 'REJECT'
  | 'RESUBMIT'
  | 'MARK_READY'
  | 'SUBSTANTIVE_CHANGE'
  | 'ISSUE_NUMBER'
  | 'CANCEL_DRAFT'
  | 'CANCEL_NUMBERED';

const TRANSITIONS: Record<LetterAction, { from: LetterStatus[]; to: LetterStatus }> = {
  SUBMIT: { from: ['DRAFT'], to: 'IN_REVIEW' },
  WITHDRAW: { from: ['IN_REVIEW'], to: 'DRAFT' }, // hanya bila penyetuju aktif belum memutuskan
  APPROVE_LAST: { from: ['IN_REVIEW'], to: 'READY_TO_ISSUE' }, // tidak menerbitkan nomor otomatis
  REQUEST_REVISION: { from: ['IN_REVIEW'], to: 'REVISION_REQUESTED' }, // wajib catatan/alasan
  REJECT: { from: ['IN_REVIEW'], to: 'REJECTED' }, // wajib alasan; tidak dibuka kembali
  RESUBMIT: { from: ['REVISION_REQUESTED'], to: 'IN_REVIEW' },
  MARK_READY: { from: ['DRAFT'], to: 'READY_TO_ISSUE' }, // surat tanpa persetujuan wajib, dokumen valid
  SUBSTANTIVE_CHANGE: { from: ['READY_TO_ISSUE'], to: 'DRAFT' },
  ISSUE_NUMBER: { from: ['READY_TO_ISSUE'], to: 'NUMBERED' }, // aksi eksplisit Terbitkan Nomor Surat (satu transaksi)
  CANCEL_DRAFT: { from: ['DRAFT', 'REVISION_REQUESTED'], to: 'CANCELLED' }, // oleh pembuat, tanpa nomor
  CANCEL_NUMBERED: { from: ['NUMBERED'], to: 'CANCELLED' }, // wajib alasan dan otorisasi sesuai kewenangan
};

export const ACTIONS_REQUIRING_REASON: LetterAction[] = [
  'REQUEST_REVISION',
  'REJECT',
  'CANCEL_NUMBERED',
];

export class TransitionError extends Error {
  constructor(public code: 'INVALID_TRANSITION' | 'REASON_REQUIRED', message: string) {
    super(message);
  }
}

export function nextStatus(from: LetterStatus, action: LetterAction, reason?: string): LetterStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(from)) {
    throw new TransitionError('INVALID_TRANSITION', `${action} tidak berlaku dari status ${from}`);
  }
  if (ACTIONS_REQUIRING_REASON.includes(action) && !reason?.trim()) {
    throw new TransitionError('REASON_REQUIRED', `${action} wajib disertai alasan`);
  }
  return t.to;
}

export const TERMINAL_STATUSES: LetterStatus[] = ['REJECTED', 'CANCELLED'];
export const isTerminal = (s: LetterStatus) => TERMINAL_STATUSES.includes(s);

/** Surat hanya punya nomor resmi pada NUMBERED, atau CANCELLED bila sudah pernah bernomor. */
export const mayHaveOfficialNumber = (s: LetterStatus) => s === 'NUMBERED' || s === 'CANCELLED';

/** Isi dan lampiran hanya dapat diubah pembuat pada status ini. */
export const isEditableByCreator = (s: LetterStatus) => s === 'DRAFT' || s === 'REVISION_REQUESTED';

/**
 * Status pengesahan sesaat setelah nomor terbit (R.04).
 * NUMBERED tidak sama dengan SUDAH DITANDATANGANI.
 */
export function signatureStatusAfterNumbering(
  requiredSignatureCount: number,
  mode: SignatureMode | null
): SignatureStatus {
  if (requiredSignatureCount === 0) return 'NOT_REQUIRED';
  if (mode === 'IN_APP') return 'WAITING';
  if (mode === 'EXTERNAL') return 'EXTERNAL';
  return 'NOT_REQUIRED';
}

/**
 * Aturan penyelesaian disposisi (Blueprint R.04 Bab 6.9):
 * Bila requires_letter = true, disposisi TIDAK BOLEH berstatus DONE (Selesai)
 * sebelum surat yang dikaitkan berstatus NUMBERED (Sudah Bernomor).
 */
export function canCompleteDisposition(
  requiresLetter: boolean,
  letterStatus?: LetterStatus | null
): boolean {
  if (!requiresLetter) return true;
  return letterStatus === 'NUMBERED';
}

/** Dimensi finalitas saja; tidak menyimpulkan pengiriman/penerimaan/selesai alur. */
export type DocumentFinality = 'NOT_FINAL' | 'FINAL';
export const DOCUMENT_FINALITY_LABEL: Record<DocumentFinality, string> = {
  NOT_FINAL: 'Belum final', FINAL: 'Dokumen final',
};
export function documentFinality(finalizedAt?: string | null): DocumentFinality {
  return finalizedAt ? 'FINAL' : 'NOT_FINAL';
}
