import { PreparedLetterEditor } from "@/components/letters/prepared-letter-editor";
export default function Page({
  searchParams,
}: {
  searchParams: { disposisi?: string };
}) {
  return <PreparedLetterEditor dispositionId={searchParams.disposisi} />;
}
