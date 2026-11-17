'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { canCompleteDisposition, LetterStatus } from '@/domain/status';
import { createNotification } from '@/server/actions/notifications';
import { revalidatePath } from 'next/cache';

export interface CreateDispositionInput {
  recipientId: string;
  letterId?: string;
  subject: string;
  instruction: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  dueDate?: string;
  requiresLetter: boolean;
}

export interface UpdateDispositionStatusInput {
  dispositionId: string;
  status: 'IN_PROGRESS' | 'DONE';
  followUpNote?: string;
}

export interface DispositionItem {
  id: string;
  subject: string;
  instruction: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  status: 'NEW' | 'IN_PROGRESS' | 'DONE';
  requiresLetter: boolean;
  letterId?: string;
  letterNumber?: string;
  giverName: string;
  recipientName: string;
  dueDate?: string;
  followUpNote?: string;
  createdAt: string;
}

export interface DispositionProfileOption {
  id: string;
  fullName: string;
  unitCode: string;
  unitName: string;
  roleInfo: string;
}

export interface DispositionsData {
  inbox: DispositionItem[];
  outbox: DispositionItem[];
  availableLetters: Array<{ id: string; officialNumber: string; subject: string; status: string }>;
  availableProfiles: DispositionProfileOption[];
  availableUnits?: Array<{ code: string; name: string }>;
  canCreateDisposition: boolean;
  canReceiveDisposition: boolean;
}

/**
 * Mengambil data disposisi (Masuk & Keluar) beserta referensi surat dan pegawai dari seluruh unit organisasi.
 */
