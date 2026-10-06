/**
 * Store texts — the storefront's own labels (buttons, form errors, cart,
 * checkout, bundle wording) reworded by the merchant per language
 * (backend storefront/storefrontTexts.js). Only the overrides are stored; the
 * defaults stay in the storefront's dictionary (apps/storefront/src/lib/i18n.ts).
 *
 *   GET /workspaces/:workspaceId/storefront-texts   (website.edit)
 *   PUT /workspaces/:workspaceId/storefront-texts   (website.edit) — replaces every override
 *
 * Keys are dictionary paths ("checkout.place", "form.errors.summary"). A blank
 * text drops the override. `{name}` placeholders are kept as written; the
 * storefront fills them for texts that take a value (`{n}`, `{amount}` …).
 * A 422 VALIDATION_ERROR carries `details: [{ path: "ar.checkout.place", message }]`.
 *
 * The public GET /store/:workspaceId carries the same object as `storefrontTexts`.
 */
import { ApiError, type ApiClient } from "../client";

/** Language → dictionary path → the merchant's text. */
export type StorefrontTexts = Record<string, Record<string, string>>;

export interface StorefrontTextsLimits {
  maxKeysPerLocale: number;
  maxText: number;
  locales: string[];
}

export interface StorefrontTextsState {
  texts: StorefrontTexts;
  limits: StorefrontTextsLimits;
}

export const STOREFRONT_TEXTS_DEFAULT_LIMITS: StorefrontTextsLimits = {
  maxKeysPerLocale: 400,
  maxText: 500,
  locales: ["ar", "en", "fr", "es", "it", "de"],
};

function normalise(body: Partial<StorefrontTextsState> | null | undefined): StorefrontTextsState {
  return {
    texts: body?.texts && typeof body.texts === "object" ? body.texts : {},
    limits: { ...STOREFRONT_TEXTS_DEFAULT_LIMITS, ...(body?.limits ?? {}) },
  };
}

export async function storefrontTextsGet(client: ApiClient, workspaceId: string): Promise<StorefrontTextsState> {
  return normalise(await client.request<StorefrontTextsState>(`/workspaces/${workspaceId}/storefront-texts`));
}

/** Sends the whole object; texts left out (or blank) go back to the default. */
export async function storefrontTextsSave(client: ApiClient, workspaceId: string, texts: StorefrontTexts): Promise<StorefrontTextsState> {
  return normalise(
    await client.request<StorefrontTextsState>(`/workspaces/${workspaceId}/storefront-texts`, { method: "PUT", body: { texts } })
  );
}

/** A save's 422 problems as `{ "ar.checkout.place": message }`; empty for any other failure. */
export function storefrontTextsErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422) return {};
  const details = (err.details as { error?: { details?: unknown } } | undefined)?.error?.details;
  const out: Record<string, string> = {};
  if (!Array.isArray(details)) return out;
  for (const d of details as Array<{ path?: unknown; message?: unknown }>) {
    if (typeof d?.path === "string" && !out[d.path]) out[d.path] = typeof d.message === "string" ? d.message : "";
  }
  return out;
}

/** The store's text overrides as the public store answer carries them (`{}` when none). */
export function storefrontTextsOf(store: unknown): StorefrontTexts {
  const texts = (store as { storefrontTexts?: unknown } | null)?.storefrontTexts;
  return texts && typeof texts === "object" && !Array.isArray(texts) ? (texts as StorefrontTexts) : {};
}
