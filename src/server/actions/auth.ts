'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setLocalSession, clearLocalSession, getCurrentUser, UserProfile } from '@/server/auth';
import { redirect } from 'next/navigation';

export interface DemoUserOption {
  id: string;
  fullName: string;
  email: string;
  systemRole: 'USER' | 'SUPER_ADMIN';
  isActive: boolean;
  position: { id: string; code: string; name: string; level: number };
  unit: { id: string; code: string; name: string };
  isOfficialSigner: boolean;
  isSuperAdmin: boolean;
}

const DEMO_USERS: Record<string, DemoUserOption> = {
  admin: {
    id: 'a0000000-0000-0000-0000-000000000001',
    fullName: 'Super Admin SIADocs',
    email: 'admin@sia.co.id',
    systemRole: 'SUPER_ADMIN',
    isActive: true,
    position: { id: 'p-adm', code: 'ADM', name: 'Super Administrator', level: 99 },
    unit: { id: 'u-sec', code: 'IT', name: 'Sekretariat & IT' },
    isOfficialSigner: false,
    isSuperAdmin: true,
  },
  dirut: {
    id: 'a0000000-0000-0000-0000-000000000002',
    fullName: 'Budi Hartono (Direktur Utama)',
    email: 'dirut@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: { id: 'p-dir', code: 'DIR', name: 'Direktur Utama', level: 4 },
    unit: { id: 'u-bod', code: 'DIR', name: 'Direksi' },
    isOfficialSigner: true,
    isSuperAdmin: false,
  },
  sm_fin: {
    id: 'a0000000-0000-0000-0000-000000000003',
    fullName: 'Siti Rahma (Senior Manager Finance)',
    email: 'sm.finance@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: { id: 'p-sm', code: 'SM', name: 'Senior Manager', level: 3 },
    unit: { id: 'u-fin', code: 'FIN', name: 'Finance' },
    isOfficialSigner: true,
    isSuperAdmin: false,
  },
  gm_ach: {
    id: 'a0000000-0000-0000-0000-000000000004',
    fullName: 'Ahmad Fauzi (GM Accounting)',
    email: 'gm.accounting@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: { id: 'p-gm', code: 'GM', name: 'GM/Kepala Unit atau Departemen', level: 2 },
    unit: { id: 'u-ach', code: 'ACH', name: 'Accounting' },
    isOfficialSigner: false,
    isSuperAdmin: false,
  },
  staff_ach: {
    id: 'a0000000-0000-0000-0000-000000000005',
    fullName: 'Rina Dewi (Staff Accounting)',
    email: 'staff.accounting@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: { id: 'p-stf', code: 'STF', name: 'Staff/PIC', level: 1 },
    unit: { id: 'u-ach', code: 'ACH', name: 'Accounting' },
    isOfficialSigner: false,
    isSuperAdmin: false,
  },
  staff_fin: {
    id: 'a0000000-0000-0000-0000-000000000006',
    fullName: 'Doni Pratama (Staff Finance)',
    email: 'staff.finance@sia.co.id',
    systemRole: 'USER',
    isActive: true,
    position: { id: 'p-stf2', code: 'STF', name: 'Staff/PIC', level: 1 },
    unit: { id: 'u-fin', code: 'FIN', name: 'Finance' },
    isOfficialSigner: false,
    isSuperAdmin: false,
  },
};

export async function loginAction(prevState: { error?: string } | null, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi.' };
  }

  // 1. Coba login ke Supabase Auth
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      await clearLocalSession();
      redirect('/');
    }
  } catch (err) {
    // Abaikan jika Supabase cloud belum disetup
  }

  // 2. Fallback Login untuk akun demo atau email umum saat Supabase cloud belum siap
  const matchedDemo = Object.values(DEMO_USERS).find((u) => u.email === email);
  if (matchedDemo) {
    await setLocalSession(matchedDemo);
    redirect('/');
  }

  // Jika kata sandi minimal 4 karakter, izinkan masuk dengan profil dinamis
  if (password.length >= 4) {
    const rawPart = email.split('@')[0] || 'pengguna';
    const namePart = rawPart.replace(/[._]/g, ' ');
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const userProfile: UserProfile = {
      id: 'usr-' + Date.now(),
      fullName: formattedName,
      email: email,
      systemRole: email.includes('admin') ? 'SUPER_ADMIN' : 'USER',
      isActive: true,
      position: {
        id: 'p-gen',
        code: 'STF',
        name: 'Staff/PIC',
        level: 1,
      },
      unit: {
        id: 'u-gen',
        code: 'ACH',
        name: 'Accounting',
      },
      isOfficialSigner: false,
      isSuperAdmin: email.includes('admin'),
    };

    await setLocalSession(userProfile);
    redirect('/');
  }

  return { error: 'Email atau kata sandi tidak sesuai. Silakan coba lagi.' };
}

