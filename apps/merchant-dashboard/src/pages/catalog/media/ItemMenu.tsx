import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@store-builder/ui";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconMoreActions } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";

// The row of the list kit's menus (components/list/BulkBar.tsx): 36px under a mouse, 44px under a thumb.
const ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11";

/** On a photo the button is a dark disc with a white glyph, so it reads on any picture; in a row it is a quiet round button. */
const TONE = {
  photo:
    "size-8 bg-black/60 text-white before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/75 aria-expanded:bg-black/75",
  plain:
    "size-11 text-ink-soft hover:bg-ink/8 hover:text-ink aria-expanded:bg-ink/8 aria-expanded:text-ink pointer-fine:size-9",
} as const;

export interface ItemMenuProps {
  /** The same list a right-click on the item gives (components/ContextMenu.tsx). */
  items: readonly ContextMenuItem[];
  /** What the menu is for, said by a screen reader and shown as the button's tooltip. */
  label: string;
  tone?: keyof typeof TONE;
  className?: string;
}

/**
 * «…» on a photo, a video or a variant: the item's own actions, one tap away.
 * It is the thumb's way to what a right-click gives with a mouse, built from
 * the same list of items. Base UI's Menu underneath: arrow keys, Enter, Escape
 * and type-to-find; focus goes back to the button when it closes.
 */
export function ItemMenu({ items, label, tone = "plain", className }: ItemMenuProps) {
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
              data-slot="item-menu"
              data-tone={tone}
              className={cn(
                "zimos-item-menu relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full",
                "transition-[scale,background-color,color,opacity] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]",
                TONE[tone],
                className
              )}
            />
          }
        >
          <IconMoreActions className={tone === "photo" ? "size-4" : "size-5"} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={6}
          className="w-auto max-w-[min(20rem,calc(100vw_-_1.5rem))] min-w-52 rounded-[1.125rem] p-1.5"
        >
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) item.onSelect();
                  }}
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
