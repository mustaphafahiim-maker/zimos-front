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

/** A card is the same surface every card element already draws itself. */
export const COLUMN_SURFACE: Record<string, string> = {
  none: "",
  card: "rounded-2xl border border-line bg-paper-raised p-6",
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
  center: "text-center [&_.self-start]:self-center [&>svg]:self-center",
};

/** Where a column sits when its neighbour is taller. Only from `md`, where columns sit side by side. */
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

/** Classes for the `<section>` and for the width wrapper inside it. */
export function sectionClasses(settings: unknown): { outer: string; inner: string } {
  const background = settingClass(settings, "background", SECTION_BACKGROUND, "none");
  const tone = settingClass(settings, "background", SECTION_TONE, "none");
  const padding = settingClass(settings, "padding", SECTION_PADDING, "normal");
  const width = settingClass(settings, "width", SECTION_WIDTH, "normal");
  return {
    outer: `px-4 sm:px-6 ${padding} ${background}`.trimEnd(),
    inner: `mx-auto flex flex-col gap-6 ${width} ${tone}`.trimEnd(),
  };
}

export function rowClasses(settings: unknown): string {
  return `grid ${settingClass(settings, "gap", ROW_GAP, "normal")} md:grid-cols-12`;
}

/** Classes for one column, on top of its span class. */
export function columnClasses(settings: unknown, spanClass: string): string {
  const surface = settingClass(settings, "surface", COLUMN_SURFACE, "none");
  const align = settingClass(settings, "align", COLUMN_ALIGN, "start");
  const vertical = settingClass(settings, "verticalAlign", COLUMN_VERTICAL, "start");
  return `flex min-w-0 flex-col gap-4 ${spanClass} ${surface} ${align} ${vertical}`.replace(/\s+/g, " ").trimEnd();
}
