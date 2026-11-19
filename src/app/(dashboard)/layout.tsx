import {QueueAutoRefresh} from "@/components/letters/queue-auto-refresh";
import * as React from 'react';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getNotificationsAction } from '@/server/actions/notifications';
import { readNavigationAccess } from '@/server/navigation-access';
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

  const [notifications,navigation]=await Promise.all([getNotificationsAction(),readNavigationAccess(user)]);

  const sidebarUser = user
    ? {
        access: navigation.access,
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
      unreadNotificationsCount={notifications.unreadCount}
      initialNotifications={notifications.data}
      initialNotificationError={notifications.error}
    >
      <QueueAutoRefresh/>
      {navigation.error&&<p role="alert" className="text-sm text-red-700">{navigation.error}</p>}
      {children}
    </DashboardShell>
  );
}
