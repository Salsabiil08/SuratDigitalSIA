import { parseDocument } from "htmlparser2";
import { isTag, isText, type AnyNode, type Element } from "domhandler";
export const LETTER_FONTS = [
  "SIG Text",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
] as const;
export const escapeText = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
export function plainTextHtml(text: string) {
  return text
    .split("\n")
    .map((s) => `<p>${escapeText(s) || "<br>"}</p>`)
    .join("");
}
const tags = new Set([
  "p",
  "div",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "span",
  "font",
  "ul",
  "ol",
  "li",
  "blockquote",
]);
const blocked = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "img",
  "video",
  "audio",
  "form",
  "input",
  "button",
]);
export function safeStyles(el: Element): Record<string, string> {
  const styles: Record<string, string> = {};
  const raw: Record<string, string> = Object.fromEntries(
    (el.attribs.style || "")
      .split(";")
      .map((s) => s.split(":").map((s) => s.trim()))
      .filter((a) => a.length === 2),
  );
  const family = (el.attribs.face || raw["font-family"] || "")
    .split(",")[0]
    ?.replace(/['"]/g, "")
    .trim();
  const font = LETTER_FONTS.find(
    (f) => f.toLowerCase() === family?.toLowerCase(),
  );
  if (font) styles["font-family"] = font;
  const size = raw["font-size"];
  const m = size?.match(/^(\d+(?:\.\d+)?)(pt|px)$/);
  const htmlSize = (
    { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 } as Record<string, number>
  )[el.attribs.size || ""];
  if (m || htmlSize) {
    const pt = m ? Number(m[1]) * (m[2] === "px" ? 0.75 : 1) : htmlSize!;
    if (pt >= 8 && pt <= 36) styles["font-size"] = pt + "pt";
  }
  if (
    ["left", "center", "right", "justify"].includes(
      raw["text-align"] || el.attribs.align || "",
    )
  )
    styles["text-align"] = raw["text-align"] || el.attribs.align!;
  if (raw["font-weight"] === "bold" || Number(raw["font-weight"]) >= 600)
    styles["font-weight"] = "bold";
  if (raw["font-style"] === "italic") styles["font-style"] = "italic";
  const decoration = (
    raw["text-decoration"] ||
    raw["text-decoration-line"] ||
    ""
  )
    .split(" ")
    .filter((s) => ["underline", "line-through"].includes(s));
  if (decoration.length) styles["text-decoration"] = decoration.join(" ");
  const indent = raw["margin-left"]?.match(/^(\d+)px$/);
  if (indent) styles["margin-left"] = Math.min(120, Number(indent[1])) + "px";
  return styles;
}
export function sanitizeLetterHtml(html: string): string {
  if (html.length > 200000)
    throw new Error("Isi surat terlalu panjang. Maksimal 200.000 karakter.");
  function clean(n: AnyNode): string {
    if (isText(n)) return escapeText(n.data);
    if (!isTag(n)) return "";
    if (blocked.has(n.name)) return "";
    const inner = n.children.map(clean).join("");
    if (!tags.has(n.name)) return inner;
    if (n.name === "br") return "<br>";
    const name = n.name === "font" ? "span" : n.name;
    const styles = Object.entries(safeStyles(n))
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    return `<${name}${styles ? ` style="${escapeText(styles)}"` : ""}>${inner}</${name}>`;
  }
  return parseDocument(html, { decodeEntities: true })
    .children.map(clean)
    .join("");
}
export function letterText(html: string): string {
  function read(n: AnyNode): string {
    return isText(n)
      ? n.data
      : isTag(n)
        ? n.children.map(read).join("") +
          (["p", "div", "li", "br"].includes(n.name) ? "\n" : "")
        : "";
  }
  return parseDocument(sanitizeLetterHtml(html)).children.map(read).join("");
}
