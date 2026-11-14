/**
 * The block email designer (backend notifications/emailBlocks.js): any order email — `abandoned_cart` included — can be built from
 * blocks instead of the plain body. The server renders and escapes them, so
 * the merchant never sends raw HTML. `blocks: null` goes back to the body.
 *
 * Same routes as endpoints/orderEmails.ts (workspace.manage); these calls
 * carry `blocks` and answer the template with them.
 *
 * Per funnel or website (item 175): every call takes an optional scope —
 * `?funnelId=` or `?websiteId=` (not both) — to read or write that funnel's
 * or website's own version of an email. An order uses its funnel's version,
 * else its website's, else the store's. Unknown funnel or website → 404.
 * All exported names are prefixed `orderEmailDesign` / `EmailBlock` /
 * `OrderEmailScope`.
 */
import type { ApiClient } from "../client";
import type { OrderEmailKey, OrderEmailPreview, OrderEmailTemplateDto } from "./orderEmails";

/** The email is right to left: `start` is the right edge. */
export type EmailBlockAlign = "start" | "center" | "end";

export interface EmailHeadingBlock {
  type: "heading";
  /** ≤5000, may hold `{{variables}}`. */
  text: string;
  size?: "lg" | "md";
  align?: EmailBlockAlign;
}

export interface EmailTextBlock {
  type: "text";
  /** A blank line starts a new paragraph. */
  text: string;
  align?: EmailBlockAlign;
}

export interface EmailButtonBlock {
  type: "button";
  /** ≤80. */
  label: string;
  /** https://… or a link variable such as `{{order_link}}`. */
  url: string;
  /** `#RRGGBB`; left out = the store's colour. */
  color?: string;
  align?: EmailBlockAlign;
}

export interface EmailImageBlock {
  type: "image";
  /** https://… */
  url: string;
  alt?: string;
  /** https://… or a link variable. */
  link?: string | null;
  /** 40–600 px; left out = full width. */
  width?: number;
  align?: EmailBlockAlign;
}

/** The order's lines × quantity with shipping and total (the cart's lines for cart recovery). */
export interface EmailOrderTableBlock {
  type: "order_table";
  align?: EmailBlockAlign;
}

export interface EmailDividerBlock {
  type: "divider";
  align?: EmailBlockAlign;
}

export type EmailBlock = EmailHeadingBlock | EmailTextBlock | EmailButtonBlock | EmailImageBlock | EmailOrderTableBlock | EmailDividerBlock;
export type EmailBlockType = EmailBlock["type"];

/** An email holds 1–40 blocks. */
export const EMAIL_BLOCKS_MAX = 40;

/**
 * A template as the designer sees it: `blocks` null when the plain body is
 * used. In a funnel's or website's list, `overridden` says whether it has its
 * own version (else the store's applies); an override's empty subject or
 * body comes from the store's version. Its blocks come from the store's only
 * while it never set any: one saved with `blocks: null` is plain text of its
 * own (`overridden: true`, `blocks: null` — frontend request 2026-10-06).
 */
export type OrderEmailDesignTemplate = OrderEmailTemplateDto & { blocks: EmailBlock[] | null; overridden?: boolean };

/** One funnel's or one website's emails; none = the store's. */
export type OrderEmailScope = { funnelId: string; websiteId?: never } | { websiteId: string; funnelId?: never };

export interface OrderEmailDesignList {
  /** `funnel:<id>` / `website:<id>`, null for the store's set. */
  scope?: string | null;
  templates: OrderEmailDesignTemplate[];
  /** The `{{token}}` names a subject, body or block may use. */
  tokens: string[];
}

export interface OrderEmailDesignDraft {
  subject?: string;
  body?: string;
  /** Unsaved blocks; null previews / sends the plain body. */
  blocks?: EmailBlock[] | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/order-emails`;
const scoped = (scope?: OrderEmailScope) =>
  scope?.funnelId ? `?funnelId=${encodeURIComponent(scope.funnelId)}` : scope?.websiteId ? `?websiteId=${encodeURIComponent(scope.websiteId)}` : "";

export async function orderEmailDesignList(client: ApiClient, workspaceId: string, scope?: OrderEmailScope): Promise<OrderEmailDesignList> {
  return client.request<OrderEmailDesignList>(`${base(workspaceId)}${scoped(scope)}`);
}

/**
 * `blocks` (1–40) switches the email to the designer; `blocks: null` goes
 * back to the plain body. Unknown fields or a bad link → 422 naming the
 * block (`blocks.0.url`). With a scope it creates or updates that funnel's or
 * website's version (a new one starts with the store's on/off) and answers
 * the merged template with `overridden: true`; there `blocks: null` keeps
 * that version in its own plain subject + body, even when the store's email
 * is designed (preview, test and real sends alike).
 */
export async function orderEmailDesignSave(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  patch: { isEnabled?: boolean; subject?: string | null; body?: string | null; blocks?: EmailBlock[] | null },
  scope?: OrderEmailScope
): Promise<OrderEmailDesignTemplate> {
  const { template } = await client.request<{ template: OrderEmailDesignTemplate }>(`${base(workspaceId)}/${key}${scoped(scope)}`, { method: "PUT", body: patch });
  return template;
}

/** Renders the unsaved draft with sample values (two products, shipping, total). */
export async function orderEmailDesignPreview(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft = {},
  scope?: OrderEmailScope
): Promise<OrderEmailPreview> {
  return client.request<OrderEmailPreview>(`${base(workspaceId)}/${key}/preview${scoped(scope)}`, { method: "POST", body: draft });
}

/** Sends the unsaved draft with sample values — to the caller's own address unless `to` is given. */
export async function orderEmailDesignSendTest(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft & { to?: string } = {},
  scope?: OrderEmailScope
): Promise<{ ok: boolean; error: string | null; to: string }> {
  return client.request(`${base(workspaceId)}/${key}/test${scoped(scope)}`, { method: "POST", body: draft });
}
