import { organizationMember, resolveInternalSender } from "@/domain/official-sender";
import {storeAttachment,removeAttachments} from "@/server/attachments";
import {validateBillingItems,billingItemsWithSharedPayment} from '@/domain/billing';
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
    throw new Error("Dokumen belum dapat diambil. Silakan coba kembali.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (version.file_hash && hashBytes(bytes) !== version.file_hash)
    throw new Error("Hash dokumen berbeda dari catatan versi.");
  return {
    bytes: materialize && !letter.manual_number_reservation_id
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
    throw new Error("Dokumen belum tersimpan. Periksa koneksi, lalu coba kembali.");
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
    { data: units, error: unitError },
    { data: categories, error: catError },
    { data: approvalGrants, error: approvalGrantError },
  ] = await Promise.all([
    db.from("profiles").select("id,full_name").eq("is_active", true),
    db
      .from("user_assignments")
      .select(
        "id,supervisor_assignment_id,profile_id,is_official_signer,start_date,end_date,position:positions!user_assignments_position_id_fkey(code,name,level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(id,code,name,is_active)",
      )
      .eq("is_active", true)
      .order("start_date", { ascending: false, nullsFirst: false }),
    db.from("master_bank").select("id,name").eq("is_active", true),
    db.from('letter_types').select('creator_unit_id').eq('category','BILLING').eq('is_active',true).maybeSingle(),
    db.from('organizational_units').select('id,parent_id').eq('is_active',true),
    db.from('document_categories').select('id,code,name').eq('is_active', true).in('code', ['PERMOHONAN','LAPORAN','PEMBERITAHUAN']),
    createAdminClient().from('approver_authorizations').select('approver_id,unit_id,starts_on,ends_on,type:letter_types(code)').eq('is_active',true),
  ]);
  if (error || ae || be || unitError)
    throw new Error(
      "Gagal memuat struktur organisasi: " + (error || ae || be || unitError)?.message,
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
        assignmentId: a?.id,
        supervisorAssignmentId: a?.supervisor_assignment_id,
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
  if (catError) throw new Error('Metadata surat belum dapat diambil.');
  if(approvalGrantError)throw new Error('Konfigurasi persetujuan belum dapat diambil.');
  const approverGrants=(approvalGrants||[]).filter(g=>(!g.unit_id||g.unit_id===user.unit?.id)&&g.starts_on<=today&&(!g.ends_on||g.ends_on>=today)).map(g=>({approverId:g.approver_id,typeCode:(g.type as any)?.code||null}));
  const reviewRules:never[]=[];
  return { user, people, organizationUnits:(units||[]).map(unit=>({id:unit.id,parentId:unit.parent_id})), banks: banks || [], financeUnitId:billingType?.creator_unit_id || '', categories: categories || [], reviewRules, approverGrants };
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
  if(old?.manual_number_reservation_id) input.manualNumberId=old.manual_number_reservation_id;
  if(input.manualNumberId && (input.source!=="UPLOAD" || input.manualNumberConfirmed!==true)) throw new Error("Konfirmasi nomor pada dokumen unggahan terlebih dahulu.");
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
  const { people, banks, categories, organizationUnits } = await peopleOptions();
  // Obsolete review inputs never create a separate workflow, including old client requests.
  if(input.approvalRequired!==undefined&&typeof input.approvalRequired!=='boolean')throw new Error('Pilihan persetujuan tidak valid.');
  input.approvalRequired=!!input.approvalRequired||input.reviewRequested===true||!!input.reviewerId;
  input.reviewRequested=false;input.reviewerId='';
  input.categoryCode=input.categoryCode || old?.document_category?.code || 'PEMBERITAHUAN';
  if (!categories.some(category => category.code === input.categoryCode)) throw new Error("Kategori surat tidak aktif.");
  let officialSender: (typeof people)[number] | undefined;
  if (input.letterTypeCode === "IN") {
    const members = people.flatMap(person => organizationMember(person.id, person.position, person.unitId, person.assignmentId, person.supervisorAssignmentId) || []);
    const creator = members.find(member => member.id === user.id);
    const recipient = members.find(member => member.id === input.recipientUserId);
    if (!creator || !recipient) throw new Error("Pilih penerima dengan jabatan dan unit aktif.");
    const { senderId } = resolveInternalSender(creator, recipient, members, organizationUnits, input.officialSenderId);
    officialSender = people.find(person => person.id === senderId);
    input = { ...input, officialSenderId: senderId, originCity: undefined, signerIds: [], mandatoryApproverIds: [], additionalApproverIds: [], areas: [], stampArea: undefined, signatureMode: "IN_APP" };
  } else if (input.letterTypeCode === "KRE") {
    officialSender = people.find(person => person.id === input.officialSenderId && person.signer);
    if (!officialSender) throw new Error("Pilih pengirim resmi SM atau Direktur yang berwenang.");
    input.originCity = input.originCity?.trim();
    if (!input.originCity || input.originCity.length > 100) throw new Error("Isi kota surat eksternal (maksimal 100 karakter).");
    input = { ...input, signerIds: [officialSender.id], mandatoryApproverIds: [], additionalApproverIds: [], signatureMode: "IN_APP" };
  }
  const signers = input.signerIds.map((id) =>
    people.find((p) => p.id === id && p.signer),
  );
  if (signers.some((s) => !s))
    throw new Error("Pilih pejabat penandatangan aktif.");
  if (input.letterTypeCode === 'Tag') {
    input.signatureMode='IN_APP';
    if(input.source==='CREATE'){
    if (!input.billing) throw new Error('Lengkapi rincian pembayaran.');
    const billing = input.billing;
    const selectedBank = banks.find(bank => bank.id === billing.bankId)?.name;
    const items = billing.sharedPayment === false
      ? billing.items
      : billingItemsWithSharedPayment(billing.sharedPayment===true ? {
          ...billing,
          items:billing.items.map(item=>({...item,payeeName:undefined,bankName:undefined,accountNumber:undefined})),
        } : billing, selectedBank);
    validateBillingItems(items);
    const first = items[0]!;
    input.billing = {
      ...billing, items, layout:'PAYMENT_REQUEST',
      bankId: billing.sharedPayment === false ? '' : billing.bankId,
      bankName: billing.sharedPayment === false ? first.bankName : selectedBank || billing.bankName,
      accountNumber: first.accountNumber!, accountHolder: first.payeeName!,
    };
    }else input.billing=undefined;
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
      r05: billingData ? {kind:"BILLING",senderName:signers[0]!.name,senderTitle:signers[0]!.title} : officialSender ? {
        kind: input.letterTypeCode === "IN" ? "INTERNAL" : "EXTERNAL",
        city: input.originCity,
        senderName: officialSender.name,
        senderTitle: officialSender.title,
      } : undefined,
      letterDate:
        (input.letterTypeCode === "Tag" || officialSender ? "" : "Aceh Besar, ") +
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
  if (attachment) attachments.push(await storeAttachment(user.id,attachment));
  const document = await storeBytes(user.id, bytes, format).catch(async e=>{await removeAttachments(attachments);throw e;});
  const data = structuredClone(input) as DraftInput & { billing?: any };
  if (data.billing)
    data.billing.totalInWords = terbilangRupiah(
      data.billing.items.reduce((s: any, i: any) => s + Number(i.amount), 0),
    );
  const { data: id, error } = await createAdminClient().rpc(
    input.manualNumberId ? "save_manual_numbered_draft" : "save_letter_draft",
    {
      ...(input.manualNumberId ? {p_reservation:input.manualNumberId,p_confirmed:input.manualNumberConfirmed===true} : {}),
      p_actor: user.id,
      p_data: data,
      p_document: { ...document, name, attachments },
    },
  );
  if (error) {
    await createAdminClient()
      .storage.from(DOCUMENT_BUCKET)
      .remove([document.path]);
    await removeAttachments(attachments);
    throw new Error(error.message);
  }
  if(input.replyToDispatchId||input.dispositionDraftKey){
    const {data:used,error:checkError}=await createAdminClient().from('letter_versions').select('id').eq('storage_path',document.path).limit(1);
    if(!checkError&&used?.length===0){await createAdminClient().storage.from(DOCUMENT_BUCKET).remove([document.path]);await removeAttachments(attachments);}
  }
  return id as string;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("Permintaan lintas situs ditolak.");
}
