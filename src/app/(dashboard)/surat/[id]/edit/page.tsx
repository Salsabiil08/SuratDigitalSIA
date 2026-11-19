import { PreparedLetterEditor } from "@/components/letters/prepared-letter-editor";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PreparedLetterEditor id={(await params).id} />;
}
