import {validateBillingItems} from '@/domain/billing';
import {assertPeerInternalAuthorization} from "@/domain/peer-internal";
import {assertReviewerHierarchy} from "@/server/reviewer-hierarchy";
import {sanitizeLetterHtml,plainTextHtml,letterText,escapeText} from '@/domain/rich-text';
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";
import { DraftInput, validateLetterDate, jakartaDate } from "@/domain/workflow";
import { generateLetterDocx } from "@/lib/docx-generator";
import {
  inspectDocument,
  fillOfficialNumber,
  DocumentFormat,
  DOCUMENT_MIME,
} from "@/lib/letter-document";
import { terbilangRupiah } from "@/domain/terbilang";
export const DOCUMENT_BUCKET = "letter-documents";
export const ASSET_BUCKET = "signature-assets";
export async function readLetter(id: string) {
  await requireUser();
  const db = await createClient();
  const { data, error } = await db
    .from("letters")
    .select(
      "*, document_category:document_categories!letters_category_id_fkey(code,name), type:letter_types!letters_letter_type_id_fkey(code,name,category), creator:profiles!letters_creator_id_fkey(full_name), recipient:profiles!letters_recipient_user_id_fkey(full_name), unit:organizational_units!letters_creator_unit_id_fkey(name,code)",
    )
    .eq("id", id)
    .single();
  if (error || !data)
    throw new Error(
      "Surat tidak ditemukan atau Anda tidak berwenang melihatnya.",
    );
  return data;
}
export async function readVersion(letter: any) {
  const { data, error } = await (await createClient())
    .from("letter_versions")
    .select("*")
    .eq("id", letter.current_version_id)
    .eq("letter_id", letter.id)
    .single();
  if (error || !data?.storage_path)
    throw new Error(
      "Versi dokumen belum tersedia. Dokumen lama perlu ditinjau pengelola.",
    );
  return data;
}
export async function downloadVersion(letter: any, materialize = true) {
  const version = await readVersion(letter);
  const { data, error } = await createAdminClient()
    .storage.from(DOCUMENT_BUCKET)
    .download(version.storage_path);
  if (error || !data)
    throw new Error("Dokumen tidak tersedia di Supabase Storage.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (version.file_hash && hashBytes(bytes) !== version.file_hash)
    throw new Error("Hash dokumen berbeda dari catatan versi.");
  return {
    bytes: materialize
      ? await fillOfficialNumber(
          bytes,
          version.file_format,
          letter.official_number,
          false,
          version.version_kind === "DRAFT" ? letter.number_area : undefined,
        )
      : bytes,
    format: version.file_format as DocumentFormat,
    version,
  };
}
export function hashBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export async function storeBytes(
  actor: string,
  bytes: Uint8Array,
  format: DocumentFormat,
  bucket = DOCUMENT_BUCKET,
) {
  const path = `${actor}/${randomUUID()}.${format.toLowerCase()}`;
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: DOCUMENT_MIME[format], upsert: false });
  if (error)
    throw new Error("Gagal menyimpan dokumen ke Supabase: " + error.message);
  return { path, hash: hashBytes(bytes), format };
}
export async function peopleOptions() {
  const user = await requireUser();
  const db = await createClient();
  const [
    { data: profiles, error },
    { data: assignments, error: ae },
    { data: banks, error: be },
    { data: billingType },
    { data: categories, error: catError },
    { data: rules, error: ruleError },
    { data: grants, error: grantError },
    { data: approvalGrants, error: approvalGrantError },
  ] = await Promise.all([
    db.from("profiles").select("id,full_name").eq("is_active", true),
    db
      .from("user_assignments")
      .select(
        "profile_id,is_official_signer,start_date,end_date,position:positions!user_assignments_position_id_fkey(code,name,level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(id,code,name,is_active)",
      )
      .eq("is_active", true)
      .order("start_date", { ascending: false }),
    db.from("master_bank").select("id,name").eq("is_active", true),
    db.from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle(),
    db.from('document_categories').select('id,code,name').eq('is_active', true).in('code', ['PERMOHONAN','LAPORAN','PEMBERITAHUAN']),
    db.from('review_policies').select('id,category_code,requires_review,validation_status,revision,type:letter_types(code)'),
    createAdminClient().from('review_authorizations').select('reviewer_id,unit_id,starts_on,ends_on,type:letter_types(code)').eq('is_active', true),
    createAdminClient().from('approver_authorizations').select('approver_id,unit_id,starts_on,ends_on,type:letter_types(code)').eq('is_active',true),
  ]);
  if (error || ae || be)
    throw new Error(
      "Gagal memuat struktur organisasi: " + (error || ae || be)?.message,
    );
  const today = jakartaDate();
  const seen = new Set<string>();
  const active = (assignments || [])
    .filter(
      (a) =>
        (!a.start_date || a.start_date <= today) &&
        (!a.end_date || a.end_date >= today),
    )
    .filter((a) => {
      if (seen.has(a.profile_id)) return false;
      seen.add(a.profile_id);
      return true;
    });
  const people = (profiles || [])
    .map((p) => {
      const a = active.find((a) => a.profile_id === p.id) as any;
      return {
        id: p.id,
        name: p.full_name,
        title: a?.position?.name || "",
        position: a?.position?.code || "",
        level: a?.position?.level || 0,
        unit: a?.unit?.code || "",
      unitId: a?.unit?.id || "",
      active: !!a?.unit?.is_active && !!a?.position?.is_active,
        unitName: a?.unit?.name || "",
        signer:
          !!a?.is_official_signer && ["SM", "DIR"].includes(a?.position?.code),
      };
    })
    .filter((p) => p.position && p.active);
  if (catError || ruleError || grantError) throw new Error('Konfigurasi pemeriksaan belum dapat diambil.');
  const reviewerGrants = (grants || []).filter(g => (!g.unit_id || g.unit_id === user.unit?.id) && g.starts_on <= today && (!g.ends_on || g.ends_on >= today))
    .map(g => ({ reviewerId: g.reviewer_id, typeCode: (g.type as any)?.code || null }));
  if(approvalGrantError)throw new Error('Konfigurasi persetujuan belum dapat diambil.');
  const approverGrants=(approvalGrants||[]).filter(g=>(!g.unit_id||g.unit_id===user.unit?.id)&&g.starts_on<=today&&(!g.ends_on||g.ends_on>=today)).map(g=>({approverId:g.approver_id,typeCode:(g.type as any)?.code||null}));
  const reviewRules = (rules || []).map(r => ({ ...r, typeCode: (r.type as any)?.code || null }));
  return { user, people, banks: banks || [], financeUnitId:billingType?.creator_unit_id || '', categories: categories || [], reviewRules, reviewerGrants, approverGrants };
}
export async function saveDraft(
  input: DraftInput,
  file?: File | null,
  attachment?: File | null,
) {
  input={...input};
  if(input.source === "CREATE") {
    input.content=sanitizeLetterHtml(input.contentFormat === "HTML" ? input.content||"" : plainTextHtml(input.content||""));
    input.contentFormat="HTML";
    if(!letterText(input.content).trim())throw new Error("Isi surat wajib diisi.");
  }
  const user = await requireUser();
  let old: any = null;
  if (input.id) {
    old = await readLetter(input.id);
    if (
      old.creator_id !== user.id ||
      !["DRAFT", "REVISION_REQUESTED"].includes(old.status) ||
      old.finalized_at
    )
      throw new Error("Draft tidak dapat diubah.");
  }
  if (!old || input.letterDate !== old.letter_date)
    validateLetterDate(
      input.letterDate,
      ["GM", "SM", "DIR"].includes(user.position?.code || ""),
      input.dateReason,
    );
  if (input.source !== "CREATE" && input.source !== "UPLOAD")
    throw new Error("Sumber surat tidak valid.");
  if (old && input.source !== old.source)
    throw new Error("Sumber dokumen tidak dapat diganti.");
  const { people, banks, categories, reviewerGrants } = await peopleOptions();
  assertPeerInternalAuthorization(input.letterTypeCode,user.position?.level||0,people.find(p=>p.id===input.recipientUserId)?.level||0,input);
  if(input.reviewerId)await assertReviewerHierarchy(user.id,input.reviewerId);
  if (!categories.some(c => c.code === input.categoryCode)) throw new Error('Pilih kategori surat yang aktif.');
  if (input.reviewerId && (input.reviewerId === user.id || !people.some(p => p.id === input.reviewerId) || !reviewerGrants.some(g => g.reviewerId === input.reviewerId && (!g.typeCode || g.typeCode === input.letterTypeCode))))
    throw new Error('Pilih pemeriksa berbeda yang berwenang untuk jenis dan unit surat.');
  const signers = input.signerIds.map((id) =>
    people.find((p) => p.id === id && p.signer),
  );
  if (signers.some((s) => !s))
    throw new Error("Pilih pejabat penandatangan aktif.");
  if (input.letterTypeCode === 'Tag') {
    if (!input.billing) throw new Error('Lengkapi rincian pembayaran.');
    validateBillingItems(input.billing.items);
    input.billing = {...input.billing, layout: 'PAYMENT_REQUEST', accountNumber: input.billing.items[0]!.accountNumber!, accountHolder: input.billing.items[0]!.payeeName!};
    input.recipientName = signers[1]?.name || '';
    input.recipientOrg = 'PT Semen Indonesia Aceh';
    input.recipientAddress = 'Kantor PT Semen Indonesia Aceh';
  }
  let bytes: Uint8Array, format: DocumentFormat;
  let name = "Surat.docx";
  if (input.source === "UPLOAD") {
    if (file?.size) {
      format = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
      name = file.name;
      if (!/\.(pdf|docx)$/i.test(name))
        throw new Error("Format impor hanya PDF/DOCX.");
      bytes = new Uint8Array(await file.arrayBuffer());
    } else if (old) {
      const v = await readVersion(old);
      const { data, error } = await createAdminClient()
        .storage.from(DOCUMENT_BUCKET)
        .download(v.storage_path);
      if (error || !data) throw new Error("Gagal membaca dokumen impor.");
      bytes = new Uint8Array(await data.arrayBuffer());
      format = v.file_format;
      name = v.original_name || "Dokumen";
    } else throw new Error("Unggah dokumen PDF/DOCX terlebih dahulu.");
  } else {
    if (!input.content?.trim()) throw new Error("Isi surat wajib diisi.");
    // Only canonical, allow-listed rich text reaches DOCX and storage.
    const escaped = input.content;
    const rec = people.find((p) => p.id === input.recipientUserId);
    let billingData: import('@/lib/docx-generator').LetterDocxData['billing'];
    if (input.letterTypeCode === 'Tag') {
      if (!input.billing) throw new Error('Lengkapi rincian pembayaran.');
      const b = input.billing;
      billingData = {
        bankName: banks.find(x => x.id === b.bankId)?.name || b.bankName || '',
        accountNumber: b.accountNumber,
        accountHolder: b.accountHolder,
        fromTitle: `${signers[0]?.title || 'Senior Manager'} PT Semen Indonesia Aceh`,
        toTitle: `${signers[1]?.title || 'Direktur Utama'} PT Semen Indonesia Aceh`,
        items: b.items,
      };
    }
    bytes = await generateLetterDocx({
      officialNumber: "{{OFFICIAL_NUMBER}}",
      letterDate:
        (input.letterTypeCode === "Tag" ? "" : "Aceh Besar, ") +
        new Date(input.letterDate + "T12:00:00+07:00").toLocaleDateString(
          "id-ID",
          {
            timeZone: "Asia/Jakarta",
            day: "numeric",
            month: "long",
            year: "numeric",
          },
        ),
      subject: input.subject,
      recipientName: rec ? `${rec.name} — ${rec.title}` : input.recipientName,
      recipientOrg: rec
        ? rec.unitName
        : [input.recipientOrg, input.recipientAddress]
            .filter(Boolean)
            .join("\n"),
      contentHtml: billingData ? escaped.replace("bank yang tercantum",escapeText(billingData.bankName)) : escaped,
      billing: billingData,
      signatureCount: signers.length,
      signers: signers.map((s) => ({ name: s!.name, title: s!.title })),
      signerName: signers[0]?.name || user.fullName,
      signerTitle: signers[0]?.title || user.unit?.name,
      signaturePlaceholders: true,
    });
    format = "DOCX";
  }
  await inspectDocument(bytes, format, input.signerIds.length, [
    ...input.areas,
    ...(input.stampArea ? [input.stampArea] : []),
    ...(input.numberArea ? [input.numberArea] : []),
  ]);
  const attachments: any[] = [];
  if (attachment?.size) {
    if (
      attachment.size > 1024 * 1024 ||
      !/\.(pdf|docx)$/i.test(attachment.name)
    )
      throw new Error("Lampiran PDF/DOCX maksimal 1 MB.");
    const attBytes = new Uint8Array(await attachment.arrayBuffer());
    const attFormat = attachment.name.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : "DOCX";
    await inspectDocument(attBytes, attFormat);
    const att = await storeBytes(user.id, attBytes, attFormat);
    attachments.push({
      ...att,
      name: attachment.name,
      mime: DOCUMENT_MIME[attFormat],
      size: attachment.size,
    });
  }
  const document = await storeBytes(user.id, bytes, format);
  const data = structuredClone(input) as DraftInput & { billing?: any };
  if (data.billing)
    data.billing.totalInWords = terbilangRupiah(
      data.billing.items.reduce((s: any, i: any) => s + Number(i.amount), 0),
    );
  const { data: id, error } = await createAdminClient().rpc(
    "save_letter_draft",
    {
      p_actor: user.id,
      p_data: data,
      p_document: { ...document, name, attachments },
    },
  );
  if (error) {
    await createAdminClient()
      .storage.from(DOCUMENT_BUCKET)
      .remove([document.path]);
    throw new Error(error.message);
  }
  if(input.replyToDispatchId||input.dispositionDraftKey){
    const {data:used,error:checkError}=await createAdminClient().from('letter_versions').select('id').eq('storage_path',document.path).limit(1);
    if(!checkError&&used?.length===0)await createAdminClient().storage.from(DOCUMENT_BUCKET).remove([document.path,...attachments.map(a=>a.path)]);
  }
  return id as string;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("Permintaan lintas situs ditolak.");
}
