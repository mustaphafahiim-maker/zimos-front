import type { EmailBlock, EmailBlockAlign, EmailBlockType } from "@store-builder/api-client";

/**
 * The block designer's working copy (EmailBlockDesigner.tsx). Every block is
 * kept as one flat record of strings so a form can edit any field; `toBlock`
 * sends only the fields the server accepts for that type (an extra field is
 * a 422), and `blockProblems` mirrors the server's rules
 * (backend notifications/emailBlocks.js) so mistakes show before saving.
 */
export interface DraftBlock {
  id: string;
  type: EmailBlockType;
  /** heading / text */
  text: string;
  /** heading */
  size: "lg" | "md";
  /** button */
  label: string;
  /** button link, image source */
  url: string;
  /** button; "" = the store's colour */
  color: string;
  /** image */
  alt: string;
  /** image link; "" = none */
  link: string;
  /** image width in px as typed; "" = full width */
  width: string;
  /** "" = the email's default (start). */
  align: EmailBlockAlign | "";
}

export type BlockField = "text" | "label" | "url" | "color" | "alt" | "link" | "width";
export type BlockProblem = "required" | "tooLong" | "link" | "imageUrl" | "color" | "width";
export type BlockProblems = Partial<Record<BlockField, BlockProblem>>;

let counter = 0;
const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

const EMPTY: Omit<DraftBlock, "id" | "type"> = {
  text: "",
  size: "lg",
  label: "",
  url: "",
  color: "",
  alt: "",
  link: "",
  width: "",
  align: "",
};

/** A fresh block of `type`, with a sensible start. */
export function newBlock(type: EmailBlockType, defaults: Partial<DraftBlock> = {}): DraftBlock {
  return { id: newId(), type, ...EMPTY, ...defaults };
}

export function fromBlock(block: EmailBlock): DraftBlock {
  const d = newBlock(block.type);
  d.align = block.align ?? "";
  switch (block.type) {
    case "heading":
      d.text = block.text;
      d.size = block.size ?? "lg";
      break;
    case "text":
      d.text = block.text;
      break;
    case "button":
      d.label = block.label;
      d.url = block.url;
      d.color = block.color ?? "";
      break;
    case "image":
      d.url = block.url;
      d.alt = block.alt ?? "";
      d.link = block.link ?? "";
      d.width = block.width ? String(block.width) : "";
      break;
  }
  return d;
}

/** Only the fields the server accepts for the block's type. */
export function toBlock(d: DraftBlock): EmailBlock {
  const align = d.align ? { align: d.align } : {};
  switch (d.type) {
    case "heading":
      return { type: "heading", text: d.text, ...(d.size === "md" ? { size: "md" } : {}), ...align };
    case "text":
      return { type: "text", text: d.text, ...align };
    case "button":
      return { type: "button", label: d.label.trim(), url: d.url.trim(), ...(d.color ? { color: d.color } : {}), ...align };
    case "image": {
      const width = Number.parseInt(d.width, 10);
      return {
        type: "image",
        url: d.url.trim(),
        ...(d.alt.trim() ? { alt: d.alt.trim() } : {}),
        ...(d.link.trim() ? { link: d.link.trim() } : {}),
        ...(d.width.trim() && Number.isFinite(width) ? { width } : {}),
        ...align,
      };
    }
    case "order_table":
      return { type: "order_table", ...align };
    case "divider":
      return { type: "divider" };
  }
}

// The server's link rule: http(s)://… or exactly one {{variable}}.
const LINK = /^(https?:\/\/\S+|\{\{\s*[a-z_]+\s*\}\})$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** What is wrong with a block, field by field; empty when it can be saved. */
export function blockProblems(d: DraftBlock): BlockProblems {
  const p: BlockProblems = {};
  if (d.type === "heading" || d.type === "text") {
    if (!d.text.trim()) p.text = "required";
    else if (d.text.length > 5000) p.text = "tooLong";
  }
  if (d.type === "button") {
    if (!d.label.trim()) p.label = "required";
    else if (d.label.trim().length > 80) p.label = "tooLong";
    if (!d.url.trim()) p.url = "required";
    else if (!LINK.test(d.url.trim())) p.url = "link";
    if (d.color && !HEX.test(d.color)) p.color = "color";
  }
  if (d.type === "image") {
    if (!d.url.trim()) p.url = "required";
    else if (!LINK.test(d.url.trim())) p.url = "imageUrl";
    if (d.link.trim() && !LINK.test(d.link.trim())) p.link = "link";
    if (d.alt.length > 200) p.alt = "tooLong";
    if (d.width.trim()) {
      const w = Number(d.width);
      if (!Number.isInteger(w) || w < 40 || w > 600) p.width = "width";
    }
  }
  return p;
}

export const hasProblems = (p: BlockProblems) => Object.keys(p).length > 0;

/**
 * "Designer" opened on a plain email: its body becomes a heading (the first
 * line) and a text block (the rest), so nothing the merchant wrote is lost.
 */
export function seedFromBody(body: string): DraftBlock[] {
  const trimmed = body.trim();
  if (!trimmed) return [newBlock("heading"), newBlock("text")];
  const [first, ...rest] = trimmed.split("\n");
  const heading = (first ?? "").trim();
  const text = rest.join("\n").trim();
  const blocks = [newBlock("heading", { text: heading })];
  if (text) blocks.push(newBlock("text", { text }));
  return blocks;
}

/** The link variables a button or image may point to, in the server's token list. */
export function linkTokens(tokens: string[]): string[] {
  return tokens.filter((t) => /_(link|url)$/.test(t));
}

/** Inserts `{{token}}` into `value` at the remembered caret, or at the end. */
export function insertToken(value: string, token: string, caret: { start: number; end: number } | null): { value: string; caret: number } {
  const text = `{{${token}}}`;
  const start = caret ? Math.min(caret.start, value.length) : value.length;
  const end = caret ? Math.min(Math.max(caret.end, start), value.length) : value.length;
  return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length };
}
