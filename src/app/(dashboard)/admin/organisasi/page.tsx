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

  const { units, positions } = await getMasterOrganisasi();

  const fallbackUnits = units.length > 0 ? units : [
    { id: '1', code: 'ACH', name: 'Accounting', isActive: true },
    { id: '2', code: 'RPT', name: 'Reporting', isActive: true },
    { id: '3', code: 'FIN', name: 'Finance', isActive: true },
  ];

  const fallbackPositions = positions.length > 0 ? positions : [
    { id: '1', code: 'DIR', name: 'Direktur Utama', level: 4, isActive: true },
    { id: '2', code: 'SM', name: 'Senior Manager', level: 3, isActive: true },
    { id: '3', code: 'GM', name: 'GM / Kepala Unit atau Departemen', level: 2, isActive: true },
    { id: '4', code: 'STF', name: 'Staff / PIC', level: 1, isActive: true },
  ];

  return (
    <OrganisasiClient
      initialUnits={fallbackUnits}
      initialPositions={fallbackPositions}
    />
  );
}
