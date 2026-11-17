/**
 * Penempatan dan pemeriksaan nomor pada dokumen. Sumber: Blueprint R.03 bagian 6.16.
 * Cakupan awal (MVP): DOCX memakai penanda {{NOMOR_SURAT}}, PDF memakai koordinat (halaman, kiri, atas, lebar, tinggi dalam mm).
 * Tahap berikutnya (belum tersedia): menyeret kotak pada pratinjau PDF. Tanpa OCR atau AI.
 */
export const DOCX_MARKER = '{{NOMOR_SURAT}}';
export type PlacementMode = 'TEMPLATE' | 'MARKER' | 'COORDINATE';

export interface CoordinatePosition { page: number; leftMm: number; topMm: number; widthMm: number; heightMm: number }
export const A4_MM = { width: 210, height: 297 } as const;

export function validateCoordinate(p: CoordinatePosition, pageCount: number): string[] {
  const e: string[] = [];
  if (!Number.isInteger(p.page) || p.page < 1 || p.page > pageCount) e.push('halaman di luar jumlah halaman dokumen');
  if (p.leftMm < 0 || p.topMm < 0) e.push('posisi tidak boleh negatif');
  if (p.widthMm <= 0 || p.heightMm <= 0) e.push('lebar dan tinggi harus lebih dari nol');
  if (p.leftMm + p.widthMm > A4_MM.width || p.topMm + p.heightMm > A4_MM.height) e.push('area melewati tepi halaman');
  return e;
}

/** DOCX harus punya tepat satu penanda sebelum penerbitan. */
export function checkDocxMarker(text: string): { ok: boolean; message?: string } {
  const n = text.split(DOCX_MARKER).length - 1;
  if (n === 0) return { ok: false, message: 'penanda posisi nomor tidak ditemukan' };
  if (n > 1) return { ok: false, message: 'penanda posisi nomor muncul lebih dari satu kali' };
  return { ok: true };
}

export interface VerifyResult { ok: boolean; reason?: 'MARKER_REMAINS' | 'NUMBER_MISSING' | 'NUMBER_DUPLICATED' | 'NUMBER_MISMATCH' }
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Pemeriksaan DOCX: penanda hilang dan nomor resmi muncul tepat sekali. */
export function verifyDocx(text: string, officialNumber: string): VerifyResult {
  if (text.includes(DOCX_MARKER)) return { ok: false, reason: 'MARKER_REMAINS' };
  const n = norm(text).split(norm(officialNumber)).length - 1;
  if (n === 0) return { ok: false, reason: 'NUMBER_MISSING' };
  if (n > 1) return { ok: false, reason: 'NUMBER_DUPLICATED' };
  return { ok: true };
}
/** Pemeriksaan PDF: hanya teks pada area nomor yang dibandingkan dengan nomor resmi. */
export function verifyPdfArea(areaText: string, officialNumber: string): VerifyResult {
  return norm(areaText) === norm(officialNumber) ? { ok: true } : { ok: false, reason: 'NUMBER_MISMATCH' };
}

/**
 * Bila pembuatan atau pemeriksaan dokumen gagal: TIDAK ada nomor baru. Nomor tetap terikat pada surat,
 * pembuatan diulang dengan nomor yang sama, dan setelah gagal berulang penerbitan ditandai tertunda.
 */
export function onVerifyFailure(attempt: number, maxAttempts = 3): 'RETRY_SAME_NUMBER' | 'MARK_PENDING_AND_NOTIFY' {
  return attempt < maxAttempts ? 'RETRY_SAME_NUMBER' : 'MARK_PENDING_AND_NOTIFY';
}
