'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { terbilangRupiah } from '@/domain/terbilang';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatFriendlyErrorMessage } from '@/lib/friendly-error';

export interface CreateLetterInput {
  source: 'CREATE' | 'UPLOAD';
  letterTypeCode: string; // 'IN' | 'KRE' | 'Tag'
  subject: string;
  recipientType: 'INTERNAL_USER' | 'EXTERNAL';
  recipientUserId?: string;
  recipientExternalName?: string;
  recipientExternalOrg?: string;
  signerId?: string;
  signatureMode?: 'IN_APP' | 'EXTERNAL';
  documentFileName?: string;
  documentStoragePath?: string;
  documentFormat?: 'PDF' | 'DOCX';
  attachments?: Array<{
    fileName: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

export interface CreateBillingLetterInput extends CreateLetterInput {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: Array<{
    description: string;
    amount: number;
  }>;
}

/**
 * Membuat draft surat baru untuk layanan Buat Surat (source = 'CREATE')
 * atau Ambil Nomor (source = 'UPLOAD').
 * Sesuai aturan bisnis, surat disimpan sebagai DRAFT tanpa nomor resmi.
 */
export async function createLetterAction(input: CreateLetterInput) {
  const user = await getCurrentUser();
  const creatorId = user?.id || 'a0000000-0000-0000-0000-000000000005'; // Fallback demo staff
  const creatorUnitId = user?.unit?.id;

  const supabase = createAdminClient();

  // Cari letter_type berdasarkan kode
  const { data: letterType, error: typeError } = await supabase
    .from('letter_types')
    .select('*')
    .eq('code', input.letterTypeCode)
    .single();

  if (typeError || !letterType) {
    return { success: false, error: 'Jenis surat tidak valid atau belum terdaftar.' };
  }

  // Tentukan unit pembuat
  let unitId = creatorUnitId;
  if (!unitId) {
    const { data: defaultUnit } = await supabase
      .from('organizational_units')
      .select('id')
      .eq('code', 'ACH')
      .single();
    unitId = defaultUnit?.id;
  }

  // Validasi kewenangan jenis surat
  let requiredSignatureCount = letterType.default_signature_count || 0;
  if (input.letterTypeCode === 'KRE') {
    requiredSignatureCount = 1;
  } else if (input.letterTypeCode === 'Tag') {
    requiredSignatureCount = 2;
  } else if (input.letterTypeCode === 'IN' && input.signerId) {
    requiredSignatureCount = 1;
  }

  // 1. Simpan baris surat (STATUS WAJIB 'DRAFT', TANPA NOMOR)
  const { data: letter, error: insertError } = await supabase
    .from('letters')
    .insert({
      source: input.source,
      letter_type_id: letterType.id,
      subject: input.subject,
      creator_id: creatorId,
      creator_unit_id: unitId,
      signer_id: input.signerId || null,
      recipient_type: input.recipientType,
      recipient_user_id: input.recipientType === 'INTERNAL_USER' ? input.recipientUserId : null,
      recipient_external_name: input.recipientType === 'EXTERNAL' ? input.recipientExternalName : null,
      recipient_external_org: input.recipientType === 'EXTERNAL' ? input.recipientExternalOrg : null,
      signature_mode: input.signatureMode || 'EXTERNAL',
      required_signature_count: requiredSignatureCount,
      status: 'DRAFT',
      signature_status: 'NOT_STARTED',
      official_number: null,
      issued_at: null,
    })
    .select()
    .single();

  if (insertError || !letter) {
    return { success: false, error: `Gagal menyimpan draft surat: ${insertError?.message}` };
  }

  // 2. Simpan versi dokumen bukti (jika ada file terunggah)
  if (input.documentStoragePath) {
    await supabase.from('letter_versions').insert({
      letter_id: letter.id,
      version_no: 1,
      version_kind: 'DRAFT',
      storage_path: input.documentStoragePath,
      file_format: input.documentFormat || 'PDF',
      created_by: creatorId,
      is_current: true,
    });
  }

  // 3. Simpan lampiran jika ada
  if (input.attachments && input.attachments.length > 0) {
    const attachmentsToInsert = input.attachments.map((att) => ({
      letter_id: letter.id,
      file_name: att.fileName,
      storage_path: att.storagePath,
      mime_type: att.mimeType,
      size_bytes: att.sizeBytes,
      uploaded_by: creatorId,
    }));
    await supabase.from('letter_attachments').insert(attachmentsToInsert);
  }

  // 4. Catat audit log
  await supabase.from('audit_logs').insert({
    actor_id: creatorId,
    letter_id: letter.id,
    action: 'CREATE_DRAFT',
    entity_type: 'letters',
    entity_id: letter.id,
    status_before: null,
    status_after: 'DRAFT',
  });

  revalidatePath('/surat');
  return { success: true, letterId: letter.id };
}

/**
 * Membuat Surat Pengantar Tagihan (khusus Finance).
 * Validasi: rincian minimal 2 baris, satu bank dan rekening, total & terbilang otomatis.
 */
export async function createBillingLetterAction(input: CreateBillingLetterInput) {
  // Validasi minimal 2 baris rincian
  if (!input.items || input.items.length < 2) {
    return { success: false, error: 'Surat Pengantar Tagihan wajib memiliki minimal 2 baris rincian tagihan.' };
  }

  // Validasi nilai nominal per baris
  for (const item of input.items) {
    if (!item.amount || item.amount <= 0) {
      return { success: false, error: 'Setiap baris rincian tagihan wajib memiliki nominal lebih besar dari 0.' };
    }
  }

  // Hitung total dan kalimat terbilang rupiah
  const totalAmount = input.items.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const terbilang = terbilangRupiah(totalAmount);

  // Simpan draft surat utama
  const letterResult = await createLetterAction({
    ...input,
    letterTypeCode: 'Tag',
  });

  if (!letterResult.success || !letterResult.letterId) {
    return letterResult;
  }

  const supabase = createAdminClient();

  // Simpan detail rekening tagihan
  const { error: billingDetailError } = await supabase.from('billing_details').insert({
    letter_id: letterResult.letterId,
    bank_name: input.bankName,
    account_number: input.accountNumber,
    account_holder: input.accountHolder,
    total_amount: totalAmount,
    terbilang: terbilang,
  });

  if (billingDetailError) {
    return { success: false, error: `Gagal menyimpan rincian bank tagihan: ${billingDetailError.message}` };
  }

  // Simpan baris-baris rincian tagihan
  const billingItems = input.items.map((item, idx) => ({
    letter_id: letterResult.letterId,
    line_no: idx + 1,
    description: item.description,
    amount: item.amount,
  }));

  const { error: itemsError } = await supabase.from('billing_items').insert(billingItems);

  if (itemsError) {
    return { success: false, error: `Gagal menyimpan item rincian tagihan: ${itemsError.message}` };
  }

  revalidatePath('/surat');
  return { success: true, letterId: letterResult.letterId };
}

export interface CreateInternalLetterQuickInput {
  unitCode: string;
  recipientName: string;
  letterDate: string;
  subject: string;
  summary?: string;
  signatureMode?: 'IN_APP' | 'EXTERNAL';
}

export interface CreateQuickLetterInput {
  source: 'CREATE' | 'UPLOAD';
  letterTypeCode: 'IN' | 'KRE';
  unitCode: string;
  recipientName: string;
  recipientOrg?: string;
  letterDate: string;
  subject: string;
  summary?: string;
  signatureMode?: 'IN_APP' | 'EXTERNAL';
  signerId?: string;
  fileName?: string;
}

/**
 * Menerbitkan nomor surat resmi secara cepat dan bertahap (Wizard).
 * Sesuai aturan Blueprint R.04: Surat internal & eksternal yang diterbitkan nomornya
 * tercatat atomik ke letters, number_issuances, dan audit_logs.
 */
export async function createQuickLetterAction(input: CreateQuickLetterInput) {
  const user = await getCurrentUser();
  const creatorId = user?.id || 'a0000000-0000-0000-0000-000000000005';
  const supabase = createAdminClient();

  const now = input.letterDate ? new Date(input.letterDate) : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const unit = (input.unitCode || 'ACH').toUpperCase();

  // Ambil tipe surat
  const { data: letterType } = await supabase
    .from('letter_types')
    .select('id, code')
    .eq('code', input.letterTypeCode)
    .single();

  const letterTypeId = letterType?.id || (input.letterTypeCode === 'KRE' ? 'f3ee26d6-1eee-40e1-952a-897eb1aac10c' : '713541c8-d902-4a31-bb35-1c8a59262b06');

  // Ambil unit kerja pembuat
  const { data: unitData } = await supabase
    .from('organizational_units')
    .select('id, code')
    .eq('code', unit)
    .single();

  // 1. Dapatkan nomor urut resmi tertinggi dari letters dan number_issuances tahun ini
  let seq = 1;
  try {
    const { data: existingLetters } = await supabase
      .from('letters')
      .select('official_number')
      .not('official_number', 'is', null);

    if (existingLetters && existingLetters.length > 0) {
      const numbers = existingLetters
        .map((l) => {
          const match = l.official_number?.match(/^(\d{3})/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);

      if (numbers.length > 0) {
        seq = Math.max(...numbers) + 1;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca counter letters:', err);
  }

  // 2. Pastikan nomor benar-benar unik dan belum pernah dipakai (looping anti-collision)
  let officialNumber = '';
  let maxAttempts = 50;
  while (maxAttempts > 0) {
    const seqPadded = String(seq).padStart(3, '0');
    const candidateNumber = input.letterTypeCode === 'IN'
      ? `${seqPadded}${day}-IN/${unit}/SIA/${month}.${year}`
      : `${seqPadded}${day}/KRE.DIR/${month}.${year}`;

    const { data: existing } = await supabase
      .from('letters')
      .select('id')
      .eq('official_number', candidateNumber)
      .maybeSingle();

    if (!existing) {
      officialNumber = candidateNumber;
      break;
    }
    seq++;
    maxAttempts--;
  }

  const signerId = input.letterTypeCode === 'IN'
    ? null
    : (input.signerId || (input.letterTypeCode === 'KRE' || input.signatureMode === 'IN_APP' ? 'a0000000-0000-0000-0000-000000000002' : null));

  const signatureStatus = input.letterTypeCode === 'IN'
    ? 'NOT_REQUIRED'
    : (input.signatureMode === 'IN_APP' ? 'WAITING' : 'EXTERNAL');

  const signatureMode = input.letterTypeCode === 'IN'
    ? 'EXTERNAL'
    : (input.signatureMode || 'EXTERNAL');

  try {
    let newLetter: any = null;
    let insertError: any = null;

    // Retry loop bila terjadi tabrakan nomor unik pada saat bersamaan (auto-retry anti collision)
    for (let retry = 0; retry < 5; retry++) {
      const res = await supabase
        .from('letters')
        .insert({
          source: input.source,
          letter_type_id: letterTypeId,
          subject: input.subject,
          creator_id: creatorId,
          creator_unit_id: unitData?.id || null,
          signer_id: signerId,
          recipient_type: input.letterTypeCode === 'IN' ? 'INTERNAL_USER' : 'EXTERNAL',
          recipient_external_name: input.recipientName,
          recipient_external_org: input.recipientOrg || null,
          status: 'NUMBERED',
          signature_status: signatureStatus,
          signature_mode: signatureMode,
          official_number: officialNumber,
          issued_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!res.error && res.data) {
        newLetter = res.data;
        insertError = null;
        break;
      }

      insertError = res.error;
      if (
        res.error?.message?.includes('letters_official_number_key') ||
        res.error?.code === '23505'
      ) {
        seq++;
        const nextSeqPadded = String(seq).padStart(3, '0');
        officialNumber =
          input.letterTypeCode === 'IN'
            ? `${nextSeqPadded}${day}-IN/${unit}/SIA/${month}.${year}`
            : `${nextSeqPadded}${day}/KRE.DIR/${month}.${year}`;
      } else {
        break;
      }
    }

    if (insertError || !newLetter) {
      console.error('Insert letter error:', insertError);
      return { success: false, error: formatFriendlyErrorMessage(insertError?.message || 'Gagal menyimpan surat') };
    }

    // Simpan naskah/isi surat ke versi dokumen (letter_versions)
    if (input.summary) {
      try {
        await supabase.from('letter_versions').insert({
          letter_id: newLetter.id,
          version_no: 1,
          version_kind: 'NUMBERED',
          content_html: input.summary,
          file_format: 'DOCX',
          created_by: creatorId,
          is_current: true,
        });
      } catch (verErr) {
        console.warn('letter_versions insert error:', verErr);
      }
    }

    // Jika signatureMode IN_APP dan BUKAN jenis surat IN, buat antrean tanda tangan
    if (input.letterTypeCode !== 'IN' && input.signatureMode === 'IN_APP') {
      try {
        const targetSigner = signerId || 'a0000000-0000-0000-0000-000000000002';
        await supabase.from('signature_requests').insert({
          letter_id: newLetter.id,
          signer_id: targetSigner,
          sign_order: 1,
          signer_role: 'Direktur Utama',
          status: 'WAITING',
        });

        // Kirim notifikasi ke penandatangan dan pembuat
        await supabase.from('notifications').insert([
          {
            recipient_id: targetSigner,
            letter_id: newLetter.id,
            event_type: 'APPROVAL_REQUEST',
            title: `Surat nomor ${officialNumber} (${input.subject}) menunggu pengesahan tanda tangan Anda.`,
            is_read: false,
          },
          {
            recipient_id: creatorId,
            letter_id: newLetter.id,
            event_type: 'NUMBER_ISSUED',
            title: `Nomor resmi ${officialNumber} terbit dan surat diteruskan ke antrean pengesahan.`,
            is_read: false,
          },
        ]);
      } catch (e) {
        console.warn('signature_requests / notifications insert error:', e);
      }
    } else {
      try {
        await supabase.from('notifications').insert({
          recipient_id: creatorId,
          letter_id: newLetter.id,
          event_type: 'NUMBER_ISSUED',
          title: `Nomor resmi ${officialNumber} terbit untuk perihal "${input.subject}".`,
          is_read: false,
        });
      } catch (e) {
        console.warn('notifications insert error:', e);
      }
    }

    // Catat ke number_issuances dengan skema kolom yang valid
    try {
      await supabase.from('number_issuances').insert({
        letter_id: newLetter.id,
        year: year,
        sequence_number: seq,
        official_number: officialNumber,
        issued_at: new Date().toISOString(),
        issued_by: creatorId,
        status: 'COMPLETED',
      });
    } catch (issErr) {
      console.warn('number_issuances insert error:', issErr);
    }

    // Catat jejak audit
    try {
      await supabase.from('audit_logs').insert({
        actor_id: creatorId,
        letter_id: newLetter.id,
        action: 'NUMBER_ISSUED',
        entity_type: 'letters',
        entity_id: newLetter.id,
        official_number: officialNumber,
        reason: `Penerbitan nomor resmi melalui layanan ${input.source === 'UPLOAD' ? 'Ambil Nomor' : 'Buat Surat'}`,
      });
    } catch {}

    revalidatePath('/surat');
    revalidatePath('/notifikasi');
    revalidatePath('/pengesahan');
    revalidatePath('/');

    return {
      success: true,
      letterId: newLetter.id,
      officialNumber,
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatFriendlyErrorMessage(err?.message || 'Terjadi kendala saat memproses surat.'),
    };
  }
}

/**
 * Meneruskan surat bernomor resmi ke antrean Pengesahan Tanda Tangan (IN_APP)
 */
export async function forwardLetterToSigningAction(letterId: string, signerId?: string) {
  try {
    const supabase = createAdminClient();
    const targetSigner = signerId || 'a0000000-0000-0000-0000-000000000002'; // Direktur Utama

    const { data: letter, error: getErr } = await supabase
      .from('letters')
      .select('id, official_number, subject, creator_id')
      .eq('id', letterId)
      .single();

    if (getErr || !letter) {
      return { success: false, error: 'Surat tidak ditemukan.' };
    }

    await supabase
      .from('letters')
      .update({
        signature_mode: 'IN_APP',
        signature_status: 'WAITING',
        signer_id: targetSigner,
      })
      .eq('id', letterId);

    // Pastikan antrean signature_requests ada
    const { data: existing } = await supabase
      .from('signature_requests')
      .select('id')
      .eq('letter_id', letterId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('signature_requests').insert({
        letter_id: letterId,
        signer_id: targetSigner,
        sign_order: 1,
        signer_role: 'Direktur Utama',
        status: 'WAITING',
      });
    } else {
      await supabase
        .from('signature_requests')
        .update({ status: 'WAITING', signer_id: targetSigner })
        .eq('id', existing.id);
    }

    // Catat notifikasi ke penandatangan dan pembuat
    await supabase.from('notifications').insert([
      {
        recipient_id: targetSigner,
        letter_id: letterId,
        event_type: 'APPROVAL_REQUEST',
        title: `Surat nomor ${letter.official_number || ''} (${letter.subject}) diteruskan ke antrean pengesahan Anda.`,
        is_read: false,
      },
      {
        recipient_id: letter.creator_id,
        letter_id: letterId,
        event_type: 'NUMBER_ISSUED',
        title: `Surat nomor ${letter.official_number || ''} berhasil diajukan ke antrean Pengesahan.`,
        is_read: false,
      },
    ]);

    revalidatePath('/pengesahan');
    revalidatePath('/notifikasi');
    revalidatePath('/surat');
    revalidatePath(`/surat/${letterId}`);
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Wrapper kompatibilitas untuk createInternalLetterQuickAction
 */
export async function createInternalLetterQuickAction(input: CreateInternalLetterQuickInput) {
  return createQuickLetterAction({
    source: 'CREATE',
    letterTypeCode: 'IN',
    unitCode: input.unitCode,
    recipientName: input.recipientName,
    letterDate: input.letterDate,
    subject: input.subject,
    summary: input.summary,
    signatureMode: input.signatureMode,
  });
}

export interface LetterItemData {
  id: string;
  officialNumber: string | null;
  subject: string;
  recipientText: string;
  typeName: string;
  typeCategory: string;
  status: any;
  signatureStatus: any;
  createdAt: string;
}

export async function getLettersAction(): Promise<LetterItemData[]> {
  try {
    const supabase = createAdminClient();
    const { data: letters, error } = await supabase
      .from('letters')
      .select(`
        id,
        official_number,
        subject,
        recipient_external_name,
        recipient_external_org,
        status,
        signature_status,
        created_at,
        letter_types (name, category)
      `)
      .order('created_at', { ascending: false });

    if (error || !letters) {
      return [];
    }

    return letters.map((l: any) => ({
      id: l.id,
      officialNumber: l.official_number,
      subject: l.subject,
      recipientText: l.recipient_external_name
        ? `${l.recipient_external_name}${l.recipient_external_org ? ` (${l.recipient_external_org})` : ''}`
        : 'Internal SIA',
      typeName: l.letter_types?.name || 'Surat Dinas',
      typeCategory: l.letter_types?.category || 'INTERNAL',
      status: l.status,
      signatureStatus: l.signature_status,
      createdAt: l.created_at,
    }));
  } catch (err) {
    return [];
  }
}

export async function getLetterDetailAction(letterId: string) {
  try {
    const supabase = createAdminClient();
    const { data: letter, error } = await supabase
      .from('letters')
      .select(`
        id,
        official_number,
        subject,
        source,
        status,
        signature_status,
        signature_mode,
        status_reason,
        created_at,
        recipient_external_name,
        recipient_external_org,
        letter_types (name, category),
        creator_unit:organizational_units (name, code),
        signer:profiles (full_name),
        creator:profiles (full_name)
      `)
      .eq('id', letterId)
      .single();

    if (error || !letter) {
      return null;
    }

    // Ambil approval steps
    const { data: steps } = await supabase
      .from('approval_steps')
      .select(`
        step_number,
        status,
        decided_at,
        approver:profiles (full_name)
      `)
      .eq('letter_id', letterId)
      .order('step_number', { ascending: true });

    return {
      id: letter.id,
      officialNumber: letter.official_number,
      subject: letter.subject,
      typeName: (letter as any).letter_types?.name || 'Surat Dinas',
      typeCategory: (letter as any).letter_types?.category || 'INTERNAL',
      source: letter.source || 'CREATE',
      status: letter.status,
      signatureStatus: letter.signature_status,
      recipientText: letter.recipient_external_name
        ? `${letter.recipient_external_name}${(letter as any).recipient_external_org ? ` (${(letter as any).recipient_external_org})` : ''}`
        : 'Internal SIA',
      signerName: (letter as any).signer?.full_name || 'Budi Hartono (Direktur Utama)',
      creatorName: (letter as any).creator?.full_name || 'Staff Pembuat',
      creatorUnit: (letter as any).creator_unit ? `${(letter as any).creator_unit.name} (${(letter as any).creator_unit.code})` : 'Accounting (ACH)',
      signatureMode: letter.signature_mode || 'EXTERNAL',
      statusReason: letter.status_reason || '',
      createdAt: letter.created_at,
      approvals: (steps || []).map((s: any) => ({
        step: s.step_number,
        approver: s.approver?.full_name || 'Penyetuju',
        status: s.status,
        date: s.decided_at ? new Date(s.decided_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : 'Menunggu',
      })),
    };
  } catch (err) {
    return null;
  }
}

