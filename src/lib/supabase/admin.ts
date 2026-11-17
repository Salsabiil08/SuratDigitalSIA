import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Klien Supabase dengan hak akses Service Role.
 * HANYA boleh dipanggil di server (Server Action, Route Handler).
 * JANGAN PERNAH diekspos ke browser atau kode sisi klien.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL: createAdminClient cannot be called from the client browser!');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ixrpdgkrxlsxbwttujvz.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL belum dikonfigurasi di environment variables (NEXT_PUBLIC_SUPABASE_URL).');
  }

  if (!serviceRoleKey) {
    throw new Error('Supabase Service Role Key atau Anon Key belum dikonfigurasi di environment variables.');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[SIADocs] PERINGATAN: SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local. ' +
      'Menggunakan NEXT_PUBLIC_SUPABASE_ANON_KEY sebagai fallback pengembangan. ' +
      'Harap tambahkan Service Role Key dari Dashboard Supabase untuk operasi administratif penuh.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
