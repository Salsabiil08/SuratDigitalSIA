import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PreparedLetterEditor } from '@/components/letters/prepared-letter-editor';
import { readManualNumbers } from '@/server/manual-numbers';
import { RecoveryState } from '@/components/ui/recovery-state';
import { Card } from '@/components/ui/card';

export default async function Page({searchParams}:{searchParams:Promise<{nomor?:string}>}) {
  const {nomor}=await searchParams;
  if(nomor){
    const [reservation]=await readManualNumbers(nomor);
    if(!reservation)return <RecoveryState title="Nomor tidak tersedia" message="Buka nomor milik akun Anda." href="/surat/ambil-nomor" label="Kembali"/>;
    if(reservation.letter_id)redirect(`/surat/${reservation.letter_id}`);
    return <PreparedLetterEditor source="UPLOAD" manualReservation={reservation}/>;
  }
  const pending=await readManualNumbers();
  return <div className="space-y-4">
    <PreparedLetterEditor source="UPLOAD"/>
    {pending.length>0&&<Card className="space-y-3 p-5">
      <h2 className="font-bold">Nomor yang Sudah Diambil</h2>
      {pending.map(reservation=><Link key={reservation.id} className="block border-t pt-3"
        href={reservation.letter_id?`/surat/${reservation.letter_id}`:`/surat/ambil-nomor?nomor=${reservation.id}`}>
        <span className="block">{reservation.subject}</span>
        <span className="block font-mono text-sm">{reservation.official_number}</span>
      </Link>)}
    </Card>}
  </div>;
}
