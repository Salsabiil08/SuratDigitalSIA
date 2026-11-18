import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  sanitizeLetterHtml,
  plainTextHtml,
  letterText,
} from "../src/domain/rich-text";
import { generateLetterDocx } from "../src/lib/docx-generator";
describe("Format isi surat yang aman dan tersimpan dalam dokumen", () => {
  it("menghapus konten aktif dan atribut berbahaya, mempertahankan format yang diizinkan", () => {
    const safe = sanitizeLetterHtml(
      '<p onclick="alert(1)" style="text-align:right;background:url(https://evil.test)"><strong>Tebal</strong><span style="font-family:Arial;font-size:14pt;color:red">A &amp; B</span><img src=x onerror=alert(1)><script>alert(2)</script><svg onload=alert(3)></svg></p>',
    );
    expect(safe).toContain("text-align:right");
    expect(safe).toContain("font-family:Arial;font-size:14pt");
    expect(safe).toContain("A &amp; B");
    expect(safe).not.toMatch(
      /onclick|onerror|script|alert|svg|img|url\(|color:/,
    );
  });
  it("memperlakukan draft teks lama sebagai teks literal, termasuk tanda lebih kecil dan entitas", () => {
    expect(plainTextHtml("A < B & C\n<b>literal</b>")).toBe(
      "<p>A &lt; B &amp; C</p><p>&lt;b&gt;literal&lt;/b&gt;</p>",
    );
    expect(letterText("<p><br></p>")).not.toMatch(/\S/);
  });
  it("font, ukuran, rata kanan, tebal, miring, garis bawah, dan daftar masuk ke Word", async () => {
    const html =
      '<p style="text-align:right"><span style="font-family:Arial;font-size:14pt"><strong><em><u>A &amp; B</u></em></strong> normal</span></p><ol><li>Pertama</li><li>Kedua</li></ol><p style="text-align:justify">Paragraf rata kanan-kiri</p>';
    const zip = await JSZip.loadAsync(
      await generateLetterDocx({ contentHtml: html, signatureCount: 0 }),
    );
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain('<w:jc w:val="right"/>');
    expect(xml).toContain('<w:jc w:val="both"/>');
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).toContain('<w:sz w:val="28"/>');
    expect(xml).toContain('<w:b/><w:i/><w:u w:val="single"/>');
    expect(xml).toContain("A &amp; B");
    expect(xml).not.toContain("&amp;amp;");
    expect(xml).toContain("1. ");
    expect(xml).toContain("2. ");
  });
  it("mengembalikan font induk setelah format bersarang berakhir", async () => {
    const zip = await JSZip.loadAsync(
      await generateLetterDocx({
        contentHtml:
          '<p><span style="font-family:Arial">Arial <span style="font-family:Georgia">Georgia</span> Arial kembali</span></p>',
      }),
    );
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toMatch(
      /w:ascii="Georgia"[^]*Georgia[^]*w:ascii="Arial"[^]*Arial kembali/,
    );
  });
});
