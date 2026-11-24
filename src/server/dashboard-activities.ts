import {createClient} from '@/lib/supabase/server';
import {displayLabel} from '@/domain/display-labels';
export async function readDashboardActivities(){
 const {data,error}=await (await createClient()).rpc('get_dashboard_letter_activity');
 if(error||!Array.isArray(data))throw new Error('Aktivitas surat belum dapat dimuat. Silakan muat ulang halaman.');
 return data.map((log:{id:string;action:string;subject:string;official_number:string|null;occurred_at:string})=>({
  id:log.id,action:displayLabel(log.action),
  description:`${displayLabel(log.action)} — ${log.official_number || log.subject}`,
  time:new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(log.occurred_at))+' WIB',
 }));
}
