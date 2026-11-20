export interface RegistrationState {error?:string;success?:boolean;message?:string}
export function registrationInput(form:FormData){
 const fullName=String(form.get('fullName')||'').trim(),email=String(form.get('email')||'').trim().toLowerCase();
 const password=String(form.get('password')||''),confirm=String(form.get('confirmPassword')||'');
 const unitId=String(form.get('unitId')||''),positionId=String(form.get('positionId')||'');
 if(fullName.length<2||fullName.length>120)throw new Error('Isi nama lengkap 2 sampai 120 karakter.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Isi alamat email yang valid.');
 if(password.length<8||password.length>128)throw new Error('Kata sandi harus 8 sampai 128 karakter.');
 if(password!==confirm)throw new Error('Konfirmasi kata sandi belum sama.');
 if(!unitId||!positionId)throw new Error('Pilih unit kerja dan jabatan yang diajukan.');
 return {fullName,email,password,unitId,positionId};
}
