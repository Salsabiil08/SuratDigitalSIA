"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  NotificationItem,
} from "@/server/actions/notifications";

export function NotifikasiClient({
  initialData,
  initialUnread,
  initialError,
}: {
  initialData: NotificationItem[];
  initialUnread: number;
  initialError?: string;
}) {
  const [notifications, setNotifications] =
    React.useState<NotificationItem[]>(initialData);
  const [error, setError] = React.useState(initialError || "");
  const [filter, setFilter] = React.useState<"ALL" | "UNREAD">("ALL");
  const [unreadCount, setUnreadCount] = React.useState(initialUnread);

  const handleMarkAsRead = async (id: string) => {
    const result = await markNotificationAsReadAction(id);
    if (!result.success) {
      setError(result.error || "Gagal menandai pemberitahuan.");
      return;
    }
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsAsReadAction();
    if (!result.success) {
      setError(result.error || "Gagal menandai pemberitahuan.");
      return;
    }
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true })),
    );
    setUnreadCount(0);
  };

  const filteredItems = React.useMemo(() => {
    if (filter === "UNREAD") {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, filter]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "APPROVAL_REQUEST":
        return <Chip variant="amber">Persetujuan</Chip>;
      case "APPROVED":
        return <Chip variant="green">Disetujui</Chip>;
      case "REVISED":
        return <Chip variant="amber">Revisi</Chip>;
      case "REJECTED":
        return <Chip variant="red">Ditolak</Chip>;
      case "NUMBER_ISSUED":
        return <Chip variant="green">Nomor Terbit</Chip>;
      case "DISPOSITION":
        return <Chip variant="blue">Disposisi</Chip>;
      case "CANCELLED":
        return <Chip variant="red">Dibatalkan</Chip>;
      default:
        return <Chip variant="gray">Sistem</Chip>;
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 max-w-5xl w-full">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <PageHeader
        title="Pusat Notifikasi"
        className="pb-0"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-8 text-xs font-semibold px-3"
            >
              Tandai Semua Sudah Dibaca
            </Button>
          ) : undefined
        }
      />

      {/* Info Privacy Box */}
      <div className="p-3 bg-neutral-50/90 border border-[#EEEEEA] rounded-xl text-xs text-neutral-600 flex items-center gap-2">
        <span className="font-semibold text-neutral-800 shrink-0">
          Privasi & Keamanan:
        </span>
        <span className="truncate">
          Notifikasi tidak memuat ringkasan atau isi dokumen surat. Informasi
          sensitif hanya diakses melalui dokumen resmi.
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEEEEA] pb-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filter === "ALL"
              ? "bg-[#121A22] text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Semua ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("UNREAD")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            filter === "UNREAD"
              ? "bg-[#121A22] text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Belum Dibaca
          {unreadCount > 0 && (
            <span className="bg-brand-red text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notif List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <Card className="p-8 text-center text-neutral-500 text-xs">
            Tidak ada notifikasi{" "}
            {filter === "UNREAD" ? "yang belum dibaca" : ""}.
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`p-3.5 transition-colors border ${
                item.is_read
                  ? "bg-white border-[#EEEEEA]"
                  : "bg-red-50/20 border-red-200 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {getEventBadge(item.event_type)}
                    <span className="text-xs text-neutral-400">
                      {new Date(item.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      WIB
                    </span>
                    {!item.is_read && (
                      <span
                        className="w-2 h-2 rounded-full bg-brand-red"
                        title="Belum dibaca"
                      />
                    )}
                  </div>

                  <p className="text-sm font-medium text-neutral-900 leading-snug">
                    {item.title}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.letter_id && (
                    <Link href={`/surat/${item.letter_id}`}>
                      <Button variant="outline" size="sm">
                        Buka Surat
                      </Button>
                    </Link>
                  )}

                  {item.disposition_id && (
                    <Link href="/disposisi">
                      <Button variant="outline" size="sm">
                        Lihat Disposisi
                      </Button>
                    </Link>
                  )}

                  {!item.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(item.id)}
                      className="text-xs text-neutral-500 hover:text-neutral-800"
                    >
                      Tandai Dibaca
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
