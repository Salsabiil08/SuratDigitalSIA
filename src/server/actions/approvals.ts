"use server";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readLetter,
  downloadVersion,
  storeBytes,
} from "@/server/letter-workflow";
import { reviewLetterAction } from "./workflow";
import { revalidatePath } from "next/cache";
export interface PendingApprovalData {
  id: string;
  letterId: string;
  subject: string;
  letterType: string;
  creatorName: string;
  recipientName: string;
  stepOrder: number;
  totalSteps: number;
  previewContent?: string;
  revision: number;
}
async function decide(
  stepId: string,
  action: "APPROVE" | "REJECT" | "REQUEST_REVISION",
  note?: string,
) {
  try {
    const user = await requireUser();
    const { data, error } = await (await createClient())
      .from("approval_steps")
      .select("letter_id")
      .eq("id", stepId)
      .eq("approver_id", user.id)
      .eq("status", "PENDING")
      .single();
    if (error || !data) throw new Error("Anda bukan penyetuju aktif.");
    const l = await readLetter(data.letter_id);
    return reviewLetterAction(l.id, action, l.revision, note);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Keputusan gagal.",
    };
  }
}
export async function approveStepAction(id: string, note?: string) {
  return decide(id, "APPROVE", note);
}
export async function requestRevisionAction(id: string, note: string) {
  return decide(id, "REQUEST_REVISION", note);
}
export async function rejectLetterAction(id: string, note: string) {
  return decide(id, "REJECT", note);
}
export async function issueLetterNumberAction(id: string) {
  try {
    const user = await requireUser();
    const l = await readLetter(id);
    if (l.creator_id !== user.id)
      throw new Error("Hanya pembuat dapat menerbitkan nomor.");
    const { data, error } = await createAdminClient().rpc(
      l.manual_number_reservation_id ? "activate_manual_letter_number" : "issue_letter_number",
      { p_letter_id: id, p_actor: user.id, ...(l.manual_number_reservation_id ? {} : {p_idempotency_key: `issue-${id}`}) },
    );
    if (error) throw new Error(error.message);
    const numbered = await readLetter(id);
    const doc = await downloadVersion(numbered);
    if (doc.version.version_kind === "DRAFT") {
      const document = await storeBytes(user.id, doc.bytes, doc.format);
      const { error: versionError } = await createAdminClient().rpc(
        "record_numbered_document",
        {
          p_actor: user.id,
          p_letter: id,
          p_previous_version: numbered.current_version_id,
          p_document: document,
        },
      );
      if (versionError)
        throw new Error(
          "Nomor sudah dicatat; salinan dokumen belum lengkap. Tekan Terbitkan lagi untuk mencoba ulang: " +
            versionError.message,
        );
    }
    ["/", "/surat", "/pengesahan", `/surat/${id}`].forEach((p) =>
      revalidatePath(p),
    );
    return { success: true, officialNumber: data.official_number };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Penerbitan gagal.",
    };
  }
}
export async function getPendingApprovalsAction(): Promise<
  PendingApprovalData[]
> {
  const user = await requireUser();
  const { data, error } = await (await createClient())
    .from("approval_steps")
    .select(
      "id,letter_id,step_order,version_id,cycle,letter:letters!approval_steps_letter_id_fkey(id,subject,revision,current_version_id,approval_cycle,approval_plan,required_signature_count,recipient_external_name,letter_types(name),creator:profiles!letters_creator_id_fkey(full_name))",
    )
    .eq("approver_id", user.id)
    .eq("status", "PENDING")
    .order("step_order");
  if (error) throw new Error(error.message);
  return (data || []).filter((s:any)=>s.letter && s.version_id===s.letter.current_version_id && (s.letter.approval_cycle==null || s.cycle===s.letter.approval_cycle)).map((s: any) => ({
    id: s.id,
    letterId: s.letter_id,
    subject: s.letter.subject,
    letterType: s.letter.letter_types?.name || "",
    creatorName: s.letter.creator?.full_name || "",
    recipientName: s.letter.recipient_external_name || "Penerima internal",
    stepOrder: s.step_order,
    totalSteps: s.letter.approval_plan?.length || 0,
    previewContent: "Buka preview dokumen tersimpan sebelum memberi keputusan.",
    revision: s.letter.revision,
  }));
}
