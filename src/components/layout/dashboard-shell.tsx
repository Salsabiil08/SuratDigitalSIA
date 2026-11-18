"use client";

import {notificationHref} from "@/domain/notification-links";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarProps } from "@/components/ui/sidebar";
import { LiveClock } from "@/components/ui/live-clock";
import { Menu, X, Search, Bell, LogOut } from "lucide-react";
import type { NotificationItem } from "@/server/actions/notifications";
import { logoutAction } from "@/server/actions/auth";

interface DashboardShellProps {
  sidebarUser: SidebarProps["user"];
  unreadNotificationsCount: number;
  children: React.ReactNode;
  initialNotifications: NotificationItem[];
  initialNotificationError?: string;
}

export function DashboardShell({
  sidebarUser,
  unreadNotificationsCount,
  children,
  initialNotifications,
  initialNotificationError,
}: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [quickNotifs, setQuickNotifs] =
    React.useState<NotificationItem[]>(initialNotifications);
  const [notificationError, setNotificationError] = React.useState(
    initialNotificationError || "",
  );
  const [unread, setUnread] = React.useState(unreadNotificationsCount);
  const pathname = usePathname();

  // Tutup menu drawer dan popup otomatis saat rute berubah
  React.useEffect(() => {
    setIsMobileOpen(false);
    setIsNotifOpen(false);
  }, [pathname]);

  // Muat notifikasi riil saat popover dibuka
  React.useEffect(() => {
    if (isNotifOpen) {
      import("@/server/actions/notifications")
        .then(({ getNotificationsAction }) => getNotificationsAction())
        .then((res) => {
          if (res.success && res.data) {
            setQuickNotifs(res.data);
            setUnread(res.unreadCount);
            setNotificationError("");
          } else
            setNotificationError(
              res.error || "Pemberitahuan belum dapat diperbarui.",
            );
        })
        .catch(() =>
          setNotificationError("Pemberitahuan belum dapat diperbarui."),
        );
    }
  }, [isNotifOpen]);

  return (
    <div className="flex h-screen h-[100dvh] w-screen w-full overflow-hidden bg-page-gradient">
      {/* Sidebar Desktop (Layar md ke atas) */}
      <aside className="hidden md:flex shrink-0 h-full overflow-hidden">
        <Sidebar
          user={sidebarUser}
          unreadNotificationsCount={unreadNotificationsCount}
          className="h-full min-h-0"
        />
      </aside>

      {/* Drawer Mobile (Layar di bawah md) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop gelap */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Konten Sidebar Mobile */}
          <div className="relative flex-1 flex flex-col max-w-[270px] w-full bg-[#121A22] z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Tombol Tutup */}
            <div className="absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Sidebar
              user={sidebarUser}
              unreadNotificationsCount={unreadNotificationsCount}
              className="w-full h-full border-r-0"
            />
          </div>
        </div>
      )}

      {/* Area Konten Utama */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 overflow-hidden">
        {/* ========================================================================= */}
        {/* HEADER BAR MERAH SESUAI GAMBAR 1 (DENGAN SEARCH, CLOCK, NOTIFIKASI & PROFIL) */}
        {/* ========================================================================= */}
        <header className="h-14 sm:h-15 px-3 sm:px-5 bg-gradient-to-r from-[#D31818] via-[#E62314] to-[#B30B0B] text-white shadow-md flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30">
          {/* Sisi Kiri: Menu Hamburger (Mobile) & Identitas Sistem (Tanpa Logo Ganda dengan Sidebar) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {/* Pada mobile: tampilkan judul SIADocs karena sidebar tersembunyi */}
              <span className="md:hidden font-extrabold text-sm sm:text-base tracking-wide text-white">
                SIADocs
              </span>
              {/* Pada desktop: tampilkan nama PT Semen Indonesia Aceh tanpa logo ganda */}
              <div className="hidden md:flex flex-col">
                <span className="font-extrabold text-sm tracking-wide text-white leading-tight">
                  PT Semen Indonesia Aceh
                </span>
                <span className="text-[10px] text-white/80 font-medium tracking-tight">
                  Sistem Persuratan Digital & Penomoran Resmi
                </span>
              </div>
            </Link>
          </div>

          {/* Bagian Tengah: Kotak Pencarian yang Proporsional & Elegan (Tidak Nabrak) */}
          <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md mx-3">
            <form action="/surat" method="GET" className="w-full">
              <div className="relative flex items-center w-full bg-white rounded-full h-9 pl-3.5 pr-1.5 shadow-xs border border-white/20 transition-all focus-within:ring-2 focus-within:ring-white/40">
                <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-2 pointer-events-none" />
                <input
                  name="q"
                  type="text"
                  placeholder="Cari surat, nomor, atau perihal..."
                  className="w-full min-w-0 text-xs text-neutral-800 placeholder:text-neutral-400 bg-transparent outline-none border-none focus:outline-none focus:ring-0 pr-2"
                />
                <button
                  type="submit"
                  className="bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-700 text-xs font-semibold px-3.5 py-1 rounded-full transition-all shrink-0 ml-1 shadow-2xs"
                >
                  Cari
                </button>
              </div>
            </form>
          </div>

          {/* Sisi Kanan: Jam Realtime, Notifikasi Bell, Profil Pengguna & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Jam Realtime Topbar */}
            <div className="hidden md:block">
              <LiveClock variant="topbar" />
            </div>

            {/* Ikon Notifikasi Bell Sesuai Gambar 1 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/15 text-white/95 hover:text-white transition-colors relative"
                title="Pusat Notifikasi"
                aria-label="Buka notifikasi"
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-300 rounded-full ring-2 ring-[#B30B0B] animate-ping" />
                )}
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-300 rounded-full ring-2 ring-[#B30B0B]" />
                )}
              </button>

              {/* Popover Notifikasi Cepat Live Supabase (Responsif Mobile) */}
              {isNotifOpen && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-neutral-200 text-neutral-900 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      Pusat Notifikasi
                    </span>
                    <span className="text-[10px] font-semibold bg-brand-red text-white px-2 py-0.5 rounded-full">
                      {unread} Baru
                    </span>
                  </div>
                  <div className="p-2 text-xs text-neutral-600 space-y-1 max-h-72 overflow-y-auto divide-y divide-neutral-100">
                    {notificationError && (
                      <p role="alert" className="p-3 text-red-700">
                        {notificationError}
                      </p>
                    )}
                    {quickNotifs.length > 0 ? (
                      quickNotifs.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          href={notificationHref(item)}
                          prefetch={false}
                          onClick={() => setIsNotifOpen(false)}
                          className="p-2.5 hover:bg-neutral-50 rounded-lg flex items-start gap-2.5 transition-colors block text-left"
                        >
                          <span className="text-base shrink-0 mt-0.5">
                            {item.event_type === "APPROVAL_REQUEST"
                              ? "🖋️"
                              : item.event_type === "NUMBER_ISSUED"
                                ? "📄"
                                : "🔔"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-neutral-800 m-0 line-clamp-2 leading-tight">
                              {item.title}
                            </p>
                            <span className="text-[10px] text-neutral-400 mt-1 block">
                              {new Date(item.created_at).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          {!item.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-red shrink-0 mt-1.5" />
                          )}
                        </Link>
                      ))
                    ) : (
                      <div className="p-4 text-center text-neutral-400 text-xs">
                        Belum ada notifikasi aktivitas.
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 bg-neutral-50 border-t border-neutral-200 text-center">
                    <Link
                      href="/notifikasi"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-xs font-bold text-brand-red hover:underline block"
                    >
                      Buka Semua Notifikasi &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Garis Pemisah Vertikal */}
            <div className="h-6 w-px bg-white/25 mx-0.5" />

            {/* Profil Pengguna di Header Atas Sesuai Gambar 1 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/profil"
                className="flex items-center gap-2 hover:opacity-90 transition-opacity select-none"
                title="Buka Halaman Profil Saya"
              >
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">
                    {sidebarUser?.name || "Pengguna SIA"}
                  </span>
                  <span className="text-[9px] font-semibold text-white/80 uppercase tracking-wider">
                    {sidebarUser?.isSuperAdmin
                      ? "SUPER ADMIN"
                      : sidebarUser?.position || "STAFF"}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white text-[#B30B0B] font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-white/30 shrink-0">
                  {sidebarUser?.initials || "SIA"}
                </div>
              </Link>

              {/* Tombol Logout Sesuai Gambar 1 */}
              <form action={logoutAction} className="flex items-center">
                <button
                  type="submit"
                  className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors"
                  title="Keluar dari Akun"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Konten Halaman Responsif & Rapi */}
        <main className="flex-1 min-h-0 p-3 sm:p-4 md:p-5 top-gradient-border flex flex-col gap-3.5 sm:gap-4 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
