/**
 * The block email designer (backend notifications/emailBlocks.js, handoff
 * item 174): any order email — `abandoned_cart` included — can be built from
 * blocks instead of the plain body. The server renders and escapes them, so
 * the merchant never sends raw HTML. `blocks: null` goes back to the body.
 *
 * Same routes as endpoints/orderEmails.ts (workspace.manage); these calls
 * carry `blocks` and answer the template with them. All exported names are
 * prefixed `orderEmailDesign` / `EmailBlock`.
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

/** A template as the designer sees it: `blocks` null when the plain body is used. */
export type OrderEmailDesignTemplate = OrderEmailTemplateDto & { blocks: EmailBlock[] | null };

export interface OrderEmailDesignList {
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

export async function orderEmailDesignList(client: ApiClient, workspaceId: string): Promise<OrderEmailDesignList> {
  return client.request<OrderEmailDesignList>(base(workspaceId));
}

/**
 * `blocks` (1–40) switches the email to the designer; `blocks: null` goes
 * back to the plain body. Unknown fields or a bad link → 422 naming the
 * block (`blocks.0.url`).
 */
export async function orderEmailDesignSave(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  patch: { isEnabled?: boolean; subject?: string | null; body?: string | null; blocks?: EmailBlock[] | null }
): Promise<OrderEmailDesignTemplate> {
  const { template } = await client.request<{ template: OrderEmailDesignTemplate }>(`${base(workspaceId)}/${key}`, { method: "PUT", body: patch });
  return template;
}

/** Renders the unsaved draft with sample values (two products, shipping, total). */
export async function orderEmailDesignPreview(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft = {}
): Promise<OrderEmailPreview> {
  return client.request<OrderEmailPreview>(`${base(workspaceId)}/${key}/preview`, { method: "POST", body: draft });
}

/** Sends the unsaved draft with sample values — to the caller's own address unless `to` is given. */
export async function orderEmailDesignSendTest(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft & { to?: string } = {}
): Promise<{ ok: boolean; error: string | null; to: string }> {
  return client.request(`${base(workspaceId)}/${key}/test`, { method: "POST", body: draft });
}
