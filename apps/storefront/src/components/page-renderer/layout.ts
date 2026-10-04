/**
 * The look a section, a row or a column carries in its own `settings` — the
 * small amount of layout the website editor's block presets and its section
 * panel write (merchant-dashboard .../editor/blocks.ts: SECTION_SETTING_SPECS,
 * COLUMN_SETTING_SPECS, ROW_SETTING_SPECS).
 *
 * The backend never validates what is inside `settings` (pageTree.js checks
 * node structure only), so every table here is read exactly as defensively as
 * element props in props.ts: anything missing, misspelt or of the wrong type
 * falls through to the table's default entry, which IS the look every node
 * had before these existed. A page saved without settings renders identically
 * — `layout.test.mjs` pins those defaults.
 *
 * Tailwind cannot build a class from a runtime value, so each choice is a
 * whole class string, like COLUMN_CLASS / SPAN_CLASS. This module has no
 * imports on purpose: it is plain data, and Node can run its test directly.
 */

// --- section -----------------------------------------------------------------

/**
 * The ground a section sits on. The two strong ones, `primary` and `ink`,
 * also capture the two colours everything inside will be drawn in
 * (`--zs-bg` / `--zs-fg`); SECTION_TONE below re-points the storefront's own
 * colour tokens at them on the section's inner wrapper. That is why an
 * element never has to know what it sits on: `text-ink` on a heading is
 * `var(--color-ink)`, and inside a dark band that variable IS the paper
 * colour. Capturing on the outer element and re-pointing on the inner one is
 * what keeps the variables from referring to themselves.
 */
export const SECTION_BACKGROUND: Record<string, string> = {
  none: "",
  paper: "bg-paper",
  raised: "bg-paper-raised",
  "primary-soft": "bg-primary-soft",
  primary: "bg-primary [--zs-bg:var(--color-primary)] [--zs-fg:var(--color-on-primary)]",
  ink: "bg-ink [--zs-bg:var(--color-ink)] [--zs-fg:var(--color-paper)] [--zs-primary:var(--color-primary)]",
};

/**
 * The colour tokens as seen from inside a strong section. Text becomes the
 * foreground; the soft text, hairlines and card surfaces become tints of it,
 * so a testimonial card or an FAQ row reads as a quieter panel of the same
 * band instead of a white slab. On a brand-colour band the primary button
 * would vanish into its own ground, so primary and its foreground swap: the
 * button turns paper with brand-colour text, links follow it.
 *
 * Every class is written out in full: Tailwind finds classes by scanning
 * source text, so one built from a template string would never reach the
 * stylesheet.
 */
export const SECTION_TONE: Record<string, string> = {
  none: "",
  paper: "",
  raised: "",
  "primary-soft": "",
  primary: [
    "[--color-ink:var(--zs-fg)]",
    "[--color-ink-soft:color-mix(in_srgb,var(--zs-fg)_82%,transparent)]",
    "[--color-paper:color-mix(in_srgb,var(--zs-fg)_8%,transparent)]",
    "[--color-paper-raised:color-mix(in_srgb,var(--zs-fg)_12%,transparent)]",
    "[--color-line:color-mix(in_srgb,var(--zs-fg)_25%,transparent)]",
    "[--color-line-strong:color-mix(in_srgb,var(--zs-fg)_45%,transparent)]",
    "[--color-primary:var(--zs-fg)]",
    "[--color-on-primary:var(--zs-bg)]",
    "[--color-primary-dark:color-mix(in_srgb,var(--zs-fg)_85%,var(--zs-bg))]",
    "[--color-primary-soft:color-mix(in_srgb,var(--zs-fg)_15%,transparent)]",
  ].join(" "),
  // On the dark band the brand colour is lifted halfway towards the
  // foreground — what globals.css's `.dark` does to `primary-dark` for the
  // navy ground — so countdown digits, links and buttons keep contrast, and
  // a primary button carries the band's own dark colour as its text. The
  // soft tint (the countdown's box, the secondary button) goes translucent,
  // or the paper-coloured text inside it would sit on a light panel.
  ink: [
    "[--color-ink:var(--zs-fg)]",
    "[--color-ink-soft:color-mix(in_srgb,var(--zs-fg)_78%,transparent)]",
    "[--color-paper:color-mix(in_srgb,var(--zs-fg)_6%,transparent)]",
    "[--color-paper-raised:color-mix(in_srgb,var(--zs-fg)_10%,transparent)]",
    "[--color-line:color-mix(in_srgb,var(--zs-fg)_18%,transparent)]",
    "[--color-line-strong:color-mix(in_srgb,var(--zs-fg)_35%,transparent)]",
    "[--color-primary:color-mix(in_srgb,var(--zs-primary)_55%,var(--zs-fg))]",
    "[--color-primary-dark:var(--zs-primary)]",
    "[--color-on-primary:var(--zs-bg)]",
    "[--color-primary-soft:color-mix(in_srgb,var(--zs-fg)_12%,transparent)]",
  ].join(" "),
};

