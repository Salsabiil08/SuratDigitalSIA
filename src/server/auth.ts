import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  systemRole: 'USER' | 'SUPER_ADMIN';
  isActive: boolean;
  position?: {
    id: string;
    code: string;
    name: string;
    level: number;
  };
  unit?: {
    id: string;
    code: string;
    name: string;
  };
  isOfficialSigner: boolean;
  isSuperAdmin: boolean;
}

/** Hapus cookie demo lama. Identitas hanya diverifikasi melalui Supabase Auth. */
export async function clearLocalSession() {
  cookies().set('siadocs_session', '', { path: '/', maxAge: 0 });
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  // 2. Cek sesi resmi dari Supabase Auth (hanya jika ada cookie auth, menghindari lag jaringan)
  try {
    const cookieStore = cookies();
    const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

    if (hasAuthCookie) {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile && profile.is_active) {
          const { data: assignment } = await supabase
            .from('user_assignments')
            .select(`
              id,
              is_official_signer,
              position:positions (id, code, name, level),
              unit:organizational_units!user_assignments_unit_id_fkey (id, code, name)
            `)
            .eq('profile_id', user.id)
            .eq('is_active', true)
            .or('end_date.is.null,end_date.gte.'+new Date().toISOString().slice(0,10))
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          const pos = assignment?.position as unknown as { id: string; code: string; name: string; level: number } | undefined;
          const unit = assignment?.unit as unknown as { id: string; code: string; name: string } | undefined;

          return {
            id: profile.id,
            fullName: profile.full_name || user.email || 'Pengguna SIA',
            email: profile.email || user.email || '',
            systemRole: profile.system_role as 'USER' | 'SUPER_ADMIN',
            isActive: profile.is_active,
            position: pos,
            unit: unit,
            isOfficialSigner: !!assignment?.is_official_signer,
            isSuperAdmin: profile.system_role === 'SUPER_ADMIN',
          };
        }
      }
    }
  } catch {
    // Supabase auth check fallback
  }

  // Pengunjung tanpa sesi harus masuk melalui halaman login.
  return null;
}

/**
 * Memeriksa apakah pengguna aktif memiliki peran Super Admin.
 */
export async function requireSuperAdmin(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    throw new Error('UNAUTHORIZED: Akses hanya diperuntukkan bagi Super Admin.');
  }
  return user;
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user?.isActive) throw new Error('Silakan masuk menggunakan akun aktif.');
  return user;
}
