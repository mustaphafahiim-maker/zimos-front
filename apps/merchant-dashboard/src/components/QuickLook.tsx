import { type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { buttonVariants, cn } from "@store-builder/ui";
import { IconArrowOut } from "@/components/icons";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { isPlainNavigationClick, useViewNavigate } from "@/lib/viewTransition";

const STRINGS = {
  en: { openFully: "Open fully" },
  ar: { openFully: "فتح الصفحة كاملة" },
} satisfies Messages;

/** Things that use Space themselves: on one of these the key is theirs, not Quick Look's. */
const CONTROLS =
  "input, textarea, select, button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='menuitem'], [role='tab'], [contenteditable]:not([contenteditable='false'])";

function isPlainSpace(e: KeyboardEvent<HTMLElement>): boolean {
  return e.key === " " && !e.defaultPrevented && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey;
}

export interface QuickLookRowProps {
  tabIndex: 0;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Props for a list row that can be peeked at: it takes focus with Tab, and
 * Space on it opens the preview (Enter still opens the row fully — that stays
 * the row's own link). Space inside a field, button or link of the row is left
 * to that control. Holds no state, so it is safe to call once per row in a map.
 *
 *   <tr {...quickLookRowProps(() => setPeek(order))}>…</tr>
 */
export function quickLookRowProps(onPeek: () => void): QuickLookRowProps {
  return {
    tabIndex: 0,
    onKeyDown(e) {
      if (!isPlainSpace(e)) return;
      const row = e.currentTarget;
      // A key pressed inside something this row portals (its own preview, a menu) is not the row's.
      if (!(e.target instanceof Element) || !row.contains(e.target)) return;
      if (e.target !== row) {
        const control = e.target.closest(CONTROLS);
        if (control && control !== row && row.contains(control)) return;
      }
      e.preventDefault(); // or the page would scroll
      onPeek();
    },
  };
}

/** The same, under the name the redesign brief gives it. Not a real hook: it calls none. */
export const useQuickLookRow = quickLookRowProps;

export interface QuickLookProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the row is: «أوردر #1024», a product's name. */
  title: ReactNode;
  /** Beside the title: who or what it belongs to. */
  subtitle?: ReactNode;
  /** The row's status chip, on the same line. */
  status?: ReactNode;
  /** The row's own page: where "open fully" goes. */
  to: string;
  /** Label of that link. Default «افتح بالكامل». */
  openLabel?: string;
  /** Quick actions for this row (call, WhatsApp, confirm…), at the start of the footer. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Quick Look: from any list, a row opens a preview without leaving the list
 * (docs/ux/REDESIGN_PROMPT.md §2.3). On the phone it is a bottom sheet that
 * can be pulled down; from 640px a panel on the end edge, the list still in
 * place behind it. The footer is drawn here: the caller's quick actions, then
 * the one link that leaves — "open fully" — which closes the preview and goes
 * to the row's page inside a view transition. Space closes it again, the way
 * it opened it (`useQuickLookRow`).
 */
export function QuickLook({ open, onOpenChange, title, subtitle, status, to, openLabel, actions, children }: QuickLookProps) {
  const t = useT(STRINGS);
  const navigate = useViewNavigate();

  const hasActions = actions !== null && actions !== undefined && actions !== false && actions !== "";

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      side="auto-end"
      popupProps={{
        onKeyDown(e) {
          if (!isPlainSpace(e)) return;
          if (e.target instanceof Element && e.target.closest(CONTROLS)) return;
          e.preventDefault();
          onOpenChange(false);
        },
      }}
    >
      <SheetHeader title={title} subtitle={subtitle} status={status} />
      <SheetBody>{children}</SheetBody>
      <SheetFooter className="flex-col sm:flex-nowrap sm:justify-between">
        {hasActions && (
          <div data-slot="quick-look-actions" className="flex min-w-0 flex-wrap items-center gap-2 max-sm:*:flex-1 sm:flex-1">
            {actions}
          </div>
        )}
        <Link
          to={to}
          data-slot="button"
          data-variant="default"
          className={cn(buttonVariants(), "gap-2 rounded-full px-5 sm:ms-auto")}
          onClick={(e) => {
            // A new tab or window is the browser's; the preview stays where it is.
            if (!isPlainNavigationClick(e)) return;
            e.preventDefault();
            onOpenChange(false);
            navigate(to);
          }}
        >
          <span className="min-w-0 truncate">{openLabel ?? t.openFully}</span>
          <IconArrowOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      </SheetFooter>
    </SheetFrame>
  );
}
