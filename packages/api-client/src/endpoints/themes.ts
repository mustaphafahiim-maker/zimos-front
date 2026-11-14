import type { ApiClient } from "../client";

/** A store theme in the platform catalog (themes/themesCatalog.js). The theme itself is storefront code; this describes it. */
export interface CatalogTheme {
  key: string;
  name: { en?: string; ar?: string };
  description: { en?: string; ar?: string };
  kind: "store" | "landing";
  category: string;
  tags: string[];
  previewImages: string[];
  /** Null = free. Set by the platform console; paid themes can't be bought yet. */
  price: { amount: number; currency: string } | null;
  position: number;
  isActive: boolean;
  /** Merchant view: free, or already the store's. */
  owned?: boolean;
  current?: boolean;
  /** Console view: stores using it. */
  stores?: number;
}

export async function themesList(client: ApiClient, workspaceId: string): Promise<{ current: string; themes: CatalogTheme[] }> {
  return client.request(`/workspaces/${workspaceId}/themes`);
}

/** 402 THEME_PURCHASE_UNAVAILABLE for a paid theme the store doesn't own; 422 THEME_UNAVAILABLE for a withdrawn one. */
export async function themeActivate(client: ApiClient, workspaceId: string, key: string): Promise<{ current: string; themes: CatalogTheme[] }> {
  return client.request(`/workspaces/${workspaceId}/themes/${encodeURIComponent(key)}/activate`, { method: "POST" });
}

// --- platform console ---------------------------------------------------------

export async function adminThemesList(client: ApiClient): Promise<CatalogTheme[]> {
  const { themes } = await client.request<{ themes: CatalogTheme[] }>(`/admin/themes`);
  return themes;
}

export async function adminThemeUpdate(
  client: ApiClient,
  key: string,
  patch: Partial<Pick<CatalogTheme, "name" | "description" | "kind" | "category" | "tags" | "previewImages" | "position" | "isActive" | "price">>
): Promise<CatalogTheme> {
  const { theme } = await client.request<{ theme: CatalogTheme }>(`/admin/themes/${encodeURIComponent(key)}`, { method: "PATCH", body: patch });
  return theme;
}

/**
 * "Reset" on the current theme: drops the look tuned on top of it (accent
 * colours, second colour, font, corners); the theme, logo and header/footer
 * content stay (themes/themeReset.js). Live at once. Needs website.edit.
 */
export async function themeResetCurrent(client: ApiClient, workspaceId: string): Promise<{ themeSettings: Record<string, unknown>; cleared: string[] }> {
  return client.request(`/workspaces/${workspaceId}/themes/current/reset`, { method: "POST" });
}
