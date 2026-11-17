import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  readLetter,
  downloadVersion,
  storeBytes,
  hashBytes,
  DOCUMENT_BUCKET,
  ASSET_BUCKET,
} from "@/server/letter-workflow";
import {
  applyDocumentImages,
  inspectDocument,
  DOCUMENT_MIME,
  DocumentFormat,
} from "@/lib/letter-document";
import { revalidatePath } from "next/cache";
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const uploaded: { bucket: string; path: string }[] = [];
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const form = await request.formData();
    const letter = await readLetter(params.id);
    if (
      !user.isOfficialSigner ||
      !["SM", "DIR"].includes(user.position?.code || "")
    )
      throw new Error(
        "Akun tidak berwenang menandatangani atau menerapkan stempel.",
      );
    const { data: s, error } = await createClient()
      .from("signature_requests")
      .select("*")
      .eq("id", String(form.get("requestId")))
      .eq("letter_id", letter.id)
      .eq("signer_id", user.id)
      .eq("status", "PENDING")
      .single();
    if (
      error ||
      !s ||
      letter.status !== "NUMBERED" ||
      letter.finalized_at ||
      letter.signature_mode !== "IN_APP"
    )
      throw new Error("Anda bukan penandatangan aktif untuk surat ini.");
    if (Number(form.get("revision")) !== letter.revision)
      throw new Error("Versi dokumen berubah. Muat ulang preview.");
    const source = await downloadVersion(letter);
    let bytes: Uint8Array = source.bytes;
    let format: DocumentFormat = source.format;
    const method = String(form.get("method"));
    const signature = form.get("signature") as File | null;
    const stamp = form.get("stamp") as File | null;
    let sigBytes: Uint8Array | undefined, stampBytes: Uint8Array | undefined;
    if (method === "IMAGE") {
      if (!signature?.size) throw new Error("Pilih gambar TTD PNG milik Anda.");
      sigBytes = new Uint8Array(await signature.arrayBuffer());
      const images = [
        {
          marker: `{{SIGNATURE_${s.sign_order}}}`,
          bytes: sigBytes,
          area: letter.signature_areas?.[s.sign_order - 1],
        },
      ];
      if (stamp?.size) {
        if (letter.signature_areas?.stamp)
          throw new Error("Konfigurasi area tidak valid.");
        stampBytes = new Uint8Array(await stamp.arrayBuffer());
        images.push({
          marker: "{{STAMP}}",
          bytes: stampBytes,
          area: letter.stamp_area,
        });
      }
      bytes = await applyDocumentImages(bytes, format, images);
    } else if (method === "WET_UPLOAD") {
      const signed = form.get("document") as File | null;
      if (!signed?.size || !/\.(pdf|docx)$/i.test(signed.name))
        throw new Error("Unggah dokumen bertanda tangan PDF/DOCX.");
      format = signed.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
      bytes = new Uint8Array(await signed.arrayBuffer());
      await inspectDocument(bytes, format);
    } else throw new Error("Mekanisme TTD tidak valid.");
    const hash = hashBytes(bytes);
    if (form.get("preview") === "1")
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": DOCUMENT_MIME[format],
          "X-Document-Hash": hash,
          "Cache-Control": "private, no-store",
        },
      });
    if (form.get("confirmed") !== "1" || form.get("previewHash") !== hash)
      throw new Error(
        "Preview hasil dan konfirmasi dokumen terkini sebelum menandatangani.",
      );
    const admin = createAdminClient();
    async function storeImage(image: Uint8Array | undefined) {
      if (!image) return null;
      const path = `${user.id}/${letter.id}/${randomUUID()}.png`;
      const { error } = await admin.storage
        .from(ASSET_BUCKET)
        .upload(path, image, { contentType: "image/png", upsert: false });
      if (error) throw new Error("Penyimpanan gambar pengesahan gagal.");
      uploaded.push({ bucket: ASSET_BUCKET, path });
      return path;
    }
    const imagePath = await storeImage(sigBytes);
    const stampPath = await storeImage(stampBytes);
    const document = await storeBytes(user.id, bytes, format);
    uploaded.push({ bucket: DOCUMENT_BUCKET, path: document.path });
    const { error: saveError } = await admin.rpc("record_signature", {
      p_actor: user.id,
      p_request: s.id,
      p_revision: letter.revision,
      p_previous_version: letter.current_version_id,
      p_document: document,
      p_method: method,
      p_image_path: imagePath,
      p_stamp_path: stampPath,
    });
    if (saveError) throw new Error(saveError.message);
    ["/", "/surat", "/pengesahan", `/surat/${letter.id}`].forEach((p) =>
      revalidatePath(p),
    );
    return NextResponse.json({ success: true, hash });
  } catch (e) {
    for (const f of uploaded)
      await createAdminClient().storage.from(f.bucket).remove([f.path]);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pengesahan gagal." },
      { status: 400 },
    );
  }
}
