import { Fragment, useRef, useState, type ReactNode } from "react";
import { Bold, Eye, Heading2, Italic, Link2, List, ListOrdered, Pencil } from "lucide-react";
import { Button } from "@store-builder/ui";
import { parseRichText, type RichInline } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Textarea } from "@/components/Textarea";

const STRINGS = {
  en: {
    toolbar: "Formatting",
    bold: "Bold",
    italic: "Italic",
    heading: "Heading",
    bullets: "Bulleted list",
    numbers: "Numbered list",
    link: "Link",
    preview: "Preview",
    edit: "Edit",
    sample: "text",
    hint: "Select words and use the buttons above. Pasted text keeps its bold, lists and headings.",
    empty: "Nothing to preview yet.",
  },
  ar: {
    toolbar: "التنسيق",
    bold: "عريض",
    italic: "مائل",
    heading: "عنوان",
    bullets: "قايمة نقط",
    numbers: "قايمة مرقّمة",
    link: "لينك",
    preview: "معاينة",
    edit: "تعديل",
    sample: "نص",
    hint: "حدّد الكلام واستخدم الأزرار اللي فوق. الكلام اللي بتلزقه بيفضل بالعريض والقوايم والعناوين بتاعته.",
    empty: "مفيش حاجة تتعاين لسه.",
  },
} satisfies Messages;

function Inline({ nodes }: { nodes: RichInline[] }): ReactNode {
  return nodes.map((node, i) =>
    node.type === "text" ? (
      <Fragment key={i}>{node.text}</Fragment>
    ) : node.type === "bold" ? (
      <strong key={i} className="font-semibold text-ink">
        <Inline nodes={node.children} />
      </strong>
    ) : node.type === "italic" ? (
      <em key={i}>
        <Inline nodes={node.children} />
      </em>
    ) : (
      <a key={i} href={node.href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
        <Inline nodes={node.children} />
      </a>
    )
  );
}

/** The description as the store will show it (api-client endpoints/richText.ts). */
export function RichTextPreview({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-soft" dir="auto">
      {parseRichText(text).map((block, i) =>
        block.type === "heading" ? (
          <h3 key={i} className="text-base font-semibold text-ink">
            <Inline nodes={block.content} />
          </h3>
        ) : block.type === "list" ? (
          block.ordered ? (
            <ol key={i} className="list-decimal space-y-1 ps-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={item} />
                </li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 ps-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={item} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline nodes={line} />
              </Fragment>
            ))}
          </p>
        )
      )}
    </div>
  );
}

/**
 * The product description with formatting (SPEC §7.1 "rich text"): a small
 * toolbar that writes the marks the store draws (bold, italic, heading,
 * lists, link) around the selection, and a preview. What is saved is text —
 * the backend (catalog/richDescription.js) turns pasted HTML into the same
 * marks and drops the rest.
 */
export function RichDescriptionField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const t = useT(STRINGS);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previewing, setPreviewing] = useState(false);

  function apply(next: string, selStart: number, selEnd: number) {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function wrap(mark: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const inner = value.slice(s, e) || t.sample;
    const next = value.slice(0, s) + mark + inner + mark + value.slice(e);
    apply(next, s + mark.length, s + mark.length + inner.length);
  }

  /** Starts every selected line with `prefix` ("1. ", "2. "… for numbers), or takes it off when all have it. */
  function prefixLines(kind: "heading" | "bullets" | "numbers") {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const endBreak = value.indexOf("\n", el.selectionEnd);
    const end = endBreak === -1 ? value.length : endBreak;
    const lines = value.slice(start, end).split("\n");
    const pattern = kind === "heading" ? /^#{1,3}\s+/ : kind === "bullets" ? /^[-•]\s+/ : /^\d{1,3}[.)]\s+/;
    const all = lines.every((l) => pattern.test(l));
    const changed = lines.map((l, i) => {
      if (all) return l.replace(pattern, "");
      const bare = l.replace(/^(#{1,3}|[-•]|\d{1,3}[.)])\s+/, "");
      return `${kind === "heading" ? "## " : kind === "bullets" ? "- " : `${i + 1}. `}${bare}`;
    });
    const block = changed.join("\n");
    apply(value.slice(0, start) + block + value.slice(end), start, start + block.length);
  }

  function link() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = value.slice(s, e).replace(/[[\]\n]/g, " ") || t.link;
    const piece = `[${text}](https://)`;
    // The address is selected, ready to be typed over.
    const urlStart = s + text.length + 3;
    apply(value.slice(0, s) + piece + value.slice(e), urlStart, urlStart + "https://".length);
  }

  const tools: Array<{ label: string; icon: typeof Bold; run: () => void }> = [
    { label: t.bold, icon: Bold, run: () => wrap("**") },
    { label: t.italic, icon: Italic, run: () => wrap("_") },
    { label: t.heading, icon: Heading2, run: () => prefixLines("heading") },
    { label: t.bullets, icon: List, run: () => prefixLines("bullets") },
    { label: t.numbers, icon: ListOrdered, run: () => prefixLines("numbers") },
    { label: t.link, icon: Link2, run: link },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t.toolbar} aria-controls={id}>
        {tools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={tool.label}
            title={tool.label}
            disabled={previewing}
            onClick={tool.run}
          >
            <tool.icon className="size-4" aria-hidden />
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <Button type="button" size="sm" variant={previewing ? "secondary" : "ghost"} aria-pressed={previewing} onClick={() => setPreviewing((p) => !p)}>
          {previewing ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {previewing ? t.edit : t.preview}
        </Button>
      </div>
      {previewing ? (
        <div className="min-h-[160px] rounded-[0.5rem] border border-line bg-paper px-3 py-2">
          {value.trim() ? <RichTextPreview text={value} /> : <p className="text-sm text-ink-soft">{t.empty}</p>}
        </div>
      ) : (
        <Textarea ref={ref} id={id} dir="auto" rows={8} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <p className="text-xs text-ink-soft">{t.hint}</p>
    </div>
  );
}
