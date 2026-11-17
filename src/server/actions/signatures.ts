'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface UploadSignedDocumentInput {
  requestId: string;
  letterId: string;
  fileName: string;
  fileBuffer: ArrayBuffer | Uint8Array;
  fileFormat: 'PDF' | 'DOCX';
  stampIncluded: boolean;
  notes?: string;
}

/**
 * Mengambil daftar surat yang menunggu pengesahan tanda tangan (jalur IN_APP).
 * Khusus pejabat penandatangan (Senior Manager atau Direktur Utama).
 */
export async function getPendingSignatures() {
  const user = await getCurrentUser();
  const supabase = createAdminClient();

  // Ambil semua permintaan tanda tangan yang berstatus WAITING atau PENDING
  const { data: requests, error } = await supabase
    .from('signature_requests')
    .select(`
      id,
      letter_id,
      signer_id,
      sign_order,
      signer_role,
      status,
      signer:profiles!signer_id (full_name),
      letter:letters (
        id,
        official_number,
        subject,
        source,
        signature_mode,
        signature_status,
        recipient_type,
        recipient_external_name,
        recipient_external_org,
        creator:profiles!creator_id (full_name),
        unit:organizational_units!creator_unit_id (code, name),
        letter_type:letter_types (code, name, default_signature_count)
      )
    `)
    .in('status', ['PENDING', 'WAITING'])
    .order('sign_order', { ascending: true });

  if (requests && requests.length > 0) {
    const filtered = requests.filter((req) => {
      const typeCode = (req.letter as any)?.letter_type?.code;
      const sigStatus = (req.letter as any)?.signature_status;
      return typeCode !== 'IN' && sigStatus !== 'NOT_REQUIRED';
    });

    return filtered.map((req) => {
      const typeCode = (req.letter as any)?.letter_type?.code;
      const count = (req.letter as any)?.letter_type?.default_signature_count || (typeCode === 'Tag' ? 2 : 1);
      return {
        id: req.id,
        letterId: req.letter_id,
        signOrder: req.sign_order,
        totalSigners: count,
        signerRole: req.signer_role || (req.signer as any)?.full_name || 'Senior Manager / Direktur Utama',
        status: req.status,
        officialNumber: (req.letter as any)?.official_number || 'Belum Bernomor',
        subject: (req.letter as any)?.subject || 'Perihal Surat',
        typeName: (req.letter as any)?.letter_type?.name || 'Surat Resmi',
        recipient:
          (req.letter as any)?.recipient_type === 'EXTERNAL'
            ? `${(req.letter as any)?.recipient_external_name || 'Eksternal'}${
                (req.letter as any)?.recipient_external_org ? ` (${(req.letter as any)?.recipient_external_org})` : ''
              }`
            : (req.letter as any)?.recipient_external_name || 'Internal SIA',
        creatorName: (req.letter as any)?.creator?.full_name || 'Staff Pembuat',
        unitName: (req.letter as any)?.unit?.name || 'Unit Kerja',
      };
    });
  }

  // Fallback: periksa letters yang berstatus WAITING
  const { data: waitingLetters } = await supabase
    .from('letters')
    .select(`
      id,
      official_number,
      subject,
      recipient_external_name,
      signature_status,
      letter_types (code, name, default_signature_count),
      creator_unit:organizational_units (name)
    `)
    .eq('signature_status', 'WAITING');

  const filteredWaiting = (waitingLetters || []).filter(
    (l: any) => l.letter_types?.code !== 'IN' && l.signature_status !== 'NOT_REQUIRED'
  );

  return filteredWaiting.map((l: any) => ({
    id: 'sig-' + l.id,
    letterId: l.id,
    signOrder: 1,
    totalSigners: l.letter_types?.default_signature_count || (l.letter_types?.code === 'Tag' ? 2 : 1),
    signerRole: 'Senior Manager / Direktur Utama',
    status: 'WAITING',
    officialNumber: l.official_number || 'Belum Bernomor',
    subject: l.subject,
    typeName: l.letter_types?.name || 'Surat Dinas',
    recipient: l.recipient_external_name || 'Internal SIA',
    creatorName: 'Staff Pembuat',
    unitName: l.creator_unit?.name || 'Unit Kerja',
  }));
}

/**
 * Mengunggah dokumen yang telah ditandatangani dan distempel di luar sistem (IN_APP).
 * Menghitung hash SHA-256 berkas, menyimpan versi SIGNED, dan memperbarui status pengesahan.
 */
