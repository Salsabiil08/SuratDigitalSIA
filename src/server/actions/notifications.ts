'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/server/auth';
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
    const user = await requireUser();
    const { data, error } = await createClient().from('notifications')
      .select('id,recipient_id,letter_id,disposition_id,event_type,title,is_read,read_at,created_at')
      .eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(50);
    if(error) throw new Error('Gagal memuat pemberitahuan.');
    const items=(data||[]) as NotificationItem[];
    return {success:true,data:items,unreadCount:items.filter(n=>!n.is_read).length};
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
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId).eq('recipient_id',user.id);

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
