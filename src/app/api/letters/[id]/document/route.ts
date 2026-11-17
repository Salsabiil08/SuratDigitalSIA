import { PDFDocument, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { readLetter, downloadVersion } from "@/server/letter-workflow";
import { fillOfficialNumber, DOCUMENT_MIME } from "@/lib/letter-document";
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const letter = await readLetter(params.id);
    const doc = await downloadVersion(letter);
    const blank = new URL(request.url).searchParams.get("blank") === "1";
    let bytes = await fillOfficialNumber(
      doc.bytes,
      doc.format,
      letter.official_number,
      blank,
    );
    if (
      doc.format === "PDF" &&
      !letter.finalized_at &&
      new URL(request.url).searchParams.get("areas") === "1"
    ) {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      const areas = [
        ...(letter.signature_areas || []).map((a: any, i: number) => ({
          ...a,
          label: `TTD ${i + 1}`,
        })),
        ...(letter.stamp_area
          ? [{ ...letter.stamp_area, label: "Stempel" }]
          : []),
        ...(letter.number_area && !letter.official_number
          ? [{ ...letter.number_area, label: "Nomor resmi" }]
          : []),
      ];
      for (const a of areas) {
        const p = pdf.getPage(a.page - 1);
        p.drawRectangle({
          x: a.x,
          y: p.getHeight() - a.y - a.height,
          width: a.width,
          height: a.height,
          borderColor: rgb(0.7, 0.05, 0.05),
          borderWidth: 1,
        });
        p.drawText(a.label, {
          x: a.x,
          y: p.getHeight() - a.y + 3,
          size: 9,
          color: rgb(0.7, 0.05, 0.05),
        });
      }
      bytes = Buffer.from(await pdf.save());
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": DOCUMENT_MIME[doc.format],
        "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="Surat.${doc.format.toLowerCase()}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dokumen tidak tersedia." },
      { status: 403 },
    );
  }
}
