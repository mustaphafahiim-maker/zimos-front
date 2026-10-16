import type { BlogBlock, BlogBlockType, BlogPost, BlogPostInput } from "@store-builder/api-client";

/**
 * The post editor's working copy (BlogPostEditorPage, BlogBlockEditor). Every
 * block is one flat record of strings so a form can edit any field; `toBlock`
 * sends only the fields the server accepts for that type (an extra field is
 * a 422), and `blockProblems` mirrors the server's rules (backend
 * modules/blog/index.js) so mistakes show before saving.
 */
export interface DraftBlock {
  id: string;
  type: BlogBlockType;
  /** heading / paragraph / quote */
  text: string;
  /** heading: 2 (large) or 3 (small) */
  level: 2 | 3;
  /** image source, button link */
  url: string;
  /** image */
  alt: string;
  caption: string;
  /** list: one item per line */
  items: string;
  ordered: boolean;
  /** quote */
  cite: string;
  /** product */
  productId: string;
  /** button */
  label: string;
}

export type BlockField = "text" | "url" | "alt" | "caption" | "items" | "cite" | "productId" | "label";
export type BlockProblem = "required" | "tooLong" | "imageUrl" | "link" | "product" | "tooMany" | "server";
export type BlockProblems = Partial<Record<BlockField, BlockProblem>>;

let counter = 0;
const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

const EMPTY: Omit<DraftBlock, "id" | "type"> = {
  text: "",
  level: 2,
  url: "",
  alt: "",
  caption: "",
  items: "",
  ordered: false,
  cite: "",
  productId: "",
  label: "",
};

export function newBlock(type: BlogBlockType, defaults: Partial<DraftBlock> = {}): DraftBlock {
  return { id: newId(), type, ...EMPTY, ...defaults };
}

export function fromBlock(block: BlogBlock): DraftBlock {
  const d = newBlock(block.type);
  switch (block.type) {
    case "heading":
      d.text = block.text;
      d.level = block.level === 3 ? 3 : 2;
      break;
    case "paragraph":
      d.text = block.text;
      break;
    case "quote":
      d.text = block.text;
      d.cite = block.cite ?? "";
      break;
    case "image":
      d.url = block.url;
      d.alt = block.alt ?? "";
      d.caption = block.caption ?? "";
      break;
    case "list":
      d.items = (block.items ?? []).join("\n");
      d.ordered = block.ordered === true;
      break;
    case "product":
      d.productId = block.productId;
      break;
    case "button":
      d.label = block.label;
      d.url = block.url;
      break;
  }
  return d;
}

export const listItems = (d: Pick<DraftBlock, "items">) =>
  d.items
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Only the fields the server accepts for the block's type. */
export function toBlock(d: DraftBlock): BlogBlock {
  switch (d.type) {
    case "heading":
      return { type: "heading", text: d.text.trim(), level: d.level };
    case "paragraph":
      return { type: "paragraph", text: d.text.trim() };
    case "quote":
      return { type: "quote", text: d.text.trim(), cite: d.cite.trim() };
    case "image":
      return { type: "image", url: d.url.trim(), alt: d.alt.trim(), caption: d.caption.trim() };
    case "list":
      return { type: "list", items: listItems(d), ordered: d.ordered };
    case "product":
      return { type: "product", productId: d.productId };
    case "button":
      return { type: "button", label: d.label.trim(), url: d.url.trim() };
    case "divider":
      return { type: "divider" };
  }
}

const HTTPS = /^https:\/\/[^\s]+$/i;
/** A button goes to an https:// page or one of the store's own paths ("/products"). */
const LINK = /^(https:\/\/[^\s]+|\/[^\s]{0,500})$/i;

export const isHttpsUrl = (value: string) => HTTPS.test(value.trim());

