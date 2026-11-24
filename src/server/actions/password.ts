'use server';
import {requireUser,clearLocalSession} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
export async function changePasswordAction(form:FormData):Promise<{success?:boolean;error?:string}>{
 try{
  const user=await requireUser();
  const current=String(form.get('currentPassword')||'');
  const password=String(form.get('newPassword')||'');
  const confirmation=String(form.get('confirmPassword')||'');
  if(!current||current.length>128)return {error:'Masukkan kata sandi saat ini.'};
  if(password.length<8||password.length>128)return {error:'Kata sandi baru harus terdiri dari 8–128 karakter.'};
  if(password!==confirmation)return {error:'Konfirmasi kata sandi tidak sama.'};
  if(password===current)return {error:'Gunakan kata sandi yang berbeda dari sebelumnya.'};
  if(!user.email)return {error:'Email akun belum tersedia. Hubungi Super Admin.'};
  const db=await createClient();
  const verified=await db.auth.signInWithPassword({email:user.email,password:current});
  if(verified.error?.status===429)return {error:'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'};
  if(verified.error||verified.data.user?.id!==user.id)return {error:'Kata sandi saat ini tidak sesuai atau belum dapat diperiksa. Coba lagi.'};
  const updated=await db.auth.updateUser({password});
  if(updated.error){
   if(updated.error.code==='weak_password')return {error:'Kata sandi terlalu mudah ditebak. Gunakan kombinasi yang lebih kuat.'};
   return {error:'Kata sandi belum berhasil diubah. Coba lagi.'};
  }
  if(updated.data.user?.id!==user.id)return {error:'Perubahan kata sandi belum dapat dipastikan. Silakan masuk kembali.'};
  await clearLocalSession();
  return {success:true};
 }catch{return {error:'Kata sandi belum dapat diubah. Pastikan Anda masih masuk, lalu coba lagi.'};}
}
