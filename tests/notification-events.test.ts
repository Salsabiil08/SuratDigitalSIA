import { expect, it } from 'vitest';
import { notificationPresentation } from '../src/domain/notification-events';
import { documentFinality, DOCUMENT_FINALITY_LABEL } from '../src/domain/status';
it.each(['SUBMIT', 'APPROVE', 'REQUEST_REVISION', 'REJECT', 'SIGNATURE_APPLIED', 'APPROVAL_REQUEST'])('event %s memakai bahasa Indonesia tanpa payload isi', type => {
  const p = notificationPresentation(type, 'Status surat diperbarui: READY_TO_ISSUE — isi rahasia');
  expect(p.title).not.toMatch(/READY_TO_ISSUE|rahasia/);
  expect(p.label).not.toBe('Pemberitahuan');
});
it('persetujuan satu tahap tidak mengklaim seluruh surat disetujui', () => {
  expect(notificationPresentation('APPROVE').title).toBe('Persetujuan surat telah dicatat.');
});
it('event tidak dikenal, null dan key prototype tidak membocorkan judul mentah', () => {
  for (const type of [null, 'UNKNOWN', '__proto__', 'constructor'])
    expect(notificationPresentation(type, 'isi rahasia').title).toBe('Ada pembaruan pada surat atau disposisi Anda.');
});
it('disposisi mempertahankan pesan dua arah yang sah', () => {
  expect(notificationPresentation('DISPOSITION', 'Hasil disposisi perlu diperbaiki').title).toBe('Hasil disposisi perlu diperbaiki');
  expect(notificationPresentation('DISPOSITION', 'isi rahasia').title).toBe('Disposisi telah diperbarui.');
});
it('finalitas tidak menyatakan surat terkirim, diterima atau selesai alur', () => {
  expect(documentFinality(null)).toBe('NOT_FINAL');
  expect(documentFinality('2026-11-18')).toBe('FINAL');
  expect(DOCUMENT_FINALITY_LABEL.FINAL).toBe('Dokumen final');
});
