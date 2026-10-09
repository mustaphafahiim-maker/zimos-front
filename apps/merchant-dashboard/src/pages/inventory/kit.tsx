import { Fragment, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import { stockLocationsList, type StockLocationList } from "@store-builder/api-client";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconMoreActions, IconSpinner } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useCachedAsync } from "@/lib/useCachedAsync";

/**
 * What the inventory screens share since they moved to the list pattern: the
 * one read of the store's locations, the «…» menu of a row or a header, a
 * switch that sits in a table cell, a thin meter, and the fact rows of a
 * preview. Material for the hooks named `inv-*` is in glass/sweep-inventory.css;
 * without the glass layer each piece is solid on its own classes.
 */

/**
 * The store's locations, read once and remembered for the session: every
 * inventory tab needs their names, so coming back to a tab shows them at once
 * and reads them again behind (lib/useCachedAsync.ts).
 */
export function useStockLocations(workspaceId: string) {
  return useCachedAsync<StockLocationList>(
    `inventory:locations:${workspaceId}`,
    () => stockLocationsList(apiClient, workspaceId),
    [workspaceId]
  );
}

/** Lower case, and Arabic-Indic digits as Latin ones, so «١٢» finds 12. */
export function foldText(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Whether any of the parts holds the (already folded) words typed in a search field. */
export function matchesText(needle: string, parts: ReadonlyArray<string | null | undefined>): boolean {
  if (!needle) return true;
  return parts.some((part) => Boolean(part) && foldText(part as string).includes(needle));
}

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const MENU_ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/**
 * «…»: the actions of a row (or of a page header) where a thumb finds them
 * without a long press. It takes the same items as the row's `ContextMenu`,
 * so the two can never drift apart. Draws nothing without items.
 */
export function MoreMenu({
  items,
  label,
  size = "row",
  className,
}: {
  items: ReadonlyArray<ContextMenuItem>;
  /** What the menu is for, as the button's name: «إجراءات المخزن». */
  label: string;
  /** `row` is a quiet round button; `header` a small pane, as the page headers have it. */
  size?: "row" | "header";
  className?: string;
}) {
  const { dir } = useLocale();
  if (items.length === 0) return null;
  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              title={label}
              data-slot="inv-more"
              data-size={size}
              className={cn(
                "zimos-inv-more inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:text-ink motion-safe:active:scale-[0.97] motion-reduce:transition-none",
                size === "header" ? "bg-paper-raised ring-1 ring-line pointer-fine:size-10" : "hover:bg-ink/6 aria-expanded:bg-ink/6 pointer-fine:size-9",
                className
              )}
            />
          }
        >
          <IconMoreActions className="size-5" weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-56 rounded-[1.125rem] p-1.5">
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={() => item.onSelect()}
                  className={MENU_ITEM}
                >
                  {ItemIcon && <ItemIcon className="size-[18px]" aria-hidden />}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}

/**
 * A switch on its own, for a cell of a list: the same track and thumb as a
 * settings row's (components/settings/SettingsRow.tsx — the glass layer styles
 * both through `zimos-settings-switch-*`), named by `label` instead of by
 * words beside it. 44px tall under a finger, 36px with a mouse.
 */
export function InlineSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  /** The change is being saved: the thumb shows a spinner and a second press waits. */
  busy?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (!busy) onChange(!checked);
      }}
      data-slot="inv-switch"
      className="group/switch inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed aria-busy:cursor-progress pointer-fine:h-9"
    >
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/switch:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        >
          {busy && <IconSpinner className="size-3.5 animate-spin text-black/55 motion-reduce:animate-none" weight="bold" aria-hidden />}
        </span>
      </span>
    </button>
  );
}

/**
 * A thin bar for "how much of it is done": counted lines of a stock count,
 * received units of a purchase order. The fill is one element scaled along
 * the reading direction (transform only); `label` says the same in words for
 * a screen reader.
 */
export function Meter({
  value,
  max,
  label,
  tone = "primary",
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "primary" | "success";
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(max, 0)}
      aria-valuenow={Math.min(Math.max(value, 0), Math.max(max, 0))}
      data-slot="inv-meter"
      className={cn("relative h-1.5 overflow-hidden rounded-full bg-paper-sunken", className)}
    >
      <span
        data-tone={tone}
        style={{ transform: `scaleX(${ratio})` }}
        className={cn(
          "zimos-inv-meter-fill absolute inset-0 origin-left rounded-full transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)] motion-reduce:transition-none rtl:origin-right",
          tone === "success" ? "bg-success" : "bg-primary"
        )}
      />
    </div>
  );
}

/** A small quiet label over a block of a preview or of a details card. */
export function BlockLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-xs leading-4 font-medium text-ink-soft", className)}>{children}</h3>;
}

/** Label and value lines, parted by hairlines: the facts of one row, in its preview or beside its lines. */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl data-slot="inv-facts" className={cn("zimos-inv-well divide-y divide-line rounded-2xl bg-paper-sunken px-4", className)}>
      {children}
    </dl>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="shrink-0 text-[13px] leading-5 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-sm leading-5 font-medium text-ink">{children}</dd>
    </div>
  );
}

/** A sunken block inside a pane: what a sheet is about, a note, a figure with its label. */
export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="inv-well" className={cn("zimos-inv-well rounded-2xl bg-paper-sunken px-4 py-3", className)}>
      {children}
    </div>
  );
}

/** A quiet pill for a small fact of a row: how many lines, where. */
export function FactChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-slot="inv-fact"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft",
        className
      )}
    >
      {children}
    </span>
  );
}

/** The quiet line a role without `inventory.manage` reads under a list. */
export function ViewOnlyNote({ children }: { children: ReactNode }) {
  return <p className="px-1 text-xs leading-5 text-ink-soft">{children}</p>;
}

/** Both actions of a sheet's footer are pills, as in ConfirmDialog; the footer gives them their height. */
export const SHEET_ACTION = "rounded-full px-5";

/** A pill button in a toolbar or an empty state: 44px tall, the house radius. */
export const TOOL_BUTTON = "h-11 gap-2 rounded-full px-4";
