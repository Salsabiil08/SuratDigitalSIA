'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Chip } from '@/components/ui/chip';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { createQuickLetterAction } from '@/server/actions/letters';

export default function BuatSuratBertahapPage() {
  const router = useRouter();

  // Wizard Step: 1 = Pilih Jenis, 2 = Isi Data, 3 = Dapatkan Nomor & Kop
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);

  // Form State
  const [jenisSurat, setJenisSurat] = React.useState<'IN' | 'KRE'>('IN');
  const [fromUnit, setFromUnit] = React.useState('ACH');
  const [recipient, setRecipient] = React.useState('Siti Rahma (SM Finance)');
  const [recipientOrg, setRecipientOrg] = React.useState('');
  const [letterDate, setLetterDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [signatureMode, setSignatureMode] = React.useState<'IN_APP' | 'EXTERNAL'>('IN_APP');
  const [signerId, setSignerId] = React.useState('a0000000-0000-0000-0000-000000000002');

  // Result State (Langkah 3)
  const [issuedLetterId, setIssuedLetterId] = React.useState('');
  const [officialNumber, setOfficialNumber] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const handleCopyNumber = () => {
    if (officialNumber) {
      navigator.clipboard.writeText(officialNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNextToStep2 = () => {
    setErrorMsg('');
    setCurrentStep(2);
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!subject.trim()) {
      setErrorMsg('Perihal surat wajib diisi.');
      return;
    }

    if (!recipient.trim()) {
      setErrorMsg('Penerima surat (Kepada) wajib diisi.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (letterDate && letterDate < todayStr) {
      setErrorMsg(`Anda memasukkan tanggal sebelum hari ini. Sesuai ketentuan, tanggal surat resmi tidak dapat dimundurkan ke waktu lampau.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const actualSignatureMode = jenisSurat === 'IN' ? 'EXTERNAL' : signatureMode;
      const res = await createQuickLetterAction({
        source: 'CREATE',
        letterTypeCode: jenisSurat,
        unitCode: fromUnit,
        recipientName: recipient.trim(),
        recipientOrg: jenisSurat === 'KRE' ? recipientOrg.trim() : undefined,
        letterDate: letterDate || new Date().toISOString().slice(0, 10),
        subject: subject.trim(),
        summary: summary.trim(),
        signatureMode: actualSignatureMode,
        signerId: actualSignatureMode === 'IN_APP' ? signerId : undefined,
      });

      if (res.success && res.officialNumber) {
        setIssuedLetterId(res.letterId || '');
        setOfficialNumber(res.officialNumber);
        setCurrentStep(3);
      } else {
        setErrorMsg(res.error || 'Gagal menerbitkan nomor surat.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCurrentStep(1);
    setSubject('');
    setSummary('');
    setOfficialNumber('');
    setIssuedLetterId('');
    setErrorMsg('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Buat Surat"
      />

      {/* Progress Stepper Wizard (Tanpa Nomor Dobel) */}
      <div className="bg-white p-3 rounded-2xl border border-[#EEEEEA] shadow-xs">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
              currentStep === 1
                ? 'bg-[#121A22] text-white font-bold'
                : currentStep > 1
                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-white/20'
              }`}
            >
              {currentStep > 1 ? '✓' : '1'}
            </span>
            <span>Pilih Jenis</span>
          </div>

          <div
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
              currentStep === 2
                ? 'bg-[#121A22] text-white font-bold'
                : currentStep > 2
                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep > 2 ? 'bg-emerald-600 text-white' : 'bg-white/20'
              }`}
            >
              {currentStep > 2 ? '✓' : '2'}
            </span>
            <span>Isi Data Pokok</span>
          </div>

          <div
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
              currentStep === 3
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-sm'
                : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Dapatkan Nomor & Kop Surat</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 1: PILIH JENIS SURAT */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-neutral-900 m-0">Pilih Jenis Surat</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setJenisSurat('IN')}
              className={`card-hover-effect p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-1 hover:shadow-md ${
                jenisSurat === 'IN'
                  ? 'border-brand-red bg-red-50/20 shadow-xs ring-1 ring-brand-red/30'
                  : 'border-[#E4E4E0] bg-white hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 text-base">🏢 Surat Internal</span>
                <input
                  type="radio"
                  name="jenis"
                  checked={jenisSurat === 'IN'}
                  onChange={() => setJenisSurat('IN')}
                  className="text-brand-red focus:ring-brand-red w-4 h-4"
                />
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed m-0">
                Surat dinas antarunit atau pegawai di lingkungan PT Semen Indonesia Aceh.
              </p>
            </div>

            <div
              onClick={() => setJenisSurat('KRE')}
              className={`card-hover-effect p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-1 hover:shadow-md ${
                jenisSurat === 'KRE'
                  ? 'border-brand-red bg-red-50/20 shadow-xs ring-1 ring-brand-red/30'
                  : 'border-[#E4E4E0] bg-white hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 text-base">🌐 Surat Eksternal</span>
                <input
                  type="radio"
                  name="jenis"
                  checked={jenisSurat === 'KRE'}
                  onChange={() => setJenisSurat('KRE')}
                  className="text-brand-red focus:ring-brand-red w-4 h-4"
                />
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed m-0">
                Ditujukan kepada instansi, mitra rekanan, atau pihak luar perusahaan.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#EEEEEA]">
            <Button variant="primary" size="md" onClick={handleNextToStep2}>
              Lanjut ke Pengisian Data &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 2: ISI DATA POKOK SURAT */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <form onSubmit={handleSubmitStep2}>
          <Card className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#EEEEEA]">
              <div>
                <h2 className="text-base font-bold text-neutral-900 m-0">Data Pokok Surat</h2>
              </div>
              <Chip variant={jenisSurat === 'IN' ? 'green' : 'blue'}>
                {jenisSurat === 'IN' ? 'Surat Internal' : 'Surat Eksternal'}
              </Chip>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Unit Pengirim" htmlFor="from-unit" required>
                <Select
                  id="from-unit"
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  required
                >
                  <option value="ACH">Accounting (ACH)</option>
                  <option value="FIN">Finance (FIN)</option>
                  <option value="RPT">Reporting (RPT)</option>
                </Select>
              </Field>

              <Field label="Tanggal Surat" htmlFor="letter-date" required>
                <Input
                  id="letter-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  required
                />
              </Field>
            </div>

            {jenisSurat === 'IN' ? (
              <Field label="Kepada (Penerima Internal)" htmlFor="rec-in" required>
                <Input
                  id="rec-in"
                  placeholder="Contoh: Senior Manager Finance"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  required
                />
              </Field>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Kepada (Nama Penerima)" htmlFor="rec-name" required>
                  <Input
                    id="rec-name"
                    placeholder="Contoh: Ir. Hendra Setiawan"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Instansi / Perusahaan Penerima" htmlFor="rec-org" required>
                  <Input
                    id="rec-org"
                    placeholder="Contoh: PT Semen Indonesia (Persero) Tbk."
                    value={recipientOrg}
                    onChange={(e) => setRecipientOrg(e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}

            <Field label="Perihal Surat" htmlFor="subject" required>
              <Input
                id="subject"
                placeholder="Contoh: Permohonan Data Rekonsiliasi Anggaran"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </Field>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 block">
                Isi Surat <span className="text-[11px] font-normal text-neutral-500">(Format teks: tebal, miring, perataan, font resmi SIG Text, daftar nomor/poin)</span>
              </label>
              <RichTextEditor
                value={summary}
                onChange={(val) => setSummary(val)}
                minHeight="260px"
                placeholder="Tuliskan naskah atau butir-butir surat dinas Anda di sini..."
              />
            </div>

            {/* Opsi Unduh Template Kop Asli Kosong */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-neutral-600 bg-neutral-50/90 p-3 rounded-xl border border-neutral-200 gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="text-sm">📄</span> Perlu template Word kop resmi SIG untuk pengetikan offline?
              </span>
              <a
                href="/api/kop/unduh"
                download="KOP_SURAT_RESMI_PT_SEMEN_INDONESIA_ACEH.docx"
                className="text-brand-red hover:text-red-700 font-semibold underline underline-offset-2 inline-flex items-center gap-1 whitespace-nowrap"
              >
                Unduh Template Kop Asli (.docx) &darr;
              </a>
            </div>

            {/* Jalur Pengesahan Tanda Tangan Resmi (R.04) */}
            {jenisSurat === 'IN' ? (
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600 flex items-center gap-2.5">
                <span className="text-base shrink-0">ℹ️</span>
                <span>
                  <b>Surat Internal</b> tidak memerlukan pengesahan tanda tangan (0 orang tanda tangan). Nomor resmi akan langsung dialokasikan setelah disimpan.
                </span>
              </div>
            ) : (
              <div className="space-y-3 pt-4 border-t border-[#EEEEEA]">
                <div>
                  <label className="text-xs font-bold text-neutral-900 block">
                    Jalur Pengesahan Tanda Tangan <span className="text-brand-red">*</span>
                  </label>
                  <p className="text-[11px] text-neutral-500 mt-0.5 m-0">
                    Sesuai ketentuan, Surat Eksternal memerlukan 1 tanda tangan resmi pejabat berwenang.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSignatureMode('IN_APP')}
                    className={`flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      signatureMode === 'IN_APP'
                        ? 'border-brand-red bg-red-50/40 text-neutral-950 shadow-xs ring-1 ring-brand-red/30'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="sig_in_app"
                          name="signatureMode"
                          value="IN_APP"
                          checked={signatureMode === 'IN_APP'}
                          onChange={() => setSignatureMode('IN_APP')}
                          className="text-brand-red focus:ring-brand-red cursor-pointer"
                        />
                        <label htmlFor="sig_in_app" className="font-bold text-xs cursor-pointer">
                          Melalui SIADocs (IN_APP)
                        </label>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Rekomendasi
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-2 m-0 leading-relaxed pl-5">
                      Surat resmi otomatis masuk ke menu <b>Pengesahan</b> pejabat penandatangan untuk ditandatangani & diunggah kembali ke sistem.
                    </p>
                  </div>

                  <div
                    onClick={() => setSignatureMode('EXTERNAL')}
                    className={`flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      signatureMode === 'EXTERNAL'
                        ? 'border-brand-red bg-red-50/40 text-neutral-950 shadow-xs ring-1 ring-brand-red/30'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="sig_ext"
                        name="signatureMode"
                        value="EXTERNAL"
                        checked={signatureMode === 'EXTERNAL'}
                        onChange={() => setSignatureMode('EXTERNAL')}
                        className="text-brand-red focus:ring-brand-red cursor-pointer"
                      />
                      <label htmlFor="sig_ext" className="font-bold text-xs cursor-pointer">
                        Di Luar SIADocs (EXTERNAL)
                      </label>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-2 m-0 leading-relaxed pl-5">
                      Tanda tangan fisik diurus manual di luar aplikasi tanpa pelacakan antrean sistem SIADocs.
                    </p>
                  </div>
                </div>

                {/* Pemilihan Pejabat Penandatangan jika IN_APP */}
                {signatureMode === 'IN_APP' && (
                  <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-semibold text-neutral-800 block">
                      Pejabat Penandatangan Sah (1 Orang)
                    </label>
                    <Select
                      value={signerId}
                      onChange={(e) => setSignerId(e.target.value)}
                      className="bg-white text-xs h-9"
                    >
                      <option value="a0000000-0000-0000-0000-000000000002">
                        Budi Hartono (Direktur Utama)
                      </option>
                      <option value="a0000000-0000-0000-0000-000000000003">
                        Siti Rahma (Senior Manager Finance)
                      </option>
                    </Select>
                    <span className="text-[10px] text-neutral-500 block">
                      Dokumen bernomor resmi akan langsung masuk ke antrean tugas Pengesahan pejabat yang dipilih di atas.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#EEEEEA]">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCurrentStep(1)}
              >
                &larr; Kembali
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                Dapatkan Nomor & Kop Surat &rarr;
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 3: DAPATKAN NOMOR RESMI & UNDUH KOP SURAT */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <Card className="p-6 sm:p-8 space-y-6 bg-white border border-emerald-200 shadow-md">
          <div className="flex items-center gap-3 pb-3 border-b border-[#EEEEEA]">
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base">
              ✓
            </span>
            <div>
              <h2 className="text-base font-bold text-neutral-900 m-0">
                Nomor Surat Resmi Berhasil Diterbitkan
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 m-0">
                Nomor resmi telah dialokasikan dan kop surat siap diunduh
              </p>
            </div>
          </div>

          {/* Kotak Nomor Resmi */}
          <div className="p-5 bg-neutral-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[#FFB27A]">
                NOMOR SURAT RESMI
              </div>
              <div className="font-mono font-bold text-xl sm:text-2xl mt-0.5 tracking-tight text-white select-all">
                {officialNumber}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                Unit {fromUnit} &bull; {letterDate}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyNumber}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 self-start sm:self-auto text-xs"
            >
              {copied ? '✓ Disalin' : 'Salin Nomor'}
            </Button>
          </div>

          {/* Unduh Kop Surat Bernomor */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm text-emerald-950 flex items-center gap-1.5">
                <span>📄</span> Unduh Dokumen Word (.docx) Kop Resmi SIG
              </div>
              <p className="text-xs text-emerald-800 mt-0.5 max-w-md m-0">
                Dokumen Word (.docx) resmi PT Semen Indonesia Aceh lengkap dengan kop logo SIG asli, font SIG Text, nomor surat resmi, dan isi naskah yang siap diedit di Microsoft Word.
              </p>
            </div>

            <a
              href={`/api/kop/${issuedLetterId || 'l-001'}/unduh`}
              download={`KOP_RESMI_${officialNumber.replace(/[\/\.]/g, '_')}.docx`}
            >
              <Button
                variant="primary"
                size="md"
                className="bg-brand-red hover:bg-[#8F0808] text-white shadow-sm font-semibold flex items-center gap-1.5"
              >
                <span>Unduh Word (.docx)</span>
              </Button>
            </a>
          </div>

          {/* Status Antrean Pengesahan */}
          {signatureMode === 'IN_APP' && (
            <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-sm text-blue-950 flex items-center gap-1.5">
                  <span>🖋️</span> Status: Menunggu Pengesahan Tanda Tangan (IN_APP)
                </div>
                <p className="text-xs text-blue-800 mt-0.5 max-w-md m-0">
                  Surat telah dialokasikan nomor resmi dan diteruskan ke menu <b>Pengesahan</b> pejabat penandatangan sah untuk ditandatangani di luar sistem & diunggah kembali.
                </p>
              </div>

              <Link href="/pengesahan">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-blue-700 hover:bg-blue-800 text-white shadow-sm font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <span>Buka Antrean Pengesahan &rarr;</span>
                </Button>
              </Link>
            </div>
          )}

          {/* Ringkasan Data Pokok */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#EEEEEA] text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-neutral-700">
              <div><span className="text-neutral-500">Perihal:</span> <b>{subject}</b></div>
              <div><span className="text-neutral-500">Kepada:</span> <b>{recipient}{recipientOrg ? ` (${recipientOrg})` : ''}</b></div>
              <div><span className="text-neutral-500">Unit:</span> <b>{fromUnit}</b></div>
              <div><span className="text-neutral-500">Tanggal:</span> <b>{letterDate}</b></div>
            </div>
          </div>

          {/* Tombol Aksi Akhir */}
          <div className="flex items-center justify-between pt-2 border-t border-[#EEEEEA]">
            <Button variant="ghost" size="sm" onClick={handleResetForm}>
              + Buat Surat Baru
            </Button>

            <Link href="/surat">
              <Button variant="secondary" size="md">
                Lihat di Surat Saya &rarr;
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
