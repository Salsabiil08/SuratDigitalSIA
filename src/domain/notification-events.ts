/** Tampilan event terpercaya. Tidak menerima judul/aktor/status dari browser.
 * Penulisan event tetap di transaksi RPC surat/disposisi, bersama audit.
 * Membaca notifikasi bukan membaca surat, menerima surat, atau mengubah statusnya.
 */
const EVENTS: Record<string, { label: string; title: string; variant: 'gray' | 'amber' | 'blue' | 'green' | 'red' }> = {
  LETTER_COMMENT_ADDED: {label:'Komentar',title:'Ada tanggapan baru pada surat Anda.',variant:'blue'},
  INTERNAL_SENT: {label:'Pengiriman',title:'Surat internal tersedia untuk Anda.',variant:'blue'},
  INTERNAL_RECEIVED: {label:'Penerimaan',title:'Penerima utama mengonfirmasi penerimaan surat.',variant:'green'},
  REVIEW_REQUESTED: { label: 'Pemeriksaan', title: 'Surat menunggu pemeriksaan Anda.', variant: 'amber' },
  REVIEW_COMMENT: { label: 'Pemeriksaan', title: 'Pemeriksa memberi catatan pada surat Anda.', variant: 'blue' },
  REVIEW_PASS: { label: 'Pemeriksaan', title: 'Pemeriksaan terdahulu tercatat dalam riwayat surat.', variant: 'green' },
  REVIEW_REQUEST_REVISION: { label: 'Perbaikan', title: 'Pemeriksa meminta perbaikan naskah surat.', variant: 'amber' },
  SUBMIT: { label: 'Pengajuan', title: 'Pengajuan surat telah diproses.', variant: 'amber' },
  APPROVAL_REQUEST: { label: 'Persetujuan', title: 'Surat menunggu persetujuan Anda.', variant: 'amber' },
  APPROVAL_COMMENT: {label:'Persetujuan',title:'Pemberi persetujuan menambahkan catatan.',variant:'blue'},
  APPROVAL_RESUBMISSION: {label:'Persetujuan',title:'Ajukan surat melalui Persetujuan Surat.',variant:'amber'},
  APPROVE: { label: 'Persetujuan', title: 'Persetujuan surat telah dicatat.', variant: 'green' },
  APPROVED: { label: 'Persetujuan', title: 'Persetujuan surat telah dicatat.', variant: 'green' },
  REQUEST_REVISION: { label: 'Perbaikan', title: 'Surat memerlukan perbaikan.', variant: 'amber' },
  REVISED: { label: 'Perbaikan', title: 'Surat memerlukan perbaikan.', variant: 'amber' },
  REJECT: { label: 'Ditolak', title: 'Pengajuan surat ditolak.', variant: 'red' },
  REJECTED: { label: 'Ditolak', title: 'Pengajuan surat ditolak.', variant: 'red' },
  NUMBER_ISSUED: { label: 'Nomor terbit', title: 'Nomor resmi surat telah diterbitkan.', variant: 'green' },
  SIGNATURE_APPLIED: { label: 'Pengesahan', title: 'Pengesahan dokumen telah dicatat.', variant: 'green' },
  CANCELLATION_REQUESTED: {label:'Pembatalan',title:'Permohonan pembatalan surat menunggu persetujuan Anda.',variant:'amber'},
  CANCELLATION_APPROVED: {label:'Pembatalan',title:'Pembatalan disetujui sebagian; menunggu otorisasi berikutnya.',variant:'amber'},
  CANCELLATION_DECLINED: {label:'Pembatalan',title:'Permohonan pembatalan ditolak. Surat tetap berlaku.',variant:'red'},
  CANCELLATION_EXECUTED: {label:'Pembatalan',title:'Surat telah dibatalkan.',variant:'red'},
  CANCELLED: { label: 'Dibatalkan', title: 'Surat telah dibatalkan.', variant: 'red' },
  DISPOSITION: { label: 'Disposisi', title: 'Disposisi telah diperbarui.', variant: 'blue' },
};
const DISPOSITION_TITLES = new Set([
  'Disposisi baru diterima', 'Disposisi mulai dikerjakan',
  'Hasil disposisi menunggu pemeriksaan Anda', 'Hasil disposisi perlu diperbaiki',
  'Hasil disposisi telah diterima',
]);
export function notificationPresentation(eventType: string | null, storedTitle?: string | null) {
  const event = eventType && Object.hasOwn(EVENTS, eventType) ? EVENTS[eventType]! : {
    label: 'Pemberitahuan', title: 'Ada pembaruan pada surat atau disposisi Anda.', variant: 'gray' as const,
  };
  return {
    ...event,
    title: eventType === 'DISPOSITION' && storedTitle && DISPOSITION_TITLES.has(storedTitle)
      ? storedTitle : event.title,
  };
}
