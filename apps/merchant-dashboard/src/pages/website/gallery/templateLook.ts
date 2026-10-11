import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { PreviewTheme } from "@/lib/previewBridge";
import { TEMPLATE_COLOR_SOURCE } from "../editor/storeLook";
import { ORIGINAL_LOOK, readThemeChoice, type StoreThemeKey } from "../editor/storeThemes";

const HEX = /^#[0-9a-f]{6}$/i;

type Blob = Record<string, unknown>;

function objectOf(value: unknown): Blob | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null;
}

/** A template's accent when it is a plain six-digit hex, else null. */
export function templateColour(raw: unknown): string | null {
  const colour = typeof raw === "string" ? raw.trim() : "";
  return HEX.test(colour) ? colour : null;
}

/**
 * Has the store a look of its own — a theme, or an accent the merchant chose?
 * Then a template's colour never replaces it (see TemplateSheet's
 * applyTemplateColour).
 */
export function storeHasOwnLook(themeSettings: Record<string, unknown> | undefined): boolean {
  const set = (key: string) => {
    const existing = themeSettings?.[key];
    return typeof existing === "string" && existing.trim() !== "";
  };
  return set("primaryColor") || set("primaryColorDark") || readThemeChoice(themeSettings?.storeTheme) !== ORIGINAL_LOOK;
}

/**
 * The store theme a template wears: `globalStyles.themeSettings.storeTheme`,
 * when it is one of the storefront's themes. Null for a template that brings
 * none, which is every template written before templates could.
 */
export function templateStoreTheme(globalStyles: unknown): StoreThemeKey | null {
  const choice = readThemeChoice(objectOf(objectOf(globalStyles)?.themeSettings)?.storeTheme);
  return choice === ORIGINAL_LOOK ? null : choice;
}

/**
 * The look a template's preview is drawn in, once its styles are known
 * (TemplateLivePreview's `themeFrom`). A template with a theme is drawn in
 * that theme alone: on a theme the store keeps the theme's own accent and a
 * template's colour is not painted over it (the storefront's brandVars), so
 * the preview sends no colour either. Without a theme, the look asked for.
 */
export function withTemplateTheme(theme: PreviewTheme, globalStyles: Record<string, unknown>): PreviewTheme {
  const storeTheme = templateStoreTheme(globalStyles);
  return storeTheme ? { storeTheme } : theme;
}

/**
 * The store's theme settings after it takes a template's look: whatever the
 * template's styles carry (`globalStyles.themeSettings` — a theme, the fuller
 * footer), then the template's colour, marked as the template's so a theme
 * still shows its own accent.
 *
 * A part that is itself a group of settings (the footer, the header) is laid
 * over the store's own key by key, so a template that only asks for the
 * fuller footer does not cost a store the footer links it already wrote.
 */
export function takeTemplateLook(current: Record<string, unknown>, globalStyles: unknown, colour: string): Record<string, unknown> {
  const next: Blob = { ...current };
  for (const [key, value] of Object.entries(objectOf(objectOf(globalStyles)?.themeSettings) ?? {})) {
    const mine = objectOf(current[key]);
    const theirs = objectOf(value);
    next[key] = mine && theirs ? { ...mine, ...theirs } : value;
  }
  next.primaryColor = colour;
  next.primaryColorSource = TEMPLATE_COLOR_SOURCE;
  return next;
}

/**
 * The look a template's preview renders in: what applying it would give this
 * store — the template's accent on a store with no look of its own, the
 * store's own look otherwise (null: as saved). The theme a template brings is
 * added once its styles are fetched (`withTemplateTheme`).
 */
export function useTemplatePreviewTheme(template: Pick<WebsiteTemplateSummary, "primaryColor">): PreviewTheme | null {
  const { currentWorkspace } = useWorkspace();
  const colour = templateColour(template.primaryColor);
  if (!colour || storeHasOwnLook(currentWorkspace?.themeSettings)) return null;
  return { primaryColor: colour };
}
