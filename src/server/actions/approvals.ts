'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { nextStatus } from '@/domain/status';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Mengajukan draft surat untuk persetujuan (DRAFT -> IN_REVIEW).
 * Mempersiapkan approval_steps sesuai aturan bisnis jenis surat:
 * - Internal: jika ada penandatangan/pejabat yang dipilih, tambahkan approval step.
 * - Eksternal: wajib persetujuan penandatangan resmi (SM/DIR).
 * - Tagihan: wajib 2 tahap berurutan: SM Finance (step 1) lalu Direktur Utama (step 2).
 */
export async function submitForApprovalAction(letterId: string) {
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000005';
  const supabase = createAdminClient();

  const { data: letter, error: fetchError } = await supabase
    .from('letters')
    .select(`
      id, status, letter_type_id, signer_id, creator_unit_id,
      letter_type:letter_types (code, category, default_signature_count)
    `)
    .eq('id', letterId)
    .single();

  if (fetchError || !letter) {
    return { success: false, error: 'Surat tidak ditemukan.' };
  }

  if (letter.status !== 'DRAFT' && letter.status !== 'REVISION_REQUESTED') {
    return { success: false, error: `Surat tidak dapat diajukan dari status ${letter.status}.` };
  }

  const typeCode = (letter.letter_type as unknown as { code: string })?.code;

  // Hapus langkah persetujuan lama jika ada
  await supabase.from('approval_steps').delete().eq('letter_id', letterId);

  // Buat langkah persetujuan sesuai jenis surat
  if (typeCode === 'Tag') {
    // Tagihan: SM Finance (step 1) lalu Direktur Utama (step 2)
    const { data: smFinance } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'sm.finance@sia.co.id')
      .single();
    const { data: dirut } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'dirut@sia.co.id')
      .single();

    const smId = smFinance?.id || 'a0000000-0000-0000-0000-000000000003';
    const dirId = dirut?.id || 'a0000000-0000-0000-0000-000000000002';

    await supabase.from('approval_steps').insert([
      {
        letter_id: letterId,
        cycle: 1,
        step_order: 1,
        approver_id: smId,
        step_source: 'BILLING_SUBMITTER',
        status: 'PENDING', // Aktif menunggu
      },
      {
        letter_id: letterId,
        cycle: 1,
        step_order: 2,
        approver_id: dirId,
        step_source: 'BILLING_APPROVER',
        status: 'WAITING', // Menunggu tahap 1 selesai
      },
    ]);
  } else if (typeCode === 'KRE') {
    // Eksternal: persetujuan penandatangan resmi
    const approverId = letter.signer_id || 'a0000000-0000-0000-0000-000000000002';
    await supabase.from('approval_steps').insert([
      {
        letter_id: letterId,
        cycle: 1,
        step_order: 1,
        approver_id: approverId,
        step_source: 'SIGNER_CONFIRMATION',
        status: 'PENDING',
      },
    ]);
  } else {
    // Internal: jika ada penandatangan pejabat
    if (letter.signer_id) {
      await supabase.from('approval_steps').insert([
        {
          letter_id: letterId,
          cycle: 1,
          step_order: 1,
          approver_id: letter.signer_id,
          step_source: 'CREATOR_SELECTED',
          status: 'PENDING',
        },
      ]);
    } else {
      // Internal tanpa persetujuan wajib: langsung Siap Diberi Nomor (MARK_READY)
      await supabase
        .from('letters')
        .update({ status: 'READY_TO_ISSUE', updated_at: new Date().toISOString() })
        .eq('id', letterId);

      await supabase.from('audit_logs').insert({
        actor_id: actorId,
        letter_id: letterId,
        action: 'MARK_READY',
        entity_type: 'letters',
        entity_id: letterId,
        status_before: 'DRAFT',
        status_after: 'READY_TO_ISSUE',
      });

      revalidatePath(`/surat/${letterId}`);
      revalidatePath('/surat');
      return { success: true, status: 'READY_TO_ISSUE' };
    }
  }

  // Update status surat menjadi IN_REVIEW
  await supabase
    .from('letters')
    .update({ status: 'IN_REVIEW', updated_at: new Date().toISOString() })
    .eq('id', letterId);

  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: letterId,
    action: 'SUBMIT',
    entity_type: 'letters',
    entity_id: letterId,
    status_before: letter.status,
    status_after: 'IN_REVIEW',
  });

  revalidatePath(`/surat/${letterId}`);
  revalidatePath('/surat');
  revalidatePath('/persetujuan');
  return { success: true, status: 'IN_REVIEW' };
}

