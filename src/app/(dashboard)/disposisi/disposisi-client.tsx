'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, Textarea, Select } from '@/components/ui/field';
import {
  getDispositionsAction,
  createDispositionAction,
  updateDispositionStatusAction,
  DispositionItem,
  DispositionsData,
} from '@/server/actions/dispositions';

interface DisposisiClientProps {
  initialData: DispositionsData;
}

export function DisposisiClient({ initialData }: DisposisiClientProps) {
  // Aturan Wewenang Disposisi:
  // 1. Disposisi Masuk: semua user KECUALI Dirut (karena level paling atas)
  const canReceiveDisposition = initialData.canReceiveDisposition ?? true;
  // 2. Disposisi Keluar: semua user KECUALI staff (karena level paling bawah)
  const canCreateDisposition = initialData.canCreateDisposition ?? false;

  // Dirut otomatis masuk ke tab OUTBOX karena tidak menerima disposisi masuk
  const [activeTab, setActiveTab] = React.useState<'INBOX' | 'OUTBOX'>(
    !canReceiveDisposition ? 'OUTBOX' : 'INBOX'
  );
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [selectedDisp, setSelectedDisp] = React.useState<DispositionItem | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Data Live langsung dari server (tanpa jeda / flicker)
  const [inbox, setInbox] = React.useState<DispositionItem[]>(initialData.inbox);
  const [outbox, setOutbox] = React.useState<DispositionItem[]>(initialData.outbox);
  const [availableLetters, setAvailableLetters] = React.useState<DispositionsData['availableLetters']>(
    initialData.availableLetters
  );
  const [availableProfiles, setAvailableProfiles] = React.useState<DispositionsData['availableProfiles']>(
    initialData.availableProfiles
  );

  // State Form Disposisi Baru
  const [unitFilter, setUnitFilter] = React.useState('ALL');
  const [newSubject, setNewSubject] = React.useState('');
  const [newInstruction, setNewInstruction] = React.useState('');
  const [newRecipientId, setNewRecipientId] = React.useState(
    initialData.availableProfiles.length > 0 ? initialData.availableProfiles[0]!.id : ''
  );
  const [newPriority, setNewPriority] = React.useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [newDueDate, setNewDueDate] = React.useState('');
  const [newRequiresLetter, setNewRequiresLetter] = React.useState(false);
  const [newLetterId, setNewLetterId] = React.useState('');

  // State Penyelesaian
  const [followUpNote, setFollowUpNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [alertMsg, setAlertMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const reloadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getDispositionsAction();
      if (res.success && res.data) {
        setInbox(res.data.inbox);
        setOutbox(res.data.outbox);
        setAvailableLetters(res.data.availableLetters);
        setAvailableProfiles(res.data.availableProfiles);
      }
    } catch (e: any) {
      console.error('Failed to reload dispositions:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newInstruction.trim()) {
      setAlertMsg({ text: 'Perihal dan instruksi disposisi wajib diisi.', type: 'error' });
      return;
    }

    if (newRequiresLetter && !newLetterId.trim()) {
      setAlertMsg({ text: 'Disposisi yang menuntut surat wajib mengaitkan surat resmi.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setAlertMsg(null);
    try {
      const res = await createDispositionAction({
        recipientId: newRecipientId,
        subject: newSubject,
        instruction: newInstruction,
        priority: newPriority,
        dueDate: newDueDate || undefined,
        requiresLetter: newRequiresLetter,
        letterId: newLetterId || undefined,
      });

      if (res.success) {
        setAlertMsg({ text: 'Disposisi baru berhasil dibuat dan dikirim ke penerima.', type: 'success' });
        setShowCreateModal(false);
        setNewSubject('');
        setNewInstruction('');
        setNewRequiresLetter(false);
        setNewLetterId('');
        await reloadData();
      } else {
        setAlertMsg({ text: res.error || 'Gagal membuat disposisi.', type: 'error' });
      }
    } catch (err: any) {
      setAlertMsg({ text: err.message || 'Terjadi kesalahan sistem.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteDisposition = async () => {
    if (!selectedDisp) return;
    if (!followUpNote.trim()) {
      setAlertMsg({ text: 'Catatan tindak lanjut wajib diisi saat menyelesaikan disposisi.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setAlertMsg(null);
    try {
      const res = await updateDispositionStatusAction({
        dispositionId: selectedDisp.id,
        status: 'DONE',
        followUpNote,
      });

      if (res.success) {
        setAlertMsg({ text: `Disposisi "${selectedDisp.subject}" berhasil diselesaikan.`, type: 'success' });
        setSelectedDisp(null);
        setFollowUpNote('');
        await reloadData();
      } else {
        setAlertMsg({ text: res.error || 'Gagal menyelesaikan disposisi.', type: 'error' });
      }
    } catch (err: any) {
      setAlertMsg({ text: err.message || 'Terjadi kesalahan sistem.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentList = activeTab === 'INBOX' ? inbox : outbox;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader
        title="Disposisi"
        className="pb-0"
        actions={
          canCreateDisposition ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="h-8 sm:h-9 px-3.5 text-xs font-semibold bg-brand-red hover:bg-[#8F0808]"
            >
              + Buat Disposisi
            </Button>
          ) : undefined
        }
      />

      {alertMsg && (
        <div
          className={`p-3 rounded-xl text-xs sm:text-sm border ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {alertMsg.text}
        </div>
      )}

      {/* Filter / Kategori Disposisi Sesuai Matriks Wewenang */}
      <div className="flex items-center gap-2">
        {canReceiveDisposition && canCreateDisposition ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('INBOX')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                activeTab === 'INBOX'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white hover:bg-neutral-50 hover:border-neutral-300 text-neutral-700 border border-[#E4E4E0] shadow-2xs'
              }`}
            >
              Disposisi Masuk ({inbox.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('OUTBOX')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                activeTab === 'OUTBOX'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white hover:bg-neutral-50 hover:border-neutral-300 text-neutral-700 border border-[#E4E4E0] shadow-2xs'
              }`}
            >
              Disposisi Keluar ({outbox.length})
            </button>
          </>
        ) : canReceiveDisposition ? (
          <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 text-white">
            Disposisi Masuk ({inbox.length})
          </div>
        ) : canCreateDisposition ? (
          <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-900 text-white">
            Disposisi Keluar ({outbox.length})
          </div>
        ) : null}
      </div>

      {/* Daftar Disposisi (Scroll Internal Pada Bagian Panjang) */}
      {isLoading ? (
        <Card className="p-8 text-center text-xs text-neutral-500">
          <div>Memperbarui data disposisi...</div>
        </Card>
      ) : currentList.length === 0 ? (
        <Card className="p-8 text-center text-neutral-500 space-y-2 border border-[#EEEEEA]">
          <div className="text-2xl">📥</div>
          <div className="text-sm font-semibold text-neutral-800">
            Belum ada disposisi {activeTab === 'INBOX' ? 'masuk' : 'keluar'}
          </div>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {activeTab === 'INBOX'
              ? 'Anda belum memiliki instruksi disposisi dari pimpinan. Disposisi baru yang ditugaskan kepada Anda akan tampil di sini.'
              : 'Anda belum membuat instruksi disposisi keluar. Klik tombol "+ Buat Disposisi" di atas untuk mengirim instruksi baru.'}
          </p>
        </Card>
      ) : (
        <div className="max-h-[calc(100vh-230px)] overflow-y-auto space-y-3 pr-1">
          {currentList.map((disp) => (
            <Card key={disp.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-neutral-900">{disp.subject}</span>
                  <Chip variant={disp.priority === 'URGENT' ? 'red' : disp.priority === 'IMPORTANT' ? 'amber' : 'gray'}>
                    {disp.priority}
                  </Chip>
                  <Chip variant={disp.status === 'DONE' ? 'green' : disp.status === 'IN_PROGRESS' ? 'blue' : 'amber'}>
                    {disp.status === 'DONE' ? 'Selesai' : disp.status === 'IN_PROGRESS' ? 'Diproses' : 'Baru'}
                  </Chip>
                  {disp.requiresLetter && (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Wajib Surat Resmi
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-600 line-clamp-2">{disp.instruction}</p>
                <div className="text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  <span>Pemberi: <b>{disp.giverName}</b></span>
                  <span>Penerima: <b>{disp.recipientName}</b></span>
                  {disp.dueDate && <span>Batas Waktu: <b>{disp.dueDate}</b></span>}
                  {disp.letterNumber && <span>Terkait Surat: <b className="font-mono">{disp.letterNumber}</b></span>}
                </div>
                {disp.followUpNote && (
                  <div className="text-xs text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200 mt-2">
                    <b>Catatan Tindak Lanjut:</b> {disp.followUpNote}
                  </div>
                )}
              </div>

              {disp.status !== 'DONE' && activeTab === 'INBOX' && (
                <div className="shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedDisp(disp)}
                  >
                    Tindak Lanjut & Selesaikan
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tindak Lanjut / Penyelesaian */}
      {selectedDisp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-neutral-900">Selesaikan Disposisi</h2>
            <div className="text-xs text-neutral-600 space-y-1">
              <div><b>Perihal:</b> {selectedDisp.subject}</div>
              <div><b>Instruksi:</b> {selectedDisp.instruction}</div>
              {selectedDisp.requiresLetter && (
                <div className="p-2 bg-blue-50 text-blue-800 rounded-lg text-xs mt-2 border border-blue-200">
                  ℹ️ Disposisi ini menuntut surat tindak lanjut. Sistem akan memeriksa apakah surat terkait telah berstatus <b>Sudah Bernomor (NUMBERED)</b>.
                </div>
              )}
            </div>

            <Field label="Catatan Tindak Lanjut *" htmlFor="disp-note" required>
              <Textarea
                id="disp-note"
                placeholder="Jelaskan tindakan yang telah dilakukan untuk menyelesaikan instruksi ini..."
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                required
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setSelectedDisp(null);
                  setFollowUpNote('');
                }}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                onClick={handleCompleteDisposition}
              >
                Tandai Selesai
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buat Disposisi Baru Responsif Mobile */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <form
            onSubmit={handleCreateDisposition}
            className="bg-white rounded-2xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#EEEEEA]">
              <h2 className="text-base font-bold text-neutral-900 m-0">Buat Disposisi Baru</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-700 font-bold text-lg w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            <Field label="Perihal Disposisi *" htmlFor="new-disp-sub" required>
              <Input
                id="new-disp-sub"
                placeholder="Perihal instruksi disposisi"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
              />
            </Field>

            {/* Pemilihan Unit & Penerima Disposisi (Semua Unit: Accounting, Finance, Reporting, dll.) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Unit Kerja Tujuan" htmlFor="filter-unit-disp">
                <Select
                  id="filter-unit-disp"
                  value={unitFilter}
                  onChange={(e) => {
                    const u = e.target.value;
                    setUnitFilter(u);
                    const matching = u === 'ALL'
                      ? availableProfiles
                      : availableProfiles.filter((p) => p.unitCode === u);
                    if (matching.length > 0 && matching[0]) {
                      setNewRecipientId(matching[0].id);
                    }
                  }}
                  className="text-xs"
                >
                  <option value="ALL">Semua Unit Kerja</option>
                  <option value="ACH">Accounting (ACH)</option>
                  <option value="FIN">Finance (FIN)</option>
                  <option value="RPT">Reporting (RPT)</option>
                </Select>
              </Field>

              <Field label="Penerima Disposisi *" htmlFor="new-disp-rec" required>
                <Select
                  id="new-disp-rec"
                  value={newRecipientId}
                  onChange={(e) => setNewRecipientId(e.target.value)}
                  className="text-xs"
                  required
                >
                  {unitFilter === 'ALL' ? (
                    <>
                      <optgroup label="Unit Accounting (ACH)">
                        {availableProfiles.filter(p => p.unitCode === 'ACH').map(p => (
                          <option key={p.id} value={p.id}>{p.fullName} ({p.roleInfo})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Unit Finance (FIN)">
                        {availableProfiles.filter(p => p.unitCode === 'FIN').map(p => (
                          <option key={p.id} value={p.id}>{p.fullName} ({p.roleInfo})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Unit Reporting (RPT)">
                        {availableProfiles.filter(p => p.unitCode === 'RPT').map(p => (
                          <option key={p.id} value={p.id}>{p.fullName} ({p.roleInfo})</option>
                        ))}
                      </optgroup>
                      {availableProfiles.filter(p => !['ACH','FIN','RPT'].includes(p.unitCode || '')).length > 0 && (
                        <optgroup label="Unit Lainnya">
                          {availableProfiles.filter(p => !['ACH','FIN','RPT'].includes(p.unitCode || '')).map(p => (
                            <option key={p.id} value={p.id}>{p.fullName} ({p.roleInfo})</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    availableProfiles.filter(p => p.unitCode === unitFilter).map(p => (
                      <option key={p.id} value={p.id}>{p.fullName} ({p.roleInfo})</option>
                    ))
                  )}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioritas">
                <Select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                >
                  <option value="NORMAL">Biasa (NORMAL)</option>
                  <option value="IMPORTANT">Penting (IMPORTANT)</option>
                  <option value="URGENT">Segera (URGENT)</option>
                </Select>
              </Field>
              <Field label="Batas Waktu">
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Instruksi Disposisi *" htmlFor="new-disp-inst" required>
              <Textarea
                id="new-disp-inst"
                placeholder="Tuliskan petunjuk atau tindakan yang wajib dilakukan bawahan..."
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                required
              />
            </Field>

            <div className="p-3 bg-neutral-50 rounded-xl border border-[#EEEEEA] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={newRequiresLetter}
                  onChange={(e) => setNewRequiresLetter(e.target.checked)}
                  className="rounded text-brand-red focus:ring-brand-red"
                />
                <span>Memerlukan Surat Resmi Bernomor (requires_letter)</span>
              </label>
              {newRequiresLetter && (
                <Field label="Pilih Surat Resmi Terkait *" required>
                  {availableLetters.length > 0 ? (
                    <Select
                      value={newLetterId}
                      onChange={(e) => setNewLetterId(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih Surat Resmi --</option>
                      {availableLetters.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.officialNumber} - {l.subject} ({l.status})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      placeholder="Masukkan ID Surat (UUID)"
                      value={newLetterId}
                      onChange={(e) => setNewLetterId(e.target.value)}
                      required
                    />
                  )}
                </Field>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setShowCreateModal(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
              >
                Kirim Disposisi
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
