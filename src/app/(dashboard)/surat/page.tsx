import {ActionNotice} from "@/components/ui/action-notice";
import { getLettersAction } from "@/server/actions/letters";
import { SuratSayaClient } from "./surat-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    const data = await getLettersAction();
    return <SuratSayaClient initialData={data} />;
  } catch {
    return (
      <ActionNotice>
        Data belum dapat diambil. Silakan buka kembali halaman ini.
      </ActionNotice>
    );
  }
}