export async function getDispositionsAction(): Promise<{
  success: boolean;
  data: DispositionsData;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const currentUserId = user?.id || 'a0000000-0000-0000-0000-000000000005';
    const supabase = createAdminClient();

    // Aturan Hak Akses Disposisi:
    // 1. Disposisi Masuk: semua user KECUALI Dirut (karena levelnya paling atas)
    const canReceiveDisposition = user ? user.position?.code !== 'DIR' || user.isSuperAdmin : true;

    // 2. Disposisi Keluar: semua user KECUALI staff (karena level paling bawah)
    const canCreateDisposition = user ? ((user.position?.level ?? 1) > 1 && user.position?.code !== 'STF') || user.isSuperAdmin : false;

    // 1. Eksekusi query secara paralel untuk kecepatan maksimal (tanpa lag)
    const dispQuery = supabase
      .from('dispositions')
      .select(`
        id,
        subject,
        instruction,
        priority,
        status,
        requires_letter,
        due_date,
        follow_up_note,
        created_at,
        letter_id,
        giver_id,
        recipient_id,
        giver:profiles!giver_id (full_name),
        recipient:profiles!recipient_id (full_name),
        letter:letters (id, official_number, subject, status)
      `)
      .order('created_at', { ascending: false });

    // Hanya ambil referensi surat jika user berwenang membuat disposisi
    const lettersQuery = canCreateDisposition
      ? supabase
          .from('letters')
          .select('id, official_number, subject, status')
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as any[] });

    const [{ data: disps, error: dispErr }, { data: letters }] = await Promise.all([
      dispQuery,
      lettersQuery,
    ]);

    if (dispErr) {
      console.error('Error fetching dispositions:', dispErr);
    }

    const items: DispositionItem[] = (disps || []).map((d: any) => ({
      id: d.id,
      subject: d.subject,
      instruction: d.instruction,
      priority: d.priority,
      status: d.status,
      requiresLetter: !!d.requires_letter,
      letterId: d.letter_id || undefined,
      letterNumber: d.letter?.official_number || undefined,
      giverName: d.giver?.full_name || 'Pemberi Disposisi',
      recipientName: d.recipient?.full_name || 'Penerima Disposisi',
      dueDate: d.due_date || undefined,
      followUpNote: d.follow_up_note || undefined,
      createdAt: d.created_at,
    }));

    // Filter inbox (diterima oleh user) & outbox (dibuat oleh user)
    const inbox = items.filter((d: any) => {
      const raw = disps?.find((r: any) => r.id === d.id);
      return raw ? raw.recipient_id === currentUserId : true;
    });

    const outbox = items.filter((d: any) => {
      const raw = disps?.find((r: any) => r.id === d.id);
      return raw ? raw.giver_id === currentUserId : false;
    });

    const availableLetters = (letters || []).map((l: any) => ({
      id: l.id,
      officialNumber: l.official_number || 'Draft / Belum Bernomor',
      subject: l.subject,
      status: l.status,
    }));

    // Data pegawai dari SELURUH unit organisasi (Accounting, Finance, Reporting, dll.)
    let availableProfiles: DispositionProfileOption[] = [
      {
        id: 'a0000000-0000-0000-0000-000000000005',
        fullName: 'Rina Dewi',
        unitCode: 'ACH',
        unitName: 'Accounting',
        roleInfo: 'Staff/PIC — Accounting (ACH)',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000004',
        fullName: 'Ahmad Fauzi',
        unitCode: 'ACH',
        unitName: 'Accounting',
        roleInfo: 'GM Accounting — Unit ACH',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000006',
        fullName: 'Doni Pratama',
        unitCode: 'FIN',
        unitName: 'Finance',
        roleInfo: 'Staff/PIC — Finance (FIN)',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        fullName: 'Siti Rahma',
        unitCode: 'FIN',
        unitName: 'Finance',
        roleInfo: 'Senior Manager Finance (FIN)',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000007',
        fullName: 'Hendri Kurniawan',
        unitCode: 'RPT',
        unitName: 'Reporting',
        roleInfo: 'Staff/PIC — Reporting (RPT)',
      },
    ];

    try {
      const { data: assignments } = await supabase
        .from('user_assignments')
        .select(`
          profile_id,
          profile:profiles!profile_id (id, full_name, is_active),
          unit:organizational_units!unit_id (id, code, name),
          position:positions!position_id (id, code, name, level)
        `)
        .eq('is_active', true);

      if (assignments && assignments.length > 0) {
        const fromDb = assignments
          .filter((a: any) => a.profile && a.profile.is_active && a.profile.id !== currentUserId)
          .map((a: any) => ({
            id: a.profile.id,
            fullName: a.profile.full_name,
            unitCode: a.unit?.code || 'SIA',
            unitName: a.unit?.name || 'Unit Kerja',
            roleInfo: `${a.position?.name || 'Pegawai'} — ${a.unit?.name || 'Unit Kerja'} (${a.unit?.code || ''})`,
          }));

        if (fromDb.length > 0) {
          availableProfiles = fromDb;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca user_assignments untuk disposisi:', e);
    }

    const availableUnits = [
      { code: 'ALL', name: 'Semua Unit Organisasi' },
      { code: 'ACH', name: 'Accounting' },
      { code: 'FIN', name: 'Finance' },
      { code: 'RPT', name: 'Reporting' },
    ];

    return {
      success: true,
      data: {
        inbox: items.length > 0 && inbox.length === 0 && outbox.length === 0 ? items : inbox,
        outbox,
        availableLetters,
        availableProfiles,
        availableUnits,
        canCreateDisposition,
        canReceiveDisposition,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      data: {
        inbox: [],
        outbox: [],
        availableLetters: [],
        availableProfiles: [],
        canCreateDisposition: false,
        canReceiveDisposition: true,
      },
    };
  }
}

/**
 * Membuat disposisi baru (satu tingkat, satu pemberi ke satu penerima).
 */
export async function createDispositionAction(input: CreateDispositionInput) {
  const user = await getCurrentUser();
  const giverId = user?.id || 'a0000000-0000-0000-0000-000000000004'; // Default GM Accounting
  const supabase = createAdminClient();

  // Staf level 1 tidak berwenang membuat disposisi keluar
  if (user && user.position && user.position.level <= 1 && !user.isSuperAdmin) {
    return { success: false, error: 'Akses Ditolak: Staff pelaksana (Level 1) tidak memiliki kewenangan membuat instruksi disposisi keluar.' };
  }

  // Jika requiresLetter = true tapi letterId tidak ada, tolak
  if (input.requiresLetter && !input.letterId) {
    return { success: false, error: 'Disposisi yang menuntut surat tindak lanjut wajib dikaitkan dengan surat.' };
  }

  const { data, error } = await supabase
    .from('dispositions')
    .insert({
      giver_id: giverId,
      recipient_id: input.recipientId,
      letter_id: input.letterId || null,
      subject: input.subject,
      instruction: input.instruction,
      priority: input.priority,
      due_date: input.dueDate || null,
      status: 'NEW',
      requires_letter: input.requiresLetter,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: `Gagal membuat disposisi: ${error?.message}` };
  }

  // Notifikasi untuk penerima (tidak memuat isi dokumen)
  await createNotification({
    recipientId: input.recipientId,
    eventType: 'DISPOSITION',
    title: `Disposisi baru diterima: "${input.subject}" (Prioritas: ${input.priority})`,
    dispositionId: data.id,
    letterId: input.letterId || undefined,
  });

  revalidatePath('/disposisi');
  return { success: true, dispositionId: data.id };
}

/**
 * Memperbarui status disposisi oleh penerima (NEW -> IN_PROGRESS -> DONE).
 * Menerapkan aturan Blueprint R.04: bila requires_letter = true,
 * status DONE DITOLAK bila surat terkait belum NUMBERED.
 */
export async function updateDispositionStatusAction({
  dispositionId,
  status,
  followUpNote,
}: UpdateDispositionStatusInput) {
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000005';
  const supabase = createAdminClient();

  const { data: disp, error: fetchError } = await supabase
    .from('dispositions')
    .select('*, letter:letters(*)')
    .eq('id', dispositionId)
    .single();

  if (fetchError || !disp) {
    return { success: false, error: 'Disposisi tidak ditemukan.' };
  }

  // Validasi aturan penyelesaian R.04
  if (status === 'DONE') {
    if (!followUpNote?.trim()) {
      return { success: false, error: 'Catatan tindak lanjut wajib diisi saat menyelesaikan disposisi.' };
    }

    if (disp.requires_letter) {
      const letterStatus = (disp.letter as any)?.status as LetterStatus | undefined;
      const isAllowed = canCompleteDisposition(true, letterStatus);
      if (!isAllowed) {
        return {
          success: false,
          error: `Disposisi ini menuntut surat resmi. Status surat saat ini adalah ${letterStatus || 'BELUM DIKAITKAN'}. Disposisi hanya dapat diselesaikan setelah surat berstatus Sudah Bernomor (NUMBERED).`,
        };
      }
    }
  }

  const { error: updateError } = await supabase
    .from('dispositions')
    .update({
      status: status,
      follow_up_note: followUpNote || disp.follow_up_note,
      completed_at: status === 'DONE' ? new Date().toISOString() : null,
    })
    .eq('id', dispositionId);

  if (updateError) {
    return { success: false, error: `Gagal memperbarui status disposisi: ${updateError.message}` };
  }

  // Notifikasi untuk pemberi disposisi
  if (status === 'DONE') {
    await createNotification({
      recipientId: disp.giver_id,
      eventType: 'DISPOSITION',
      title: `Disposisi selesai dikerjakan: "${disp.subject}"`,
      dispositionId: dispositionId,
      letterId: disp.letter_id || undefined,
    });
  }

  revalidatePath('/disposisi');
  return { success: true };
}
