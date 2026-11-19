import type {UserProfile} from './auth';
import {createClient} from '@/lib/supabase/server';
import {jakartaDate} from '@/domain/workflow';
import {navigationAccess} from '@/domain/navigation-access';

export async function readNavigationAccess(user: UserProfile) {
  const hasAssignment = !!user.position && !!user.unit;
  const input = {hasAssignment,isSuperAdmin:user.isSuperAdmin,positionCode:user.position?.code,
    isOfficialSigner:user.isOfficialSigner,isFinance:false,reviewerAssigned:false,approverAssigned:false};
  if (!hasAssignment) return {access:navigationAccess(input),error:undefined};
  const db=await createClient(), today=jakartaDate();
  const [review,approval,billing]=await Promise.all([
    db.from('review_authorizations').select('id').eq('reviewer_id',user.id).eq('is_active',true)
      .lte('starts_on',today).or(`ends_on.is.null,ends_on.gte.${today}`).limit(1),
    db.from('approver_authorizations').select('id').eq('approver_id',user.id).eq('is_active',true)
      .lte('starts_on',today).or(`ends_on.is.null,ends_on.gte.${today}`).limit(1),
    db.from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle(),
  ]);
  return {access:navigationAccess({...input,
    reviewerAssigned:!review.error && !!review.data?.length,
    approverAssigned:!approval.error && !!approval.data?.length,
    isFinance:!billing.error && !!billing.data?.creator_unit_id && billing.data.creator_unit_id===user.unit?.id}),
    error:review.error||approval.error||billing.error?'Sebagian menu belum dapat diperiksa. Muat ulang halaman.':undefined};
}
