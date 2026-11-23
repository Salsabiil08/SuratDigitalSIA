import {AccessDenied} from '@/components/ui/access-denied';
import { getMasterSeri } from '@/server/admin';
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminSeriPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!user.isSuperAdmin) return <AccessDenied/>;

  const { types, series } = await getMasterSeri();

  const fallbackTypes=types;
  const fallbackSeries=series;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader
        title="Master Jenis & Seri Penomoran"
        className="pb-0"
        actions={
          <div className="flex items-center gap-2">
            <Button disabledReason="Penambahan jenis surat belum tersedia pada halaman ini." variant="secondary" size="sm" className="h-8 px-3 text-xs">
              + Tambah Jenis Surat
            </Button>
            <Button disabledReason="Penambahan seri belum tersedia pada halaman ini." variant="primary" size="sm" className="h-8 px-3 text-xs bg-brand-red hover:bg-[#8F0808]">
              + Tambah Pola Seri
            </Button>
          </div>
        }
      />

      {/* Tabel Jenis Surat */}
      <Card className="overflow-hidden border border-[#EEEEEA]">
        <CardHeader className="py-2.5 px-4 border-b border-[#EEEEEA]">
          <CardTitle className="text-sm font-bold">Jenis Surat Resmi ({fallbackTypes.length})</CardTitle>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Jenis surat menentukan persetujuan, penomoran, dan tanda tangan yang diperlukan.
          </p>
        </CardHeader>
        <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Jenis Surat</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Dasar Penentu Seri</TableHead>
              <TableHead>Wajib Lampiran</TableHead>
              <TableHead>Jml Tanda Tangan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fallbackTypes.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono font-bold text-neutral-900">{t.code}</TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <Chip variant={t.category === 'BILLING' ? 'amber' : t.category === 'EXTERNAL' ? 'blue' : 'gray'}>
                    {({INTERNAL:'Internal',EXTERNAL:'Eksternal',BILLING:'Pengantar Tagihan'} as Record<string,string>)[t.category]||t.category}
                  </Chip>
                </TableCell>
                <TableCell className="text-xs text-neutral-600">
                  {t.seriesBasis === 'SIGNER_POSITION' ? 'Jabatan Penandatangan' : 'Unit Pembuat'}
                </TableCell>
                <TableCell>
                  <span className="text-xs">{t.requiredAttachment ? 'Wajib' : 'Opsional'}</span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-xs">{t.defaultSignatureCount} orang</span>
                </TableCell>
                <TableCell>
                  <Chip variant={t.isActive ? 'green' : 'gray'}>
                    {t.isActive ? 'Aktif' : 'Nonaktif'}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Tabel Seri Penomoran */}
      <Card className="overflow-hidden border border-[#EEEEEA]">
        <CardHeader className="py-2.5 px-4 border-b border-[#EEEEEA]">
          <CardTitle className="text-sm font-bold">Pola Seri Penomoran Resmi ({fallbackSeries.length})</CardTitle>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Token yang didukung: <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{URUT}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{TGL}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{BLN}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{THN}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{UNIT}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{JABATAN}'}</code>,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">{'{JENIS}'}</code>
          </p>
        </CardHeader>
        <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis Surat</TableHead>
              <TableHead>Pola Format Nomor Resmi</TableHead>
              <TableHead>Lingkup Unit / Jabatan</TableHead>
              <TableHead>Status Seri</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fallbackSeries.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-neutral-900">{s.letterTypeName}</TableCell>
                <TableCell className="font-mono text-xs font-semibold text-neutral-800 bg-neutral-50/60 p-2 rounded">
                  {s.pattern}
                </TableCell>
                <TableCell className="text-xs text-neutral-600">
                  {s.positionCode ? `Jabatan: ${s.positionCode}` : s.unitCode ? `Unit: ${s.unitCode}` : '-'}
                </TableCell>
                <TableCell>
                  <Chip variant={s.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {s.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