/** What is wrong with a block, field by field; empty when it can be saved. */
export function blockProblems(d: DraftBlock): BlockProblems {
  const p: BlockProblems = {};
  if (d.type === "heading" || d.type === "paragraph" || d.type === "quote") {
    // An empty paragraph is simply left out (savableBlocks), never refused.
    if (!d.text.trim()) {
      if (d.type !== "paragraph") p.text = "required";
    }
    else if (d.text.trim().length > 10000) p.text = "tooLong";
  }
  if (d.type === "quote" && d.cite.trim().length > 200) p.cite = "tooLong";
  if (d.type === "image") {
    if (!d.url.trim()) p.url = "required";
    else if (!HTTPS.test(d.url.trim()) || d.url.trim().length > 1000) p.url = "imageUrl";
    if (d.alt.trim().length > 200) p.alt = "tooLong";
    if (d.caption.trim().length > 300) p.caption = "tooLong";
  }
  if (d.type === "list") {
    const items = listItems(d);
    if (items.length === 0) p.items = "required";
    else if (items.length > 50) p.items = "tooMany";
    else if (items.some((item) => item.length > 1000)) p.items = "tooLong";
  }
  if (d.type === "product" && !d.productId) p.productId = "product";
  if (d.type === "button") {
    if (!d.label.trim()) p.label = "required";
    else if (d.label.trim().length > 80) p.label = "tooLong";
    if (!d.url.trim()) p.url = "required";
    else if (!LINK.test(d.url.trim())) p.url = "link";
  }
  return p;
}

export const hasProblems = (p: BlockProblems) => Object.keys(p).length > 0;

/** The post as the form holds it. */
export interface PostDraft {
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  authorName: string;
  tags: string[];
  categoryId: string;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  blocks: DraftBlock[];
}

export const EMPTY_POST: PostDraft = {
  title: "",
  slug: "",
  excerpt: "",
  coverUrl: "",
  authorName: "",
  tags: [],
  categoryId: "",
  seoTitle: "",
  seoDescription: "",
  noindex: false,
  blocks: [],
};

export function draftOf(post: BlogPost): PostDraft {
  return {
    title: post.title ?? "",
    slug: post.slug ?? "",
    excerpt: post.excerpt ?? "",
    coverUrl: post.coverUrl ?? "",
    authorName: post.authorName ?? "",
    tags: post.tags ?? [],
    categoryId: post.category?.id ?? "",
    seoTitle: post.seo?.title ?? "",
    seoDescription: post.seo?.description ?? "",
    noindex: post.seo?.noindex === true,
    blocks: (post.blocks ?? []).map(fromBlock),
  };
}

/**
 * The blocks that are sent: an untouched empty paragraph (a new post starts
 * with one, ready to type in) is left out rather than refused.
 */
export const savableBlocks = (blocks: DraftBlock[]) => blocks.filter((b) => !(b.type === "paragraph" && !b.text.trim()));

/** Everything but the publishing state, ready for POST / PATCH. */
export function inputOf(d: PostDraft): BlogPostInput & { title: string } {
  return {
    title: d.title.trim(),
    slug: d.slug.trim(),
    excerpt: d.excerpt.trim() || null,
    coverUrl: d.coverUrl.trim() || null,
    authorName: d.authorName.trim() || null,
    tags: d.tags,
    categoryId: d.categoryId || null,
    seo: { title: d.seoTitle.trim(), description: d.seoDescription.trim(), noindex: d.noindex },
    blocks: savableBlocks(d.blocks).map(toBlock),
  };
}

/** A stable fingerprint of what would be sent, for the "unsaved changes" check. */
export const fingerprint = (d: PostDraft) => JSON.stringify(inputOf(d));

export type PostField = "title" | "slug" | "excerpt" | "coverUrl" | "authorName" | "tags" | "seoTitle" | "seoDescription";

/** The post's own fields that need fixing before a save. */
export function postProblems(d: PostDraft): Partial<Record<PostField, BlockProblem>> {
  const p: Partial<Record<PostField, BlockProblem>> = {};
  if (!d.title.trim()) p.title = "required";
  else if (d.title.trim().length > 200) p.title = "tooLong";
  if (d.slug.trim().length > 200) p.slug = "tooLong";
  if (d.excerpt.trim().length > 500) p.excerpt = "tooLong";
  if (d.coverUrl.trim() && !isHttpsUrl(d.coverUrl)) p.coverUrl = "imageUrl";
  if (d.authorName.trim().length > 120) p.authorName = "tooLong";
  if (d.seoTitle.trim().length > 200) p.seoTitle = "tooLong";
  if (d.seoDescription.trim().length > 500) p.seoDescription = "tooLong";
  return p;
}

/** `datetime-local` value (the viewer's own clock) for an ISO time, and back. */
export function localInputOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isoOfLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Tomorrow at 10:00 on the viewer's clock — a first guess for a scheduled post. */
export function defaultScheduleInput(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return localInputOf(date.toISOString());
}
