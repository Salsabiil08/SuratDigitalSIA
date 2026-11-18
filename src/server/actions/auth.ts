'use server';
import { createClient } from '@/lib/supabase/server';
import { clearLocalSession, getCurrentUser, requireUser } from '@/server/auth';
import { redirect } from 'next/navigation';

export async function loginAction(_prev: { error?: string } | null, form: FormData) {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  if (!email || !password) return { error: 'Email dan kata sandi wajib diisi.' };
  let authenticated = false;
  try {
    const { data, error } = await (await createClient()).auth.signInWithPassword({ email, password });
    if(error&&(error.name==='AuthRetryableFetchError'||error.status===0||(error.status||0)>=500))return {error:'Layanan login belum dapat dihubungi. Coba kembali.'};
    authenticated = !error && !!data.user;
  } catch { return { error: 'Layanan login belum dapat dihubungi. Coba kembali.' }; }
  if (!authenticated) return { error: 'Email atau kata sandi tidak sesuai.' };
  await clearLocalSession();
  if (!await getCurrentUser()) {await (await createClient()).auth.signOut();return { error: 'Profil belum aktif. Hubungi pengelola akun perusahaan.' };}
  redirect('/');
}

export async function registerAction(_prev: { error?: string } | null, _form: FormData) {
  return { error: 'Pendaftaran akun dan penetapan jabatan dilakukan oleh pengelola perusahaan. Hubungi administrator.' };
}

export async function logoutAction() {
  await (await createClient()).auth.signOut();
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
  const user = await requireUser();
  const posCode = user.position?.code || '';
  const posLevel = user.position?.level ?? 0;
  const unitCode = user.unit?.code || '';
  const isSuperAdmin = !!user?.isSuperAdmin;

  // Surat Penagihan mengikuti unit pengaju yang ditetapkan perusahaan.
  const { data: billingType } = await (await createClient()).from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle();
  const canCreateBilling = !!user?.unit?.id && user.unit.id === billingType?.creator_unit_id;

  // Ajukan Pengesahan: seluruh staff, seluruh GM, dan SM (Dirut level paling atas tidak mengajukan)
  const canApplySignature = posLevel > 0 && posCode !== 'DIR';

  // Antrean Pengesahan: hanya Dirut dan SM yang menandatangani
  const canSignQueue = user.isOfficialSigner && (posCode === 'DIR' || posCode === 'SM');

  // Disposisi Masuk: semua user KECUALI Dirut (karena levelnya diatas)
  const canReceiveDisposition = posLevel > 0 && posCode !== 'DIR';

  // Disposisi Keluar: semua user KECUALI staff (karena level bawah)
  const canCreateDisposition = posLevel > 1 && posCode !== 'STF';

  return {
    id: user.id,
    name: user.fullName,
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
