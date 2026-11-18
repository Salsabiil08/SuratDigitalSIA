import { PreparedLetterEditor } from "@/components/letters/prepared-letter-editor";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ disposisi?: string }>;
}) {
  return <PreparedLetterEditor dispositionId={(await searchParams).disposisi} />;
}
