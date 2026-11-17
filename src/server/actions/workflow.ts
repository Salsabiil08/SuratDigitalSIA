"use server";
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
  ] = await Promise.all([
    db
      .from("letter_versions")
      .select(
        "id,version_no,version_kind,file_format,file_hash,content_html,created_at,created_by,original_name",
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
  ]);
  if (ve || ae || se) throw new Error((ve || ae || se)!.message);
  return {
    letter: l,
    versions: versions || [],
    approvals: approvals || [],
    signatures: signatures || [],
    billing,
    items: items || [],
    isCreator: l.creator_id === user.id,
    userId: user.id,
  };
}
export async function reviewLetterAction(
  id: string,
  action: "PREVIEW" | "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_REVISION",
  revision: number,
  note?: string,
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
    const { data, error } = await createAdminClient().rpc("review_letter", {
      p_actor: user.id,
      p_letter: id,
      p_action: action,
      p_revision: revision,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
    for (const p of [
      "/surat",
      "/persetujuan",
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
