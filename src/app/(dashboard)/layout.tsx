import * as React from 'react';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  let unreadNotificationsCount = 0;

  if (user) {
    try {
      const supabase = createAdminClient();
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (!user.isSuperAdmin) {
        query = query.eq('recipient_id', user.id);
      }

      const { count: notifCount } = await query;
      unreadNotificationsCount = notifCount || 0;
    } catch {
      // safe fallback
    }
  }

  const sidebarUser = user
    ? {
        name: user.fullName,
        position: user.position?.name || 'Pengguna',
        positionCode: user.position?.code,
        positionLevel: user.position?.level ?? 1,
        unit: user.unit?.code,
        isSuperAdmin: user.isSuperAdmin,
        initials: user.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
      }
    : {
        name: 'Pengguna SIA',
        position: 'Staff',
        positionCode: 'STF',
        positionLevel: 1,
        unit: 'Accounting',
        isSuperAdmin: false,
        initials: 'PS',
      };

  return (
    <DashboardShell
      sidebarUser={sidebarUser}
      unreadNotificationsCount={unreadNotificationsCount}
    >
      {children}
    </DashboardShell>
  );
}
