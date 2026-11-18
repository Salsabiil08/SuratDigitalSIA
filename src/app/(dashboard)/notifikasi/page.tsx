import { getNotificationsAction } from "@/server/actions/notifications";
import { NotifikasiClient } from "./notifikasi-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await getNotificationsAction();
  return (
    <NotifikasiClient
      initialData={result.data}
      initialUnread={result.unreadCount}
      initialError={result.error}
    />
  );
}
