import { getDispositionsAction } from '@/server/actions/dispositions';
import { DisposisiClient } from './disposisi-client';

export const dynamic = 'force-dynamic';

export default async function DisposisiPage() {
  const res = await getDispositionsAction();
  const initialData = res.success && res.data ? res.data : {
    inbox: [],
    outbox: [],
    availableLetters: [],
    availableProfiles: [],
    canCreateDisposition: false,
    canReceiveDisposition: false,
  };

  return <DisposisiClient initialData={initialData} />;
}
