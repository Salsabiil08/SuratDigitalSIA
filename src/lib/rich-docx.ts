import { parseDocument } from "htmlparser2";
import { isTag, isText, type AnyNode } from "domhandler";
import {
  sanitizeLetterHtml,
  safeStyles,
  escapeText,
} from "../domain/rich-text";
type Style = {
  font: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: string;
  indent?: number;
};
export function richTextDocx(html: string, font = "SIG Text") {
  const paragraphs: string[] = [];
  let runs: string[] = [];
  let paragraph: Style = { font, size: 22 };
  const flush = () => {
    if (runs.length) {
      paragraphs.push(
        `<w:p><w:pPr><w:jc w:val="${paragraph.align === "justify" ? "both" : paragraph.align || "left"}"/><w:ind w:left="${paragraph.indent || 0}"/><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>${runs.join("")}</w:p>`,
      );
      runs = [];
    }
  };
  function run(text: string, style: Style, br = false) {
    const pr = `<w:rFonts w:ascii="${escapeText(style.font)}" w:hAnsi="${escapeText(style.font)}"/><w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>${style.bold ? "<w:b/>" : ""}${style.italic ? "<w:i/>" : ""}${style.underline ? '<w:u w:val="single"/>' : ""}${style.strike ? "<w:strike/>" : ""}`;
    runs.push(
      `<w:r><w:rPr>${pr}</w:rPr>${br ? "<w:br/>" : `<w:t xml:space="preserve">${escapeText(text)}</w:t>`}</w:r>`,
    );
  }
  function walk(
    n: AnyNode,
    base: Style,
    list?: { ordered: boolean; index: number },
  ) {
    if (isText(n)) {
      if (n.data.trim() || runs.length) run(n.data, base);
      return;
    }
    if (!isTag(n)) return;
    const css = safeStyles(n);
    const s: Style = {
      ...base,
      font: css["font-family"] || base.font,
      size: css["font-size"]
        ? Math.round(parseFloat(css["font-size"]) * 2)
        : base.size,
      bold:
        base.bold ||
        ["b", "strong"].includes(n.name) ||
        css["font-weight"] === "bold",
      italic:
        base.italic ||
        ["i", "em"].includes(n.name) ||
        css["font-style"] === "italic",
      underline:
        base.underline ||
        n.name === "u" ||
        css["text-decoration"]?.includes("underline"),
      strike:
        base.strike ||
        ["s", "strike"].includes(n.name) ||
        css["text-decoration"]?.includes("line-through"),
      align: css["text-align"] || base.align,
      indent: css["margin-left"]
        ? parseInt(css["margin-left"]) * 15
        : base.indent,
    };
    if (n.name === "blockquote") s.indent = (s.indent || 0) + 360;
    if (n.name === "br") {
      run("", s, true);
      return;
    }
    if (["ul", "ol"].includes(n.name)) {
      flush();
      const l = { ordered: n.name === "ol", index: 0 };
      for (const c of n.children)
        walk(c, { ...s, indent: (s.indent || 0) + 360 }, l);
      flush();
      return;
    }
    const block = ["p", "div", "li", "blockquote"].includes(n.name);
    if (block) {
      flush();
      paragraph = { ...s };
    }
    if (n.name === "li") run(list?.ordered ? `${++list.index}. ` : "• ", s);
    for (const c of n.children) walk(c, s, list);
    if (block) {
      if (!runs.length) run("", s);
      flush();
    }
  }
  for (const n of parseDocument(sanitizeLetterHtml(html)).children)
    walk(n, { font, size: 22 });
  flush();
  return paragraphs.join("");
}
