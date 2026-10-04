/**
 * Custom HTML blocks (backend customCode/htmlBlocks.js, SPEC §8.2 / §8.4): the
 * page tree's `html_block` element names a block; its HTML is kept outside
 * the tree and edited here (website.publish, audited). It goes live at once,
 * on the store's own host only, without a publish.
 *
 *   GET /workspaces/:id/custom-code/html-blocks/:blockId
 *   PUT /workspaces/:id/custom-code/html-blocks/:blockId   { html, isActive }
 */
import type { ApiClient } from "../client";

export interface HtmlBlock {
  blockId: string;
  html: string;
  isActive: boolean;
  updatedAt: string | null;
}

/** 8–24 lowercase letters or digits, as the page tree checks it. */
export function newHtmlBlockId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-3);
}

export async function htmlBlockGet(client: ApiClient, workspaceId: string, blockId: string): Promise<HtmlBlock> {
  const { block } = await client.request<{ block: HtmlBlock }>(`/workspaces/${workspaceId}/custom-code/html-blocks/${blockId}`);
  return block;
}

export async function htmlBlockSave(client: ApiClient, workspaceId: string, blockId: string, input: { html: string; isActive: boolean }): Promise<HtmlBlock> {
  const { block } = await client.request<{ block: HtmlBlock }>(`/workspaces/${workspaceId}/custom-code/html-blocks/${blockId}`, { method: "PUT", body: input });
  return block;
}
