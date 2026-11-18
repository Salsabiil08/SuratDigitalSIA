"use server";
import {readDispositionLetterContext} from "@/server/disposition-integration";
import {readReplyContext} from "@/server/official-replies";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readLetter,
  downloadVersion,
  peopleOptions,
} from "@/server/letter-workflow";
import { inspectDocument } from "@/lib/letter-document";
import { revalidatePath } from "next/cache";

export async function getWorkflowOptions() {
  return peopleOptions();
}
export async function getWorkflowLetter(id: string) {
  const user = await requireUser();
  const l = await readLetter(id);
  const db = createClient();
  const [
    { data: versions, error: ve },
    { data: approvals, error: ae },
    { data: signatures, error: se },
    { data: billing },
    { data: items },
    { data: cancellations, error: ce },
    { data: reviews, error: re },
  ] = await Promise.all([
    db
      .from("letter_versions")
      .select(
        "id,version_no,version_kind,file_format,file_hash,content_html,content_format,created_at,created_by,original_name",
      )
      .eq("letter_id", id)
      .order("version_no", { ascending: false }),
    db
      .from("approval_steps")
      .select("*,approver:profiles!approval_steps_approver_id_fkey(full_name)")
      .eq("letter_id", id)
      .order("cycle", { ascending: false })
      .order("step_order"),
    db
      .from("signature_requests")
      .select(
        "id,letter_id,signer_id,sign_order,signer_role,status,uploaded_at,stamp_included,method,signer:profiles!signature_requests_signer_id_fkey(full_name)",
      )
      .eq("letter_id", id)
      .order("sign_order"),
    db.from("billing_details").select("*").eq("letter_id", id).maybeSingle(),
    db
      .from("billing_items")
      .select("description,amount")
      .eq("letter_id", id)
      .order("line_no"),
    db
      .from("cancellation_requests")
      .select(
        "id,status,reason,cancellation_authorizations(authorizer_id,decision)",
      )
      .eq("letter_id", id)
      .order("created_at", { ascending: false }),
    db.from('review_steps').select('*,reviewer:profiles!review_steps_reviewer_id_fkey(full_name),comments:review_comments(*)').eq('letter_id', id).order('cycle', { ascending: false }),
  ]);
  if (ve || ae || se || ce || re) throw new Error((ve || ae || se || ce || re)!.message);
  const {data:delivery,error:de}=await createAdminClient().rpc('get_internal_delivery_context',{p_actor:user.id,p_letter:id});
  if(de)throw new Error('Informasi pengiriman belum dapat diambil.');
  let ccOptions: {id:string;full_name:string}[]=[];
  if(delivery?.ccEnabled&&delivery?.canDispatch){const {data:ccPeople,error:cce}=await db.from('profiles').select('id,full_name').eq('is_active',true);if(cce)throw new Error('Penerima tembusan belum dapat diambil.');ccOptions=ccPeople||[];}
  const replyContext=await readReplyContext(id);
  return {
    dispositionContext:await readDispositionLetterContext(id),
    replyContext,
    ccOptions,
    delivery,
    letter: l,
    versions: versions || [],
    approvals: approvals || [],
    signatures: signatures || [],
    billing,
    items: items || [],
    cancellations: cancellations || [],
    reviews: reviews || [],
    isCreator: l.creator_id === user.id,
    userId: user.id,
  };
}
export async function reviewLetterAction(
  id: string,
  action: "PREVIEW" | "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_REVISION",
  revision: number,
  note?: string,
  confirmCreatorApproval = false,
) {
  try {
    const user = await requireUser();
    const l = await readLetter(id);
    if (action === "SUBMIT") {
      const doc = await downloadVersion(l, false);
      await inspectDocument(
        doc.bytes,
        doc.format,
        l.required_signature_count,
        l.signature_areas,
        true,
      );
      if (doc.format === "PDF" && !l.number_area)
        throw new Error(
          "Tentukan area nomor resmi pada PDF sebelum mengajukan.",
        );
    }
    const { data, error } = action === 'SUBMIT'
      ? await createAdminClient().rpc('submit_letter_for_approval', {p_actor:user.id,p_letter:id,p_revision:revision,p_confirm_self:confirmCreatorApproval})
      : await createAdminClient().rpc('review_letter', {p_actor:user.id,p_letter:id,p_action:action,p_revision:revision,p_note:note || null});
    if (error) throw new Error(error.message);
    for (const p of [
      "/surat",
      "/persetujuan",
      "/pemeriksaan",
      "/pengesahan",
      "/",
      `/surat/${id}`,
    ])
      revalidatePath(p);
    return { success: true, status: data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Proses gagal.",
    };
  }
}
export async function finalizeLetterAction(
  id: string,
  revision: number,
  externalConfirmed: boolean,
) {
  try {
    const user = await requireUser();
    await readLetter(id);
    const { error } = await createAdminClient().rpc("finalize_letter", {
      p_actor: user.id,
      p_letter: id,
      p_revision: revision,
      p_external_confirmed: externalConfirmed,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/surat");
    revalidatePath(`/surat/${id}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Finalisasi gagal.",
    };
  }
}

export async function restartApprovalAction(id:string, revision:number, reason:string) {
  try {
    const user=await requireUser();
    const {error}=await createAdminClient().rpc('restart_letter_approval',{p_actor:user.id,p_letter:id,p_revision:revision,p_reason:reason});
    if(error) throw new Error(error.message);
    for(const path of ['/surat','/persetujuan','/pemeriksaan',`/surat/${id}`]) revalidatePath(path);
    return {success:true};
  }catch(e){return {success:false,error:e instanceof Error?e.message:'Pengajuan belum dapat dikoreksi.'};}
}
