/**
 * Penyusunan nomor resmi. Harus identik dengan fungsi SQL build_official_number().
 * Seri awal (Blueprint R.03 tabel Seri Nomor Awal):
 *   eksternal : {URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}
 *   tagihan   : {URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}
 *   internal  : {URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}
 */
export const TOKENS = ['{URUT}', '{TGL}', '{BLN}', '{THN}', '{UNIT}', '{JABATAN}', '{JENIS}'] as const;
export const TIME_ZONE = 'Asia/Jakarta';

export interface NumberInput {
  pattern: string;
  sequence: number;
  issuedAt: Date;
  unit?: string | null;
  position?: string | null;
  type?: string | null;
}

/** Bagian tanggal menurut Asia/Jakarta, bukan zona waktu server. */
export function jakartaParts(d: Date): { year: string; month: string; day: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: p.year!, month: p.month!, day: p.day! };
}

export function buildOfficialNumber(i: NumberInput): string {
  if (!Number.isInteger(i.sequence) || i.sequence < 1) throw new RangeError('nomor urut harus bilangan bulat positif');
  const t = jakartaParts(i.issuedAt);
  return i.pattern
    .replaceAll('{URUT}', String(i.sequence).padStart(3, '0')) // minimal 3 digit, tanpa batas atas
    .replaceAll('{TGL}', t.day)
    .replaceAll('{BLN}', t.month)
    .replaceAll('{THN}', t.year)
    .replaceAll('{UNIT}', i.unit ?? '')
    .replaceAll('{JABATAN}', i.position ?? '')
    .replaceAll('{JENIS}', i.type ?? '');
}

export interface PatternCheck { ok: boolean; errors: string[] }
/** Aturan pola: wajib {URUT} lalu {TGL} menempel, token dikenal saja, {TGL} tepat sebelum / atau - pertama. */
export function validatePattern(pattern: string): PatternCheck {
  const errors: string[] = [];
  const found = pattern.match(/\{[A-Z]+\}/g) ?? [];
  for (const f of found) if (!(TOKENS as readonly string[]).includes(f)) errors.push(`token tidak dikenal: ${f}`);
  if (!pattern.startsWith('{URUT}{TGL}')) errors.push('pola harus diawali {URUT}{TGL}');
  const first = pattern.search(/[\/-]/);
  if (first !== -1 && pattern.slice(0, first) !== '{URUT}{TGL}') errors.push('{TGL} harus tepat sebelum tanda / atau - pertama');
  if (found.filter((f) => f === '{URUT}').length !== 1) errors.push('{URUT} harus muncul tepat satu kali');
  return { ok: errors.length === 0, errors };
}

/** Kunci pencegah nomor ganda untuk satu upaya penerbitan (klik ganda dan retry memakai kunci yang sama). */
export const idempotencyKey = (letterId: string, attempt: string) => `issue:${letterId}:${attempt}`;
