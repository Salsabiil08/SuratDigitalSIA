'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { terbilangRupiah } from '@/domain/terbilang';
import { createBillingLetterAction } from '@/server/actions/letters';

interface BillingItem {
  description: string;
  amount: number;
}

export default function BuatSuratTagihanPage() {
  const router = useRouter();
  const [subject, setSubject] = React.useState('Surat Pengantar Tagihan Pembayaran Vendor');
  const [bankName, setBankName] = React.useState('Bank Mandiri');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountHolder, setAccountHolder] = React.useState('');
  const [recipientOrg, setRecipientOrg] = React.useState('PT Semen Indonesia (Persero) Tbk.');
  const [signatureMode, setSignatureMode] = React.useState<'IN_APP' | 'EXTERNAL'>('IN_APP');

  const [items, setItems] = React.useState<BillingItem[]>([
    { description: 'Biaya Pengadaan Material Periode Oktober 2026', amount: 15000000 },
    { description: 'Biaya Jasa Pengiriman dan Bongkar Muat', amount: 2500000 },
  ]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const totalAmount = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const terbilangText = React.useMemo(() => {
    return terbilangRupiah(totalAmount);
  }, [totalAmount]);

  const handleItemChange = (index: number, field: keyof BillingItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index]!, [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 2) {
      setErrorMsg('Surat Pengantar Tagihan wajib memiliki minimal 2 baris rincian.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length < 2) {
      setErrorMsg('Minimal harus ada 2 baris rincian tagihan.');
      return;
    }

    if (!accountNumber.trim() || !accountHolder.trim()) {
      setErrorMsg('Nomor rekening dan nama pemilik rekening wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBillingLetterAction({
        source: 'CREATE',
        letterTypeCode: 'Tag',
        subject,
        recipientType: 'EXTERNAL',
        recipientExternalName: 'Bagian Keuangan / Perbendaharaan',
        recipientExternalOrg: recipientOrg,
        signerId: 'a0000000-0000-0000-0000-000000000002', // Direktur Utama
        signatureMode,
        bankName,
        accountNumber,
        accountHolder,
        items,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Gagal menyimpan surat tagihan.');
        setIsSubmitting(false);
        return;
      }

      router.push('/surat');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title="Surat Penagihan"
        actions={
          <Link href="/surat">
            <Button variant="secondary" size="md">
              Batal
            </Button>
          </Link>
        }
      />

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. Informasi Umum Tagihan */}
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">1. Informasi Surat</h2>
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">
              Khusus Unit Finance
            </span>
          </div>

          <Field label="Perihal Surat Tagihan" htmlFor="bill-subject" required>
            <Input
              id="bill-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </Field>

          <Field label="Tujuan Instansi Pembayaran" htmlFor="bill-org" required>
            <Input
              id="bill-org"
              value={recipientOrg}
              onChange={(e) => setRecipientOrg(e.target.value)}
              required
            />
          </Field>
        </Card>

        {/* 2. Rincian Tagihan (Minimal 2 Baris) */}
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">2. Rincian Tagihan (Min. 2 Baris)</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Wajib mencantumkan rincian item tagihan beserta nominal rupiah</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
              + Tambah Baris
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-neutral-50 rounded-xl border border-[#EEEEEA]">
                <span className="w-6 text-center font-bold text-xs text-neutral-500">{idx + 1}.</span>
                <div className="flex-1 w-full">
                  <Input
                    placeholder="Deskripsi item tagihan..."
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Nominal (Rp)"
                    value={item.amount || ''}
                    onChange={(e) => handleItemChange(idx, 'amount', Number(e.target.value))}
                    required
                  />
                </div>
                {items.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1"
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Kalkulasi Otomatis Total & Terbilang */}
          <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-sm font-bold text-emerald-950">
              <span>Total Nilai Tagihan:</span>
              <span className="text-lg font-mono">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="text-xs text-emerald-800 font-medium italic">
              Terbilang: &ldquo;{terbilangText}&rdquo;
            </div>
          </div>
        </Card>

        {/* 3. Rekening Tujuan Pembayaran */}
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">3. Rekening Pembayaran</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nama Bank" htmlFor="bank-name" required>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Contoh: Bank Mandiri"
                required
              />
            </Field>

            <Field label="Nomor Rekening" htmlFor="acc-num" required>
              <Input
                id="acc-num"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Contoh: 158-00-1234567-8"
                required
              />
            </Field>

            <Field label="Atas Nama Pemilik Rekening" htmlFor="acc-holder" required>
              <Input
                id="acc-holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Contoh: PT Semen Indonesia Aceh"
                required
              />
            </Field>
          </div>
        </Card>

        {/* 4. Alur Persetujuan & Tanda Tangan Ganda */}
        <Card className="p-6 space-y-3 bg-[#FFF9F5] border-[#E4E4E0]">
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">4. Alur Otorisasi Otomatis</h2>
          <div className="text-xs text-neutral-700 leading-relaxed space-y-1">
            <div>1. <b>Persetujuan Tahap 1:</b> Senior Manager Finance (Pengaju)</div>
            <div>2. <b>Persetujuan Tahap 2:</b> Direktur Utama (Penyetuju Final)</div>
            <div>3. <b>Penandatanganan:</b> Wajib 2 tanda tangan berurutan (SM Finance lalu Direktur Utama)</div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/surat">
            <Button type="button" variant="secondary" size="md">
              Batal
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            Simpan sebagai Draft
          </Button>
        </div>
      </form>
    </div>
  );
}

