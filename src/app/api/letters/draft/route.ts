import { NextResponse } from "next/server";
import { assertSameOrigin, saveDraft } from "@/server/letter-workflow";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const id = await saveDraft(
      JSON.parse(String(form.get("data"))),
      form.get("file") as File | null,
      form.get("attachment") as File | null,
    );
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan draft." },
      { status: 400 },
    );
  }
}
