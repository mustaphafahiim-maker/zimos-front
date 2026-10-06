/**
 * Store scripts — named snippets of the merchant's own code, each placed in
 * <head>, right after <body> opens or before </body>, and run only on the page
 * types it names (backend customCode/storeScripts.js). Same rules as the
 * custom code slots: website.publish to read or write, every change audited,
 * never served to a staff preview, run only on the store's own host and never
 * on the card payment pages.
 *
 *   GET    /workspaces/:workspaceId/custom-code/store-scripts        → { scripts, options }
 *   POST   /workspaces/:workspaceId/custom-code/store-scripts        → 201 { script }
 *   PATCH  /workspaces/:workspaceId/custom-code/store-scripts/:id    → { script }  (any field, at least one)
 *   DELETE /workspaces/:workspaceId/custom-code/store-scripts/:id    → { deleted, id }
 *
 * The public GET /store/:workspaceId/custom-code also carries `scripts`
 * (active, non-empty, in order; `[]` in a preview).
 *
 * Codes: VALIDATION_ERROR (422, details [{ field, message }]; also "A store
 * keeps at most 30 scripts"), NOT_FOUND (404), FORBIDDEN (403).
 */
import type { ApiClient } from "../client";
import type { CustomCodeSlotKey } from "./storeDesign";

export type StoreScriptPosition = "head" | "body_start" | "body_end";
export type StoreScriptPageType = "all" | "home" | "collection" | "product" | "page" | "funnel" | "cart" | "checkout" | "thank_you";

export const STORE_SCRIPT_POSITIONS: readonly StoreScriptPosition[] = ["head", "body_start", "body_end"];
export const STORE_SCRIPT_PAGE_TYPES: readonly StoreScriptPageType[] = [
  "all",
  "home",
  "collection",
  "product",
  "page",
  "funnel",
  "cart",
  "checkout",
  "thank_you",
];

export interface StoreScript {
  id: string;
  name: string;
  position: StoreScriptPosition;
  pages: StoreScriptPageType[];
  code: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface StoreScriptsOptions {
  positions: StoreScriptPosition[];
  pageTypes: StoreScriptPageType[];
  maxScripts: number;
  maxCodeLength: number;
}

export const STORE_SCRIPTS_DEFAULT_OPTIONS: StoreScriptsOptions = {
  positions: [...STORE_SCRIPT_POSITIONS],
  pageTypes: [...STORE_SCRIPT_PAGE_TYPES],
  maxScripts: 30,
  maxCodeLength: 50000,
};

export interface StoreScriptInput {
  name: string;
  position: StoreScriptPosition;
  /** Defaults to ["all"]; "all" with others collapses to ["all"]. */
  pages?: StoreScriptPageType[];
  code: string;
  isActive?: boolean;
  sortOrder?: number;
}

function base(workspaceId: string) {
  return `/workspaces/${workspaceId}/custom-code/store-scripts`;
}

export async function storeScriptsList(
  client: ApiClient,
  workspaceId: string
): Promise<{ scripts: StoreScript[]; options: StoreScriptsOptions }> {
  const body = await client.request<{ scripts?: StoreScript[]; options?: Partial<StoreScriptsOptions> }>(base(workspaceId));
  return { scripts: body.scripts ?? [], options: { ...STORE_SCRIPTS_DEFAULT_OPTIONS, ...(body.options ?? {}) } };
}

export async function storeScriptsCreate(client: ApiClient, workspaceId: string, input: StoreScriptInput): Promise<StoreScript> {
  const { script } = await client.request<{ script: StoreScript }>(base(workspaceId), { method: "POST", body: input });
  return script;
}

export async function storeScriptsUpdate(
  client: ApiClient,
  workspaceId: string,
  id: string,
  patch: Partial<StoreScriptInput>
): Promise<StoreScript> {
  const { script } = await client.request<{ script: StoreScript }>(`${base(workspaceId)}/${id}`, { method: "PATCH", body: patch });
  return script;
}

export async function storeScriptsDelete(client: ApiClient, workspaceId: string, id: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${id}`, { method: "DELETE" });
}

/** A script as the live store gets it. */
export interface StorefrontStoreScript {
  id: string;
  position: StoreScriptPosition;
  pages: StoreScriptPageType[];
  code: string;
}

/** The live store's code in one call: the slots ({ slot: code }) and the scripts; both empty for a staff preview. */
export async function storefrontStoreCode(
  client: ApiClient,
  workspaceId: string
): Promise<{ slots: Partial<Record<CustomCodeSlotKey, string>>; scripts: StorefrontStoreScript[] }> {
  const body = await client.request<{ slots?: Partial<Record<CustomCodeSlotKey, string>>; scripts?: StorefrontStoreScript[] }>(
    `/store/${workspaceId}/custom-code`,
    { auth: false }
  );
  return { slots: body.slots ?? {}, scripts: Array.isArray(body.scripts) ? body.scripts : [] };
}
