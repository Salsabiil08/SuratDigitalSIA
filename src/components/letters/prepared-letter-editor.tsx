import {RecoveryState} from '@/components/ui/recovery-state';
import {ActionNotice} from "@/components/ui/action-notice";
import {readDispositionDraftSeed} from "@/server/disposition-integration";
import { LetterEditor } from "./letter-editor";
import {
  getWorkflowOptions,
  getWorkflowLetter,
} from "@/server/actions/workflow";
export async function PreparedLetterEditor(props: {
  id?: string;
  source?: "CREATE" | "UPLOAD";
  billing?: boolean;
  dispositionId?: string;
}) {
  try {
    const [options, data] = await Promise.all([
      getWorkflowOptions(),
      props.id ? getWorkflowLetter(props.id) : Promise.resolve(undefined),
    ]);
    if (
      data &&
      (!data.isCreator ||
        !["DRAFT", "REVISION_REQUESTED"].includes(data.letter.status))
    )
      throw new Error("Surat ini sudah terkunci untuk pengeditan.");
    const dispositionSeed=props.dispositionId?await readDispositionDraftSeed(props.dispositionId):undefined;
    return (
      <LetterEditor {...props} dispositionSeed={dispositionSeed} initialOptions={options} initialData={data} />
    );
  } catch (e) {
    return (
      <RecoveryState title="Formulir tidak dapat dibuka" message={e instanceof Error ? e.message : "Silakan coba kembali."} href="/surat" label="Kembali ke Daftar Surat"/>
    );
  }
}