export const SECTION_PADDING: Record<string, string> = {
  normal: "py-10 sm:py-14",
  tight: "py-3 sm:py-4",
  compact: "py-6 sm:py-8",
  roomy: "py-16 sm:py-24",
};

export const SECTION_WIDTH: Record<string, string> = {
  normal: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

// --- row ---------------------------------------------------------------------

export const ROW_GAP: Record<string, string> = {
  normal: "gap-6",
  tight: "gap-3",
  loose: "gap-10",
};

// --- column ------------------------------------------------------------------

/**
 * A card is the same surface every card element already draws itself.
 * `zt-card` is a theme hook (globals.css): nothing without a store theme.
 */
export const COLUMN_SURFACE: Record<string, string> = {
  none: "",
  card: "zt-card rounded-2xl border border-line bg-paper-raised p-6",
};

/**
 * Centred text. Deliberately not `items-center`: a column is a stretching
 * flex container, and centring its items would shrink every block child —
 * a gallery grid, a form, an FAQ list — to its content width. Only the two
 * things that hug their content need moving: a button (`self-start`, see
 * ButtonElement) and a bare icon.
 */
export const COLUMN_ALIGN: Record<string, string> = {
  start: "",
  // The second svg rule only ever matches in the editor's preview, where each
  // element sits in a `display: contents` marker (PageRenderer's editable mode).
  center: "text-center [&_.self-start]:self-center [&>svg]:self-center [&>[data-zimos-el]>svg]:self-center",
};

/** Where a column sits when its neighbour is taller. Only from `md`, where columns sit side by side. */
export const COLUMN_LAYOUT: Record<string, string> = { stack: "flex-col", inline: "flex-row flex-wrap items-center" };
export const COLUMN_GAP: Record<string, string> = { tight: "gap-2", normal: "gap-4", loose: "gap-8" };
// Only side by side has a row to line up; stacked keeps its alignment setting.
export const COLUMN_JUSTIFY: Record<string, string> = { start: "", center: "[&.flex-row]:justify-center", between: "[&.flex-row]:justify-between", end: "[&.flex-row]:justify-end" };

export const COLUMN_VERTICAL: Record<string, string> = {
  start: "",
  center: "md:self-center",
  end: "md:self-end",
};

// --- readers -----------------------------------------------------------------

/** One setting as a class string; the `fallback` key whenever the stored value is unusable. */
export function settingClass(
  settings: unknown,
  key: string,
  table: Record<string, string>,
  fallback: string
): string {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return table[fallback];
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" && value in table ? table[value] : table[fallback];
}

/** The tallest minimum height a section may ask for, in px. */
export const MAX_SECTION_MIN_HEIGHT = 2000;

/**
 * A section's minimum height in px — what dragging the handle under a section
 * in the editor's preview sets — or null for its natural height, which is
 * every section written before this existed. Numbers only, clamped.
 */
export function sectionMinHeight(settings: unknown): number | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const raw = (settings as Record<string, unknown>).minHeight;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.min(MAX_SECTION_MIN_HEIGHT, Math.round(raw));
}

/**
 * Classes for the `<section>` and for the width wrapper inside it. A section
 * given a minimum height also centres its content vertically in the extra
 * room, the way a tall hero band reads; without one, the classes are exactly
 * what they always were.
 */
export function sectionClasses(settings: unknown): { outer: string; inner: string } {
  const background = settingClass(settings, "background", SECTION_BACKGROUND, "none");
  const tone = settingClass(settings, "background", SECTION_TONE, "none");
  const padding = settingClass(settings, "padding", SECTION_PADDING, "normal");
  const width = settingClass(settings, "width", SECTION_WIDTH, "normal");
  const tall = sectionMinHeight(settings) !== null ? " flex flex-col justify-center" : "";
  return {
    outer: `px-4 sm:px-6 ${padding} ${background}`.trimEnd() + tall,
    inner: `mx-auto flex flex-col gap-6 ${width} ${tone}`.trimEnd(),
  };
}