/**
 * Menyetujui langkah persetujuan aktif (APPROVE).
 * Jika langkah terakhir: status surat bertransisi ke READY_TO_ISSUE.
 * TIDAK MENERBITKAN NOMOR OTOMATIS!
 */
export async function approveStepAction(stepId: string, note?: string) {
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002';
  const supabase = createAdminClient();

  const { data: step, error: stepError } = await supabase
    .from('approval_steps')
    .select('*, letter:letters(*)')
    .eq('id', stepId)
    .single();

  if (stepError || !step) {
    return { success: false, error: 'Langkah persetujuan tidak ditemukan.' };
  }

  // Tandai langkah ini APPROVED
  await supabase
    .from('approval_steps')
    .update({
      status: 'APPROVED',
      decision_note: note || 'Disetujui',
      decided_at: new Date().toISOString(),
    })
    .eq('id', stepId);

  // Periksa apakah masih ada langkah persetujuan berikutnya dalam siklus ini
  const { data: nextStep } = await supabase
    .from('approval_steps')
    .select('*')
    .eq('letter_id', step.letter_id)
    .eq('cycle', step.cycle)
    .gt('step_order', step.step_order)
    .order('step_order', { ascending: true })
    .limit(1)
    .single();

  if (nextStep) {
    // Aktifkan langkah berikutnya
    await supabase
      .from('approval_steps')
      .update({ status: 'PENDING' })
      .eq('id', nextStep.id);
  } else {
    // Ini persetujuan terakhir! Status surat menjadi READY_TO_ISSUE
    await supabase
      .from('letters')
      .update({
        status: 'READY_TO_ISSUE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.letter_id);

    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      letter_id: step.letter_id,
      action: 'APPROVE_LAST',
      entity_type: 'letters',
      entity_id: step.letter_id,
      status_before: 'IN_REVIEW',
      status_after: 'READY_TO_ISSUE',
      reason: note || 'Semua persetujuan wajib telah lengkap',
    });
  }

  revalidatePath('/persetujuan');
  revalidatePath(`/surat/${step.letter_id}`);
  return { success: true };
}

/**
 * Meminta revisi surat (REQUEST_REVISION).
 * Wajib menyertakan catatan revisi!
 */
export async function requestRevisionAction(stepId: string, revisionNote: string) {
  if (!revisionNote?.trim()) {
    return { success: false, error: 'Catatan revisi wajib diisi.' };
  }

  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002';
  const supabase = createAdminClient();

  const { data: step } = await supabase
    .from('approval_steps')
    .select('*')
    .eq('id', stepId)
    .single();

  if (!step) {
    return { success: false, error: 'Langkah persetujuan tidak ditemukan.' };
  }

  // Update step
  await supabase
    .from('approval_steps')
    .update({
      status: 'REVISION_REQUESTED',
      decision_note: revisionNote,
      decided_at: new Date().toISOString(),
    })
    .eq('id', stepId);

  // Update status surat ke REVISION_REQUESTED
  await supabase
    .from('letters')
    .update({
      status: 'REVISION_REQUESTED',
      status_reason: revisionNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.letter_id);

  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: step.letter_id,
    action: 'REQUEST_REVISION',
    entity_type: 'letters',
    entity_id: step.letter_id,
    status_before: 'IN_REVIEW',
    status_after: 'REVISION_REQUESTED',
    reason: revisionNote,
  });

  revalidatePath('/persetujuan');
  revalidatePath(`/surat/${step.letter_id}`);
  return { success: true };
}

