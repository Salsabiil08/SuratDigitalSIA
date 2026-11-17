import { describe, expect, it } from 'vitest';
import { buildOfficialNumber, validatePattern } from '../src/domain/numbering';
import { terbilangRupiah } from '../src/domain/terbilang';
import {
  nextStatus,
  signatureStatusAfterNumbering,
  TransitionError,
  mayHaveOfficialNumber,
  canCompleteDisposition,
  isEditableByCreator,
  isTerminal,
} from '../src/domain/status';

const EXT = '{URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}';
const TAG = '{URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}';
const INT = '{URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}';
const d = (s: string) => new Date(s);

describe('penomoran (R.04)', () => {
  it('contoh pola nomor pada blueprint', () => {
    expect(
      buildOfficialNumber({
        pattern: EXT,
        sequence: 1,
        issuedAt: d('2027-01-05T03:00:00Z'),
        position: 'DIR',
      })
    ).toBe('00105/KRE.DIR/01.2027');

    expect(
      buildOfficialNumber({
        pattern: EXT,
        sequence: 2,
        issuedAt: d('2027-01-06T03:00:00Z'),
        position: 'DIR',
      })
    ).toBe('00206/KRE.DIR/01.2027');

    expect(
      buildOfficialNumber({
        pattern: TAG,
        sequence: 1,
        issuedAt: d('2027-01-05T03:00:00Z'),
        unit: 'ACH',
      })
    ).toBe('00105-Tag/ACH/SIA/01.2027');

    expect(
      buildOfficialNumber({
        pattern: INT,
        sequence: 1,
        issuedAt: d('2027-01-05T03:00:00Z'),
        unit: 'ACH',
        type: 'IN',
      })
    ).toBe('00105-IN/ACH/SIA/01.2027');
  });

  it('tanggal mengikuti Asia/Jakarta (WIB), bukan UTC', () => {
    // 31 Des 2026 18:30 UTC = 1 Jan 2027 01:30 WIB
    expect(
      buildOfficialNumber({
        pattern: EXT,
        sequence: 1,
        issuedAt: d('2026-12-31T18:30:00Z'),
        position: 'SM',
      })
    ).toBe('00101/KRE.SM/01.2027');
  });

  it('nomor urut melebihi 999 menambah digit secara otomatis', () => {
    expect(
      buildOfficialNumber({
        pattern: INT,
        sequence: 1234,
        issuedAt: d('2027-03-10T03:00:00Z'),
        unit: 'ACH',
        type: 'IN',
      })
    ).toBe('123410-IN/ACH/SIA/03.2027');
  });

  it('menolak nomor urut tidak valid (<= 0)', () => {
    expect(() =>
      buildOfficialNumber({ pattern: EXT, sequence: 0, issuedAt: new Date() })
    ).toThrow();
    expect(() =>
      buildOfficialNumber({ pattern: EXT, sequence: -1, issuedAt: new Date() })
    ).toThrow();
  });

  it('validasi pola token', () => {
    expect(validatePattern(EXT).ok && validatePattern(TAG).ok && validatePattern(INT).ok).toBe(
      true
    );
    expect(validatePattern('{TGL}{URUT}/X').ok).toBe(false);
    expect(validatePattern('{URUT}{TGL}/{ABC}').ok).toBe(false);
    expect(validatePattern('{URUT}{BLN}{TGL}/X').ok).toBe(false);
  });
});

describe('status dan transisi (R.04)', () => {
  it('persetujuan terakhir menuju Siap Diberi Nomor (READY_TO_ISSUE), bukan langsung bernomor', () => {
    expect(nextStatus('IN_REVIEW', 'APPROVE_LAST')).toBe('READY_TO_ISSUE');
    expect(() => nextStatus('IN_REVIEW', 'ISSUE_NUMBER')).toThrow(TransitionError);
  });

  it('penerbitan nomor satu transaksi: hanya bisa dilakukan dari READY_TO_ISSUE langsung ke NUMBERED', () => {
    const invalidStatuses = [
      'DRAFT',
      'IN_REVIEW',
      'REVISION_REQUESTED',
      'REJECTED',
      'NUMBERED',
      'CANCELLED',
    ] as const;

    for (const s of invalidStatuses) {
      expect(() => nextStatus(s, 'ISSUE_NUMBER')).toThrow(TransitionError);
    }

    // Penerbitan satu transaksi (R.04)
    expect(nextStatus('READY_TO_ISSUE', 'ISSUE_NUMBER')).toBe('NUMBERED');
  });

  it('alasan/catatan wajib untuk tolak, minta revisi, dan pembatalan surat bernomor', () => {
    expect(() => nextStatus('IN_REVIEW', 'REJECT')).toThrow(/alasan/);
    expect(() => nextStatus('IN_REVIEW', 'REQUEST_REVISION', '  ')).toThrow(/alasan/);
    expect(nextStatus('IN_REVIEW', 'REJECT', 'tidak sesuai')).toBe('REJECTED');
    expect(() => nextStatus('NUMBERED', 'CANCEL_NUMBERED')).toThrow(/alasan/);
    expect(nextStatus('NUMBERED', 'CANCEL_NUMBERED', 'salah tujuan surat')).toBe('CANCELLED');
  });

  it('status terminal (REJECTED dan CANCELLED) tidak dapat dibuka kembali', () => {
    for (const s of ['REJECTED', 'CANCELLED'] as const) {
      expect(isTerminal(s)).toBe(true);
      for (const a of ['SUBMIT', 'RESUBMIT', 'MARK_READY', 'WITHDRAW', 'ISSUE_NUMBER'] as const) {
        expect(() => nextStatus(s, a)).toThrow(TransitionError);
      }
    }
  });

  it('hak pengubahan oleh pembuat hanya pada DRAFT dan REVISION_REQUESTED', () => {
    expect(isEditableByCreator('DRAFT')).toBe(true);
    expect(isEditableByCreator('REVISION_REQUESTED')).toBe(true);
    expect(isEditableByCreator('READY_TO_ISSUE')).toBe(false);
    expect(isEditableByCreator('NUMBERED')).toBe(false);
    expect(isEditableByCreator('CANCELLED')).toBe(false);
  });

  it('hanya surat NUMBERED atau CANCELLED yang boleh memiliki nomor resmi', () => {
    expect(mayHaveOfficialNumber('DRAFT')).toBe(false);
    expect(mayHaveOfficialNumber('IN_REVIEW')).toBe(false);
    expect(mayHaveOfficialNumber('READY_TO_ISSUE')).toBe(false);
    expect(mayHaveOfficialNumber('NUMBERED')).toBe(true);
    expect(mayHaveOfficialNumber('CANCELLED')).toBe(true);
  });

  it('Sudah Bernomor (NUMBERED) tidak sama dengan Sudah Ditandatangani', () => {
    expect(signatureStatusAfterNumbering(1, 'IN_APP')).toBe('WAITING');
    expect(signatureStatusAfterNumbering(2, 'EXTERNAL')).toBe('EXTERNAL');
    expect(signatureStatusAfterNumbering(0, null)).toBe('NOT_REQUIRED');
  });
});

