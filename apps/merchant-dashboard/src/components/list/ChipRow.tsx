import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn } from "@store-builder/ui";
import { IconCaretDown } from "@/components/icons";
import { fmt, getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    more: "More",
    moreCount: "+{n}",
    moreLabel: "More: {count}",
    empty_one: "1 with nothing in it",
    empty_other: "{n} with nothing in them",
  },
  ar: {
    more: "كمان",
    moreCount: "+{n}",
    moreLabel: "كمان: {count}",
    empty_one: "واحدة فاضية",
    empty_two: "اتنين فاضيين",
    empty_few: "{n} فاضيين",
    empty_other: "{n} فاضيين",
  },
} satisfies Messages;

type ChipTone = "default" | "attention" | "danger" | "success";

export interface ChipItem<T extends string> {
  value: T;
  label: string;
  /** The figure after the label. Left out or `null`: no figure (nothing is counted, or it is not this role's to see). */
  count?: number | null;
  /** Tints the figure while it is above zero: attention is the amber accent. */
  tone?: "default" | "attention" | "danger" | "success";
}

export interface ChipRowProps<T extends string> {
  items: ReadonlyArray<ChipItem<T>>;
  value: T;
  /** NoInfer keeps T pinned to `items` / `value`, so a plain setState fits here. */
  onChange: (value: NoInfer<T>) => void;
  /** Names the row for screen readers. */
  label: string;
  /** Items whose count is exactly 0 (and are not selected) move behind a «كمان» menu at the row's end. Default true. */
  collapseEmpty?: boolean;
  /** True while counts are loading: count chips show a dash at reduced contrast-safe style. */
  countsLoading?: boolean;
  className?: string;
}

/** How wide the soft edge is on a side where chips run out of sight. */
const FADE = "12px";
/** Air kept between a chip brought into view and the edge of the row, so its neighbour peeks in. */
const PEEK = 20;

// The fade is a mask on the scrolling row. Its two widths are set from the scroll position (syncFade):
// nothing is faded at rest, so the first chip is never dimmed.
const MASK =
  "linear-gradient(to right, transparent, #000 var(--chip-fade-left, 0px), #000 calc(100% - var(--chip-fade-right, 0px)), transparent)";
const MASK_STYLE: CSSProperties = { maskImage: MASK, WebkitMaskImage: MASK };

// One chip: a full pill, 40px tall with a mouse and 44px under a finger.
const CHIP =
  "zimos-chip inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full text-sm font-medium whitespace-nowrap select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
// The solid look, used when the glass layer is off; glass/list.css gives the pane and the brand gradient.
const CHIP_ON = "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const CHIP_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

const COUNT =
  "zimos-chip-count inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs leading-none font-semibold tabular-nums";
// On the chosen chip the figure sits in a darker bead (a lighter one in the dark theme, where the fill is light).
const COUNT_ON = "bg-black/20 dark:bg-white/30";
const COUNT_TONE: Record<ChipTone, string> = {
  default: "bg-paper-sunken text-ink-soft",
  attention: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
};

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the corners of the menu. */
const MENU_ITEM = "min-h-9 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";

function isRtl(element: Element): boolean {
  return window.getComputedStyle(element).direction === "rtl";
}

/** The edge fades only on a side where chips are hidden. */
function syncFade(scroller: HTMLElement) {
  const hidden = scroller.scrollWidth - scroller.clientWidth;
  // A right-to-left row counts scrollLeft down from zero: the distance from its start is the size of the number.
  const fromStart = Math.abs(scroller.scrollLeft);
  const start = fromStart > 1 ? FADE : "0px";
  const end = fromStart < hidden - 1 ? FADE : "0px";
  const rtl = isRtl(scroller);
  scroller.style.setProperty("--chip-fade-left", rtl ? end : start);
  scroller.style.setProperty("--chip-fade-right", rtl ? start : end);
}

/** Brings a chip fully into the row by scrolling the row alone — never the page. */
function reveal(scroller: HTMLElement, chip: HTMLElement, smooth: boolean) {
  const row = scroller.getBoundingClientRect();
  const box = chip.getBoundingClientRect();
  if (row.width === 0) return;
  const pastLeft = box.left < row.left + PEEK;
  const pastRight = box.right > row.right - PEEK;
  let by = 0;
  // A chip wider than the row shows its beginning.
  if (pastLeft && pastRight) by = isRtl(scroller) ? box.right - row.right + PEEK : box.left - row.left - PEEK;
  else if (pastLeft) by = box.left - row.left - PEEK;
  else if (pastRight) by = box.right - row.right + PEEK;
  if (Math.abs(by) < 1) return;
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  scroller.scrollBy({ left: by, behavior: smooth && !calm ? "smooth" : "auto" });
}

