import { getAuditLogs, AuditLogData } from '@/server/admin';
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Chip, ChipVariant } from '@/components/ui/chip';

function getActionChip(action: string): { variant: ChipVariant; label: string } {
  switch (action) {
    case 'NUMBER_ISSUED':
    case 'NUMBER_ALLOCATED':
      return { variant: 'green', label: 'Nomor Diterbitkan' };
    case 'APPROVE':
    case 'APPROVED':
      return { variant: 'blue', label: 'Persetujuan' };
    case 'REQUEST_REVISION':
      return { variant: 'amber', label: 'Revisi Diminta' };
    case 'REJECT':
      return { variant: 'red', label: 'Ditolak' };
    case 'LETTER_CANCELLED':
      return { variant: 'red', label: 'Pembatalan' };
    case 'CREATE_DRAFT':
      return { variant: 'gray', label: 'Buat Draft' };
    default:
      return { variant: 'gray', label: action };
  }
}

export const dynamic = 'force-dynamic';

export default async function AdminLogPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    redirect('/');
  }

  const logs = await getAuditLogs(50);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader
        title="Log History"
        className="pb-0"
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <input
          type="search"
          placeholder="Cari aktivitas, pengguna, atau nomor surat..."
          className="flex-1 min-w-[240px] min-h-[38px] px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#C9C9C3] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
        />
        <select className="min-h-[38px] px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#C9C9C3] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20">
          <option>Semua aksi</option>
          <option>Nomor Diterbitkan</option>
          <option>Persetujuan</option>
          <option>Revisi Diminta</option>
          <option>Pembatalan</option>
        </select>
        <select className="min-h-[38px] px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#C9C9C3] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20">
          <option>7 hari terakhir</option>
          <option>30 hari terakhir</option>
          <option>Semua riwayat</option>
        </select>
      </div>

      {/* Tabel Log History / Empty State (Scroll Internal Bila Data Panjang) */}
      {logs.length === 0 ? (
        <Card className="p-8 text-center text-neutral-500 space-y-2 border border-[#EEEEEA]">
          <div className="text-2xl text-neutral-400">📜</div>
          <div className="text-sm font-semibold text-neutral-800">
            Belum ada riwayat aktivitas sistem
          </div>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Audit log sistem bersifat append-only. Setiap kali ada pembuatan draf, persetujuan, penerbitan nomor, atau pembatalan surat yang dilakukan secara nyata, jejak transaksi akan otomatis tercatat di sini.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#EEEEEA]">
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu (WIB)</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Surat / Nomor Resmi</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const chip = getActionChip(log.action);
                const dateStr = new Date(log.occurredAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-neutral-500 whitespace-nowrap">
                      {dateStr}
                    </TableCell>
                    <TableCell className="font-semibold text-neutral-900 text-sm">
                      {log.actorName}
                    </TableCell>
                    <TableCell>
                      <Chip variant={chip.variant}>{chip.label}</Chip>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-neutral-800">
                        {log.officialNumber || 'Belum Bernomor'}
                      </div>
                      {log.letterSubject && (
                        <div className="text-xs text-neutral-500 truncate max-w-xs mt-0.5">
                          {log.letterSubject}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-neutral-600 max-w-sm">
                      {log.reason || log.action}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      <div className="text-xs text-neutral-400">
        Log bersifat tambah saja (append-only), tidak dapat diubah atau dihapus. Isi dokumen tidak dapat diakses melalui log ini.
      </div>
    </div>
  );
}
