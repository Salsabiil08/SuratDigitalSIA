import { PreparedLetterEditor } from "@/components/letters/prepared-letter-editor";
export default function Page({ params }: { params: { id: string } }) {
  return <PreparedLetterEditor id={params.id} />;
}
