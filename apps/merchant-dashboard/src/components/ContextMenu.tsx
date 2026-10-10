import { Fragment, isValidElement, useRef, type MouseEvent, type ReactNode } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { cn } from "@store-builder/ui";
import type { Icon } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { menu: "Actions" },
  ar: { menu: "إجراءات" },
} satisfies Messages;

/** How long after a long press opened the menu a click on the row is taken for the end of that press. */
const LONG_PRESS_CLICK_WINDOW = 700;

export type ContextMenuItem = {
  id: string;
  label: string;
  icon?: Icon;
  onSelect: () => void;
  /** Written in the danger colour: delete, cancel an order. */
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a hairline above this item, to set a group apart. */
  separatorBefore?: boolean;
};

export interface ContextMenuProps {
  items: readonly ContextMenuItem[];
  /** What the menu is for, read out by a screen reader: «إجراءات الأوردر». */
  label?: string;
  /** The row (or card) the menu belongs to. */
  children: ReactNode;
  /**
   * Put the trigger on the child itself instead of around it. This is already
   * what happens for a plain element (`<tr>`, `<li>`, `<a>`, `<div>`), so a
   * table row stays a direct child of its `<tbody>`. Set it for a component
   * that passes its props and ref down to one element (a `ViewLink`, the
   * shared `TableRow`); leave it off for anything else, which gets a wrapper
   * that takes no room (`display: contents`).
   */
  asChild?: boolean;
  /** No menu: the browser's own stays. */
  disabled?: boolean;
}

/**
 * The menu of a row: right-click on a desktop, a long press (about half a
 * second) on a touch screen, Shift+F10 or the Menu key while the row or
 * something in it has focus — all three from Base UI's ContextMenu, which also
 * gives the arrow keys, Enter, Escape and type-to-find
 *. It adds nothing to the row's layout.
 *
 * Give the same actions somewhere a thumb finds them without a long press too
 * (Quick Look's footer, a row's own buttons): a context menu is a shortcut,
 * never the only way.
 */
export function ContextMenu({ items, label, children, asChild, disabled = false }: ContextMenuProps) {
  const t = useT(STRINGS);
  // A plain element (or, with `asChild`, a component that forwards its props) becomes the trigger itself.
  const child = isValidElement(children) && (asChild ?? typeof children.type === "string") ? children : null;
  // On a touch screen a long press would otherwise start selecting the row's text.
  const triggerClass = "pointer-coarse:select-none";

  // Lifting the finger after a long press can still arrive as a click on the
  // row. The press opened the menu; it must not also open the row behind it.
  const openedByTouchAt = useRef<number | null>(null);
  const swallowClickAfterLongPress = (e: MouseEvent<HTMLElement>) => {
    const at = openedByTouchAt.current;
    if (at === null || performance.now() - at > LONG_PRESS_CLICK_WINDOW) return;
    openedByTouchAt.current = null;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <ContextMenuPrimitive.Root
      disabled={disabled || items.length === 0}
      onOpenChange={(open, details) => {
        if (!open) return;
        const event = details.event;
        const byTouch = event.type.startsWith("touch") || ("pointerType" in event && event.pointerType === "touch");
        openedByTouchAt.current = byTouch ? performance.now() : null;
      }}
    >
      {child ? (
        <ContextMenuPrimitive.Trigger
          data-context-menu=""
          className={triggerClass}
          onClickCapture={swallowClickAfterLongPress}
          render={child}
        />
      ) : (
        <ContextMenuPrimitive.Trigger
          data-context-menu="wrap"
          className={cn("contents", triggerClass)}
          onClickCapture={swallowClickAfterLongPress}
        >
          {children}
        </ContextMenuPrimitive.Trigger>
      )}
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="z-50 outline-none" collisionPadding={8}>
          <ContextMenuPrimitive.Popup
            data-slot="context-menu"
            aria-label={label ?? t.menu}
            // The popup is portalled, but in React a click on an item would still climb to
            // whatever the menu sits inside (a row with onClick, a link) and be taken for a click on it.
            onClick={(e) => e.stopPropagation()}
            className="max-h-(--available-height) max-w-[min(20rem,calc(100vw_-_1rem))] min-w-[13rem] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-[0.875rem] bg-paper-raised p-1.5 text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none transition-[scale,opacity] duration-[var(--dur-move)] ease-[var(--ease-spring)] data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[ending-style]:duration-[var(--dur-fade)] data-[ending-style]:ease-[var(--ease-out)] data-[instant]:transition-none data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 motion-reduce:transition-none"
          >
            {items.map((item, index) => {
              const ItemIcon = item.icon;
              return (
                <Fragment key={item.id}>
                  {item.separatorBefore && index > 0 && (
                    <ContextMenuPrimitive.Separator data-slot="context-menu-separator" className="mx-2 my-1 h-px bg-line" />
                  )}
                  <ContextMenuPrimitive.Item
                    data-slot="context-menu-item"
                    data-destructive={item.destructive ? "" : undefined}
                    disabled={item.disabled}
                    onClick={() => item.onSelect()}
                    className={cn(
                      "group/item flex min-h-9 cursor-default items-center gap-2.5 rounded-[0.5rem] px-2.5 text-sm leading-5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 pointer-coarse:min-h-11",
                      item.destructive
                        ? "text-danger data-[highlighted]:bg-danger-soft"
                        : "text-ink data-[highlighted]:bg-paper-sunken"
                    )}
                  >
                    {ItemIcon && (
                      <ItemIcon
                        className="size-4 shrink-0 opacity-70 group-data-[highlighted]/item:opacity-100"
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </ContextMenuPrimitive.Item>
                </Fragment>
              );
            })}
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}
