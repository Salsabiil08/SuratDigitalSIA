import JSZip from "jszip";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SignatureArea, validateArea } from "../domain/workflow";
export type DocumentFormat = "PDF" | "DOCX";
export const DOCUMENT_MIME = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export async function inspectDocument(
  bytes: Uint8Array,
  format: DocumentFormat,
  count = 0,
  areas: SignatureArea[] = [],
  requireAreas = false,
) {
  if (!bytes.length || bytes.length > 3 * 1024 * 1024)
    throw new Error("Ukuran dokumen maksimal 3 MB untuk unggah melalui web.");
  if (format === "PDF") {
    if (Buffer.from(bytes.slice(0, 5)).toString() !== "%PDF-")
      throw new Error("Berkas bukan PDF valid.");
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const sizes = doc.getPages().map((p) => p.getSize());
    areas.forEach((a) => validateArea(a, sizes));
    if (requireAreas && areas.length !== count)
      throw new Error(
        "Tentukan area TTD PDF untuk setiap penandatangan sebelum mengajukan.",
      );
    return sizes;
  }
  const zip = await JSZip.loadAsync(bytes);
  const all = Object.values(zip.files) as (JSZip.JSZipObject & {
    _data?: { uncompressedSize?: number };
  })[];
  if (
    all.length > 3000 ||
    all.reduce((sum, f) => sum + (f._data?.uncompressedSize || 0), 0) >
      40 * 1024 * 1024
  )
    throw new Error("Dokumen terlalu besar setelah diekstrak.");
  if (
    zip.file("word/vbaProject.bin") ||
    all.some((f) => /embeddings\//.test(f.name))
  )
    throw new Error("Dokumen dengan makro/objek tertanam tidak didukung.");
  const part = zip.file("word/document.xml");
  if (!part) throw new Error("Berkas DOCX tidak valid.");
  const xml = await part.async("string");
  if (requireAreas && xml.split("{{OFFICIAL_NUMBER}}").length !== 2)
    throw new Error(
      "Tambahkan satu placeholder {{OFFICIAL_NUMBER}} untuk nomor resmi sebelum mengajukan.",
    );
  if (requireAreas)
    for (let i = 1; i <= count; i++)
      if (xml.split(`{{SIGNATURE_${i}}}`).length !== 2)
        throw new Error(
          `Tambahkan satu placeholder {{SIGNATURE_${i}}} dalam satu teks Word, lalu unggah ulang. Posisi TTD belum dikenali.`,
        );
  return [];
}
function drawImageXml(rel: string, id: number, width = 140, height = 55) {
  return `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width * 9525}" cy="${height * 9525}"/><wp:docPr id="${id}" name="Pengesahan ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Pengesahan"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width * 9525}" cy="${height * 9525}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}
export async function applyDocumentImages(
  bytes: Uint8Array,
  format: DocumentFormat,
  images: { marker: string; bytes: Uint8Array; area?: SignatureArea }[],
) {
  // Decode on the server, reject arbitrary content; PNG only (SVG and external URLs cannot enter documents).
  for (const image of images) {
    if (
      Buffer.from(image.bytes.slice(0, 8)).toString("hex") !==
        "89504e470d0a1a0a" ||
      image.bytes.length > 512 * 1024
    )
      throw new Error("Gambar TTD/stempel wajib PNG, maksimal 512 KB.");
    const width=Buffer.from(image.bytes).readUInt32BE(16),height=Buffer.from(image.bytes).readUInt32BE(20);
    if(!width||!height||width>4096||height>4096||width*height>8000000)throw new Error('Resolusi gambar TTD/stempel terlalu besar.');
    const probe = await PDFDocument.create();
    await probe.embedPng(image.bytes);
  }
  if (format === "PDF") {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const sizes = pdf.getPages().map((p) => p.getSize());
    for (const image of images) {
      if (!image.area)
        throw new Error("Area TTD/stempel PDF belum ditentukan.");
      validateArea(image.area, sizes);
      const { page, x, y, width, height } = image.area;
      const png = await pdf.embedPng(image.bytes);
      const fit = png.scaleToFit(width, height);
      pdf
        .getPage(page - 1)
        .drawImage(png, {
          x: x + (width - fit.width) / 2,
          y: sizes[page - 1]!.height - y - height + (height - fit.height) / 2,
          width: fit.width,
          height: fit.height,
        });
    }
    return Buffer.from(await pdf.save());
  }
  const zip = await JSZip.loadAsync(bytes);
  let xml = await zip.file("word/document.xml")!.async("string");
  let rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
  for (let i = 0; i < images.length; i++) {
    const image = images[i]!;
    if (xml.split(image.marker).length !== 2)
      throw new Error(
        `Posisi ${image.marker} belum dikenali atau lebih dari satu. Perbaiki draft terlebih dahulu.`,
      );
    const key = `siadocs${createHash("sha256").update(image.bytes).update(image.marker).digest("hex").slice(0, 24)}`;
    const media = `${key}.png`;
    const re = new RegExp(
      `<w:t[^>]*>[^<]*${image.marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^<]*<\\/w:t>`,
    );
    if (!re.test(xml))
      throw new Error("Placeholder harus utuh dalam satu teks Word.");
    xml = xml.replace(
      re,
      drawImageXml(
        key,
        9000 +
          parseInt(
            createHash("sha256").update(image.marker).digest("hex").slice(0, 6),
            16,
          ),
      ),
    );
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="${key}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${media}"/></Relationships>`,
    );
    zip.file(`word/media/${media}`, image.bytes, {
      date: new Date("2000-01-01T00:00:00Z"),
    });
  }
  zip.file("word/document.xml", xml, {
    date: zip.file("word/document.xml")!.date,
  });
  zip.file("word/_rels/document.xml.rels", rels, {
    date: zip.file("word/_rels/document.xml.rels")!.date,
  });
  let types = await zip.file("[Content_Types].xml")!.async("string");
  if (!types.includes('Extension="png"'))
    types = types.replace(
      "</Types>",
      '<Default Extension="png" ContentType="image/png"/></Types>',
    );
  zip.file("[Content_Types].xml", types, {
    date: zip.file("[Content_Types].xml")!.date,
  });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
export async function fillOfficialNumber(
  bytes: Uint8Array,
  format: DocumentFormat,
  number: string | null,
  blankAreas = false,
  numberArea?: SignatureArea,
) {
  if (format === "PDF") {
    if (!number || !numberArea) return Buffer.from(bytes);
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const sizes = pdf.getPages().map((p) => p.getSize());
    validateArea(numberArea, sizes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const size = Math.min(
      11,
      numberArea.width / font.widthOfTextAtSize(number, 1),
    );
    if (size < 7) throw new Error("Area nomor PDF terlalu sempit.");
    pdf
      .getPage(numberArea.page - 1)
      .drawText(number, {
        x: numberArea.x,
        y:
          sizes[numberArea.page - 1]!.height -
          numberArea.y -
          numberArea.height / 2,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    return Buffer.from(await pdf.save());
  }
  const zip = await JSZip.loadAsync(bytes);
  let xml = await zip.file("word/document.xml")!.async("string");
  const originalXml = xml;
  const safe = (number || "BELUM BERNOMOR")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  xml = xml.replace(/\{\{OFFICIAL_NUMBER\}\}/g, safe);
  if (blankAreas) xml = xml.replace(/\{\{(?:SIGNATURE_\d+|STAMP)\}\}/g, "");
  if (xml === originalXml) return Buffer.from(bytes);
  zip.file("word/document.xml", xml, {
    date: zip.file("word/document.xml")!.date,
  });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
