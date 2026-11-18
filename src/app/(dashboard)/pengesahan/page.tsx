export const dynamic = 'force-dynamic';
import Link from "next/link";
import { getPendingSignatures } from "@/server/actions/signatures";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
export default async function Page() {
  const pending = await getPendingSignatures();
  return (
    <div className="space-y-5">
      <PageHeader title="Menunggu Tanda Tangan" />
      <p className="text-sm text-neutral-600">
        Hanya tugas TTD aktif milik akun Anda. Pengesahan tagihan berjalan
        berurutan.
      </p>
      {pending.length === 0 ? (
        <Card className="p-6">
          Tidak ada surat yang menunggu tanda tangan Anda.
        </Card>
      ) : (
        pending.map((s: any) => (
          <Card className="p-5 space-y-2" key={s.id}>
            <h2 className="font-bold">{s.letter.subject}</h2>
            <p className="text-sm">
              {s.letter.official_number} · TTD {s.sign_order} dari{" "}
              {s.letter.required_signature_count}
            </p>
            <Link
              className="text-brand-red underline text-sm"
              href={`/surat/${s.letter_id}`}
            >
              Pratinjau dan Tanda Tangani
            </Link>
          </Card>
        ))
      )}
    </div>
  );
}
