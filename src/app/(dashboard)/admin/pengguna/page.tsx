import { isRetiredBetaAccount } from '@/domain/retired-beta-accounts';
import { requireSuperAdmin } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrationOptions } from '@/server/registration';
import { RequestForm } from './request-form';
export const dynamic='force-dynamic';
export default async function UsersPage(){
 await requireSuperAdmin();
 const db=createAdminClient();
 const [requests,users,options]=await Promise.all([
 db.from('account_registrations').select('id,profile_id,requested_unit_id,requested_position_id,created_at').eq('status','PENDING').order('created_at'),
 db.from('profiles').select('id,full_name,email,is_active,system_role').order('full_name'),
 registrationOptions()]);
 if(requests.error||users.error||options.error) return <p role="alert">Daftar pengguna gagal dimuat. Silakan coba kembali.</p>;
 const visibleUsers=users.data?.filter(user=>!isRetiredBetaAccount(user));
 return <div className="space-y-6"><h1 className="text-2xl font-bold">Akun Pengguna</h1>
 <section className="bg-white rounded-xl p-5"><h2 className="font-semibold text-lg">Pendaftaran Menunggu Pemeriksaan</h2>
 <p className="text-sm text-gray-600">Periksa identitas, unit, dan jabatan sebelum aktivasi. Hak penandatangan dan mandat pemeriksa diatur terpisah.</p>
 {!requests.data?.length&&<p className="mt-3">Tidak ada pendaftaran yang menunggu.</p>}
 {requests.data?.map(r=>{const u=users.data?.find(u=>u.id===r.profile_id);return <article key={r.id} className="border-t py-4 mt-4"><h3 className="font-semibold">{u?.full_name}</h3><p>{u?.email}</p><RequestForm id={r.id} unitId={r.requested_unit_id} positionId={r.requested_position_id} units={options.units} positions={options.positions}/></article>;})}</section>
 <section className="bg-white rounded-xl p-5 overflow-x-auto"><h2 className="font-semibold text-lg">Daftar Pengguna</h2><table className="w-full text-left mt-3"><thead><tr><th>Nama</th><th>Email</th><th>Status</th></tr></thead><tbody>{visibleUsers?.map(u=><tr key={u.id} className="border-t"><td className="py-3">{u.full_name}</td><td>{u.email}</td><td>{u.is_active?'Aktif':'Belum aktif'}</td></tr>)}</tbody></table></section></div>;
}
