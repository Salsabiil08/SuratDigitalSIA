"use server";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { workflowLabel } from "@/domain/workflow";
export interface LetterItemData {
  id: string;
  officialNumber: string | null;
  subject: string;
  recipientText: string;
  typeName: string;
  typeCategory: string;
  status: any;
  signatureStatus: any;
  createdAt: string;
  workflowStatus: string;
}
export async function getLettersAction(dashboardStatus?: string): Promise<LetterItemData[]> {
  const user = await requireUser();
  let query = (await createClient())
    .from("letters")
    .select(
      "*,letter_types(name,category),recipient:profiles!letters_recipient_user_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (dashboardStatus === "DRAFT" || dashboardStatus === "NUMBERED") query = query.eq("status", dashboardStatus);
  else if (dashboardStatus === "WAITING_SIGNATURE") query = query.eq("signature_status", "WAITING");
  else query = query.eq("creator_id", user.id);
  const {data,error} = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((l: any) => ({
    id: l.id,
    officialNumber: l.official_number,
    subject: l.subject,
    recipientText:
      l.recipient?.full_name ||
      [l.recipient_external_name, l.recipient_external_org]
        .filter(Boolean)
        .join(" — "),
    typeName: l.letter_types?.name || "",
    typeCategory: l.letter_types?.category || "",
    status: l.status,
    signatureStatus: l.signature_status,
    createdAt: l.created_at,
    workflowStatus: workflowLabel(l),
  }));
}