/**
 * Menolak surat (REJECT).
 * Wajib menyertakan alasan penolakan. Status terminal, tidak dibuka kembali!
 */
export async function rejectLetterAction(stepId: string, reason: string) {
  if (!reason?.trim()) {
    return { success: false, error: 'Alasan penolakan surat wajib diisi.' };
  }

  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002';
  const supabase = createAdminClient();

  const { data: step } = await supabase
    .from('approval_steps')
    .select('*')
    .eq('id', stepId)
    .single();

  if (!step) {
    return { success: false, error: 'Langkah persetujuan tidak ditemukan.' };
  }

  // Update step
  await supabase
    .from('approval_steps')
    .update({
      status: 'REJECTED',
      decision_note: reason,
      decided_at: new Date().toISOString(),
    })
    .eq('id', stepId);

  // Update surat menjadi REJECTED
  await supabase
    .from('letters')
    .update({
      status: 'REJECTED',
      status_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.letter_id);

  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: step.letter_id,
    action: 'REJECT',
    entity_type: 'letters',
    entity_id: step.letter_id,
    status_before: 'IN_REVIEW',
    status_after: 'REJECTED',
    reason: reason,
  });

  revalidatePath('/persetujuan');
  revalidatePath(`/surat/${step.letter_id}`);
  return { success: true };
}

/**
 * Terbitkan Nomor Surat Resmi (Blueprint R.04).
 * Eksekusi satu transaksi melalui fungsi database issue_letter_number.
 * Surat bertransisi langsung dari READY_TO_ISSUE menjadi NUMBERED.
 */
export async function issueLetterNumberAction(letterId: string) {
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002';
  const idempotencyKey = `issuance-${letterId}-${Date.now()}`;

  const supabase = createAdminClient();

  // Panggil fungsi database atomik issue_letter_number
  const { data, error } = await supabase.rpc('issue_letter_number', {
    p_letter_id: letterId,
    p_actor: actorId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { success: false, error: `Penerbitan nomor gagal: ${error.message}` };
  }

  // Ambil data surat yang baru diterbitkan
  const { data: updatedLetter } = await supabase
    .from('letters')
    .select('official_number, issued_at, status, signature_status')
    .eq('id', letterId)
    .single();

  revalidatePath(`/surat/${letterId}`);
  revalidatePath(`/surat/${letterId}/terbitkan`);
  revalidatePath('/surat');

  return {
    success: true,
    officialNumber: updatedLetter?.official_number || (data as any)?.official_number,
    signatureStatus: updatedLetter?.signature_status,
  };
}

export interface PendingApprovalData {
  id: string;
  letterId: string;
  subject: string;
  letterType: string;
  creatorName: string;
  recipientName: string;
  stepOrder: number;
  totalSteps: number;
  previewContent?: string;
}

export async function getPendingApprovalsAction(): Promise<PendingApprovalData[]> {
  try {
    const supabase = createAdminClient();
    const { data: steps, error } = await supabase
      .from('approval_steps')
      .select(`
        id,
        letter_id,
        step_number,
        status,
        letters (
          id,
          subject,
          recipient_external_name,
          letter_types (name),
          creator:profiles (full_name)
        )
      `)
      .eq('status', 'WAITING')
      .order('step_number', { ascending: true });

    if (error || !steps) {
      return [];
    }

    return steps.map((s: any) => {
      const letData = s.letters;
      return {
        id: s.id,
        letterId: s.letter_id,
        subject: letData?.subject || 'Surat Dinas',
        letterType: letData?.letter_types?.name || 'Surat Dinas',
        creatorName: letData?.creator?.full_name || 'Staff Pembuat',
        recipientName: letData?.recipient_external_name || 'Internal SIA',
        stepOrder: s.step_number || 1,
        totalSteps: 2,
        previewContent: `Perihal: ${letData?.subject || ''}\nDitujukan kepada: ${letData?.recipient_external_name || 'Internal SIA'}\nDokumen surat sedang dalam alur persetujuan resmi.`,
      };
    });
  } catch (err) {
    return [];
  }
}

