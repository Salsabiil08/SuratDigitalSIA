'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/server/actions/auth';

export interface NavItem {
  label: string;
  href: string;
  badge?: number | string;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export interface SidebarProps {
  user?: {
    name: string;
    position: string;
    positionCode?: string;
    positionLevel?: number;
    unit?: string;
    initials?: string;
    isSuperAdmin?: boolean;
  };
  unreadNotificationsCount?: number;
  className?: string;
}

export function Sidebar({ user, unreadNotificationsCount, className }: SidebarProps) {
  const pathname = usePathname();

  // Surat Penagihan: Finance (FIN), GM, Dirut, dan SM (atau Super Admin)
  const canAccessBilling =
    user?.unit === 'FIN' ||
    user?.positionCode === 'GM' ||
    user?.positionCode === 'SM' ||
    user?.positionCode === 'DIR' ||
    user?.isSuperAdmin;

  const suratItems: NavItem[] = [
    { label: 'Surat Saya', href: '/surat' },
    { label: 'Buat Surat', href: '/surat/buat' },
    { label: 'Ambil Nomor', href: '/surat/ambil-nomor' },
  ];

  if (canAccessBilling) {
    suratItems.push({ label: 'Surat Penagihan', href: '/tagihan/buat' });
  }

  suratItems.push(
    { label: 'Pengesahan', href: '/pengesahan' },
    { label: 'Disposisi', href: '/disposisi' }
  );

  // Menu Administrasi: Master Organisasi & Seri Penomoran untuk semua user, Log History khusus Super Admin
  const adminItems: NavItem[] = [
    { label: 'Master Organisasi', href: '/admin/organisasi' },
    { label: 'Seri Penomoran', href: '/admin/seri' },
  ];

  if (user?.isSuperAdmin) {
    adminItems.push({ label: 'Riwayat Aktivitas', href: '/admin/log' });
  }

  const groups: NavGroup[] = [
    {
      items: [
        { label: 'Beranda', href: '/' },
      ],
    },
    {
      title: 'Surat',
      items: suratItems,
    },
    {
      title: 'Administrasi',
      items: adminItems,
    },
  ];

  const defaultUser = user || {
    name: 'Pengguna SIA',
    position: 'Staff',
    unit: 'Accounting',
    initials: 'PS',
  };

  return (
    <nav
      className={cn(
        'w-[250px] shrink-0 bg-[#121A22] text-[#E1E5EA] flex flex-col p-3.5 sm:p-4 h-full min-h-0 overflow-hidden border-r border-[#1C2630]',
        className
      )}
      aria-label="Menu utama"
    >
      {/* Brand dengan Logo dan Teks Resmi */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-1 py-3 mb-2 hover:opacity-90 transition-opacity"
        title="SIADocs - Beranda Dashboard"
      >
        <img
          src="/images/logo.png"
          alt="SIADocs Logo"
          className="h-8 w-auto object-contain drop-shadow-sm shrink-0"
        />
        <img
          src="/images/logo-text.png"
          alt="SIADocs"
          className="h-5 w-auto object-contain drop-shadow-xs shrink-0"
        />
      </Link>

      {/* Nav Groups */}
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-1">
            {group.title && (
              <div className="text-[11px] font-semibold tracking-wider uppercase text-[#9AA3AE] px-2.5 pt-4 pb-1">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors min-h-[38px]',
                    isActive
                      ? 'bg-[rgba(242,106,15,0.22)] text-[#FFB27A] font-semibold'
                      : 'text-[#E1E5EA] hover:bg-white/[0.08]'
                  )}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="bg-gradient-to-r from-[#E62314] to-[#F26A0F] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Ikon Profil Saja di Kiri Bawah Sesuai Permintaan User */}
      <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-white">
        <Link
          href="/profil"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.08] transition-colors w-full group"
          title="Buka Halaman Profil Saya"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B30B0B] to-[#F26A0F] text-white flex items-center justify-center text-xs font-bold ring-2 ring-white/20 group-hover:ring-white/40 shadow-xs shrink-0">
            {defaultUser.initials || 'SIA'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate">
              Profil Saya
            </div>
            <div className="text-[10px] text-neutral-400 truncate">
              {defaultUser.position}
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}
