import {ActionNotice} from "@/components/ui/action-notice";
import Link from 'next/link';
import { getPendingReviewsAction } from '@/server/actions/reviews';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
export const dynamic = 'force-dynamic';
export default async function Page() {
  try {
    const rows = await getPendingReviewsAction();
    return <div className="max-w-6xl w-full space-y-4"><PageHeader title="Pemeriksaan Surat" />
      {rows.length === 0 ? <Card className="p-5">Tidak ada surat yang menunggu pemeriksaan Anda.</Card> : rows.map(row => <Card key={row.id} className="p-5 flex justify-between gap-3"><span>{row.subject}</span><Link className="text-brand-red underline" href={`/surat/${row.letterId}`}>Periksa Surat</Link></Card>)}
    </div>;
  } catch { return <ActionNotice>Daftar pemeriksaan belum dapat diambil. Silakan coba kembali.</ActionNotice>; }
}
