'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/auth';
import { readNotifications } from '@/server/notifications';
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
    const result=await readNotifications();
    return {success:true,...result};
  } catch {
    return {success:false,data:[],unreadCount:0,error:'Gagal memuat pemberitahuan.'};
  }
}

/**
 * Menandai satu notifikasi telah dibaca.
 */
export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const user = await requireUser();
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId).eq('recipient_id',user.id)
      .select('id').maybeSingle();

    if (error || !data) return { success: false, error: 'Gagal menandai pemberitahuan. Coba kembali.' };
    revalidatePath('/notifikasi');
    return { success: true };
  } catch {
    return { success: false, error: 'Tidak dapat menandai pemberitahuan. Pastikan Anda masuk dengan akun aktif.' };
  }
}

/**
 * Menandai seluruh notifikasi pengguna aktif sebagai terbaca.
 */
export async function markAllNotificationsAsReadAction() {
  try {
    const user = await requireUser();
    const recipientId = user.id;
    const supabase = createClient();

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) return { success: false, error: 'Gagal menandai pemberitahuan. Coba kembali.' };
    revalidatePath('/notifikasi');
    return { success: true };
  } catch {
    return { success: false, error: 'Tidak dapat menandai pemberitahuan. Pastikan Anda masuk dengan akun aktif.' };
  }
}
