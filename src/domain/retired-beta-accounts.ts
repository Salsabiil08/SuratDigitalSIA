// Akun QA lama tetap tersimpan untuk relasi surat dan audit; tidak ditampilkan sebagai akun operasional.
const retiredIds = new Set([
 'a22c291b-9227-4edb-902b-92797a7eb3d7',
 '573eae2a-5c56-4b35-b6d7-346112227dbf',
 'c43be4ec-cf1d-47a6-8184-f2543301d188',
 '1584a5c2-6b45-405b-81f3-feabcc98e765',
 '4daddd7f-d62a-445a-becc-e0d85b3a38e3',
 'ee074985-c775-4418-8aca-c3e0080e5227',
]);
export function isRetiredBetaAccount(user:{id:string;full_name:string;email:string;is_active:boolean}){
 return !user.is_active && retiredIds.has(user.id) && user.full_name.startsWith('[UJI REV]') && /^qa\.rev18\.(admin|director|finance|gm|sm|staff)@siadocs\.test$/.test(user.email);
}
