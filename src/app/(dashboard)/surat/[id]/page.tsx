import { getWorkflowLetter } from "@/server/actions/workflow";
import { LetterDetailClient } from "./letter-detail-client";
export default async function Page({ params }: { params: { id: string } }) {
  try {
    const data = await getWorkflowLetter(params.id);
    return <LetterDetailClient id={params.id} initialData={data} />;
  } catch (e) {
    return (
      <p role="alert">
        {e instanceof Error ? e.message : "Surat tidak dapat dibuka."}
      </p>
    );
  }
}
