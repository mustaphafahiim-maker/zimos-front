import type { CSSProperties } from "react";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import type { Dictionary } from "@/lib/i18n";
import { compareRows, str, strList, type Props } from "./props";

/**
 * Two plain storefront sections: a strip of short claims that slides, and an
 * "us vs them" table.
 *
 * Unlike the immersive ones next door these fetch nothing and run nothing —
 * they are ordinary server components that draw the merchant's own words. The
 * marquee moves entirely in CSS (the `.zimos-marquee` block in globals.css),
 * so there is no client bundle, no hydration and nothing to fall back from:
 * `prefers-reduced-motion` turns it into a static wrapping row in the
 * stylesheet itself.
 *
 * Both render nothing at all when the merchant hasn't written anything yet, so
 * a half-filled block never shows a shopper an empty frame.
 */

/**
 * Seconds per claim, so a strip of three and a strip of twelve travel at the
 * same speed rather than the same rate. Tailwind can't build a class from a
 * runtime value and this is a duration, not a class, so it rides in on a
 * custom property the stylesheet reads.
 */
const MARQUEE_SECONDS_PER_ITEM: Record<string, number> = {
  normal: 4.5,
  slow: 7,
  fast: 2.75,
};

/** Each claim's own skin. The first entry is the quiet default. */
const MARQUEE_TONE: Record<string, string> = {
  line: "text-sm font-medium text-ink-soft",
  primary:
    "rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary",
};

/** One copy of the claims. Rendered twice; the second copy is decorative. */
function MarqueeRow({ items, tone, copy }: { items: string[]; tone: string; copy?: boolean }) {
  // One copy has to be at least as wide as the screen, or the loop runs off
  // the end of the second copy and shows a bare patch. `space-around` then
  // spreads a short list over that width instead of leaving a slab of empty
  // paper after it.
  return (
    <ul
      className={`zimos-marquee-row flex min-w-[100vw] items-center justify-around gap-x-8 gap-y-3 ${
        copy ? "zimos-marquee-copy" : ""
      }`}
      aria-hidden={copy || undefined}
    >
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex shrink-0 items-center gap-8">
          <span className={tone}>{item}</span>
          {/* A separating dot between claims, never before the first one. */}
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-line" />
        </li>
      ))}
    </ul>
  );
}

/** `marquee` — short claims on a loop, in the merchant's own words. */
export function MarqueeElement({ props }: { props: Props }) {
  const items = strList(props, "items");
  if (items.length === 0) return null;

  const perItem =
    MARQUEE_SECONDS_PER_ITEM[str(props, "speed")] ?? MARQUEE_SECONDS_PER_ITEM.normal;
  const tone = MARQUEE_TONE[str(props, "tone")] ?? MARQUEE_TONE.line;

  return (
    <div className="zimos-marquee -mx-4 sm:-mx-6">
      <div
        className="zimos-marquee-track"
        style={{ "--zimos-marquee-duration": `${(items.length * perItem).toFixed(2)}s` } as CSSProperties}
      >
        <MarqueeRow items={items} tone={tone} />
        <MarqueeRow items={items} tone={tone} copy />
      </div>
    </div>
  );
}

/**
 * One cell of the comparison. The merchant may write short text, or the bare
 * words "yes" / "no" — which the editor's own hint tells them about — and those
 * two become a check or a cross with the word still there for a screen reader.
 * The cross is drawn in the quiet ink colour rather than danger red: the other
 * column is an absence, not an error.
 */
function CompareCell({ value, t }: { value: string; t: Dictionary }) {
  const word = value.trim().toLowerCase();

  if (word === "yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <CheckIcon size={18} />
        <span className="sr-only">{t.renderer.yes}</span>
      </span>
    );
  }
  if (word === "no") {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <CrossIcon size={18} />
        <span className="sr-only">{t.renderer.no}</span>
      </span>
    );
  }
  return <span className="text-sm text-ink">{value}</span>;
}

/**
 * `comparison` — an "us vs them" table.
 *
 * On a phone every row is its own card and each value carries its column's
 * name inline; from `sm` up the rows line up under one header and those inline
 * names become screen-reader-only, so the heading is never announced twice.
 * The grid follows the document direction, so an RTL store reads it
 * right-to-left without a single flipped class.
 */
export function ComparisonElement({ props, t }: { props: Props; t: Dictionary }) {
  const rows = compareRows(props, "rows");
  if (rows.length === 0) return null;

  const title = str(props, "title");
  const usLabel = str(props, "usLabel");
  const themLabel = str(props, "themLabel");
  const cols = "grid gap-x-4 gap-y-2 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-center";

  return (
    <div>
      {title ? <h2 className="mb-5 text-2xl font-bold text-ink">{title}</h2> : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {/* Visual column headings only — every value repeats them for a
            screen reader, so announcing them here too would double up. */}
        <div
          aria-hidden
          className={`${cols} hidden border-b border-line bg-paper px-4 py-3 sm:grid sm:px-5`}
        >
          <span />
          <span className="text-sm font-semibold text-primary">{usLabel}</span>
          <span className="text-sm font-semibold text-ink-soft">{themLabel}</span>
        </div>

        <ul className="divide-y divide-line">
          {rows.map((row, i) => (
            <li key={`${row.label}-${i}`} className={`${cols} px-4 py-4 sm:px-5`}>
              <span className="text-sm font-semibold text-ink">{row.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-primary sm:sr-only">{usLabel}</span>
                <CompareCell value={row.us} t={t} />
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-ink-soft sm:sr-only">{themLabel}</span>
                <CompareCell value={row.them} t={t} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
