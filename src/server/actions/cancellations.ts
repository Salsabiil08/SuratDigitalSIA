"use server";
import { requireUser } from "@/server/auth";
import { readLetter } from "@/server/letter-workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
export async function cancellationAction(
  id: string,
  action: "CANCEL_DRAFT" | "REQUEST" | "APPROVE" | "DECLINE",
  reason?: string,
) {
  try {
    const user = await requireUser();
    await readLetter(id);
    const { data, error } = await createAdminClient().rpc(
      "cancel_letter_workflow",
      {
        p_actor: user.id,
        p_letter: id,
        p_action: action,
        p_reason: reason || null,
      },
    );
    if (error) throw new Error(error.message);
    ["/surat", "/", `/surat/${id}`].forEach((p) => revalidatePath(p));
    return { success: true, status: data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Pembatalan gagal.",
    };
  }
}
