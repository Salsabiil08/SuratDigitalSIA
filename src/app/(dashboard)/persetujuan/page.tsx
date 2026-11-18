import { getPendingApprovalsAction } from "@/server/actions/approvals";
import { PersetujuanClient } from "./persetujuan-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    const data = await getPendingApprovalsAction();
    return <PersetujuanClient initialData={data} />;
  } catch {
    return (
      <p role="alert">
        Data belum dapat diambil. Silakan buka kembali halaman ini.
      </p>
    );
  }
}
