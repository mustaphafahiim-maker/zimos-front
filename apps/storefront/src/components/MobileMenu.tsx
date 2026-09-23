"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "@/components/StoreRoute";
import { CrossIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import { backdrop, focusRing, iconBtn, modalLayer, sheet } from "./ui";

/**
 * The header's navigation on a phone: a sheet that slides in from the
 * inline-end edge with the links the desktop header shows inline, plus the
 * theme toggle the narrow header has no room for. Focus stays inside while
 * it is open (lib/useDialog), Escape and the backdrop close it, and a link
 * that changes the route closes it too.
 *
 * Rendered only below `sm`; the desktop header keeps its inline links.
 */
export function MobileMenu({ storeName }: { storeName: string }) {
  const { t } = useStore();
  const pathname = usePathname();
  // The sheet remembers the path it was opened on, so a link that changes the
  // route closes it by itself — no effect, and the destination never renders
  // under an open sheet.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (next: boolean) => setOpenAt(next ? pathname : null);
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose: () => setOpen(false) });
  // In the DOM only while open or sliding out (lib/useDialog).
  const { present, shown } = useSheetPresence(open);

  const link = `flex min-h-12 items-center rounded-xl px-3 text-base font-medium text-ink transition-colors hover:bg-primary-soft hover:text-primary ${focusRing}`;

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.shop.openMenu}
        aria-expanded={open}
        aria-controls="store-mobile-menu"
        className={iconBtn}
      >
        <MenuIcon />
      </button>

      {/* Portalled out of the header: its backdrop-blur would otherwise be the
          containing block of this fixed layer, confining the sheet to the
          header's own 4rem. The store wrapper (.brand-theme, the layout's div)
          is the host rather than <body> so the merchant's colours still apply
          inside. Only ever rendered after a tap, so `document` is there. */}
      {present && createPortal(
      <div className={modalLayer}>
      <div className={backdrop(shown)} aria-hidden onClick={() => setOpen(false)} />

      <div
        ref={dialogRef}
        id="store-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t.common.menu}
        aria-hidden={!open}
        // `inert` keeps a sliding-out sheet out of the tab order and the accessibility tree.
        inert={!open}
        className={`${sheet(shown)} max-w-xs`}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-line px-4">
          <span className="truncate font-display text-lg font-bold text-ink">{storeName}</span>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.shop.closeMenu} className={iconBtn}>
            <CrossIcon />
          </button>
        </div>

        <nav aria-label={t.common.menu} className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            <li>
              <StoreLink href="/" className={link}>
                {t.common.home}
              </StoreLink>
            </li>
            <li>
              <StoreLink href="/cart" className={link}>
                {t.common.cart}
              </StoreLink>
            </li>
            <li>
              <StoreLink href="/track" className={link}>
                {t.common.trackOrder}
              </StoreLink>
            </li>
          </ul>
        </nav>

        {/* The theme toggle the narrow header leaves out; it labels itself. */}
        <div className="flex items-center justify-end border-t border-line px-4 py-3">
          <ThemeToggle />
        </div>
      </div>
      </div>,
      document.querySelector<HTMLElement>(".brand-theme") ?? document.body
      )}
    </div>
  );
}
