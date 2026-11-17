'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { revalidatePath } from 'next/cache';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  letter_id?: string | null;
  disposition_id?: string | null;
  event_type: string;
  title: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  recipientId: string;
  eventType: 'APPROVAL_REQUEST' | 'APPROVED' | 'REVISED' | 'REJECTED' | 'NUMBER_ISSUED' | 'DISPOSITION' | 'CANCELLED';
  title: string;
  letterId?: string;
  dispositionId?: string;
}

/**
 * Mengambil daftar notifikasi untuk pengguna yang sedang aktif.
 * Aturan Bisnis: Notifikasi TIDAK MEMUAT isi dokumen surat.
 */
export async function getNotificationsAction(): Promise<{
  success: boolean;
  data: NotificationItem[];
  unreadCount: number;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const recipientId = user?.id || 'a0000000-0000-0000-0000-000000000005';
    const supabase = createAdminClient();

    // 1. Cek notifikasi khusus untuk user aktif (jika bukan Super Admin)
    if (user && !user.isSuperAdmin) {
      const { data: userNotifs } = await supabase
        .from('notifications')
        .select('id, recipient_id, letter_id, disposition_id, event_type, title, is_read, read_at, created_at')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (userNotifs && userNotifs.length > 0) {
        const unread = userNotifs.filter((n) => !n.is_read).length;
        return {
          success: true,
          data: userNotifs as NotificationItem[],
          unreadCount: unread,
        };
      }
    }

    // 2. Ambil notifikasi terkini dari Supabase (untuk Super Admin atau fallback aktivitas organisasi)
    const { data: allNotifs, error } = await supabase
      .from('notifications')
      .select('id, recipient_id, letter_id, disposition_id, event_type, title, is_read, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !allNotifs || allNotifs.length === 0) {
      return {
        success: true,
        data: getDemoNotifications(recipientId),
        unreadCount: 0,
      };
    }

    const items = allNotifs as NotificationItem[];
    const unreadCount = items.filter((n) => !n.is_read).length;

    return {
      success: true,
      data: items,
      unreadCount,
    };
  } catch (err: any) {
    return {
      success: true,
      data: getDemoNotifications('a0000000-0000-0000-0000-000000000005'),
      unreadCount: 0,
    };
  }
}

/**
 * Menandai satu notifikasi telah dibaca.
 */
export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      console.warn('markNotificationAsReadAction error:', error.message);
    }
    revalidatePath('/notifikasi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Menandai seluruh notifikasi pengguna aktif sebagai terbaca.
 */
export async function markAllNotificationsAsReadAction() {
  try {
    const user = await getCurrentUser();
    const recipientId = user?.id || 'a0000000-0000-0000-0000-000000000005';
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      console.warn('markAllNotificationsAsReadAction error:', error.message);
    }
    revalidatePath('/notifikasi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Membuat entri notifikasi baru (Server-side helper).
 * Tidak menyimpan ringkasan atau isi dokumen apapun.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: input.recipientId,
        letter_id: input.letterId || null,
        disposition_id: input.dispositionId || null,
        event_type: input.eventType,
        title: input.title,
        is_read: false,
        channels_sent: ['IN_APP'],
      })
      .select()
      .single();

    return { success: !error, data, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function getDemoNotifications(recipientId: string): NotificationItem[] {
  return [
    {
      id: 'notif-001',
      recipient_id: recipientId,
      letter_id: 'l-002',
      event_type: 'NUMBER_ISSUED',
      title: 'Nomor surat resmi 00105-Tag/FIN/SIA/11.2026 telah berhasil diterbitkan.',
      is_read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 menit lalu
    },
    {
      id: 'notif-002',
      recipient_id: recipientId,
      letter_id: 'l-001',
      event_type: 'APPROVAL_REQUEST',
      title: 'Surat dinas baru membutuhkan persetujuan Anda sebagai Penyetuju Tahap 1.',
      is_read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 jam lalu
    },
    {
      id: 'notif-003',
      recipient_id: recipientId,
      disposition_id: 'disp-001',
      event_type: 'DISPOSITION',
      title: 'Anda menerima instruksi disposisi baru dengan instruksi tindak lanjut.',
      is_read: true,
      read_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 hari lalu
    },
    {
      id: 'notif-004',
      recipient_id: recipientId,
      letter_id: 'l-003',
      event_type: 'CANCELLED',
      title: 'Surat dengan nomor resmi 00098/DIR/SIA/11.2026 telah dibatalkan resmi.',
      is_read: true,
      read_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 hari lalu
    },
  ];
}

