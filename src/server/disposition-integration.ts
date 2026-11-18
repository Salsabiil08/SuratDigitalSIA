import {requireUser} from '@/server/auth';
import {createClient} from '@/lib/supabase/server';
export interface DispositionLetterContext{canCreate:boolean;tasks:{id:string;subject:string;status:string;isResult:boolean}[];links:{id:string;dispositionId:string;letterId:string;subject:string;officialNumber:string|null;createdAt:string;createdBy:string}[]}
export async function readDispositionLetterContext(id:string):Promise<DispositionLetterContext>{
 await requireUser();const {data,error}=await (await createClient()).rpc('get_disposition_letter_context',{p_letter:id});
 if(error||!data||typeof data.canCreate!=='boolean'||!Array.isArray(data.tasks)||!Array.isArray(data.links))throw new Error('Hubungan disposisi belum dapat diambil.');
 return data;
}
export async function readDispositionDraftSeed(id:string){
 const user=await requireUser();const {data,error}=await (await createClient()).from('dispositions').select('id,recipient_id,giver_id,subject,status,source_dispatch_id').eq('id',id).single();
 if(error||!data||data.recipient_id!==user.id||!['NEW','IN_PROGRESS','REVISION_REQUESTED'].includes(data.status))throw new Error('Surat hasil hanya dapat disiapkan pelaksana sebelum pemeriksaan.');
 return data.source_dispatch_id?{dispositionId:data.id,recipientId:data.giver_id,subject:`Hasil tindak lanjut: ${data.subject}`} :undefined;
}
