"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";
import { peopleOptions } from "@/server/letter-workflow";
import { workflowLabel } from "@/domain/workflow";
import { revalidatePath } from "next/cache";

export interface CreateDispositionInput {
  recipientId: string;
  letterId?: string;
  subject: string;
  instruction: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  dueDate?: string;
  requiresLetter: boolean;
}
export interface DispositionItem {
  id: string;
  revision: number;
  subject: string;
  instruction: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: "NEW" | "IN_PROGRESS" | "IN_REVIEW" | "REVISION_REQUESTED" | "DONE";
  requiresLetter: boolean;
  letterId?: string;
  letterNumber?: string;
  responseLetterId?: string;
  responseLabel?: string;
  responseEditable: boolean;
  responseFinal: boolean;
  giverName: string;
  recipientName: string;
  dueDate?: string;
  followUpNote?: string;
  reviewNote?: string;
  createdAt: string;
}
export interface DispositionsData {
  inbox: DispositionItem[];
  outbox: DispositionItem[];
  availableLetters: Array<{
    id: string;
    officialNumber: string;
    subject: string;
    status: string;
  }>;
  availableProfiles: Array<{
    id: string;
    fullName: string;
    unitCode: string;
    unitName: string;
    roleInfo: string;
  }>;
  canCreateDisposition: boolean;
  canReceiveDisposition: boolean;
}
export async function getDispositionsAction(): Promise<{
  success: boolean;
  data: DispositionsData;
  error?: string;
}> {
  const empty: DispositionsData = {
    inbox: [],
    outbox: [],
    availableLetters: [],
    availableProfiles: [],
    canCreateDisposition: false,
    canReceiveDisposition: true,
  };
  try {
    const user = await requireUser();
    const db = createClient();
    const opts = await peopleOptions();
    const canCreate = (user.position?.level || 0) > 1;
    const [{ data: disps, error }, { data: letters, error: le }] =
      await Promise.all([
        db
          .from("dispositions")
          .select(
            "*,giver:profiles!giver_id(full_name),recipient:profiles!recipient_id(full_name),letter:letters!dispositions_letter_id_fkey(official_number),response:letters!dispositions_response_letter_id_fkey(id,status,signature_status,finalized_at)",
          )
          .or(`giver_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        db
          .from("letters")
          .select(
            "id,official_number,subject,status,signature_status,finalized_at",
          )
          .eq("status", "NUMBERED")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    if (error || le)
      throw new Error("Gagal memuat disposisi. Silakan coba lagi.");
    const items = (disps || []).map(
      (d: any): DispositionItem => ({
        id: d.id,
        revision: d.revision,
        subject: d.subject,
        instruction: d.instruction,
        priority: d.priority,
        status: d.status,
        requiresLetter: d.requires_letter,
        letterId: d.letter_id,
        letterNumber: d.letter?.official_number,
        responseLetterId: d.response_letter_id,
        responseLabel: d.response ? workflowLabel(d.response) : undefined,
        responseEditable:
          !!d.response &&
          ["DRAFT", "REVISION_REQUESTED"].includes(d.response.status),
        responseFinal:
          !!d.response?.finalized_at && d.response?.status === "NUMBERED",
        giverName: d.giver?.full_name || "Pemberi",
        recipientName: d.recipient?.full_name || "Penerima",
        dueDate: d.due_date,
        followUpNote: d.follow_up_note,
        reviewNote: d.review_note,
        createdAt: d.created_at,
      }),
    );
    const recipients = opts.people.filter(
      (p) =>
        p.id !== user.id &&
        p.level < (user.position?.level || 0) &&
        ((user.position?.level || 0) > 2 || p.unitId === user.unit?.id),
    );
    return {
      success: true,
      data: {
        inbox: items.filter((_, i) => disps![i].recipient_id === user.id),
        outbox: items.filter((_, i) => disps![i].giver_id === user.id),
        availableLetters: (letters || []).map((l) => ({
          id: l.id,
          officialNumber: l.official_number || "Belum bernomor",
          subject: l.subject,
          status: workflowLabel(l),
        })),
        availableProfiles: recipients.map((p) => ({
          id: p.id,
          fullName: p.name,
          unitCode: p.unit,
          unitName: p.unitName,
          roleInfo:
            p.position === "SM" ? p.title : `${p.title} — ${p.unitName}`,
        })),
        canCreateDisposition: canCreate,
        canReceiveDisposition: user.position?.code !== "DIR",
      },
    };
  } catch (e) {
    return {
      success: false,
      data: empty,
      error: e instanceof Error ? e.message : "Gagal memuat disposisi.",
    };
  }
}
export async function createDispositionAction(input: CreateDispositionInput) {
  try {
    const user = await requireUser();
    const { data, error } = await createAdminClient().rpc(
      "disposition_workflow",
      { p_actor: user.id, p_action: "CREATE", p_data: input },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/disposisi");
    return { success: true, dispositionId: data as string };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal mengirim disposisi.",
    };
  }
}
export async function updateDispositionStatusAction(input: {
  dispositionId: string;
  revision: number;
  action: "START" | "SUBMIT" | "ACCEPT" | "RETURN";
  note?: string;
}) {
  try {
    const user = await requireUser();
    const { error } = await createAdminClient().rpc("disposition_workflow", {
      p_actor: user.id,
      p_action: input.action,
      p_id: input.dispositionId,
      p_revision: input.revision,
      p_data: { note: input.note || "" },
    });
    if (error) throw new Error(error.message);
    revalidatePath("/disposisi");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal memperbarui disposisi.",
    };
  }
}
