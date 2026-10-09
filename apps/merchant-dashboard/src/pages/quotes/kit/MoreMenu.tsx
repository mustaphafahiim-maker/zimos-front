import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconMoreActions, IconSpinner } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the corners of the menu. */
const ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

export interface MoreMenuProps {
  /** The same items a row's context menu takes, so one list feeds both. */
  items: readonly ContextMenuItem[];
  /** Names the button for a screen reader and its tooltip: «أدوات الكورس». */
  label: string;
  /** `header`: the round pane that closes a page header. `row`: a quiet round button at the end of a row. */
  variant?: "header" | "row";
  /** Something the menu started is still running: the dots give way to a spinner. */
  busy?: boolean;
  className?: string;
}

/**
 * «…»: what is done rarely, one tap away instead of on the page. The button is
 * 44px under a finger; the menu hangs from its end and takes the same items as
 * `ContextMenu`, so a row's long-press menu and its visible «…» never differ.
 * Draws nothing when there is nothing to offer.
 */
export function MoreMenu({ items, label, variant = "header", busy = false, className }: MoreMenuProps) {
  const { dir } = useLocale();
  if (items.length === 0) return null;
  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={variant === "header" ? "outline" : "ghost"}
              aria-label={label}
              title={label}
              aria-busy={busy || undefined}
              className={cn("size-11 shrink-0 rounded-full p-0", variant === "row" && "text-ink-soft pointer-fine:size-9", className)}
            />
          }
        >
          {busy ? (
            <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <IconMoreActions className="size-5" weight="bold" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-56 rounded-[1.125rem] p-1.5">
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem variant={item.destructive ? "destructive" : "default"} disabled={item.disabled} onClick={item.onSelect} className={ITEM}>
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