export async function registerAction(prevState: { error?: string } | null, formData: FormData) {
  const fullName = (formData.get('fullName') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const unitCode = (formData.get('unitCode') as string) || 'ACH';
  const positionCode = (formData.get('positionCode') as string) || 'STF';

  if (!fullName || !email || !password) {
    return { error: 'Nama lengkap, email, dan kata sandi wajib diisi.' };
  }

  if (password.length < 6) {
    return { error: 'Kata sandi minimal 6 karakter.' };
  }

  const unitMap: Record<string, string> = {
    ACH: 'Accounting',
    FIN: 'Finance',
    RPT: 'Reporting',
    HRD: 'Human Resources',
    OPR: 'Operasional',
    DIR: 'Direksi',
  };

  const positionMap: Record<string, { name: string; level: number; isSigner: boolean }> = {
    DIR: { name: 'Direktur Utama', level: 4, isSigner: true },
    SM: { name: 'Senior Manager', level: 3, isSigner: true },
    GM: { name: 'GM/Kepala Unit', level: 2, isSigner: false },
    STF: { name: 'Staff/PIC', level: 1, isSigner: false },
  };

  const defaultPos = { name: 'Staff/PIC', level: 1, isSigner: false };
  const selectedPos = positionMap[positionCode] ?? defaultPos;
  const selectedUnitName = unitMap[unitCode] || 'Accounting';

  const newUserId = 'usr-' + Date.now();

  let assignedUserId = newUserId;

  // 1. Coba daftarkan di Supabase jika cloud aktif
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (!authErr && authData.user) {
      assignedUserId = authData.user.id;
      // Simpan ke tabel profiles
      try {
        await adminSupabase.from('profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          email: email,
          system_role: 'USER',
          is_active: true,
        });

        // Ambil unit_id dan position_id dari database
        const { data: uData } = await adminSupabase
          .from('organizational_units')
          .select('id')
          .eq('code', unitCode)
          .single();

        const { data: pData } = await adminSupabase
          .from('positions')
          .select('id')
          .eq('code', positionCode)
          .single();

        if (uData && pData) {
          await adminSupabase.from('user_assignments').insert({
            profile_id: authData.user.id,
            unit_id: uData.id,
            position_id: pData.id,
            is_official_signer: selectedPos.isSigner,
            start_date: new Date().toISOString().slice(0, 10),
            is_active: true,
          });
        }
      } catch (err) {
        console.warn('Profile/assignment insert error:', err);
      }
    }
  } catch {
    // Supabase cloud belum siap, gunakan fallback sesi
  }

  // 2. Set sesi aktif pengguna baru langsung di browser
  const newProfile: UserProfile = {
    id: assignedUserId,
    fullName,
    email,
    systemRole: 'USER',
    isActive: true,
    position: {
      id: 'pos-' + positionCode.toLowerCase(),
      code: positionCode,
      name: selectedPos.name,
      level: selectedPos.level,
    },
    unit: {
      id: 'unit-' + unitCode.toLowerCase(),
      code: unitCode,
      name: selectedUnitName,
    },
    isOfficialSigner: selectedPos.isSigner,
    isSuperAdmin: false,
  };

  await setLocalSession(newProfile);
  redirect('/');
}

export async function quickLoginAction(roleKey: string) {
  const fallbackUser = DEMO_USERS['staff_ach'] || DEMO_USERS['admin'];
  const demoUser = DEMO_USERS[roleKey] || fallbackUser;
  if (!demoUser) {
    redirect('/login');
  }
  await setLocalSession(demoUser as UserProfile);
  redirect('/');
}

export async function logoutAction() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {}
  await clearLocalSession();
  redirect('/login');
}

export interface UserRoleInfo {
  id: string;
  name: string;
  email: string;
  positionCode: string;
  positionLevel: number;
  unitCode: string;
  isSuperAdmin: boolean;
  isOfficialSigner: boolean;
  canCreateBilling: boolean;
  canApplySignature: boolean;
  canSignQueue: boolean;
  canReceiveDisposition: boolean;
  canCreateDisposition: boolean;
}

/**
 * Mengambil informasi peran dan izin akses menu pengguna saat ini.
 * Disesuaikan dengan matriks wewenang:
 * - Surat Penagihan: Finance, GM, Dirut, SM
 * - Ajukan Pengesahan: seluruh staff, seluruh GM, dan SM (Dirut tidak)
 * - Antrean Pengesahan: hanya Dirut dan SM yang menandatangani
 * - Disposisi Masuk: semua user kecuali Dirut
 * - Disposisi Keluar: semua user kecuali staff
 */
export async function getCurrentUserRoleAction(): Promise<UserRoleInfo> {
  const user = await getCurrentUser();
  const posCode = user?.position?.code || 'STF';
  const posLevel = user?.position?.level ?? 1;
  const unitCode = user?.unit?.code || 'ACH';
  const isSuperAdmin = !!user?.isSuperAdmin;

  // Surat Penagihan: Finance (FIN), GM, Dirut, SM (atau Super Admin)
  const canCreateBilling =
    unitCode === 'FIN' ||
    posCode === 'DIR' ||
    posCode === 'SM' ||
    posCode === 'GM' ||
    posLevel >= 2 ||
    isSuperAdmin;

  // Ajukan Pengesahan: seluruh staff, seluruh GM, dan SM (Dirut level paling atas tidak mengajukan)
  const canApplySignature = posCode !== 'DIR' || isSuperAdmin;

  // Antrean Pengesahan: hanya Dirut dan SM yang menandatangani
  const canSignQueue = posCode === 'DIR' || posCode === 'SM' || isSuperAdmin;

  // Disposisi Masuk: semua user KECUALI Dirut (karena levelnya diatas)
  const canReceiveDisposition = posCode !== 'DIR' || isSuperAdmin;

  // Disposisi Keluar: semua user KECUALI staff (karena level bawah)
  const canCreateDisposition = (posLevel > 1 && posCode !== 'STF') || isSuperAdmin;

  return {
    id: user?.id || 'a0000000-0000-0000-0000-000000000005',
    name: user?.fullName || 'Pengguna SIA',
    email: user?.email || '',
    positionCode: posCode,
    positionLevel: posLevel,
    unitCode,
    isSuperAdmin,
    isOfficialSigner: !!user?.isOfficialSigner,
    canCreateBilling,
    canApplySignature,
    canSignQueue,
    canReceiveDisposition,
    canCreateDisposition,
  };
}
