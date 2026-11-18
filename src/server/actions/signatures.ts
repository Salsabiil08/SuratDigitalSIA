"use server";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
export async function getPendingSignatures() {
  const user = await requireUser();
  const { data, error } = await (await createClient())
    .from("signature_requests")
    .select(
      "id,letter_id,sign_order,signer_role,status,letter:letters!signature_requests_letter_id_fkey(id,subject,official_number,required_signature_count)",
    )
    .eq("signer_id", user.id)
    .eq("status", "PENDING")
    .order("sign_order");
  if (error) throw new Error(error.message);
  return data || [];
}