/**
 * The chips over a list (the statuses of the orders, say): ONE row that scrolls
 * sideways and never wraps. On a phone it runs to the screen edges (the page's
 * 1rem gutter is taken back with `-mx-4`; pass `max-sm:mx-0` where the row does
 * not sit in that gutter), and a soft fade marks a side with more to see.
 *
 * Toggle buttons in a named group: each chip is a button with `aria-pressed`,
 * every one a Tab stop; ← → move between them following the reading direction,
 * Home and End jump to the ends. The chosen chip is scrolled into view when the
 * row arrives and whenever the choice changes — the row scrolls, never the page.
 *
 * Chips with nothing in them (count 0) wait behind «كمان» at the end of the row,
 * so the row shows what has work in it; choosing one there puts it in the row.
 *
 * Material (the small panes, the brand fill, the tinted figures) is in
 * glass/list.css; without the glass layer the chips are solid pills.
 */
export function ChipRow<T extends string>({
  items,
  value,
  onChange,
  label,
  collapseEmpty = true,
  countsLoading = false,
  className,
}: ChipRowProps<T>) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // False until the first placement: on arrival the chosen chip is simply there, afterwards the row travels to it.
  const placed = useRef(false);
  // Figures in the viewer's digits.
  const digits = new Intl.NumberFormat(getIntlLocale());

  const tuckedAway = (item: ChipItem<T>) => collapseEmpty && item.count === 0 && item.value !== value;
  const inRow = items.filter((item) => !tuckedAway(item));
  const tucked = items.filter(tuckedAway);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const chosen = scroller.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (chosen) reveal(scroller, chosen, placed.current);
    placed.current = true;
  }, [value]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const sync = () => syncFade(scroller);
    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [dir]);

  // The chips themselves may have changed (a count arrived, one moved behind «كمان»): the row is as long as they are.
  useEffect(() => {
    if (scrollerRef.current) syncFade(scrollerRef.current);
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const scroller = event.currentTarget;
    const target = event.target;
    // A key pressed in the «كمان» menu is the menu's: it is drawn in <body>, but for React it is still inside this row.
    if (!(target instanceof HTMLElement) || !scroller.contains(target)) return;
    const chips = Array.from(scroller.querySelectorAll<HTMLElement>(".zimos-chip"));
    const from = chips.findIndex((chip) => chip.contains(target));
    if (from < 0) return;
    let to: number;
    switch (event.key) {
      case "ArrowRight":
        to = from + (isRtl(scroller) ? -1 : 1);
        break;
      case "ArrowLeft":
        to = from + (isRtl(scroller) ? 1 : -1);
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = chips.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    // The ends are walls: the row does not wrap around.
    const next = chips[Math.min(Math.max(to, 0), chips.length - 1)];
    if (!next || next === chips[from]) return;
    next.focus({ preventScroll: true });
    reveal(scroller, next, true);
  }

  return (
    // The group is the row's name; the chips sit one level down, in the part that scrolls.
    <div role="group" aria-label={label} data-slot="chip-row" className={cn("flex min-w-0 flex-col max-sm:-mx-4", className)}>
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        style={MASK_STYLE}
        // The padding is room for a focus ring and the glow of the chosen chip, which the scroll box would cut; the margins take it back.
        className="-my-2 flex items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain py-2 [scrollbar-width:none] max-sm:px-4 sm:-mx-1 sm:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {inRow.map((item) => {
          const pressed = item.value === value;
          // While counts load, a chip that will have a figure shows a dash in its place.
          const waiting = countsLoading && item.count !== undefined;
          const figure = !waiting && typeof item.count === "number" ? item.count : null;
          // A tint says "look here": with nothing to look at the figure stays neutral.
          const tone: ChipTone = figure !== null && figure > 0 ? (item.tone ?? "default") : "default";
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                if (!pressed) onChange(item.value);
              }}
              className={cn(CHIP, waiting || figure !== null ? "ps-3.5 pe-2" : "px-3.5", pressed ? CHIP_ON : CHIP_OFF)}
            >
              <span>{item.label}</span>
              {waiting ? (
                <span aria-hidden data-loading="" className={cn(COUNT, pressed ? COUNT_ON : COUNT_TONE.default)}>
                  –
                </span>
              ) : figure !== null ? (
                <span data-tone={tone} className={cn(COUNT, pressed ? COUNT_ON : COUNT_TONE[tone])}>
                  {digits.format(figure)}
                </span>
              ) : null}
            </button>
          );
        })}

        {tucked.length > 0 && (
          <DirectionProvider direction={dir}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={fmt(t.moreLabel, { count: pluralOf(t, "empty", tucked.length) })}
                    className={cn(CHIP, CHIP_OFF, "group/more gap-1.5 ps-3.5 pe-2.5 aria-expanded:bg-paper-sunken")}
                  />
                }
              >
                <span>{t.more}</span>
                <span className="text-ink-soft tabular-nums">{fmt(t.moreCount, { n: tucked.length })}</span>
                <IconCaretDown
                  className="size-4 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-aria-expanded/more:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </DropdownMenuTrigger>
              {/* The chip is the last thing in the row: the menu hangs from the end of it. */}
              <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto min-w-48 rounded-[1.125rem] p-1.5">
                {tucked.map((item) => (
                  <DropdownMenuItem key={item.value} onClick={() => onChange(item.value)} className={MENU_ITEM}>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="text-xs text-ink-soft tabular-nums">{digits.format(0)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DirectionProvider>
        )}
      </div>
    </div>
  );
}
