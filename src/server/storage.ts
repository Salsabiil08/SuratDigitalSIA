import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const BUCKET_DOCUMENTS = 'letter-documents';
export const BUCKET_ATTACHMENTS = 'letter-attachments';
export const MAX_ATTACHMENTS_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Mengunggah berkas ke Supabase Storage.
 * Berkas disimpan di bucket privat.
 */
export async function uploadLetterFile({
  bucket,
  path,
  fileBuffer,
  contentType,
}: {
  bucket: string;
  path: string;
  fileBuffer: ArrayBuffer | Uint8Array;
  contentType: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Gagal mengunggah berkas ke storage: ${error.message}`);
  }

  return data.path;
}

/**
 * Membuat Signed URL berumur pendek (default 5 menit) untuk berkas privat.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Gagal membuat URL unduhan bertanda tangan: ${error?.message || 'Path tidak valid'}`);
  }

  return data.signedUrl;
}

