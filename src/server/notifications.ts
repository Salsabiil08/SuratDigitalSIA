import { cache } from "react";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
export const readNotifications = cache(async () => {
  const user = await requireUser(),
    db = createClient();
  const [{ data, error }, { count, error: ce }] = await Promise.all([
    db
      .from("notifications")
      .select(
        "id,recipient_id,letter_id,disposition_id,event_type,title,is_read,read_at,created_at",
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("recipient_id", user.id)
      .eq("is_read", false),
  ]);
  if (error || ce)
    throw new Error("Gagal mengambil pemberitahuan. Coba kembali.");
  return { data: data || [], unreadCount: count || 0 };
});
