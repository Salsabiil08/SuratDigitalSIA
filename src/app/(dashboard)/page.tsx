import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { getDashboardDataAction } from '@/server/actions/dashboard';

export const revalidate = 0; // Data live dari Supabase

export default async function DashboardPage() {
  const data = await getDashboardDataAction();

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      {/* Header Dashboard Padat & Rapi */}
      <PageHeader
        title="Dashboard"
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

      {/* Ringkasan Kartu Counter (Dipadatkan dengan Efek Hover Cantik) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Link href="/surat?status=DRAFT" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"><Card className="h-full group p-3 sm:p-3.5 border border-[#EEEEEA] relative overflow-hidden transition-all duration-300 hover:border-amber-300/80 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-amber-400 group-hover:to-orange-500 transition-all duration-300" />
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">Draft Surat</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-1 transition-transform duration-200 group-hover:scale-105 origin-left">{data.draftCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Belum bernomor</div>
        </Card></Link>
        <Link href="/surat?status=NUMBERED" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"><Card className="h-full group p-3 sm:p-3.5 border border-[#EEEEEA] relative overflow-hidden transition-all duration-300 hover:border-emerald-300/80 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-emerald-500 group-hover:to-teal-500 transition-all duration-300" />
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">Surat Bernomor</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-1 transition-transform duration-200 group-hover:scale-105 origin-left">{data.numberedCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Nomor resmi terbit</div>
        </Card></Link>
        <Link href="/surat?status=WAITING_SIGNATURE" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"><Card className="h-full group p-3 sm:p-3.5 border border-[#EEEEEA] relative overflow-hidden transition-all duration-300 hover:border-blue-300/80 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-indigo-500 transition-all duration-300" />
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">Pengesahan</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-1 transition-transform duration-200 group-hover:scale-105 origin-left">{data.waitingSignatureCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Menunggu tanda tangan</div>
        </Card></Link>
        <Link href="/disposisi" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"><Card className="h-full group p-3 sm:p-3.5 border border-[#EEEEEA] relative overflow-hidden transition-all duration-300 hover:border-purple-300/80 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-pink-500 transition-all duration-300" />
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-purple-700 transition-colors">Disposisi Aktif</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-1 transition-transform duration-200 group-hover:scale-105 origin-left">{data.activeDispositionsCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Instruksi kedinasan berjalan</div>
        </Card></Link>
      </div>

      {/* Konten Utama: Perlu Tindakan & Aktivitas - Scroll Internal Pada Bagian Panjang */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 items-start">
        {/* Kolom Kiri: Perlu Tindakan Anda (Scroll Internal Bila Data Panjang) */}
        <section className="lg:col-span-2">
          <Card className="overflow-hidden border border-[#EEEEEA]">
            <CardHeader className="py-2.5 px-4 border-b border-[#EEEEEA]">
              <CardTitle className="text-xs sm:text-sm font-bold text-neutral-900">Perlu tindakan Anda</CardTitle>
            </CardHeader>
            {data.pendingActions.length === 0 ? (
              <div className="py-7 px-4 text-center text-xs text-neutral-500">
                Tidak ada dokumen atau instruksi yang memerlukan tindakan Anda saat ini.
              </div>
            ) : (
              <div className="max-h-[260px] lg:max-h-[280px] overflow-y-auto divide-y divide-[#EEEEEA]">
                {data.pendingActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.link}
                    className="grid grid-cols-1 md:grid-cols-[130px_1fr_auto] gap-2.5 items-center p-3 hover:bg-neutral-50/90 hover:translate-x-1 transition-all duration-200 text-xs"
                  >
                    <span className="font-mono text-neutral-500 text-[11px]">
                      {action.officialNumber || 'Belum bernomor'}
                    </span>
                    <div>
                      <div className="font-semibold text-neutral-900 line-clamp-1">{action.subject}</div>
                      <div className="text-[11px] text-neutral-500 line-clamp-1">
                        {action.typeName} &bull; {action.recipientText}
                      </div>
                    </div>
                    <div>
                      <Chip
                        variant={
                          action.kind === 'DISPOSISI'
                            ? 'blue'
                            : action.kind === 'PENGESAHAN'
                            ? 'amber'
                            : 'gray'
                        }
                      >
                        {action.status}
                      </Chip>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Kolom Kanan: Aktivitas Terbaru (Scroll Internal Bila Data Panjang) */}
        <section>
          <Card className="overflow-hidden border border-[#EEEEEA]">
            <CardHeader className="py-2.5 px-4 border-b border-[#EEEEEA]">
              <CardTitle className="text-xs sm:text-sm font-bold text-neutral-900">Riwayat Transaksi Terbaru</CardTitle>
            </CardHeader>
            {data.recentActivities.length === 0 ? (
              <div className="py-7 px-4 text-center text-xs text-neutral-500">
                Belum ada aktivitas persuratan yang tercatat.
              </div>
            ) : (
              <div className="max-h-[260px] lg:max-h-[280px] overflow-y-auto divide-y divide-[#EEEEEA]">
                {data.recentActivities.map((act) => (
                  <div key={act.id} className="p-3 flex flex-col gap-0.5 hover:bg-neutral-50/90 hover:translate-x-1 transition-all duration-200">
                    <div className="text-xs font-semibold text-neutral-900 leading-snug">{act.description}</div>
                    <div className="text-[10px] text-neutral-400">{act.time}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
