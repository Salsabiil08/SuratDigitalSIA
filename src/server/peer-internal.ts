import {createAdminClient} from '@/lib/supabase/admin';
import {jakartaDate} from '@/domain/workflow';
import {assertPeerInternalAuthorization} from '@/domain/peer-internal';
export async function assertPeerLetterPlan(letter:{type:{code:string};creator_id:string;recipient_user_id?:string|null;signer_ids?:string[];mandatory_approver_ids?:string[];additional_approver_ids?:string[];required_signature_count:number}){
 if(letter.type.code!=='IN'||!letter.recipient_user_id)return;
 const {data,error}=await createAdminClient().from('user_assignments').select('profile_id,start_date,end_date,position:positions!user_assignments_position_id_fkey(level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(is_active)').in('profile_id',[letter.creator_id,letter.recipient_user_id]).eq('is_active',true).order('start_date',{ascending:false});
 if(error)throw new Error('Jabatan pengirim dan penerima belum dapat diperiksa.');
 const today=jakartaDate();const level=(id:string)=>{const a=(data||[]).find((a:any)=>a.profile_id===id&&(!a.start_date||a.start_date<=today)&&(!a.end_date||a.end_date>=today));return(a?.position as any)?.is_active&&(a?.unit as any)?.is_active?(a?.position as any).level:0;};
 assertPeerInternalAuthorization('IN',level(letter.creator_id),level(letter.recipient_user_id),{signatureCount:letter.required_signature_count,signerIds:letter.signer_ids,mandatoryApproverIds:letter.mandatory_approver_ids,additionalApproverIds:letter.additional_approver_ids});
}
