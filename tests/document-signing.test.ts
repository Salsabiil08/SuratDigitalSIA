import { describe, it, expect, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { generateLetterDocx } from "../src/lib/docx-generator";
import {
  inspectDocument,
  applyDocumentImages,
  fillOfficialNumber,
} from "../src/lib/letter-document";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
describe("Pengesahan dokumen nyata", () => {
  it("template DOCX menyediakan area; gambar TTD dan stempel masuk ke berkas, bukan hanya UI", async () => {
    const doc = await generateLetterDocx({
      officialNumber: "{{OFFICIAL_NUMBER}}",
      subject: "UJI DOKUMEN",
      contentText: "Naskah <tetap> & aman",
      signatureCount: 2,
      signers: [
        { name: "Uji SM", title: "SM" },
        { name: "Uji Direktur", title: "Direktur" },
      ],
      signaturePlaceholders: true,
    });
    await inspectDocument(doc, "DOCX", 2, [], true);
    const numbered = await fillOfficialNumber(
      doc,
      "DOCX",
      "00118-Tag/FIN/SIA/11.2026",
    );
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-17T20:00:00Z"));
    const first = await applyDocumentImages(numbered, "DOCX", [
      { marker: "{{SIGNATURE_1}}", bytes: png },
      { marker: "{{STAMP}}", bytes: png },
    ]);
    const second = await applyDocumentImages(first, "DOCX", [
      { marker: "{{SIGNATURE_2}}", bytes: png },
    ]);
    const xml = await (await JSZip.loadAsync(second))
      .file("word/document.xml")!
      .async("string");
    expect(xml).not.toContain("{{SIGNATURE_");
    expect(xml).not.toContain("{{STAMP}}");
    expect(xml).toContain("00118-Tag/FIN/SIA/11.2026");
    expect(xml).toContain("Naskah &lt;tetap&gt; &amp; aman");
    expect(xml.match(/<w:drawing>/g)?.length).toBe(3);
    vi.setSystemTime(new Date("2026-11-17T20:05:00Z"));
    const repeat = await applyDocumentImages(numbered, "DOCX", [
      { marker: "{{SIGNATURE_1}}", bytes: png },
      { marker: "{{STAMP}}", bytes: png },
    ]);
    expect(Buffer.compare(first, repeat)).toBe(0);vi.useRealTimers();
  });
  it("menolak placeholder yang hilang dan gambar bukan PNG", async () => {
    const doc = await generateLetterDocx({ signatureCount: 0 });
    await expect(inspectDocument(doc, "DOCX", 1, [], true)).rejects.toThrow(
      /placeholder/,
    );
    await expect(
      applyDocumentImages(doc, "DOCX", [
        { marker: "{{SIGNATURE_1}}", bytes: png },
      ]),
    ).rejects.toThrow(/Posisi/);
    await expect(
      applyDocumentImages(doc, "DOCX", [
        { marker: "{{SIGNATURE_1}}", bytes: Buffer.from("<svg/>") },
      ]),
    ).rejects.toThrow(/PNG/);
  });
  it("PDF mempertahankan isi dan menempelkan gambar hanya pada koordinat tervalidasi", async () => {
    const p = await PDFDocument.create();
    const page = p.addPage([595, 842]);
    page.drawText("DOKUMEN UJI", {
      x: 50,
      y: 750,
      font: await p.embedFont(StandardFonts.Helvetica),
    });
    const original = await p.save();
    const area = { page: 1, x: 350, y: 600, width: 140, height: 55 };
    await inspectDocument(original, "PDF", 1, [area], true);
    const result = await applyDocumentImages(original, "PDF", [
      { marker: "{{SIGNATURE_1}}", bytes: png, area },
    ]);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
    expect(result.length).toBeGreaterThan(original.length);
    const repeated = await applyDocumentImages(original, "PDF", [
      { marker: "{{SIGNATURE_1}}", bytes: png, area },
    ]);
    expect(Buffer.compare(result, repeated)).toBe(0);
    await expect(
      applyDocumentImages(original, "PDF", [
        { marker: "{{SIGNATURE_1}}", bytes: png, area: { ...area, x: 590 } },
      ]),
    ).rejects.toThrow(/luar halaman/);
  });
});
