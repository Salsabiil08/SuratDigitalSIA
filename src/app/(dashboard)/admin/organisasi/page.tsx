import {AccessDenied} from '@/components/ui/access-denied';
import { getMasterOrganisasi } from '@/server/admin';
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';
import { OrganisasiClient } from './organisasi-client';

export const dynamic = 'force-dynamic';

export default async function AdminOrganisasiPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!user.isSuperAdmin) return <AccessDenied/>;

  const { units, positions } = await getMasterOrganisasi();

  const fallbackUnits=units;
  const fallbackPositions=positions;

  return (
    <OrganisasiClient
      initialUnits={fallbackUnits}
      initialPositions={fallbackPositions}
    />
  );
}
