import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { readLetter, downloadVersion } from "@/server/letter-workflow";
import { fillOfficialNumber, DOCUMENT_MIME } from "@/lib/letter-document";
import {correctLegacyBillingOutput} from '@/lib/legacy-billing-output';
import { correctLegacyInternalOutput } from '@/lib/legacy-internal-output';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user=await requireUser();
    const letter = await readLetter((await params).id);
    const {data:context,error:contextError}=await createAdminClient().rpc('get_internal_delivery_context',{p_actor:user.id,p_letter:letter.id});
    if(contextError||!context)throw new Error('Anda tidak berwenang melihat dokumen ini.');
    const variant = new URL(request.url).searchParams.get("variant");
    const blank = new URL(request.url).searchParams.get("blank") === "1" || (variant === "unsigned" && !!letter.official_number && letter.required_signature_count > 0);
    if(blank&&!context.fullVersionAccess)throw new Error('Salinan sebelum pengesahan tidak tersedia melalui hak penerima/pengiriman.');
    let sourceLetter = {...letter,current_version_id:context.documentVersionId};
    if (blank) {
      const { data: version, error: versionError } = await (await createClient())
        .from("letter_versions")
        .select("id")
        .eq("letter_id", letter.id)
        .eq("version_kind", "NUMBERED")
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (versionError || !version) throw new Error('Salinan tanpa TTD tersedia setelah nomor surat diterbitkan.');
      sourceLetter = { ...letter, current_version_id: version.id };
    }
    const doc = await downloadVersion(sourceLetter,false);
    if(blank && letter.required_signature_count > 0 && doc.version.version_kind !== 'NUMBERED')throw new Error('Versi surat tanpa tanda tangan belum tersedia.');
    if(variant === 'unsigned' && doc.version.version_kind === 'SIGNED')throw new Error('Versi surat tanpa tanda tangan belum tersedia.');
    if(variant === 'signed' && doc.version.version_kind !== 'SIGNED')throw new Error('Surat bertanda tangan belum tersedia.');
    // Verify the original snapshot first; corrections below affect only the presentation copy.
    let bytes = (letter.manual_number_reservation_id || letter.finalized_at && !blank) ? doc.bytes : await fillOfficialNumber(doc.bytes,doc.format,letter.official_number,blank);
    if(context.recipientRole && context.dispatch && request.method==='GET'){
      const matches=doc.version.id===context.dispatch.version_id && doc.version.file_hash===context.dispatch.file_hash;
      if(!matches&&!context.fullVersionAccess)throw new Error('Snapshot pengiriman tidak sesuai.');
      if(matches){const {error:readError}=await createAdminClient().rpc('record_internal_recipient_action',{p_actor:user.id,p_dispatch:context.dispatch.id,p_action:'READ'});
        if(readError)throw new Error('Pembacaan belum dapat dicatat. Coba kembali.');
        revalidatePath('/kotak-masuk');revalidatePath('/kotak-keluar');}
    }
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
    const original = new URL(request.url).searchParams.get('original') === '1';
    const internalOutput = original || letter.source==='UPLOAD' ? bytes : await correctLegacyInternalOutput(bytes, letter, doc.format);
    const {bytes:output,corrected} = original || letter.source==='UPLOAD' ? {bytes:internalOutput,corrected:false} : await correctLegacyBillingOutput(internalOutput,letter,doc.format);
    return new NextResponse(new Uint8Array(output), {
      headers: {
        "Content-Type": DOCUMENT_MIME[doc.format],
        "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="Surat${corrected ? "-salinan-format" : ""}${blank ? "-tanpa-TTD" : ""}.${doc.format.toLowerCase()}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-SIADocs-Document-Variant": blank || doc.version.version_kind !== "SIGNED" ? "unsigned" : "signed",
        ...(corrected ? {"X-SIADocs-Layout-Copy":"1"} : {}),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dokumen tidak tersedia." },
      { status: 403 },
    );
  }
}
