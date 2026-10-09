import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconCaretDown, IconMoreActions, IconSpinner, type IconComponent } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

export interface MoreMenuProps {
  /** What the menu holds: the name of the round button, or the word on the pill. */
  label: string;
  /** The same shape a row's context menu takes, so one list can feed both. */
  items: ReadonlyArray<ContextMenuItem>;
  /** `round` is the «…» button (44px); `pill` writes the label beside the glyph from sm up, like «أدوات». */
  variant?: "round" | "pill";
  icon?: IconComponent;
  /** Something the menu started is still running: the glyph gives way to a spinner. */
  busy?: boolean;
  className?: string;
}

/**
 * What is used rarely, one tap away instead of on the page: the secondary
 * actions of a header, or of a card. Draws nothing when there is nothing to
 * offer. Base UI's menu underneath (arrow keys, Escape, type-to-find), in the
 * reading direction of the app.
 */
export function MoreMenu({ label, items, variant = "round", icon: Glyph = IconMoreActions, busy = false, className }: MoreMenuProps) {
  const { dir } = useLocale();
  if (items.length === 0) return null;

  const glyph = busy ? (
    <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
  ) : (
    <Glyph className="size-5" weight={variant === "round" ? "bold" : "regular"} aria-hidden />
  );

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        {variant === "pill" ? (
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" title={label} className={cn("h-11 gap-2 rounded-full px-3 sm:h-10 sm:px-4", className)} />}
          >
            {glyph}
            <span className="max-sm:sr-only">{label}</span>
            <IconCaretDown className="size-4 text-ink-soft max-sm:hidden" aria-hidden />
          </DropdownMenuTrigger>
        ) : (
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={label}
                title={label}
                className={cn(
                  "zimos-more-button relative z-10 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft",
                  "transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-paper-sunken aria-expanded:text-ink",
                  "motion-reduce:transition-none motion-reduce:active:scale-100",
                  className
                )}
              />
            }
          >
            {glyph}
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  className={ITEM}
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
