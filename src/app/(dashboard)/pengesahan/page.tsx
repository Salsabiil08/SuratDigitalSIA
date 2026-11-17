'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import {
  getPendingSignatures,
  uploadSignedDocumentAction,
  getSignatureTrackingListAction,
  getEligibleLettersForSigningAction,
  getOfficialSignersAction,
  submitLetterToSigningAction,
  type SignatureTrackingItem,
  type EligibleLetterForSigning,
  type OfficialSignerOption,
} from '@/server/actions/signatures';
import { getCurrentUserRoleAction, type UserRoleInfo } from '@/server/actions/auth';

interface SignatureTask {
  id: string;
  letterId: string;
  officialNumber: string;
  subject: string;
  typeName: string;
  recipient: string;
  creatorName: string;
  unitName: string;
  signOrder: number;
  totalSigners: number;
  signerRole: string;
}

export default function PengesahanPage() {
  // Navigation Tabs: 'tracking' = Status Pengesahan, 'queue' = Antrean Pengesahan
  const [activeTab, setActiveTab] = React.useState<'tracking' | 'queue'>('tracking');
  const [userRole, setUserRole] = React.useState<UserRoleInfo | null>(null);

  // Tracking State
  const [trackingList, setTrackingList] = React.useState<SignatureTrackingItem[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = React.useState(true);
  const [trackingSearch, setTrackingSearch] = React.useState('');

  // Queue / Actions State
  const [tasks, setTasks] = React.useState<SignatureTask[]>([]);
  const [isTasksLoading, setIsTasksLoading] = React.useState(true);
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [stampIncluded, setStampIncluded] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState<{ text: string; hash?: string; type: 'success' | 'error' } | null>(null);

  // Modal Ajukan Pengesahan State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [eligibleLetters, setEligibleLetters] = React.useState<EligibleLetterForSigning[]>([]);
  const [signersList, setSignersList] = React.useState<OfficialSignerOption[]>([]);
  const [selectedLetterId, setSelectedLetterId] = React.useState('');
  const [selectedSigner1, setSelectedSigner1] = React.useState('a0000000-0000-0000-0000-000000000002');
  const [selectedSigner2, setSelectedSigner2] = React.useState('a0000000-0000-0000-0000-000000000003');
  const [isSubmittingModal, setIsSubmittingModal] = React.useState(false);
  const [modalError, setModalError] = React.useState('');

  // Load Tracking Data
  const loadTracking = React.useCallback(async () => {
    setIsTrackingLoading(true);
    try {
      const data = await getSignatureTrackingListAction();
      setTrackingList(data || []);
    } catch (err: any) {
      console.error('Failed to load signature tracking:', err);
    } finally {
      setIsTrackingLoading(false);
    }
  }, []);

  // Load Queue Data
  const loadQueue = React.useCallback(async () => {
    setIsTasksLoading(true);
    try {
      const data = await getPendingSignatures();
      setTasks(data || []);
      setSelectedIdx(0);
    } catch (err: any) {
      console.error('Failed to load pending signatures:', err);
    } finally {
      setIsTasksLoading(false);
    }
  }, []);

  // Initial Load
  React.useEffect(() => {
    loadTracking();
    loadQueue();
    getCurrentUserRoleAction().then((role) => {
      setUserRole(role);
      // Jika bukan pejabat penandatangan (bukan Dirut/SM), arahkan selalu ke tab Status Pengesahan
      if (!role.canSignQueue) {
        setActiveTab('tracking');
      }
    });
  }, [loadTracking, loadQueue]);

  // Open Modal Ajukan Pengesahan
  const handleOpenModal = async () => {
    setModalError('');
    setIsModalOpen(true);
    try {
      const [letters, signers] = await Promise.all([
        getEligibleLettersForSigningAction(),
        getOfficialSignersAction(),
      ]);
      setEligibleLetters(letters);
      // Hanya Direktur Utama dan SM Finance
      const filteredSigners = signers.filter((s) => s.id !== 'a0000000-0000-0000-0000-000000000004');
      setSignersList(filteredSigners);

      if (letters && letters.length > 0 && letters[0]) {
        setSelectedLetterId(letters[0].id);
        const reqCount = letters[0].defaultSignatureCount;
        if (reqCount === 2) {
          setSelectedSigner1('a0000000-0000-0000-0000-000000000003'); // SM Finance
          setSelectedSigner2('a0000000-0000-0000-0000-000000000002'); // Direktur Utama
        } else {
          setSelectedSigner1('a0000000-0000-0000-0000-000000000002'); // Direktur Utama
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch modal dependencies:', e);
      setModalError('Gagal memuat data surat resmi.');
    }
  };

  const handleSelectLetterChange = (letterId: string) => {
    setSelectedLetterId(letterId);
    const chosen = eligibleLetters.find((l) => l.id === letterId);
    if (chosen?.defaultSignatureCount === 2) {
      setSelectedSigner1('a0000000-0000-0000-0000-000000000003'); // SM Finance
      setSelectedSigner2('a0000000-0000-0000-0000-000000000002'); // Direktur Utama
    } else {
      setSelectedSigner1('a0000000-0000-0000-0000-000000000002'); // Direktur Utama
    }
  };

  const currentSelectedLetter = eligibleLetters.find((l) => l.id === selectedLetterId);
  const signatureCountNeeded = currentSelectedLetter?.defaultSignatureCount ?? 1;

  // Submit Modal
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLetterId) {
      setModalError('Silakan pilih surat resmi yang akan diajukan.');
      return;
    }

    setModalError('');
    setIsSubmittingModal(true);

    try {
      const signerIds = signatureCountNeeded === 2
        ? [selectedSigner1, selectedSigner2]
        : [selectedSigner1];

      const res = await submitLetterToSigningAction({
        letterId: selectedLetterId,
        signerIds,
      });

      if (res.success) {
        setIsModalOpen(false);
        setResultMsg({
          text: `Pengesahan untuk surat ${currentSelectedLetter?.officialNumber} berhasil diajukan kepada pejabat penandatangan.`,
          type: 'success',
        });
        await Promise.all([loadTracking(), loadQueue()]);
      } else {
        setModalError(res.error || 'Gagal mengajukan pengesahan.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Upload Signed Document (Antrean Pengesahan)
  const selectedTask = tasks[selectedIdx];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!uploadedFile) {
      setResultMsg({ text: 'Berkas dokumen bertanda tangan wajib dipilih.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setResultMsg(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const format = uploadedFile.name.endsWith('.docx') ? 'DOCX' : 'PDF';

      const res = await uploadSignedDocumentAction({
        requestId: selectedTask.id,
        letterId: selectedTask.letterId,
        fileName: uploadedFile.name,
        fileBuffer: buffer,
        fileFormat: format,
        stampIncluded,
        notes,
      });

      if (res.success) {
        setResultMsg({
          text: `Dokumen bertanda tangan untuk nomor ${selectedTask.officialNumber} berhasil disahkan dan diunggah.`,
          hash: res.fileHash,
          type: 'success',
        });
        await Promise.all([loadQueue(), loadTracking()]);
        setUploadedFile(null);
        setNotes('');
      } else {
        setResultMsg({ text: res.error || 'Gagal mengunggah dokumen bertanda tangan.', type: 'error' });
      }
    } catch (err: any) {
      setResultMsg({ text: err.message || 'Terjadi kesalahan sistem.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Tracking
  const filteredTracking = trackingList.filter((item) => {
    const q = trackingSearch.toLowerCase();
    return (
      item.officialNumber.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      item.typeName.toLowerCase().includes(q) ||
      item.recipient.toLowerCase().includes(q) ||
      item.currentSignerName.toLowerCase().includes(q)
    );
  });

  const totalSubmitted = trackingList.length;
  const waitingSignatures = trackingList.filter((t) => t.overallStatus === 'MENUNGGU').length;
  const completedSignatures = trackingList.filter((t) => t.overallStatus === 'SELESAI').length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header: Judul Bersih Tanpa Sub-teks & Tombol Ajukan Pengesahan Responsif Mobile */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EEEEEA]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 m-0">
            Pengesahan
          </h1>
        </div>

        {/* 1. Ajukan Pengesahan: seluruh staff, seluruh GM, dan SM (Dirut level paling atas tidak mengajukan) */}
        {userRole?.canApplySignature !== false && (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenModal}
            className="bg-brand-red hover:bg-[#d01515] text-white shadow-sm flex items-center gap-1.5 shrink-0 text-xs sm:text-sm px-3 sm:px-4 py-2"
          >
            <span>+ Ajukan Pengesahan</span>
          </Button>
        )}
      </div>

      {/* Global Result Alert */}
      {resultMsg && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs border flex flex-col gap-1.5 transition-all ${
            resultMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="font-semibold flex items-center gap-1.5">
            <span>{resultMsg.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{resultMsg.text}</span>
          </div>
          {resultMsg.hash && (
            <div className="text-[11px] font-mono bg-white/80 px-2.5 py-1.5 rounded border border-emerald-300 select-all break-all">
              SHA-256 Integritas Berkas: {resultMsg.hash}
            </div>
          )}
        </div>
      )}

      {/* Tabs Selector Responsif (Scrollable di Mobile) */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-[#EEEEEA] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('tracking')}
          className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 shrink-0 ${
            activeTab === 'tracking'
              ? 'border-brand-red text-brand-red bg-red-50/20'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <span>📊 Status Pengesahan</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-700 font-semibold">
            {trackingList.length}
          </span>
        </button>

        {/* 3. Antrean Pengesahan: hanya Dirut dan SM yang menandatangani */}
        {userRole?.canSignQueue && (
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 shrink-0 ${
              activeTab === 'queue'
                ? 'border-brand-red text-brand-red bg-red-50/20'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <span>🖋️ Antrean Pengesahan</span>
            <span className="hidden sm:inline text-neutral-400 font-normal">(Menunggu Tindakan)</span>
            {tasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {tasks.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STATUS PENGESAHAN (PELACAKAN PROGRES) */}
      {/* ========================================================================= */}
      {activeTab === 'tracking' && (
        <div className="space-y-4 sm:space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-3.5 sm:p-4 bg-white border border-[#EEEEEA] flex items-center justify-between">
              <div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Total Surat Diajukan
                </div>
                <div className="text-xl sm:text-2xl font-bold text-neutral-900 mt-1">{totalSubmitted}</div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base sm:text-lg">
                📄
              </div>
            </Card>

            <Card className="p-3.5 sm:p-4 bg-white border border-[#EEEEEA] flex items-center justify-between">
              <div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Menunggu Tanda Tangan
                </div>
                <div className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{waitingSignatures}</div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-base sm:text-lg">
                ⏳
              </div>
            </Card>

            <Card className="p-3.5 sm:p-4 bg-white border border-[#EEEEEA] flex items-center justify-between">
              <div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Selesai Disahkan
                </div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{completedSignatures}</div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base sm:text-lg">
                ✓
              </div>
            </Card>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-[#EEEEEA]">
            <span className="text-neutral-400 pl-1.5 sm:pl-2">🔍</span>
            <input
              type="text"
              placeholder="Cari nomor surat, perihal, atau pejabat penandatangan..."
              value={trackingSearch}
              onChange={(e) => setTrackingSearch(e.target.value)}
              className="w-full text-xs bg-transparent border-0 outline-none text-neutral-800 placeholder-neutral-400"
            />
            {trackingSearch && (
              <button
                onClick={() => setTrackingSearch('')}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-2 shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Konten Pelacakan Status Pengesahan */}
          <Card className="p-0 overflow-hidden border border-[#EEEEEA]">
            {isTrackingLoading ? (
              <div className="p-12 text-center text-neutral-500 text-xs">
                Memuat data pelacakan pengesahan...
              </div>
            ) : filteredTracking.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-neutral-500 space-y-2">
                <div className="text-3xl text-neutral-400">📭</div>
                <div className="text-sm font-semibold text-neutral-800">
                  Belum ada data status pengesahan
                </div>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Surat Eksternal (KRE) atau Surat Tagihan (Tag) yang bernomor dapat diajukan tanda tangannya melalui tombol &ldquo;+ Ajukan Pengesahan&rdquo;.
                </p>
                <div className="pt-2">
                  <Button variant="secondary" size="sm" onClick={handleOpenModal}>
                    Ajukan Surat Pertama &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Tampilan Desktop (Table View) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-[#EEEEEA] text-neutral-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Nomor Surat Resmi</th>
                        <th className="py-3 px-4">Perihal & Jenis</th>
                        <th className="py-3 px-4">Jumlah TTD</th>
                        <th className="py-3 px-4">Progres & Pejabat</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Aksi Dokumen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEEEEA]">
                      {filteredTracking.map((item) => (
                        <tr key={item.letterId} className="hover:bg-neutral-50/70 transition-colors">
                          {/* Nomor Surat */}
                          <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap align-top">
                            <div>{item.officialNumber}</div>
                            <div className="text-[10px] font-sans font-normal text-neutral-400 mt-0.5">
                              Unit {item.unitName}
                            </div>
                          </td>

                          {/* Perihal & Jenis */}
                          <td className="py-3.5 px-4 align-top max-w-xs">
                            <div className="font-semibold text-neutral-900 line-clamp-2">
                              {item.subject}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-2">
                              <span className="font-medium text-neutral-700">{item.typeName}</span>
                              <span>&bull;</span>
                              <span>Kepada: {item.recipient}</span>
                            </div>
                          </td>

                          {/* Jumlah Tanda Tangan */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <Chip variant={item.totalSigners === 2 ? 'amber' : 'blue'}>
                              {item.totalSigners === 2 ? '2 TTD Berjenjang' : '1 TTD Pejabat'}
                            </Chip>
                          </td>

                          {/* Progres & Pejabat */}
                          <td className="py-3.5 px-4 align-top min-w-[200px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-700">
                                <span>
                                  {item.completedSigners} / {item.totalSigners} Selesai
                                </span>
                                <span className="text-neutral-500">
                                  {Math.round((item.completedSigners / item.totalSigners) * 100)}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    item.completedSigners === item.totalSigners
                                      ? 'bg-emerald-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{
                                    width: `${(item.completedSigners / item.totalSigners) * 100}%`,
                                  }}
                                />
                              </div>

                              <div className="space-y-1 pt-1">
                                {item.signers.map((s, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 text-[11px] text-neutral-600"
                                  >
                                    <span
                                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                        s.status === 'UPLOADED'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {s.status === 'UPLOADED' ? '✓' : idx + 1}
                                    </span>
                                    <span className="font-medium text-neutral-800">{s.name}</span>
                                    <span className="text-neutral-400">({s.role})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            {item.overallStatus === 'SELESAI' ? (
                              <Chip variant="green">✓ Selesai Disahkan</Chip>
                            ) : item.overallStatus === 'EKSTERNAL' ? (
                              <Chip variant="gray">Di Luar SIADocs</Chip>
                            ) : (
                              <Chip variant="amber">⏳ Menunggu TTD</Chip>
                            )}
                          </td>

                          {/* Aksi */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap space-x-2">
                            <a
                              href={`/api/kop/${item.letterId}/unduh`}
                              download={`KOP_RESMI_${item.officialNumber.replace(/[\/\.\s]/g, '_')}.docx`}
                            >
                              <Button variant="secondary" size="sm" className="text-[11px] py-1 px-2.5">
                                📥 Unduh DOCX
                              </Button>
                            </a>
                            <Link href={`/surat/${item.letterId}`}>
                              <Button variant="ghost" size="sm" className="text-[11px] py-1 px-2">
                                Lihat &rarr;
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Tampilan Mobile (Card View Responsif) */}
                <div className="md:hidden divide-y divide-[#EEEEEA]">
                  {filteredTracking.map((item) => (
                    <div key={item.letterId} className="p-3.5 space-y-3 bg-white">
                      {/* Baris Atas: Nomor & Badge Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-neutral-900">
                            {item.officialNumber}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Unit {item.unitName}
                          </div>
                        </div>

                        {item.overallStatus === 'SELESAI' ? (
                          <Chip variant="green">✓ Selesai</Chip>
                        ) : item.overallStatus === 'EKSTERNAL' ? (
                          <Chip variant="gray">Di Luar</Chip>
                        ) : (
                          <Chip variant="amber">⏳ Menunggu TTD</Chip>
                        )}
                      </div>

                      {/* Baris Perihal & Jenis */}
                      <div>
                        <div className="font-semibold text-xs text-neutral-900 leading-snug">
                          {item.subject}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-neutral-700">{item.typeName}</span>
                          <span>&bull;</span>
                          <Chip variant={item.totalSigners === 2 ? 'amber' : 'blue'}>
                            {item.totalSigners === 2 ? '2 TTD' : '1 TTD'}
                          </Chip>
                        </div>
                      </div>

                      {/* Baris Progres & Pejabat Mobile */}
                      <div className="space-y-1.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-700">
                          <span>
                            Progres: {item.completedSigners} / {item.totalSigners} Selesai
                          </span>
                          <span className="text-neutral-500 font-mono text-[10px]">
                            {Math.round((item.completedSigners / item.totalSigners) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.completedSigners === item.totalSigners ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${(item.completedSigners / item.totalSigners) * 100}%` }}
                          />
                        </div>

                        <div className="space-y-1 pt-1">
                          {item.signers.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                  s.status === 'UPLOADED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {s.status === 'UPLOADED' ? '✓' : idx + 1}
                              </span>
                              <span className="font-medium text-neutral-800">{s.name}</span>
                              <span className="text-neutral-400 text-[10px]">({s.role})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tombol Aksi Mobile (Grid 2 Kolom) */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`/api/kop/${item.letterId}/unduh`}
                          download={`KOP_RESMI_${item.officialNumber.replace(/[\/\.\s]/g, '_')}.docx`}
                          className="w-full"
                        >
                          <Button variant="secondary" size="sm" className="w-full text-xs justify-center py-1.5">
                            📥 Unduh DOCX
                          </Button>
                        </a>
                        <Link href={`/surat/${item.letterId}`} className="w-full">
                          <Button variant="ghost" size="sm" className="w-full text-xs justify-center py-1.5 border border-neutral-200">
                            Lihat Detail &rarr;
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ANTREAN PENGESAHAN (MENUNGGU TINDAKAN TTD - KHUSUS DIRUT & SM) */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && userRole?.canSignQueue && (
        <div>
          {isTasksLoading ? (
            <Card className="p-12 text-center text-neutral-500">
              <div className="text-xs">Memuat antrean pengesahan...</div>
            </Card>
          ) : tasks.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center text-neutral-500 space-y-2">
              <div className="text-3xl text-emerald-600">✓</div>
              <div className="text-base font-semibold text-neutral-800">
                Tidak ada dokumen yang menunggu pengesahan Anda
              </div>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Seluruh surat yang ditugaskan kepada Anda sebagai pejabat penandatangan resmi telah selesai disahkan. Dokumen bernomor baru yang diajukan ke Anda akan otomatis tampil di sini.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
              {/* Kolom Kiri: Daftar Antrean */}
              <Card className="p-3.5 sm:p-4 space-y-2">
                <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider px-2 py-1">
                  Menunggu Tanda Tangan ({tasks.length})
                </h2>
                <div className="divide-y divide-[#EEEEEA]">
                  {tasks.map((task, idx) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedIdx(idx);
                        setResultMsg(null);
                      }}
                      className={`p-3 rounded-xl cursor-pointer transition-all ${
                        idx === selectedIdx
                          ? 'bg-red-50/70 border-l-4 border-brand-red shadow-2xs'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div className="font-mono text-xs font-bold text-neutral-900 line-clamp-1">
                        {task.officialNumber}
                      </div>
                      <div className="text-xs font-semibold text-neutral-800 line-clamp-1 mt-0.5">
                        {task.subject}
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-neutral-500 mt-1">
                        <span>{task.typeName}</span>
                        <Chip variant="amber">
                          TTD {task.signOrder} dari {task.totalSigners}
                        </Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Kolom Kanan: Detail & Form Pengesahan */}
              {selectedTask && (
                <Card className="lg:col-span-2 p-4 sm:p-6 space-y-4 sm:space-y-5">
                  <div className="flex flex-wrap justify-between items-start gap-2.5 pb-3 border-b border-[#EEEEEA]">
                    <div>
                      <div className="font-mono text-xs font-bold text-neutral-900">
                        {selectedTask.officialNumber}
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-neutral-900 mt-0.5 m-0">
                        {selectedTask.subject}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-neutral-500 mt-1 m-0">
                        {selectedTask.typeName} &bull; Pembuat: {selectedTask.creatorName} ({selectedTask.unitName})
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <Chip variant="amber">
                        Penandatangan ke-{selectedTask.signOrder} dari {selectedTask.totalSigners}
                      </Chip>
                      <div className="text-[11px] sm:text-xs text-neutral-500 mt-1">
                        Peran: <b>{selectedTask.signerRole}</b>
                      </div>
                    </div>
                  </div>

                  {/* Langkah 1: Unduh Berkas Word Bernomor */}
                  <div className="p-3.5 sm:p-4 bg-neutral-50 rounded-xl border border-[#EEEEEA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                        Langkah 1: Unduh Dokumen Word Bernomor
                      </h3>
                      <p className="text-[11px] sm:text-xs text-neutral-600 mt-0.5 max-w-md">
                        Unduh berkas kop resmi dengan nomor dan ruang tanda tangan yang sudah disesuaikan otomatis ({selectedTask.totalSigners} tanda tangan).
                      </p>
                    </div>
                    <a
                      href={`/api/kop/${selectedTask.letterId}/unduh`}
                      download={`KOP_RESMI_${selectedTask.officialNumber.replace(/[\/\.\s]/g, '_')}.docx`}
                      className="w-full sm:w-auto"
                    >
                      <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto font-semibold shrink-0">
                        📥 Unduh Dokumen Word (.docx)
                      </Button>
                    </a>
                  </div>

                  {/* Langkah 2: Unggah Berkas Bertanda Tangan */}
                  <form onSubmit={handleUploadSubmit} className="space-y-4 pt-1">
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Langkah 2: Unggah Dokumen Bertanda Tangan & Distempel
                    </h3>

                    <Field
                      label="Pilih Berkas Hasil Penandatanganan (PDF / DOCX) *"
                      hint="Unggah dokumen pindaian atau berkas final yang telah memuat tanda tangan resmi."
                      required
                    >
                      <Input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileChange}
                        required
                      />
                    </Field>

                    <div className="p-3 bg-white rounded-lg border border-[#C9C9C3] flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="stamp-check"
                        checked={stampIncluded}
                        onChange={(e) => setStampIncluded(e.target.checked)}
                        className="rounded text-brand-red focus:ring-brand-red w-4 h-4"
                      />
                      <label htmlFor="stamp-check" className="text-xs font-medium text-neutral-800 cursor-pointer">
                        Dokumen telah memuat stempel resmi perusahaan yang sah
                      </label>
                    </div>

                    <Field
                      label="Catatan Pengesahan (Opsional)"
                      hint="Catatan terkait penandatanganan fisik atau kelengkapan berkas."
                    >
                      <Textarea
                        placeholder="Contoh: Dokumen telah ditandatangani basah oleh Direktur Utama dan dibubuhi stempel resmi."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </Field>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={isSubmitting}
                        className="w-full sm:w-auto bg-brand-red hover:bg-[#d01515] text-white"
                      >
                        Simpan & Sahkan Dokumen
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUKAN PENGESAHAN (RESPONSIF MOBILE DENGAN MAX-HEIGHT & SCROLL) */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-neutral-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#EEEEEA] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-neutral-900 m-0">Ajukan Pengesahan Surat</h2>
                <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 m-0">
                  Pilih surat resmi bernomor dan tentukan pejabat penandatangan yang berwenang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 font-bold text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Scrollable */}
            <form onSubmit={handleSubmitModal} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                  {modalError}
                </div>
              )}

              {/* 1. Pilih Surat Resmi */}
              <Field label="Pilih Surat Resmi Bernomor" htmlFor="select-letter" required>
                {eligibleLetters.length === 0 ? (
                  <div className="p-3 bg-neutral-100 text-neutral-500 rounded-lg text-xs">
                    Tidak ada surat resmi non-internal bernomor yang dapat diajukan saat ini.
                  </div>
                ) : (
                  <Select
                    id="select-letter"
                    value={selectedLetterId}
                    onChange={(e) => handleSelectLetterChange(e.target.value)}
                    className="text-xs"
                    required
                  >
                    {eligibleLetters.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.officialNumber} — {l.subject} ({l.typeName})
                      </option>
                    ))}
                  </Select>
                )}
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  Hanya menampilkan Surat Eksternal (KRE) atau Tagihan (Tag). Surat Internal (IN) tidak memerlukan alur pengesahan.
                </span>
              </Field>

              {/* Ringkasan Jenis Surat Terpilih */}
              {currentSelectedLetter && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-neutral-500">Jenis Dokumen:</div>
                    <div className="text-xs font-bold text-neutral-800">
                      {currentSelectedLetter.typeName} ({currentSelectedLetter.typeCode})
                    </div>
                  </div>
                  <Chip variant={signatureCountNeeded === 2 ? 'amber' : 'blue'}>
                    Memerlukan {signatureCountNeeded} Orang Tanda Tangan
                  </Chip>
                </div>
              )}

              {/* 2. Pemilihan Pejabat Penandatangan (Hanya SM dan Dirut) */}
              <div className="space-y-3 pt-2 border-t border-[#EEEEEA]">
                <div className="text-xs font-bold text-neutral-900">
                  Pilih Pejabat Penandatangan Sah
                </div>

                {signatureCountNeeded === 1 ? (
                  // 1 Tanda Tangan (KRE) - Hanya SM Finance dan Dirut
                  <Field label="Pejabat Penandatangan (1 Orang)" htmlFor="signer-1" required>
                    <Select
                      id="signer-1"
                      value={selectedSigner1}
                      onChange={(e) => setSelectedSigner1(e.target.value)}
                      className="text-xs"
                    >
                      <option value="a0000000-0000-0000-0000-000000000002">
                        Budi Hartono — Direktur Utama (Level 4)
                      </option>
                      <option value="a0000000-0000-0000-0000-000000000003">
                        Siti Rahma — Senior Manager Finance (Level 3)
                      </option>
                    </Select>
                  </Field>
                ) : (
                  // 2 Tanda Tangan Berjenjang (Tag) - SM Finance lalu Dirut
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Penandatangan 1 (Verifikator/Penyusun)" htmlFor="signer-1-multi" required>
                      <Select
                        id="signer-1-multi"
                        value={selectedSigner1}
                        onChange={(e) => setSelectedSigner1(e.target.value)}
                        className="text-xs"
                      >
                        <option value="a0000000-0000-0000-0000-000000000003">
                          Siti Rahma — Senior Manager Finance
                        </option>
                        <option value="a0000000-0000-0000-0000-000000000002">
                          Budi Hartono — Direktur Utama
                        </option>
                      </Select>
                    </Field>

                    <Field label="Penandatangan 2 (Pengesah Utama)" htmlFor="signer-2-multi" required>
                      <Select
                        id="signer-2-multi"
                        value={selectedSigner2}
                        onChange={(e) => setSelectedSigner2(e.target.value)}
                        className="text-xs"
                      >
                        <option value="a0000000-0000-0000-0000-000000000002">
                          Budi Hartono — Direktur Utama
                        </option>
                        <option value="a0000000-0000-0000-0000-000000000003">
                          Siti Rahma — Senior Manager Finance
                        </option>
                      </Select>
                    </Field>
                  </div>
                )}

                {/* Info Template Kop Surat Word */}
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>📄</span> Penyesuaian Otomatis Kop Surat Word (.docx):
                  </div>
                  <p className="mt-1 text-[11px] text-blue-800 m-0 leading-relaxed">
                    {signatureCountNeeded === 2
                      ? 'Template berkas Word (.docx) akan menghasilkan 2 kolom tanda tangan berdampingan: kolom kiri untuk Penandatangan 1 dan kolom kanan untuk Penandatangan 2.'
                      : 'Template berkas Word (.docx) akan menghasilkan 1 kolom tanda tangan resmi di sebelah kanan dengan nama pejabat yang dipilih di atas.'}
                  </p>
                </div>
              </div>

              {/* Modal Actions Responsif Mobile */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-[#EEEEEA] shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmittingModal}
                  disabled={eligibleLetters.length === 0}
                  className="w-full sm:w-auto bg-brand-red hover:bg-[#d01515] text-white"
                >
                  Kirim Pengajuan Pengesahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
