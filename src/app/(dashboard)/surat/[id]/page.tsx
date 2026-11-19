import {ActionNotice} from "@/components/ui/action-notice";
import { getWorkflowLetter } from "@/server/actions/workflow";
import { LetterDetailClient } from "./letter-detail-client";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await getWorkflowLetter((await params).id);
    return <LetterDetailClient id={(await params).id} initialData={data} />;
  } catch (e) {
    return (
      <ActionNotice>
        {e instanceof Error ? e.message : "Surat tidak dapat dibuka."}
      </ActionNotice>
    );
  }
}