describe('aturan penyelesaian disposisi (R.04)', () => {
  it('disposisi yang tidak memerlukan surat (requires_letter = false) dapat diselesaikan kapan saja', () => {
    expect(canCompleteDisposition(false, null)).toBe(true);
    expect(canCompleteDisposition(false, 'DRAFT')).toBe(true);
    expect(canCompleteDisposition(false, 'IN_REVIEW')).toBe(true);
  });

  it('disposisi yang memerlukan surat (requires_letter = true) TIDAK BOLEH Selesai sebelum surat NUMBERED', () => {
    expect(canCompleteDisposition(true, null)).toBe(false);
    expect(canCompleteDisposition(true, 'DRAFT')).toBe(false);
    expect(canCompleteDisposition(true, 'IN_REVIEW')).toBe(false);
    expect(canCompleteDisposition(true, 'REVISION_REQUESTED')).toBe(false);
    expect(canCompleteDisposition(true, 'READY_TO_ISSUE')).toBe(false);
    expect(canCompleteDisposition(true, 'CANCELLED')).toBe(false);
    expect(canCompleteDisposition(true, 'REJECTED')).toBe(false);

    // Hanya boleh bila NUMBERED
    expect(canCompleteDisposition(true, 'NUMBERED')).toBe(true);
  });
});

describe('simulasi konkurensi & idempotensi penerbitan nomor (R.04)', () => {
  it('permintaan konkuren untuk surat yang sama (idempotensi) menghasilkan nomor identik tanpa duplikasi', async () => {
    let counter = 0;
    const issuances = new Map<string, { seq: number; number: string }>();

    const simulateIssue = async (letterId: string, _idempotencyKey: string) => {
      if (issuances.has(letterId)) {
        return issuances.get(letterId)!;
      }
      counter += 1;
      const num = buildOfficialNumber({
        pattern: INT,
        sequence: counter,
        issuedAt: d('2027-01-05T03:00:00Z'),
        unit: 'ACH',
        type: 'IN',
      });
      const record = { seq: counter, number: num };
      issuances.set(letterId, record);
      return record;
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => simulateIssue('letter-1', `key-${i}`))
    );

    const firstNum = results[0]!.number;
    expect(results.every((r) => r.number === firstNum)).toBe(true);
    expect(counter).toBe(1);
  });

  it('permintaan paralel untuk 40 surat berbeda menghasilkan 40 nomor berurutan tanpa celah', async () => {
    let counter = 0;
    const simulateIssue = async (_letterId: string) => {
      counter += 1;
      return buildOfficialNumber({
        pattern: INT,
        sequence: counter,
        issuedAt: d('2027-01-05T03:00:00Z'),
        unit: 'ACH',
        type: 'IN',
      });
    };

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => simulateIssue(`letter-${i + 1}`))
    );

    expect(results.length).toBe(40);
    const uniqueNumbers = new Set(results);
    expect(uniqueNumbers.size).toBe(40);
    expect(results[0]).toMatch(/^001/);
    expect(results[39]).toMatch(/^040/);
    expect(counter).toBe(40);
  });
});

describe('terbilang rupiah otomatis (Surat Pengantar Tagihan)', () => {
  it('mengonversi angka 0 menjadi Nol rupiah', () => {
    expect(terbilangRupiah(0)).toBe('Nol rupiah');
  });

  it('mengonversi seribu', () => {
    expect(terbilangRupiah(1000)).toBe('Seribu rupiah');
  });

  it('mengonversi angka ratusan ribu dan jutaan dengan tepat', () => {
    expect(terbilangRupiah(1500000)).toBe('Satu juta lima ratus ribu rupiah');
    expect(terbilangRupiah(12500000)).toBe('Dua belas juta lima ratus ribu rupiah');
    expect(terbilangRupiah(250750500)).toBe('Dua ratus lima puluh juta tujuh ratus lima puluh ribu lima ratus rupiah');
  });

  it('mengonversi angka miliaran', () => {
    expect(terbilangRupiah(1500000000)).toBe('Satu miliar lima ratus juta rupiah');
  });
});
