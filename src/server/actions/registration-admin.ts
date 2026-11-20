'use server';
import { requireSuperAdmin } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
export async function decideRegistration(_prev: {error?:string;success?:string},form:FormData) {
 try {
 const actor=await requireSuperAdmin();
 const action=String(form.get('action')||'');
 const {error}=await createAdminClient().rpc('decide_account_registration',{
 p_actor:actor.id,p_request:String(form.get('requestId')||''),p_action:action,
 p_unit:form.get('unitId')||null,p_position:form.get('positionId')||null,p_note:String(form.get('note')||'')});
 if(error) return {error:'Keputusan gagal disimpan. Periksa pilihan dan catatan, lalu coba kembali.'};
 revalidatePath('/admin/pengguna');
 return {success:action==='APPROVE'?'Akun berhasil diaktifkan.':'Pendaftaran ditolak.'};
 }catch{return {error:'Akses ditolak atau layanan tidak tersedia.'};}
}
