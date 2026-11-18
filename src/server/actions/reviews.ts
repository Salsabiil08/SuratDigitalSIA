'use server';
import { requireUser } from '@/server/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
export async function getPendingReviewsAction() {
  const user = await requireUser();
  const { data, error } = await (await createClient()).from('review_steps')
    .select('id,letter_id,version_id,cycle,letter:letters!review_steps_letter_id_fkey(id,subject,current_version_id,reviewer_id,review_status,revision,status)')
    .eq('reviewer_id', user.id).eq('status', 'PENDING').order('assigned_at');
  if (error) throw new Error('Daftar pemeriksaan belum dapat diambil.');
  return (data || []).filter(row => {
    const letter = row.letter as any;
    return !!letter && letter.current_version_id === row.version_id && letter.reviewer_id === user.id && letter.review_status === 'WAITING';
  }).map(row => ({ id: row.id, letterId: row.letter_id, subject: (row.letter as any).subject }));
}
export async function decideReviewAction(stepId: string, versionId: string, revision: number, action: 'COMMENT' | 'PASS' | 'REQUEST_REVISION', note?: string) {
  try {
    const user = await requireUser();
    const { error } = await createAdminClient().rpc('decide_letter_review', {
      p_actor: user.id, p_step: stepId, p_version: versionId, p_revision: revision,
      p_action: action, p_note: note || null,
    });
    if (error) throw new Error(error.message);
    for (const path of ['/pemeriksaan','/surat','/notifikasi','/']) revalidatePath(path);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Pemeriksaan gagal disimpan.' };
  }
}
