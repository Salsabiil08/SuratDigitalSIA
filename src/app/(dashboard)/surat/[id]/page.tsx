import {RecoveryState} from '@/components/ui/recovery-state';
import {ActionNotice} from "@/components/ui/action-notice";
import { getWorkflowLetter } from "@/server/actions/workflow";
import { LetterDetailClient } from "./letter-detail-client";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await getWorkflowLetter((await params).id);
    return <LetterDetailClient id={(await params).id} initialData={data} />;
  } catch (e) {
    return (
      <RecoveryState title="Surat tidak dapat dibuka" message="Surat tidak ditemukan atau Anda tidak memiliki akses." href="/surat" label="Kembali ke Daftar Surat"/>
    );
  }
}
