import {ActionNotice} from "@/components/ui/action-notice";
import { getLettersAction } from "@/server/actions/letters";
import { SuratSayaClient } from "./surat-client";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}) {
  try {
    const status = (await searchParams).status;
    const data = await getLettersAction(status);
    return <SuratSayaClient initialData={data} initialStatus={status} />;
  } catch {
    return (
      <ActionNotice>
        Data belum dapat diambil. Silakan buka kembali halaman ini.
      </ActionNotice>
    );
  }
}
