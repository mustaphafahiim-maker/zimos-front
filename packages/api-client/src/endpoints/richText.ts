/**
 * Formatted product descriptions (SPEC §7.1 "description (rich text)").
 *
 * The backend keeps a description as text with a small set of marks — never
 * as HTML (catalog/richDescription.js turns pasted or imported HTML into
 * these marks and drops everything else):
 *
 *   ## A heading            a line on its own
 *   - an item               a bulleted list, one line each
 *   1. an item              a numbered list
 *   **bold**  _italic_  [a link](https://…)
 *
 * Blank lines separate paragraphs; a single newline is a line break. Each
 * app draws the parsed blocks with its own components — React escapes the
 * text, so nothing in a description can become markup.
 */

export type RichInline =
  | { type: "text"; text: string }
  | { type: "bold"; children: RichInline[] }
  | { type: "italic"; children: RichInline[] }
  | { type: "link"; href: string; children: RichInline[] };

export type RichBlock =
  | { type: "heading"; content: RichInline[] }
  | { type: "paragraph"; lines: RichInline[][] }
  | { type: "list"; ordered: boolean; items: RichInline[][] };

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;
const BULLET = /^[-•]\s+/;
const NUMBERED = /^\d{1,3}[.)]\s+/;
const HEADING = /^#{1,3}\s+/;

/** The inline marks of one line. Unknown or unsafe marks stay as the plain characters they are. */
export function parseInline(text: string, depth = 0): RichInline[] {
  const out: RichInline[] = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push({ type: "text", text: plain });
    plain = "";
  };
  let i = 0;
  while (i < text.length) {
    if (depth < 3 && text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "bold", children: parseInline(text.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }
    // _italic_ not inside a Latin word, so snake_case_words stay as they are
    // (an Arabic word may lead into it: "و_خفيف_").
    if (depth < 3 && text[i] === "_" && (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1]))) {
      const end = text.indexOf("_", i + 1);
      if (end > i + 1 && text[i + 1] !== " " && (end === text.length - 1 || !/[A-Za-z0-9_]/.test(text[end + 1]))) {
        flush();
        out.push({ type: "italic", children: parseInline(text.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 3 && text[i] === "[") {
      const m = /^\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/.exec(text.slice(i));
      if (m && SAFE_HREF.test(m[2])) {
        flush();
        out.push({ type: "link", href: m[2], children: parseInline(m[1], depth + 1) });
        i += m[0].length;
        continue;
      }
    }
    plain += text[i];
    i += 1;
  }
  flush();
  return out;
}

export function parseRichText(source: string | null | undefined): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph: RichInline[][] = [];
  let list: { ordered: boolean; items: RichInline[][] } | null = null;
  const close = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    paragraph = [];
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const trimmed = line.trimStart();
    if (HEADING.test(trimmed)) {
      close();
      blocks.push({ type: "heading", content: parseInline(trimmed.replace(HEADING, "")) });
      continue;
    }
    const bullet = BULLET.test(trimmed);
    const numbered = !bullet && NUMBERED.test(trimmed);
    if (bullet || numbered) {
      if (paragraph.length) {
        blocks.push({ type: "paragraph", lines: paragraph });
        paragraph = [];
      }
      if (!list || list.ordered !== numbered) {
        if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
        list = { ordered: numbered, items: [] };
      }
      list.items.push(parseInline(trimmed.replace(bullet ? BULLET : NUMBERED, "")));
      continue;
    }
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
    paragraph.push(parseInline(line));
  }
  close();
  return blocks;
}

function inlinePlain(nodes: RichInline[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : inlinePlain(n.children))).join("");
}

/** The description without its marks: for meta descriptions, cards, shared data and feeds. */
export function richTextToPlain(source: string | null | undefined): string {
  return parseRichText(source)
    .map((b) =>
      b.type === "heading"
        ? inlinePlain(b.content)
        : b.type === "paragraph"
          ? b.lines.map(inlinePlain).join("\n")
          : b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : "-"} ${inlinePlain(item)}`).join("\n")
    )
    .join("\n\n");
}