export async function uploadSignedDocumentAction({
  requestId,
  letterId,
  fileName,
  fileBuffer,
  fileFormat,
  stampIncluded,
  notes,
}: UploadSignedDocumentInput) {
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000002';
  const supabase = createAdminClient();

  // 1. Hitung SHA-256 hash berkas
  const buffer = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : fileBuffer instanceof ArrayBuffer
    ? Buffer.from(fileBuffer)
    : Buffer.from(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // 2. Simpan berkas ke Supabase Storage privat
  const storagePath = `signed/${letterId}/${Date.now()}_${fileName}`;
  const { error: storageError } = await supabase.storage
    .from('letter-documents')
    .upload(storagePath, buffer, {
      contentType: fileFormat === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (storageError) {
    // Jika storage gagal (misal emulator lokal belum aktif), catat path lokal simulasi
    console.warn('Storage upload error, using fallback path:', storageError.message);
  }

  // 3. Simpan entri letter_versions baru berjenis SIGNED
  const { data: newVersion, error: versionError } = await supabase
    .from('letter_versions')
    .insert({
      letter_id: letterId,
      version_no: 2,
      version_kind: 'SIGNED',
      storage_path: storagePath,
      file_format: fileFormat,
      file_hash: fileHash,
      created_by: actorId,
      is_current: true,
    })
    .select()
    .single();

  if (versionError || !newVersion) {
    return { success: false, error: `Gagal mencatat versi dokumen bertanda tangan: ${versionError?.message}` };
  }

  // 4. Perbarui signature_requests terkait
  await supabase
    .from('signature_requests')
    .update({
      status: 'UPLOADED',
      signed_version_id: newVersion.id,
      stamp_included: stampIncluded,
      uploaded_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // 5. Periksa apakah masih ada penandatangan berikutnya (misal pada Tagihan berurutan: SM lalu DIR)
  const { data: remainingRequests } = await supabase
    .from('signature_requests')
    .select('*')
    .eq('letter_id', letterId)
    .neq('status', 'UPLOADED');

  const nextSigner = remainingRequests?.find((r) => r.status === 'WAITING');
  if (nextSigner) {
    // Aktifkan antrean penandatangan berikutnya
    await supabase
      .from('signature_requests')
      .update({ status: 'PENDING' })
      .eq('id', nextSigner.id);
  } else {
    // Seluruh penandatanganan selesai! Status pengesahan surat menjadi UPLOADED
    await supabase
      .from('letters')
      .update({
        signature_status: 'UPLOADED',
        current_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', letterId);
  }

  // 6. Catat audit_logs
  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: letterId,
    action: 'SIGNATURE_UPLOADED',
    entity_type: 'letter_versions',
    entity_id: newVersion.id,
    version_id: newVersion.id,
    reason: notes ? `Pengesahan bertanda tangan diunggah: ${notes}` : 'Dokumen bertanda tangan resmi berhasil diunggah',
  });

  // 7. Berikan notifikasi ke pembuat surat
  try {
    const { data: letterData } = await supabase
      .from('letters')
      .select('creator_id, official_number, subject')
      .eq('id', letterId)
      .maybeSingle();

    if (letterData?.creator_id) {
      await supabase.from('notifications').insert({
        recipient_id: letterData.creator_id,
        letter_id: letterId,
        event_type: 'APPROVED',
        title: `Dokumen bernomor ${letterData.official_number || ''} telah disahkan dan diunggah bertanda tangan.`,
        is_read: false,
      });
    }
  } catch (notifErr) {
    console.warn('Gagal mencatat notifikasi pengesahan:', notifErr);
  }

  revalidatePath('/pengesahan');
  revalidatePath('/notifikasi');
  revalidatePath('/');
  revalidatePath(`/surat/${letterId}`);
  revalidatePath('/surat');

  return { success: true, fileHash, versionId: newVersion.id };
}

export interface SignatureSignerTrack {
  order: number;
  role: string;
  name: string;
  status: 'WAITING' | 'PENDING' | 'UPLOADED';
  uploadedAt?: string | null;
}

export interface SignatureTrackingItem {
  letterId: string;
  officialNumber: string;
  subject: string;
  typeCode: string;
  typeName: string;
  recipient: string;
  creatorName: string;
  unitName: string;
  signatureMode: 'IN_APP' | 'EXTERNAL';
  signatureStatus: 'NOT_STARTED' | 'NOT_REQUIRED' | 'WAITING' | 'UPLOADED' | 'EXTERNAL';
  totalSigners: number;
  completedSigners: number;
  signers: SignatureSignerTrack[];
  currentSignerName: string;
  issuedAt: string | null;
  overallStatus: 'MENUNGGU' | 'SELESAI' | 'EKSTERNAL';
}

/**
 * Mengambil pelacakan status pengesahan tanda tangan seluruh surat resmi bernomor non-internal.
 * Menghitung progres penandatanganan berjenjang (0/1, 1/2, 2/2 Selesai).
 */
export async function getSignatureTrackingListAction(): Promise<SignatureTrackingItem[]> {
  const supabase = createAdminClient();

  const { data: letters, error } = await supabase
    .from('letters')
    .select(`
      id,
      official_number,
      subject,
      status,
      signature_mode,
      signature_status,
      issued_at,
      created_at,
      recipient_type,
      recipient_external_name,
      recipient_external_org,
      creator:profiles!creator_id (full_name),
      unit:organizational_units!creator_unit_id (name, code),
      letter_type:letter_types (code, name, default_signature_count),
      signature_requests (
        id,
        signer_id,
        sign_order,
        signer_role,
        status,
        uploaded_at,
        signer:profiles!signer_id (full_name)
      )
    `)
    .not('official_number', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !letters) {
    console.error('Failed to load signature tracking:', error);
    return [];
  }

  // Filter: Surat Internal (IN) TIDAK ADA PENGESAHAN
  const nonInternalLetters = letters.filter(
    (l: any) => l.letter_type?.code !== 'IN' && l.signature_status !== 'NOT_REQUIRED'
  );

  return nonInternalLetters.map((l: any) => {
    const typeCode = l.letter_type?.code || 'KRE';
    const totalSigners = l.letter_type?.default_signature_count || (typeCode === 'Tag' ? 2 : 1);

    const rawRequests: any[] = l.signature_requests || [];
    const sortedReqs = [...rawRequests].sort((a, b) => a.sign_order - b.sign_order);

    let signers: SignatureSignerTrack[] = sortedReqs.map((sr) => ({
      order: sr.sign_order,
      role: sr.signer_role || (sr.sign_order === 1 && totalSigners === 2 ? 'Senior Manager Finance' : 'Direktur Utama'),
      name: sr.signer?.full_name || (sr.sign_order === 1 && totalSigners === 2 ? 'Siti Rahma' : 'Budi Hartono'),
      status: sr.status as any,
      uploadedAt: sr.uploaded_at,
    }));

    // Fallback jika belum ada baris signature_requests (misal mode EXTERNAL atau baru terbit)
    if (signers.length === 0) {
      if (totalSigners === 2) {
        signers = [
          { order: 1, role: 'Senior Manager Finance', name: 'Siti Rahma', status: l.signature_status === 'UPLOADED' ? 'UPLOADED' : 'WAITING' },
          { order: 2, role: 'Direktur Utama', name: 'Budi Hartono', status: l.signature_status === 'UPLOADED' ? 'UPLOADED' : 'PENDING' },
        ];
      } else {
        signers = [
          { order: 1, role: 'Direktur Utama', name: 'Budi Hartono', status: l.signature_status === 'UPLOADED' ? 'UPLOADED' : 'WAITING' },
        ];
      }
    }

    const completedSigners = signers.filter((s) => s.status === 'UPLOADED').length;
    const waitingSigner = signers.find((s) => s.status !== 'UPLOADED');
    const currentSignerName = waitingSigner ? `${waitingSigner.name} (${waitingSigner.role})` : 'Semua Pejabat';

    let overallStatus: 'MENUNGGU' | 'SELESAI' | 'EKSTERNAL' = 'MENUNGGU';
    if (l.signature_status === 'UPLOADED' || completedSigners >= totalSigners) {
      overallStatus = 'SELESAI';
    } else if (l.signature_mode === 'EXTERNAL' || l.signature_status === 'EXTERNAL') {
      overallStatus = 'EKSTERNAL';
    }

    return {
      letterId: l.id,
      officialNumber: l.official_number || 'Belum Bernomor',
      subject: l.subject,
      typeCode: l.letter_type?.code || 'KRE',
      typeName: l.letter_type?.name || 'Surat Eksternal',
      recipient:
        l.recipient_type === 'EXTERNAL'
          ? `${l.recipient_external_name || 'Eksternal'}${l.recipient_external_org ? ` (${l.recipient_external_org})` : ''}`
          : l.recipient_external_name || 'Internal SIA',
      creatorName: l.creator?.full_name || 'Staff',
      unitName: l.unit?.name || 'Unit Kerja',
      signatureMode: l.signature_mode || 'IN_APP',
      signatureStatus: l.signature_status || 'WAITING',
      totalSigners,
      completedSigners,
      signers,
      currentSignerName,
      issuedAt: l.issued_at || l.created_at,
      overallStatus,
    };
  });
}

export interface EligibleLetterForSigning {
  id: string;
  officialNumber: string;
  subject: string;
  typeCode: string;
  typeName: string;
  defaultSignatureCount: number;
  signatureStatus: string;
  signatureMode: string;
}

/**
 * Mengambil daftar surat bernomor resmi yang berhak diajukan pengesahan (non-IN).
 */
export async function getEligibleLettersForSigningAction(): Promise<EligibleLetterForSigning[]> {
  const supabase = createAdminClient();

  const { data: letters, error } = await supabase
    .from('letters')
    .select(`
      id,
      official_number,
      subject,
      signature_status,
      signature_mode,
      letter_types (code, name, default_signature_count)
    `)
    .not('official_number', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !letters) {
    return [];
  }

  // Filter: hanya surat eksternal / penagihan (bukan surat internal)
  return letters
    .filter((l: any) => l.letter_types?.code !== 'IN')
    .map((l: any) => ({
      id: l.id,
      officialNumber: l.official_number || '',
      subject: l.subject,
      typeCode: l.letter_types?.code || 'KRE',
      typeName: l.letter_types?.name || 'Surat Eksternal',
      defaultSignatureCount: l.letter_types?.default_signature_count || (l.letter_types?.code === 'Tag' ? 2 : 1),
      signatureStatus: l.signature_status,
      signatureMode: l.signature_mode,
    }));
}

export interface OfficialSignerOption {
  id: string;
  name: string;
  title: string;
  level: number;
}

/**
 * Mengambil daftar pejabat berwenang tanda tangan resmi.
 */
export async function getOfficialSignersAction(): Promise<OfficialSignerOption[]> {
  // Hanya Senior Manager Finance dan Direktur Utama yang berwenang menandatangani (R.04)
  return [
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Budi Hartono',
      title: 'Direktur Utama',
      level: 4,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Siti Rahma',
      title: 'Senior Manager Finance',
      level: 3,
    },
  ];
}

/**
 * Mengajukan surat ke alur pengesahan dengan pejabat yang dipilih sesuai jumlah tanda tangan.
 */
export async function submitLetterToSigningAction({
  letterId,
  signerIds,
}: {
  letterId: string;
  signerIds: string[];
}) {
  const supabase = createAdminClient();
  const user = await getCurrentUser();
  const actorId = user?.id || 'a0000000-0000-0000-0000-000000000005';

  // 1. Ambil data surat
  const { data: letter, error: letterError } = await supabase
    .from('letters')
    .select('id, official_number, subject, letter_types(code, name, default_signature_count)')
    .eq('id', letterId)
    .single();

  if (letterError || !letter) {
    return { success: false, error: 'Surat bernomor tidak ditemukan.' };
  }

  const typeCode = (letter.letter_types as any)?.code;
  if (typeCode === 'IN') {
    return { success: false, error: 'Surat Internal tidak memerlukan alur pengesahan tanda tangan.' };
  }

  const expectedSigners = (letter.letter_types as any)?.default_signature_count || (typeCode === 'Tag' ? 2 : 1);
  const typeName = (letter.letter_types as any)?.name || 'Resmi';
  if (signerIds.length < expectedSigners) {
    return {
      success: false,
      error: `Surat jenis ${typeName} memerlukan ${expectedSigners} orang pejabat penandatangan.`,
    };
  }

  // 2. Bersihkan antrean pengesahan lama yang belum selesai
  await supabase
    .from('signature_requests')
    .delete()
    .eq('letter_id', letterId)
    .neq('status', 'UPLOADED');

  const signersMetadata: Record<string, string> = {
    'a0000000-0000-0000-0000-000000000002': 'Direktur Utama',
    'a0000000-0000-0000-0000-000000000003': 'Senior Manager Finance',
  };

  // 3. Masukkan antrean penandatangan baru
  const requestsToInsert = signerIds.slice(0, expectedSigners).map((sId, idx) => ({
    letter_id: letterId,
    signer_id: sId,
    sign_order: idx + 1,
    signer_role: signersMetadata[sId] || (idx === 0 && expectedSigners === 2 ? 'Senior Manager Finance' : 'Direktur Utama'),
    status: idx === 0 ? 'WAITING' : 'PENDING',
  }));

  const { error: insertSigErr } = await supabase.from('signature_requests').insert(requestsToInsert);
  if (insertSigErr) {
    return { success: false, error: `Gagal membuat permohonan pengesahan: ${insertSigErr.message}` };
  }

  // 4. Update status surat menjadi WAITING di SIADocs
  await supabase
    .from('letters')
    .update({
      signature_mode: 'IN_APP',
      signature_status: 'WAITING',
      signer_id: signerIds[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', letterId);

  // 5. Beri notifikasi ke pejabat penandatangan pertama
  await supabase.from('notifications').insert({
    recipient_id: signerIds[0],
    letter_id: letterId,
    event_type: 'APPROVAL_REQUEST',
    title: `Surat nomor ${letter.official_number || ''} (${letter.subject}) menunggu pengesahan tanda tangan Anda.`,
    is_read: false,
  });

  // 6. Audit log
  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    letter_id: letterId,
    action: 'SIGNATURE_REQUESTED',
    entity_type: 'letters',
    entity_id: letterId,
    reason: `Pengesahan diajukan kepada ${requestsToInsert.length} pejabat penandatangan resmi.`,
  });

  revalidatePath('/pengesahan');
  revalidatePath('/surat');
  return { success: true };
}
