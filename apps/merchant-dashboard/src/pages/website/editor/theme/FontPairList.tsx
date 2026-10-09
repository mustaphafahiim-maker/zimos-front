import { useId, useState } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretDown } from "@/components/icons";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useEditorLocale } from "../editorLocale";
import { useStoreFonts } from "../FontSelect";
import { StoreFontsSection } from "../StoreFontsSection";
import { FONT_OPTIONS, type StoreLook } from "../storeLook";
import { ORIGINAL_LOOK, THEME_SPECS } from "../storeThemes";
import { FONT_PAIRS, FONT_SPECIMEN, googleStack, uploadedStack, useFontSpecimens } from "./fontPairs";
import { LookCheck, lookCardClass, lookTextButtonClass } from "./parts";
import { lookUi, themeUi } from "./themeLocale";

/** How many cards show before «خطوط أكتر». */
const SHORT_LIST = 6;

interface FontCard {
  id: string;
  name: string;
  /** The `font-family` the specimen is drawn in. */
  heading: string;
  weight: number;
  /** Set when the name can be drawn in the body face too (a face that is fully loaded). */
  body?: string;
  active: boolean;
  next: StoreLook;
}

/**
 * The store's type as a list of pairs, each drawn in its own face: the look's
 * built-in pairings (the original look) or the theme's own type, the store's
 * uploaded fonts, then ready Google pairs. Under «خطوط أكتر»: the rest of the
 * pairs, and the full controls — any Google font for body and for headings,
 * and uploading a font (StoreFontsSection).
 *
 * A built-in pairing is `fontFamily`; everything else is the `bodyFont` /
 * `headingFont` references that go over it — the two the storefront already
 * reads. Picking a built-in pairing therefore clears the references, or it
 * would not show.
 */
export function FontPairList({
  look,
  onChange,
  variant = "panel",
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
  variant?: "panel" | "sheet";
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const workspaceId = useWorkspaceId();
  const fonts = useStoreFonts();
  const uploaded = fonts.data ?? [];
  const moreId = useId();

  const original = look.storeTheme === ORIGINAL_LOOK;
  const bodyRef = look.bodyFont ?? "";
  const headingRef = look.headingFont ?? "";
  const own = bodyRef === "" && headingRef === "";

  useFontSpecimens(
    FONT_PAIRS.map((pair) => pair.heading),
    uploaded,
    workspaceId
  );

  const cards: FontCard[] = [];
  if (original) {
    for (const option of FONT_OPTIONS) {
      cards.push({
        id: `look:${option.value}`,
        name: ui.fontName(option.value),
        heading: option.heading,
        weight: 600,
        body: option.body,
        active: own && look.fontFamily === option.value,
        next: { ...look, fontFamily: option.value, bodyFont: "", headingFont: "" },
      });
    }
  } else {
    const spec = THEME_SPECS[look.storeTheme];
    cards.push({
      id: "theme",
      name: t.fontThemeOwn,
      heading: spec.fonts.display,
      weight: spec.fonts.displayWeight,
      active: own,
      next: { ...look, bodyFont: "", headingFont: "" },
    });
  }
  for (const font of uploaded) {
    const ref = `c:${font.id}`;
    cards.push({
      id: ref,
      name: font.name,
      heading: uploadedStack(font.id),
      weight: 600,
      body: uploadedStack(font.id),
      active: bodyRef === ref && headingRef === ref,
      next: { ...look, bodyFont: ref, headingFont: ref },
    });
  }
  for (const pair of FONT_PAIRS) {
    const heading = `g:${pair.heading}`;
    const body = `g:${pair.body}`;
    cards.push({
      id: `pair:${pair.key}`,
      name: pair.heading === pair.body ? pair.heading : t.fontPairName(pair.heading, pair.body),
      heading: googleStack(pair.heading),
      weight: pair.weight,
      active: headingRef === heading && bodyRef === body,
      next: { ...look, bodyFont: body, headingFont: heading },
    });
  }

  // A choice no card stands for (two different fonts picked by hand) lives in the full controls: open on them.
  const custom = !cards.some((card) => card.active);
  const [more, setMore] = useState(custom);
  const shown = more ? cards : cards.filter((card, index) => index < SHORT_LIST || card.active);

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={original ? ui.font : t.fontOverTheme}
        className={cn("grid gap-2", variant === "sheet" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}
      >
        {shown.map((card) => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={card.active}
            onClick={() => {
              if (!card.active) onChange(card.next);
            }}
            className={cn(lookCardClass, "min-h-[4.25rem] px-3 py-2.5")}
          >
            <span
              className="block truncate text-xl leading-tight text-ink"
              style={{ fontFamily: card.heading, fontWeight: card.weight }}
            >
              {FONT_SPECIMEN}
            </span>
            <span
              className="mt-1 block truncate pe-5 text-xs text-ink-soft"
              style={card.body ? { fontFamily: card.body } : undefined}
            >
              {card.name}
            </span>
            {card.active && <LookCheck className="absolute end-2 bottom-2" />}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-expanded={more}
        aria-controls={moreId}
        onClick={() => setMore((value) => !value)}
        className={cn(lookTextButtonClass, "gap-1")}
      >
        {more ? t.fontsLess : t.fontsMore}
        <IconCaretDown
          className={cn(
            "size-3.5 transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            more && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {more && (
        <div id={moreId}>
          <StoreFontsSection look={look} onChange={(next) => onChange(next, "look:fonts")} fonts={fonts} />
        </div>
      )}
    </div>
  );
}
