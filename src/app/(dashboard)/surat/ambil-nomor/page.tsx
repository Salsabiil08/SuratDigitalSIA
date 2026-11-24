import {redirect} from 'next/navigation';
import {PreparedLetterEditor} from '@/components/letters/prepared-letter-editor';
import {ManualNumberForm} from '@/components/letters/manual-number-form';
import {getWorkflowOptions} from '@/server/actions/workflow';
import {readManualNumbers} from '@/server/manual-numbers';
import {RecoveryState} from '@/components/ui/recovery-state';
export default async function Page({searchParams}:{searchParams:Promise<{nomor?:string}>}){
 const {nomor}=await searchParams;
 if(nomor){const [reservation]=await readManualNumbers(nomor);if(!reservation)return <RecoveryState title="Nomor tidak tersedia" message="Buka nomor milik akun Anda." href="/surat/ambil-nomor" label="Kembali"/>;if(reservation.letter_id)redirect(`/surat/${reservation.letter_id}`);return <PreparedLetterEditor source="UPLOAD" manualReservation={reservation}/>;}
 const [options,pending]=await Promise.all([getWorkflowOptions(),readManualNumbers()]);return <ManualNumberForm options={options} pending={pending}/>;
}
