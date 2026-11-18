import { getDispositionsAction } from '@/server/actions/dispositions';
import { DisposisiClient } from './disposisi-client';

export const dynamic = 'force-dynamic';

export default async function DisposisiPage({searchParams}:{searchParams:{surat?:string;tugas?:string}}) {
  const res = await getDispositionsAction(searchParams.surat);
  const initialData = res.success && res.data ? res.data : {
    inbox: [],
    outbox: [],
    availableLetters: [],
    availableProfiles: [],
    canCreateDisposition: false,
    canReceiveDisposition: false,
  };

  return <DisposisiClient initialData={initialData} initialError={res.error} sourceLetterId={searchParams.surat} selectedTaskId={searchParams.tugas} />;
}
