import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
export interface ManualNumber {id:string;official_number:string;subject:string;reserved_signer_id:string|null;letter_id:string|null;status:string;typeCode:'IN'|'KRE'|'Tag'}
export async function readManualNumbers(id?:string):Promise<ManualNumber[]> {
 const user=await requireUser();let query=(await createClient()).from('manual_number_reservations').select('id,official_number,subject,reserved_signer_id,letter_id,status,type:letter_types!manual_number_reservations_letter_type_id_fkey(code)').eq('owner_id',user.id).order('created_at',{ascending:false});
 if(id)query=query.eq('id',id);else query=query.in('status',['RESERVED','BOUND']);
 const {data,error}=await query;if(error)throw new Error('Daftar nomor belum dapat dimuat.');
 return (data||[]).map((r:any)=>({...r,typeCode:r.type.code}));
}
