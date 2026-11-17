'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { revalidatePath } from 'next/cache';

export interface CancelLetterInput {
  letterId: string;
  reason: string;
}

/**
 * Membatalkan draf surat (sebelum terbit nomor).
 * Langsung dieksekusi oleh pembuat tanpa memerlukan otorisasi pejabat.
 */
export async function cancelDraftLetterAction({ letterId, reason }: CancelLetterInput) {
  if (!reason?.trim()) {
    return { success: false, error: 'Alasan pembatalan draf wajib diisi.' };
  }

  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000005';
  const supabase = createAdminClient();

  const { data: letter } = await supabase
    .from('letters')
    .select('id, status, official_number')
    .eq('id', letterId)
    .single();

  if (!letter) {
    return { success: false, error: 'Surat tidak ditemukan.' };
  }

  if (letter.status === 'NUMBERED') {
    return { success: false, error: 'Surat yang sudah bernomor harus dibatalkan melalui prosedur otorisasi pembatalan resmi.' };
  }

  if (letter.status === 'CANCELLED' || letter.status === 'REJECTED') {
    return { success: false, error: `Surat dengan status ${letter.status} tidak dapat dibatalkan lagi.` };
  }

  // Update surat menjadi CANCELLED
  await supabase
    .from('letters')
    .update({
      status: 'CANCELLED',
      status_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', letterId);

  // Catat audit
  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: letterId,
    action: 'CANCEL_DRAFT',
    entity_type: 'letters',
    entity_id: letterId,
    status_before: letter.status,
    status_after: 'CANCELLED',
    reason,
  });

  revalidatePath(`/surat/${letterId}`);
  revalidatePath('/surat');
  return { success: true };
}

/**
 * Membatalkan surat bernomor resmi (Blueprint 6.12).
 * Wajib alasan dan dieksekusi sistem melalui fungsi database cancel_numbered_letter.
 * Nomor tetap tersimpan pada surat yang dibatalkan dan tidak pernah dipakai ulang.
 */
export async function cancelNumberedLetterAction({ letterId, reason }: CancelLetterInput) {
  if (!reason?.trim()) {
    return { success: false, error: 'Alasan pembatalan surat bernomor resmi wajib diisi.' };
  }

  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002'; // Pejabat berwenang
  const supabase = createAdminClient();

  // Panggil fungsi database atomik cancel_numbered_letter
  const { data, error } = await supabase.rpc('cancel_numbered_letter', {
    p_letter_id: letterId,
    p_actor: actorId,
    p_reason: reason,
  });

  if (error) {
    return { success: false, error: `Pembatalan surat gagal: ${error.message}` };
  }

  revalidatePath(`/surat/${letterId}`);
  revalidatePath('/surat');
  return { success: true, officialNumber: (data as any)?.official_number };
}