/** The value one setting resolves to — the table key, or `fallback` when unusable. */
function settingKey(settings: unknown, key: string, table: Record<string, string>, fallback: string): string {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fallback;
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" && value in table ? value : fallback;
}

/**
 * The attributes a store theme styles a section by (globals.css,
 * `[data-zt-section]`): its vertical space, which the theme scales to its own
 * density; its width, which follows the theme's container; and its
 * background, which a theme's hero leaves alone once the merchant has picked
 * one. Attributes rather than classes so the class strings above — and every
 * page rendered with them — stay exactly as they were. Without a theme
 * nothing reads them.
 */
export function sectionHooks(settings: unknown): Record<string, string> {
  const hooks: Record<string, string> = {
    "data-zt-section": "",
    "data-zt-pad": settingKey(settings, "padding", SECTION_PADDING, "normal"),
    "data-zt-width": settingKey(settings, "width", SECTION_WIDTH, "normal"),
  };
  const background = settingKey(settings, "background", SECTION_BACKGROUND, "none");
  if (background !== "none") hooks["data-zt-bg"] = background;
  return hooks;
}

/** Just enough of a page-tree node to walk it; everything is checked, never trusted. */
type Node = { rows?: unknown; columns?: unknown; elements?: unknown; type?: unknown; props?: unknown };

function children(node: unknown, key: "rows" | "columns" | "elements"): Node[] {
  if (!node || typeof node !== "object") return [];
  const list = (node as Node)[key];
  return Array.isArray(list) ? (list.filter((n) => n && typeof n === "object") as Node[]) : [];
}

function headingLevel(element: Node): number {
  const props = element.props && typeof element.props === "object" ? (element.props as Record<string, unknown>) : {};
  const level = Number(props.level);
  return Number.isFinite(level) ? level : 2;
}

/**
 * Whether a section reads as a page's opening: a top-level heading anywhere
 * in it, or a heading and a button sharing a column (the editor's plain
 * "Hero" block writes a level-2 heading, so the level alone would miss it).
 */
function isHeadline(section: unknown): boolean {
  for (const row of children(section, "rows")) {
    for (const column of children(row, "columns")) {
      const elements = children(column, "elements");
      if (elements.some((el) => el.type === "heading" && headingLevel(el) === 1)) return true;
      if (elements.some((el) => el.type === "heading") && elements.some((el) => el.type === "button")) return true;
    }
  }
  return false;
}

/**
 * Which section is the page's hero — the one a store theme lays out its own
 * way (globals.css, `[data-zimos-hero]`: its alignment, whitespace, heading
 * scale and picture treatment). Sections aren't typed, so it is read off the
 * content: the first of the page's first two sections that opens with a
 * headline. The second is allowed because a page often starts with a thin
 * announcement band or a claims strip. -1 when there is none, and nothing on
 * the page is treated as a hero.
 */
export function heroSectionIndex(sections: unknown): number {
  if (!Array.isArray(sections)) return -1;
  for (let i = 0; i < Math.min(2, sections.length); i++) {
    if (isHeadline(sections[i])) return i;
  }
  return -1;
}

export function rowClasses(settings: unknown): string {
  return `grid ${settingClass(settings, "gap", ROW_GAP, "normal")} md:grid-cols-12`;
}

/** Classes for one column, on top of its span class. */
export function columnClasses(settings: unknown, spanClass: string): string {
  const surface = settingClass(settings, "surface", COLUMN_SURFACE, "none");
  const align = settingClass(settings, "align", COLUMN_ALIGN, "start");
  const vertical = settingClass(settings, "verticalAlign", COLUMN_VERTICAL, "start");
  // A column is the "container" of SPEC §9.3: stacked, or side by side and wrapping.
  const layout = settingClass(settings, "layout", COLUMN_LAYOUT, "stack");
  const gap = settingClass(settings, "itemGap", COLUMN_GAP, "normal");
  const justify = settingClass(settings, "justify", COLUMN_JUSTIFY, "start");
  return `flex min-w-0 ${layout} ${gap} ${spanClass} ${surface} ${align} ${vertical} ${justify}`.replace(/\s+/g, " ").trimEnd();
}
