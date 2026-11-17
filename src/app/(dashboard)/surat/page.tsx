'use client';

import * as React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Chip, getStatusChipVariant } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { STATUS_LABEL, SIGNATURE_STATUS_LABEL, LetterStatus, SignatureStatus } from '@/domain/status';
import { getLettersAction, LetterItemData } from '@/server/actions/letters';

export default function SuratSayaPage() {
  const [activeTab, setActiveTab] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('ALL');
  const [letters, setLetters] = React.useState<LetterItemData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchLetters = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getLettersAction();
      setLetters(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  const filteredLetters = React.useMemo(() => {
    return letters.filter((l) => {
      // Filter tab status
      if (activeTab === 'DRAFT' && l.status !== 'DRAFT') return false;
      if (activeTab === 'IN_REVIEW' && l.status !== 'IN_REVIEW' && l.status !== 'REVISION_REQUESTED') return false;
      if (activeTab === 'READY_TO_ISSUE' && l.status !== 'READY_TO_ISSUE') return false;
      if (activeTab === 'NUMBERED' && l.status !== 'NUMBERED') return false;
      if (activeTab === 'CANCELLED' && l.status !== 'CANCELLED') return false;

      // Filter kategori jenis surat
      if (selectedType !== 'ALL' && l.typeCategory !== selectedType) return false;

      // Filter pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = l.officialNumber?.toLowerCase().includes(q);
        const matchSub = l.subject.toLowerCase().includes(q);
        const matchRec = l.recipientText.toLowerCase().includes(q);
        if (!matchNum && !matchSub && !matchRec) return false;
      }

      return true;
    });
  }, [letters, activeTab, selectedType, searchQuery]);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader
        title="Surat Saya"
        className="pb-0"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/surat/ambil-nomor">
              <Button variant="secondary" size="sm" className="h-8 sm:h-9 px-3 text-xs font-semibold">
                Ambil Nomor
              </Button>
            </Link>
            <Link href="/surat/buat">
              <Button
                variant="primary"
                size="sm"
                className="h-8 sm:h-9 px-3.5 text-xs font-semibold bg-brand-red hover:bg-[#8F0808] shadow-xs"
              >
                + Buat Surat
              </Button>
            </Link>
          </div>
        }
      />

      {/* Tabs Filter Status */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {[
          { id: 'ALL', label: 'Semua' },
          { id: 'DRAFT', label: 'Draft' },
          { id: 'IN_REVIEW', label: 'Menunggu Persetujuan' },
          { id: 'READY_TO_ISSUE', label: 'Siap Diberi Nomor' },
          { id: 'NUMBERED', label: 'Sudah Bernomor' },
          { id: 'CANCELLED', label: 'Dibatalkan' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#B30B0B] to-[#E62314] text-white shadow-xs'
                : 'bg-white hover:bg-neutral-50 hover:border-neutral-300 text-neutral-700 border border-[#E4E4E0] shadow-2xs'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Pencarian & Jenis */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <input
          type="search"
          placeholder="Cari nomor surat, penerima, atau perihal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[240px] min-h-[38px] px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#C9C9C3] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="min-h-[38px] px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#C9C9C3] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        >
          <option value="ALL">Semua jenis surat</option>
          <option value="INTERNAL">Internal</option>
          <option value="EXTERNAL">Eksternal</option>
          <option value="BILLING">Surat Penagihan</option>
        </select>
      </div>

      {/* Tabel Surat Saya (Scroll Internal Bila Data Panjang) */}
      <Card className="overflow-hidden border border-[#EEEEEA]">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            Memuat daftar surat dari database...
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 space-y-2">
            <div className="text-2xl">📭</div>
            <div className="text-sm font-semibold text-neutral-800">
              Belum ada surat yang terdaftar
            </div>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Database surat saat ini bersih dan siap digunakan. Buat surat baru untuk memulai penomoran digital.
            </p>
            <div className="pt-2">
              <Link href="/surat/buat">
                <Button variant="primary" size="sm">
                  + Buat Surat Baru
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor Surat</TableHead>
                <TableHead>Perihal & Penerima</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status Proses</TableHead>
                <TableHead>Status Pengesahan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLetters.map((letter) => (
                <TableRow key={letter.id}>
                  <TableCell>
                    {letter.officialNumber ? (
                      <span className="font-mono font-bold text-xs text-neutral-900">
                        {letter.officialNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">Belum terbit</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm text-neutral-900 line-clamp-1">
                      {letter.subject}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                      Penerima: {letter.recipientText}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-neutral-700">{letter.typeName}</TableCell>
                  <TableCell className="text-xs text-neutral-600">
                    {new Date(letter.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip variant={getStatusChipVariant(letter.status)}>
                      {letter.workflowStatus || STATUS_LABEL[letter.status as LetterStatus] || letter.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      variant={
                        letter.signatureStatus === 'WAITING'
                          ? 'amber'
                          : letter.signatureStatus === 'UPLOADED'
                          ? 'green'
                          : 'gray'
                      }
                    >
                      {SIGNATURE_STATUS_LABEL[letter.signatureStatus as SignatureStatus] ||
                        letter.signatureStatus}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/surat/${letter.id}`}>
                      <Button variant="ghost" size="sm">
                        Buka &rarr;
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
