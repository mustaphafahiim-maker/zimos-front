import {
  useId,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { select: "Select this row", unread: "New:" },
  ar: { select: "اختار الصف ده", unread: "جديد:" },
} satisfies Messages;

export interface ListRowCardProps {
  /** First line, start: who or what (truncates). */
  title: ReactNode;
  /** First line, end: the money or the main figure (never wraps; tabular). */
  amount?: ReactNode;
  /** Second line, start: the status chip and one or two facts (place · age). */
  status?: ReactNode;
  meta?: ReactNode;
  /** Second line, end: the row's ONE action (e.g. ContactActions variant="icon", or a pill button). */
  action?: ReactNode;
  /** A leading thumbnail or avatar (40px). */
  leading?: ReactNode;
  /** Small chips under the two lines (tags, risk). */
  footer?: ReactNode;
  selected?: boolean;
  /** Present → the card shows a 44px checkbox target at the start. */
  onSelectedChange?: (selected: boolean) => void;
  selectLabel?: string;
  /** Tapping the card (not its action or checkbox): open Quick Look. */
  onOpen?: () => void;
  openLabel?: string;
  unread?: boolean;
  className?: string;
}

/**
 * Anything else given to the card lands on its pressable region: the
 * `{ tabIndex, onKeyDown }` of `useQuickLookRow`, a ref, `data-*`, `style`.
 * `onClick` and `onKeyDown` run before the card's own.
 */
type RegionProps = Omit<ComponentProps<"div">, keyof ListRowCardProps | "children">;

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/** The tick box and the action are their own controls: a press on one never reaches the card or whatever holds it. */
const contain = (event: SyntheticEvent) => event.stopPropagation();

/**
 * A row of a list as a phone card: who and how much on the first line, the
 * status chip, a fact or two and the row's ONE action on the second.
 *
 * The card is one big target — a button laid over it, so a tap anywhere opens
 * the row (Enter too; Space as well, unless `useQuickLookRow` is spread here
 * and takes it for the peek). The tick box and the action are drawn above that
 * button and are separate Tab stops, in reading order: tick box, card, action.
 * They are siblings of the button, never inside it, so a screen reader meets
 * three controls and not one button that swallowed the other two. A link or a
 * button placed in the title, the facts or the footer is raised the same way.
 *
 * Material (the sheet pane, the brand ring of a selected card) is in
 * glass/list.css, with no blur: a list is fifty of these. Without the glass
 * layer the card is a solid raised sheet with a hairline.
 */
export function ListRowCard({
  title,
  amount,
  status,
  meta,
  action,
  leading,
  footer,
  selected = false,
  onSelectedChange,
  selectLabel,
  onOpen,
  openLabel,
  unread = false,
  className,
  onClick,
  onKeyDown,
  ...rest
}: ListRowCardProps & RegionProps) {
  const t = useT(STRINGS);
  const id = useId();
  const titleId = `${id}-title`;
  const amountId = `${id}-amount`;
  const hasAmount = shown(amount);
  const hasSecondLine = shown(status) || shown(meta) || shown(action);
  // With nothing to do on a press the card is only a card, and what was passed for the region goes on the card itself.
  const pressable = onOpen !== undefined || onClick !== undefined || onKeyDown !== undefined;

  function press(event: MouseEvent<HTMLDivElement>) {
    onClick?.(event);
    if (!event.defaultPrevented) onOpen?.();
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    // The caller first: Space is Quick Look's when its row props are spread here, and it says so by preventing the default.
    onKeyDown?.(event);
    if (!onOpen || event.defaultPrevented || event.repeat || event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault(); // or Space would scroll the page
    onOpen();
  }

  return (
    <div
      {...(pressable ? undefined : rest)}
      data-slot="list-row-card"
      data-selected={selected ? "" : undefined}
      data-unread={unread ? "" : undefined}
      className={cn(
        "zimos-row-card relative flex min-h-[72px] items-center gap-3 rounded-[1.25rem] px-3.5 py-3 text-ink shadow-[var(--shadow-card)]",
        "transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        // The whole card gives a little while the button over it is held.
        "motion-safe:has-[[data-row-open]:active]:scale-[0.985]",
        selected ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line",
        className
      )}
    >
      {onSelectedChange && (
        // A 44px target around a 22px box; pulled toward the edges so the box, not its air, lines up with the card's padding.
        <label
          className="relative z-10 -ms-2 -me-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center"
          onClick={contain}
          onPointerDown={contain}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={selectLabel ?? t.select}
            className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
          />
          <span
            aria-hidden
            data-checked={selected ? "" : undefined}
            className={cn(
              "zimos-row-check pointer-events-none flex size-[22px] items-center justify-center rounded-[7px]",
              "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:scale-[0.92] motion-reduce:peer-active:scale-100",
              selected ? "bg-primary text-primary-foreground" : "bg-paper-raised ring-[1.5px] ring-line-strong ring-inset"
            )}
          >
            {selected && (
              <IconCheck
                className="size-3.5 motion-safe:animate-[list-badge-pop_var(--dur-pop)_var(--ease-pop)_both]"
                weight="bold"
                aria-hidden
              />
            )}
          </span>
        </label>
      )}

      {pressable && (
        <div
          role="button"
          tabIndex={0}
          aria-label={openLabel}
          aria-labelledby={openLabel ? undefined : hasAmount ? `${titleId} ${amountId}` : titleId}
          {...rest}
          data-row-open=""
          onClick={press}
          onKeyDown={key}
          className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      )}

      {shown(leading) && (
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem]">{leading}</div>
      )}

      {/* The words lie under the button; a link or a button among them is lifted over it and keeps working. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 [&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10">
        <div className="flex items-baseline gap-2">
          {unread && <span aria-hidden className="zimos-row-dot size-2 shrink-0 self-center rounded-full bg-primary" />}
          <div id={titleId} className="min-w-0 flex-1 truncate text-[15px] leading-[1.375rem] font-semibold text-ink">
            {unread && <span className="sr-only">{t.unread} </span>}
            {title}
          </div>
          {hasAmount && (
            <div id={amountId} className="shrink-0 text-[15px] leading-[1.375rem] font-semibold whitespace-nowrap text-ink tabular-nums">
              {amount}
            </div>
          )}
        </div>

        {hasSecondLine && (
          <div className="flex min-h-6 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-5 text-ink-soft">
              {shown(status) && <span className="flex shrink-0 items-center">{status}</span>}
              {shown(meta) && <span className="min-w-0 truncate">{meta}</span>}
            </div>
            {shown(action) && (
              // A 44px action may reach 4px past the line above and below it: the card stays compact.
              <div className="relative z-10 -my-1 flex shrink-0 items-center gap-2" onClick={contain} onPointerDown={contain}>
                {action}
              </div>
            )}
          </div>
        )}

        {shown(footer) && <div className="flex flex-wrap items-center gap-1.5 pt-0.5">{footer}</div>}
      </div>
    </div>
  );
}
