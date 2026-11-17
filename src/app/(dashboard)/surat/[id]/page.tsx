'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip, getStatusChipVariant } from '@/components/ui/chip';
import { STATUS_LABEL, SIGNATURE_STATUS_LABEL, LetterStatus, SignatureStatus } from '@/domain/status';
import { submitForApprovalAction } from '@/server/actions/approvals';
import { cancelDraftLetterAction, cancelNumberedLetterAction } from '@/server/actions/cancellations';
import { getLetterDetailAction, forwardLetterToSigningAction } from '@/server/actions/letters';

export default function DetailSuratPage() {
  const params = useParams();
  const router = useRouter();
  const letterId = params?.id as string;

  const [letter, setLetter] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState('');
  const [actionError, setActionError] = React.useState('');

  // State Modal Pembatalan
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);

  const fetchLetterDetail = React.useCallback(async () => {
    if (!letterId) return;
    setIsLoading(true);
    try {
      const data = await getLetterDetailAction(letterId);
      setLetter(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [letterId]);

  React.useEffect(() => {
    fetchLetterDetail();
  }, [fetchLetterDetail]);

  const handleCopyNumber = () => {
    if (letter?.officialNumber) {
      navigator.clipboard.writeText(letter.officialNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmitReview = async () => {
    if (!letter) return;
    setIsSubmitting(true);
    setActionMsg('');
    setActionError('');
    try {
      const res = await submitForApprovalAction(letter.id);
      if (res.success) {
        setLetter((prev: any) => ({
          ...prev,
          status: (res.status as LetterStatus) || 'IN_REVIEW',
        }));
        setActionMsg('Surat berhasil diajukan untuk persetujuan.');
      } else {
        setActionError(res.error || 'Gagal mengajukan surat.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!letter) return;
    if (!cancelReason.trim()) {
      setActionError('Alasan pembatalan wajib diisi.');
      return;
    }

    setIsCancelling(true);
    setActionMsg('');
    setActionError('');

    try {
      if (letter.status === 'NUMBERED') {
        const res = await cancelNumberedLetterAction({
          letterId: letter.id,
          reason: cancelReason,
        });
        if (res.success) {
          setLetter((prev: any) => ({
            ...prev,
            status: 'CANCELLED',
            statusReason: cancelReason,
          }));
          setActionMsg('Surat bernomor resmi berhasil dibatalkan. Nomor surat tetap disimpan dan tidak dipakai ulang.');
          setIsCancelModalOpen(false);
        } else {
          setActionError(res.error || 'Gagal membatalkan surat.');
        }
      } else {
        const res = await cancelDraftLetterAction({
          letterId: letter.id,
          reason: cancelReason,
        });
        if (res.success) {
          setLetter((prev: any) => ({
            ...prev,
            status: 'CANCELLED',
            statusReason: cancelReason,
          }));
          setActionMsg('Draf surat berhasil dibatalkan.');
          setIsCancelModalOpen(false);
        } else {
          setActionError(res.error || 'Gagal membatalkan draf surat.');
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-sm text-neutral-500">
        Memuat detail surat dari database...
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <div className="text-4xl">📄</div>
        <h2 className="text-lg font-bold text-neutral-900">Surat Tidak Ditemukan</h2>
        <p className="text-xs text-neutral-500">
          Surat dengan ID &quot;{letterId}&quot; belum dibuat atau telah dibersihkan dari database.
        </p>
        <Link href="/surat">
          <Button variant="primary" size="md">
            &larr; Kembali ke Surat Saya
          </Button>
        </Link>
      </div>
    );
  }

  const canCancel = letter.status !== 'CANCELLED' && letter.status !== 'REJECTED';

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <Link href="/surat" className="text-xs font-semibold text-brand-red hover:underline">
          &larr; Kembali ke Surat Saya
        </Link>
      </div>

      <PageHeader
        title={letter.subject}
        actions={
          <div className="flex items-center gap-2.5">
            {letter.status === 'READY_TO_ISSUE' && (
              <Link href={`/surat/${letter.id}/terbitkan`}>
                <Button variant="primary" size="md">
                  Terbitkan Nomor Surat
                </Button>
              </Link>
            )}

            {letter.status === 'DRAFT' && (
              <Button
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                onClick={handleSubmitReview}
              >
                Ajukan Persetujuan
              </Button>
            )}

            {letter.status === 'NUMBERED' && (
              <>
                <Button variant="secondary" size="md" onClick={handleCopyNumber}>
                  {copied ? '✓ Tersalin!' : 'Salin Nomor'}
                </Button>
                <a
                  href={`/api/kop/${letter.id}/unduh`}
                  download={`KOP_RESMI_${letter.official_number?.replace(/[\/\.\s]/g, '_') || 'SURAT'}.docx`}
                >
                  <Button variant="secondary" size="md">
                    Unduh Word Kop Bernomor (.docx)
                  </Button>
                </a>

                {letter.signature_status === 'WAITING' ? (
                  <Link href="/pengesahan">
                    <Button variant="primary" size="md" className="bg-blue-700 hover:bg-blue-800">
                      Buka di Pengesahan &rarr;
                    </Button>
                  </Link>
                ) : letter.signature_status !== 'UPLOADED' ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={async () => {
                      setIsSubmitting(true);
                      const res = await forwardLetterToSigningAction(letter.id);
                      setIsSubmitting(false);
                      if (res.success) {
                        setActionMsg('Surat berhasil diteruskan ke antrean Pengesahan tanda tangan.');
                        await fetchLetterDetail();
                      } else {
                        setActionError(res.error || 'Gagal meneruskan ke pengesahan.');
                      }
                    }}
                    isLoading={isSubmitting}
                  >
                    Ajukan ke Pengesahan (IN_APP) &rarr;
                  </Button>
                ) : null}
              </>
            )}

            {canCancel && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
                className="text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400"
              >
                Batalkan Surat
              </Button>
            )}
          </div>
        }
      />

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          {actionMsg}
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
          {actionError}
        </div>
      )}

      {/* Banner Surat Dibatalkan */}
      {letter.status === 'CANCELLED' && (
        <div className="p-4 bg-red-100/70 border border-red-300 text-red-900 rounded-xl space-y-1">
          <div className="font-bold text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
            Surat Ini Telah Dibatalkan Resmi
          </div>
          <div className="text-xs text-red-800">
            Alasan pembatalan: <span className="font-semibold">{letter.statusReason || 'Dibatalkan oleh pembuat/pejabat berwenang.'}</span>
          </div>
          {letter.officialNumber && (
            <div className="text-xs text-red-700 font-mono mt-1">
              Nomor resmi {letter.officialNumber} tetap tersimpan pada surat ini dan tidak dapat dipakai ulang untuk surat lain.
            </div>
          )}
        </div>
      )}

      {/* Dua Status Utama: Proses dan Pengesahan */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 bg-white">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status Proses Surat</div>
          <div className="mt-2 flex items-center gap-2">
            <Chip variant={getStatusChipVariant(letter.status)}>
              {STATUS_LABEL[letter.status as LetterStatus] || letter.status}
            </Chip>
            <span className="text-xs text-neutral-500">
              {letter.status === 'READY_TO_ISSUE'
                ? 'Persetujuan wajib lengkap. Siap diberi nomor.'
                : letter.status === 'NUMBERED'
                ? 'Nomor resmi telah diterbitkan.'
                : letter.status === 'CANCELLED'
                ? 'Surat tidak berlaku lagi (dibatalkan).'
                : 'Menunggu proses persetujuan.'}
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status Pengesahan Tanda Tangan</div>
          <div className="mt-2 flex items-center gap-2">
            <Chip variant={letter.signatureStatus === 'WAITING' ? 'amber' : letter.signatureStatus === 'UPLOADED' ? 'green' : 'gray'}>
              {SIGNATURE_STATUS_LABEL[letter.signatureStatus as SignatureStatus] || letter.signatureStatus}
            </Chip>
            <span className="text-xs text-neutral-500">
              {letter.signatureMode === 'IN_APP'
                ? 'Jalur dilacak SIADocs'
                : 'Jalur di luar sistem'}
            </span>
          </div>
        </Card>
      </section>

      {/* Ringkasan Data Surat */}
      <Card className="p-6">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 pb-2 border-b border-[#EEEEEA]">
          Informasi & Metadata Surat
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Nomor Surat Resmi:</span>
            <span className="font-mono font-bold text-base text-neutral-900 mt-0.5 block">
              {letter.officialNumber || <span className="text-neutral-400 font-sans italic font-normal text-sm">Belum Diterbitkan</span>}
            </span>
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Jenis Surat & Layanan:</span>
            <span className="text-neutral-800 font-medium mt-0.5 block">
              {letter.typeName} ({letter.source === 'UPLOAD' ? 'Ambil Nomor' : 'Buat Surat'})
            </span>
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Penerima:</span>
            <span className="text-neutral-800 font-medium mt-0.5 block">{letter.recipientText}</span>
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Pejabat Penandatangan Sah:</span>
            <span className="text-neutral-800 font-medium mt-0.5 block">{letter.signerName}</span>
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Pembuat & Unit:</span>
            <span className="text-neutral-800 font-medium mt-0.5 block">
              {letter.creatorName} &bull; {letter.creatorUnit}
            </span>
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-semibold block">Waktu Dibuat:</span>
            <span className="text-neutral-800 font-medium mt-0.5 block">
              {new Date(letter.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} WIB
            </span>
          </div>
        </div>
      </Card>

      {/* Riwayat Persetujuan */}
      <Card className="p-6">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 pb-2 border-b border-[#EEEEEA]">
          Alur & Status Persetujuan
        </h2>
        {letter.approvals && letter.approvals.length > 0 ? (
          <div className="space-y-3">
            {letter.approvals.map((app: any) => (
              <div key={app.step} className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-[#EEEEEA] text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                    ✓
                  </span>
                  <div>
                    <div className="font-semibold text-neutral-900">Tahap {app.step}: {app.approver}</div>
                    <div className="text-xs text-neutral-500">{app.date}</div>
                  </div>
                </div>
                <Chip variant="green">{app.status}</Chip>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-neutral-500 py-2">
            Surat ini tidak memiliki tahapan persetujuan bertingkat (surat internal langsung atau belum diajukan).
          </div>
        )}
      </Card>

      {/* Modal Dialog Konfirmasi Pembatalan Surat */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-neutral-900 mb-2">
              Konfirmasi Pembatalan Surat
            </h3>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              {letter.status === 'NUMBERED' ? (
                <span className="text-red-700 font-semibold block">
                  Perhatian: Surat ini sudah memiliki nomor resmi. Jika dibatalkan, nomor resmi tetap tersimpan pada surat yang dibatalkan dan nomor tidak akan pernah dipakai ulang oleh surat mana pun.
                </span>
              ) : (
                'Apakah Anda yakin ingin membatalkan draf surat ini? Draf yang dibatalkan tidak dapat diproses lebih lanjut.'
              )}
            </p>

            <div className="mb-4">
              <label htmlFor="cancel-reason" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Alasan Pembatalan <span className="text-red-600">*</span>
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Tuliskan alasan pembatalan secara jelas..."
                className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isCancelling}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmCancel}
                isLoading={isCancelling}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              >
                Ya, Batalkan Surat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
