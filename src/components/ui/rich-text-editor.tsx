"use client";

import * as React from "react";
import { sanitizeLetterHtml, plainTextHtml } from "@/domain/rich-text";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Indent,
  Outdent,
  Quote,
  RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Ketik isi naskah surat resmi di sini...",
  minHeight = "280px",
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [selectedFont, setSelectedFont] = React.useState("SIG Text");
  const [selectedSize, setSelectedSize] = React.useState("3"); // 3 = normal in execCommand

  const selection = React.useRef<Range | null>(null);
  const initialHtml = React.useRef(sanitizeLetterHtml(value));
  const remember = React.useCallback(() => {
    const current = window.getSelection();
    if (current?.rangeCount && editorRef.current?.contains(current.anchorNode))
      selection.current = current.getRangeAt(0).cloneRange();
  }, []);
  React.useEffect(() => {
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, [remember]);
  React.useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor) {
      const safe = sanitizeLetterHtml(value);
      if (editor.innerHTML !== safe) editor.innerHTML = safe;
    }
  }, [value]);
  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    const current = window.getSelection();
    if (
      selection.current &&
      editorRef.current?.contains(selection.current.commonAncestorContainer)
    ) {
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      remember();
      onChange(editorRef.current.innerHTML);
    }
  };
  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    setSelectedFont(font);
    exec("fontName", font);
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    setSelectedSize(size);
    exec("fontSize", size);
  };

  return (
    <div className="w-full border border-[#C9C9C3] rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-brand-red/25 focus-within:border-brand-red transition-all">
      {/* Toolbar Gaya Gmail */}
      <div
        role="toolbar"
        aria-label="Format isi surat"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          else remember();
        }}
        className="flex flex-wrap items-center gap-1 p-2 bg-[#F6F6F4] border-b border-[#E4E4E0] select-none text-neutral-700"
      >
        {/* Undo & Redo */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-neutral-300">
          <button
            type="button"
            onClick={() => exec("undo")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-600 hover:text-neutral-900 transition-colors"
            title="Urungkan (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("redo")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-600 hover:text-neutral-900 transition-colors"
            title="Ulangi (Redo)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Pilihan Font */}
        <select
          value={selectedFont}
          onChange={handleFontChange}
          className="h-7 px-2 text-xs bg-white border border-[#D5D5CF] rounded hover:bg-neutral-50 text-neutral-800 focus:outline-none cursor-pointer font-medium"
          title="Jenis Font"
        >
          <option value="SIG Text">SIG Text (Resmi SIG)</option>
          <option value="Arial">Sans Serif (Arial)</option>
          <option value="Times New Roman">Serif (Times New Roman)</option>
          <option value="Courier New">Monospace (Courier)</option>
          <option value="Georgia">Georgia</option>
        </select>

        {/* Ukuran Font */}
        <select
          value={selectedSize}
          onChange={handleSizeChange}
          className="h-7 px-2 text-xs bg-white border border-[#D5D5CF] rounded hover:bg-neutral-50 text-neutral-800 focus:outline-none cursor-pointer"
          title="Ukuran Font"
        >
          <option value="2">Kecil</option>
          <option value="3">Normal</option>
          <option value="4">Besar</option>
          <option value="5">Sangat Besar</option>
        </select>

        {/* Pemisah */}
        <div className="h-5 w-px bg-neutral-300 mx-0.5" />

        {/* Format Teks: Bold, Italic, Underline, Strike */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => exec("bold")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 font-bold transition-colors"
            title="Tebal (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("italic")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 italic transition-colors"
            title="Miring (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("underline")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 underline transition-colors"
            title="Garis Bawah (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("strikeThrough")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Coret"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Pemisah */}
        <div className="h-5 w-px bg-neutral-300 mx-0.5" />

        {/* Perataan Teks (Alignment) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => exec("justifyLeft")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Rata Kiri"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("justifyCenter")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Rata Tengah"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("justifyRight")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Rata Kanan"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("justifyFull")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Rata Kanan-Kiri (Justify)"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Pemisah */}
        <div className="h-5 w-px bg-neutral-300 mx-0.5" />

        {/* Daftar (List) & Indentasi */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => exec("insertOrderedList")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Daftar Bernomor (1, 2, 3)"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("insertUnorderedList")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Daftar Poin (Bullet)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("outdent")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Kurangi Indentasi"
          >
            <Outdent className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("indent")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-800 transition-colors"
            title="Tambah Indentasi"
          >
            <Indent className="w-4 h-4" />
          </button>
        </div>

        {/* Hapus Format */}
        <div className="ml-auto pl-1">
          <button
            type="button"
            onClick={() => exec("removeFormat")}
            className="p-1.5 rounded hover:bg-neutral-200/80 text-neutral-500 hover:text-neutral-800 transition-colors"
            title="Hapus Pemformatan"
          >
            <RemoveFormatting className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Area Naskah Dokumen Luas (Editable Canvas) */}
      <div
        ref={editorRef}
        id="letter-content"
        role="textbox"
        aria-label="Isi surat"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialHtml.current }}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          exec(
            "insertHTML",
            html
              ? sanitizeLetterHtml(html)
              : plainTextHtml(e.clipboardData.getData("text/plain")),
          );
        }}
        onDrop={(e) => {
          e.preventDefault();
          exec(
            "insertHTML",
            plainTextHtml(e.dataTransfer.getData("text/plain")),
          );
        }}
        onInput={handleInput}
        style={{
          minHeight,
          fontFamily: "'SIG Text', var(--font-inter), sans-serif",
        }}
        className="p-4 sm:p-5 outline-none text-neutral-900 text-sm sm:text-base leading-relaxed overflow-y-auto max-h-[550px] font-sans focus:outline-none"
        data-placeholder={placeholder}
      />
    </div>
  );
}
