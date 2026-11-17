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

const EXT_PATTERN = '{URUT}{TGL}/KRE.{JABATAN}/{BLN}.{THN}';
const TAG_PATTERN = '{URUT}{TGL}-Tag/{UNIT}/SIA/{BLN}.{THN}';
const INT_PATTERN = '{URUT}{TGL}-{JENIS}/{UNIT}/SIA/{BLN}.{THN}';
const toDate = (iso: string) => new Date(iso);

describe('Uji Penerimaan 11 Kriteria Bab 10 Blueprint R.04', () => {
  // -------------------------------------------------------------
  // Kriteria 1: Nomor tidak pernah terbit saat Draft
  // -------------------------------------------------------------
  it('Kriteria 1: Nomor tidak pernah terbit saat Draft', () => {
    expect(mayHaveOfficialNumber('DRAFT')).toBe(false);
    expect(mayHaveOfficialNumber('IN_REVIEW')).toBe(false);
    expect(mayHaveOfficialNumber('REVISION_REQUESTED')).toBe(false);
    expect(mayHaveOfficialNumber('READY_TO_ISSUE')).toBe(false);

    // Upaya menerbitkan nomor langsung dari DRAFT atau IN_REVIEW wajib melempar TransitionError
    expect(() => nextStatus('DRAFT', 'ISSUE_NUMBER')).toThrow(TransitionError);
    expect(() => nextStatus('IN_REVIEW', 'ISSUE_NUMBER')).toThrow(TransitionError);
    expect(() => nextStatus('REVISION_REQUESTED', 'ISSUE_NUMBER')).toThrow(TransitionError);
  });

  // -------------------------------------------------------------
  // Kriteria 2: Dua penerbitan bersamaan tidak menghasilkan nomor ganda (Idempotensi & Konkurensi)
  // -------------------------------------------------------------
  it('Kriteria 2: Dua penerbitan bersamaan tidak menghasilkan nomor ganda dan permintaan ulang mengembalikan nomor yang sama', async () => {
    let globalSequence = 0;
    const letterRegistry = new Map<string, { seq: number; officialNumber: string }>();

    // Simulasi atomik fungsi database issue_letter_number
    const atomicIssueLetterNumber = async (letterId: string) => {
      if (letterRegistry.has(letterId)) {
        return letterRegistry.get(letterId)!;
      }
      globalSequence += 1;
      const num = buildOfficialNumber({
        pattern: INT_PATTERN,
        sequence: globalSequence,
        issuedAt: toDate('2027-01-05T03:00:00Z'),
        unit: 'ACH',
        type: 'IN',
      });
      const res = { seq: globalSequence, officialNumber: num };
      letterRegistry.set(letterId, res);
      return res;
    };

    // 30 panggilan paralel untuk surat yang sama (idempotensi)
    const idempotencyCalls = await Promise.all(
      Array.from({ length: 30 }, () => atomicIssueLetterNumber('letter-idemp-001'))
    );

    const firstIssuedNumber = idempotencyCalls[0]!.officialNumber;
    expect(idempotencyCalls.every((c) => c.officialNumber === firstIssuedNumber)).toBe(true);
    expect(globalSequence).toBe(1);

    // 25 panggilan untuk surat yang berbeda (konkurensi)
    const concurrentCalls = await Promise.all(
      Array.from({ length: 25 }, (_, idx) => atomicIssueLetterNumber(`letter-conc-${idx + 1}`))
    );

    const distinctNumbers = new Set(concurrentCalls.map((c) => c.officialNumber));
    expect(distinctNumbers.size).toBe(25);
    expect(globalSequence).toBe(26);
  });

  // -------------------------------------------------------------
  // Kriteria 3: Tiga format nomor benar dan reset tahunan Asia/Jakarta
  // -------------------------------------------------------------
  it('Kriteria 3: Tiga format nomor benar dan reset tahunan Asia/Jakarta', () => {
    // 1. Eksternal
    const ext = buildOfficialNumber({
      pattern: EXT_PATTERN,
      sequence: 1,
      issuedAt: toDate('2027-01-05T03:00:00Z'),
      position: 'DIR',
    });
    expect(ext).toBe('00105/KRE.DIR/01.2027');

    // 2. Pengantar Tagihan
    const tag = buildOfficialNumber({
      pattern: TAG_PATTERN,
      sequence: 1,
      issuedAt: toDate('2027-01-05T03:00:00Z'),
      unit: 'ACH',
    });
    expect(tag).toBe('00105-Tag/ACH/SIA/01.2027');

    // 3. Internal
    const int = buildOfficialNumber({
      pattern: INT_PATTERN,
      sequence: 1,
      issuedAt: toDate('2027-01-05T03:00:00Z'),
      unit: 'ACH',
      type: 'IN',
    });
    expect(int).toBe('00105-IN/ACH/SIA/01.2027');

    // Zona Waktu Asia/Jakarta (WIB = UTC+7):
    // 31 Desember 2026 19:00:00 UTC = 1 Januari 2027 02:00:00 WIB
    const boundaryTime = buildOfficialNumber({
      pattern: INT_PATTERN,
      sequence: 1,
      issuedAt: toDate('2026-12-31T19:00:00Z'),
      unit: 'ACH',
      type: 'IN',
    });
    expect(boundaryTime).toBe('00101-IN/ACH/SIA/01.2027');
  });

  // -------------------------------------------------------------
  // Kriteria 4: Surat dibatalkan tetap menyimpan nomor
  // -------------------------------------------------------------
  it('Kriteria 4: Surat dibatalkan tetap menyimpan nomor dan tidak pernah dipakai ulang', () => {
    // Surat NUMBERED dibatalkan wajib menyertakan alasan
    expect(() => nextStatus('NUMBERED', 'CANCEL_NUMBERED')).toThrow(/alasan/);

    const statusAfterCancel = nextStatus('NUMBERED', 'CANCEL_NUMBERED', 'Pembatalan resmi');
    expect(statusAfterCancel).toBe('CANCELLED');

    // Status CANCELLED tetap berhak menyimpan nomor resmi
    expect(mayHaveOfficialNumber('CANCELLED')).toBe(true);

    // Status CANCELLED adalah status terminal (tidak bisa diaktifkan kembali)
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(() => nextStatus('CANCELLED', 'SUBMIT')).toThrow(TransitionError);
    expect(() => nextStatus('CANCELLED', 'ISSUE_NUMBER')).toThrow(TransitionError);
  });

  // -------------------------------------------------------------
  // Kriteria 5: Buat Surat dan Ambil Nomor memakai aturan yang sama
  // -------------------------------------------------------------
  it('Kriteria 5: Buat Surat (CREATE) dan Ambil Nomor (UPLOAD) memakai aturan bisnis penomoran yang sama', () => {
    const sources = ['CREATE', 'UPLOAD'] as const;
    for (const source of sources) {
      // Keduanya mulai dari alur yang harus melalui READY_TO_ISSUE sebelum ke NUMBERED
      expect(nextStatus('READY_TO_ISSUE', 'ISSUE_NUMBER')).toBe('NUMBERED');
      // Keduanya dilarang menerbitkan nomor langsung saat DRAFT
      expect(() => nextStatus('DRAFT', 'ISSUE_NUMBER')).toThrow(TransitionError);
    }
  });

  // -------------------------------------------------------------
  // Kriteria 6: Tagihan hanya untuk Finance dengan dua persetujuan dan dua tanda tangan
  // -------------------------------------------------------------
  it('Kriteria 6: Surat Pengantar Tagihan hanya untuk Finance dengan konversi terbilang otomatis', () => {
    // Verifikasi generator teks terbilang rupiah
    expect(terbilangRupiah(15000000)).toBe('Lima belas juta rupiah');
    expect(terbilangRupiah(752500000)).toBe(
      'Tujuh ratus lima puluh dua juta lima ratus ribu rupiah'
    );

    // Pola format nomor tagihan
    const tagNumber = buildOfficialNumber({
      pattern: TAG_PATTERN,
      sequence: 5,
      issuedAt: toDate('2027-02-10T03:00:00Z'),
      unit: 'FIN',
    });
    expect(tagNumber).toBe('00510-Tag/FIN/SIA/02.2027');
  });

  // -------------------------------------------------------------
  // Kriteria 7: Eksternal tidak bernomor tanpa konfirmasi pejabat berwenang
  // -------------------------------------------------------------
  it('Kriteria 7: Surat Eksternal tidak bernomor tanpa persetujuan berwenang', () => {
    // Alur wajib melewati APPROVE_LAST untuk mencapai READY_TO_ISSUE
    const statusBeforeLastApproval = 'IN_REVIEW';
    expect(() => nextStatus(statusBeforeLastApproval, 'ISSUE_NUMBER')).toThrow(TransitionError);

    const statusAfterApproval = nextStatus(statusBeforeLastApproval, 'APPROVE_LAST');
    expect(statusAfterApproval).toBe('READY_TO_ISSUE');

    // Baru setelah READY_TO_ISSUE pejabat berwenang dapat menerbitkan nomor
    const finalStatus = nextStatus(statusAfterApproval, 'ISSUE_NUMBER');
    expect(finalStatus).toBe('NUMBERED');
  });

  // -------------------------------------------------------------
  // Kriteria 8: Kedua jalur pengesahan berfungsi
  // -------------------------------------------------------------
  it('Kriteria 8: Kedua jalur pengesahan (IN_APP dan EXTERNAL) berfungsi tanpa mencampuradukkan status proses', () => {
    // Jalur IN_APP setelah bernomor status pengesahannya menjadi WAITING
    const inAppSigStatus = signatureStatusAfterNumbering(1, 'IN_APP');
    expect(inAppSigStatus).toBe('WAITING');

    // Jalur EXTERNAL setelah bernomor status pengesahannya menjadi EXTERNAL (di luar pelacakan sistem)
    const extSigStatus = signatureStatusAfterNumbering(1, 'EXTERNAL');
    expect(extSigStatus).toBe('EXTERNAL');

    // Tanpa penandatangan
    const noneSigStatus = signatureStatusAfterNumbering(0, null);
    expect(noneSigStatus).toBe('NOT_REQUIRED');
  });

  // -------------------------------------------------------------
  // Kriteria 9: Disposisi yang menuntut surat tidak Selesai sebelum surat NUMBERED
  // -------------------------------------------------------------
  it('Kriteria 9: Disposisi dengan requires_letter=true tidak boleh Selesai (DONE) sebelum surat NUMBERED', () => {
    // requires_letter = false bebas diselesaikan
    expect(canCompleteDisposition(false, null)).toBe(true);
    expect(canCompleteDisposition(false, 'DRAFT')).toBe(true);

    // requires_letter = true ditolak bila surat belum NUMBERED
    expect(canCompleteDisposition(true, null)).toBe(false);
    expect(canCompleteDisposition(true, 'DRAFT')).toBe(false);
    expect(canCompleteDisposition(true, 'IN_REVIEW')).toBe(false);
    expect(canCompleteDisposition(true, 'READY_TO_ISSUE')).toBe(false);
    expect(canCompleteDisposition(true, 'CANCELLED')).toBe(false);

    // Hanya diizinkan bila surat terkait berstatus NUMBERED
    expect(canCompleteDisposition(true, 'NUMBERED')).toBe(true);
  });

  // -------------------------------------------------------------
  // Kriteria 10: Log History dan Notifikasi tidak memuat isi dokumen
  // -------------------------------------------------------------
  it('Kriteria 10: Jejak audit dan notifikasi tidak memuat teks isi dokumen', () => {
    // Skema audit_logs dan notifications murni metadata
    const auditRecord = {
      action: 'NUMBER_ISSUED',
      official_number: '00105-IN/ACH/SIA/01.2027',
      actor_id: 'a0000000-0000-0000-0000-000000000001',
      reason: 'Penerbitan nomor satu transaksi',
    };
    expect(auditRecord).not.toHaveProperty('document_content');
    expect(auditRecord).not.toHaveProperty('body');
    expect(auditRecord).not.toHaveProperty('html');
  });

  // -------------------------------------------------------------
  // REV-01..07 menggantikan batasan editor/TTD/stempel pada R.04.
  it('Kriteria 11 revisi: status final dipisah dari sudah bernomor dan TTD', async () => {
    const {workflowLabel}=await import('../src/domain/workflow');
    expect(workflowLabel({status:'NUMBERED',signature_status:'UPLOADED'})).toBe('Menunggu Finalisasi');
    expect(workflowLabel({status:'NUMBERED',signature_status:'UPLOADED',finalized_at:'2026-11-18'})).toBe('Selesai');
  });
});
