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

const SESSION_COOKIE_NAME = 'siadocs_session';

/**
 * Menyimpan data sesi lokal di cookie (Fallback saat Supabase Cloud belum dihubungkan).
 */
export async function setLocalSession(profile: UserProfile) {
  try {
    const cookieStore = cookies();
    const serialized = Buffer.from(JSON.stringify(profile)).toString('base64');
    cookieStore.set(SESSION_COOKIE_NAME, serialized, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });
  } catch (err) {
    console.warn('setLocalSession error:', err);
  }
}

/**
 * Menghapus sesi lokal dari cookie.
 */
export async function clearLocalSession() {
  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      path: '/',
      maxAge: 0,
    });
  } catch (err) {
    console.warn('clearLocalSession error:', err);
  }
}

/**
 * Mendapatkan data profil dan penugasan pengguna aktif.
 * Mendukung Supabase Auth resmi serta sesi fallback lokal agar pengguna tetap
 * dapat menggunakan aplikasi saat database cloud sedang dalam proses setup.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  // 1. Cek sesi lokal dari cookie (Diperbarui saat login demo cepat atau login resmi)
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const decoded = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
      if (decoded && decoded.email) {
        return decoded as UserProfile;
      }
    }
  } catch {
    // Abaikan jika cookie corrupt
  }

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

  // 3. Default fallback demo user (Ahmad Fauzi) agar dashboard tidak blank
  return {
    id: 'a0000000-0000-0000-0000-000000000004',
    fullName: 'Ahmad Fauzi (GM Accounting)',
    email: 'gm.accounting@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: {
      id: 'p-003',
      code: 'GM',
      name: 'GM/Kepala Unit atau Departemen',
      level: 2,
    },
    unit: {
      id: 'u-001',
      code: 'ACH',
      name: 'Accounting',
    },
    isOfficialSigner: false,
    isSuperAdmin: false,
  };
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
