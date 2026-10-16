import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { PreviewTheme } from "@/lib/previewBridge";
import { TEMPLATE_COLOR_SOURCE } from "../editor/storeLook";
import { ORIGINAL_LOOK, THEME_SPECS, readThemeChoice, type StoreThemeKey } from "../editor/storeThemes";

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
 * (TemplateLivePreview's `themeFrom`).
 *
 * A template that wears a theme is always shown in it, whatever the store's
 * own look: the preview is of the template. The theme goes with its own two
 * accents, spelled out, because a store's saved accent would otherwise stay on
 * the page under the theme. (Taking the template is another matter: a store
 * with a look of its own keeps it, and the sheet says so.)
 *
 * A template with no theme keeps the rule it always had: the look asked for,
 * which is its colour on a store with no look of its own and nothing otherwise.
 */
export function withTemplateTheme(theme: PreviewTheme | null, globalStyles: Record<string, unknown>): PreviewTheme | null {
  const storeTheme = templateStoreTheme(globalStyles);
  if (!storeTheme) return theme;
  const { light, dark } = THEME_SPECS[storeTheme].palette;
  return { storeTheme, primaryColor: light.accent, primaryColorDark: dark.accent };
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
 * The imported template ("xs" look) a template is: `globalStyles.themeSettings.xsLook`,
 * or null for one of Zimos's own. Such a template is its header and footer as
 * much as its pages (storefront components/xs), so it is taken whole.
 */
export function templateXsLook(globalStyles: unknown): string | null {
  const look = objectOf(objectOf(globalStyles)?.themeSettings)?.xsLook;
  return typeof look === "string" && look.trim() !== "" ? look : null;
}

/**
 * The store's theme settings after it takes an imported template: the
 * template's shell — its look, menu, notice and footer columns — laid over
 * the store's own, whatever look the store had. A store theme is dropped with
 * it: the two would both dress the same header and headings.
 */
export function takeXsShell(current: Record<string, unknown>, globalStyles: unknown, colour: string | null): Record<string, unknown> {
  const next = takeTemplateLook(current, globalStyles, colour ?? "");
  if (!colour) {
    if ("primaryColor" in current) next.primaryColor = current.primaryColor;
    else delete next.primaryColor;
    if ("primaryColorSource" in current) next.primaryColorSource = current.primaryColorSource;
    else delete next.primaryColorSource;
  }
  delete next.storeTheme;
  return next;
}

/** The settings without an imported template's shell, or null when the store wears none. */
export function dropXsShell(current: Record<string, unknown>): Record<string, unknown> | null {
  if (!("xsLook" in current)) return null;
  const next = { ...current };
  delete next.xsLook;
  return next;
}

/**
 * The look a template's preview renders in: what applying it would give this
 * store — the template's accent on a store with no look of its own, the
 * store's own look otherwise (null: as saved). A template that wears a theme
 * is drawn in that theme instead, once its styles are fetched
 * (`withTemplateTheme`).
 */
export function useTemplatePreviewTheme(template: Pick<WebsiteTemplateSummary, "primaryColor">): PreviewTheme | null {
  const { currentWorkspace } = useWorkspace();
  const colour = templateColour(template.primaryColor);
  if (!colour || storeHasOwnLook(currentWorkspace?.themeSettings)) return null;
  return { primaryColor: colour };
}
