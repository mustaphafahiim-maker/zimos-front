"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ShellLink } from "@/components/ShellLink";
import { StoreLink } from "@/components/StoreRoute";
import type { ResolvedShellLink } from "@/lib/storeShell";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { xsPhoneMenuOf } from "@/lib/xsShell";

/**
 * The menu of an imported template (an "xs" look) on a phone or a tablet.
 *
 * The store's own header has one sheet for every store (MobileMenu); a
 * template has its own, and they are not alike — one drops a coloured list
 * under the bar, another slides a white sheet in from the side, another
 * covers the screen. Which of those a look does is in lib/xsShell.ts
 * (XS_PHONE_MENUS); how it is drawn is app/xs-phone.css, by `data-mode` and
 * `data-xs-look`.
 *
 * What is in it is the store's, whatever the look: the header's menu with
 * the lists that open under its links, the links the bar has no room for
 * (cart, order tracking, the account), the announcement line the strip shows
 * on a wide screen, and the language switch. The look decides the order.
 *
 * The layer is portalled to the store wrapper (not left in the header, whose
 * bar is fixed) and carries the look's name itself, so the look's colours
 * and faces reach it there.
 */
export function XsPhoneMenu({
  look,
  brand,
  links,
  subLinks,
  extras,
  notice,
  noticeHref,
  showLanguage,
  labels,
  own,
}: {
  look: string;
  /** The logo or the store's name, for a look whose sheet opens with it. */
  brand: ReactNode;
  links: ResolvedShellLink[];
  /** The lists under the menu's links, by the link's place in the saved menu (headerMenuOf). */
  subLinks: Map<number, ResolvedShellLink[]>;
  extras: ResolvedShellLink[];
  notice: string;
  noticeHref?: string | null;
  showLanguage: boolean;
  labels: { open: string; close: string; menu: string };
  /** The bar's own colours from the editor (`--xs-own-bar…`), which the menu follows. */
  own: Record<string, string>;
}) {
  const mode = xsPhoneMenuOf(look);
  const pathname = usePathname();
  // Remembers the path it was opened on, so a link that changes the route closes it (as MobileMenu does).
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (next: boolean) => setOpenAt(next ? pathname : null);
  // Where the bar ends, measured as the menu opens: a list that drops opens from there, whatever the look's bar measures.
  const [barEnd, setBarEnd] = useState(70);
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose: () => setOpen(false) });
  const { present, shown } = useSheetPresence(open, 420);

  return (
    <div className="xs-phone" data-xs-look={look} data-mode={mode}>
      <button
        type="button"
        // `zt-icon-btn`: the bar's icons take their colour from the look by that name, and so does this one.
        className="zt-icon-btn xs-phone__toggle"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls="xs-phone-menu"
        onClick={(event) => {
          const bar = event.currentTarget.closest(".xs-header__bar");
          if (bar) setBarEnd(Math.max(0, Math.round(bar.getBoundingClientRect().bottom)));
          setOpen(!open);
        }}
      >
        <i />
        <i />
        <i />
      </button>

      {present &&
        createPortal(
          <div className="xs-phone__layer" data-xs-look={look} data-mode={mode} data-open={shown ? "" : undefined} style={{ ...own, "--xs-ph-bar": `${barEnd}px` } as CSSProperties}>
            <div className="xs-phone__veil" aria-hidden onClick={() => setOpen(false)} />
            <div
              ref={dialogRef}
              id="xs-phone-menu"
              role="dialog"
              aria-modal="true"
              aria-label={labels.menu}
              // `inert` keeps a panel that is sliding away out of the tab order and the accessibility tree.
              inert={!open}
              className="xs-phone__panel"
            >
              {/* A list under the bar is closed by the bar's own button; a sheet or a cover needs one of its own. */}
              {mode !== "drop" ? (
                <button type="button" className="xs-phone__close" aria-label={labels.close} onClick={() => setOpen(false)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </button>
              ) : null}
              <div className="xs-phone__brand">{brand}</div>
              {notice ? (
                <p className="xs-phone__notice">{noticeHref ? <StoreLink href={noticeHref}>{notice}</StoreLink> : notice}</p>
              ) : null}
              <nav aria-label={labels.menu} className="xs-phone__nav">
                <ul className="xs-phone__list">
                  {links.map((link) => {
                    const under = subLinks.get(Number(link.key.split(":")[0]));
                    return (
                      <li key={link.key}>
                        <ShellLink link={link} className="xs-phone__link" />
                        {under && under.length > 0 ? (
                          <ul className="xs-phone__sub">
                            {under.map((item) => (
                              <li key={item.key}>
                                <ShellLink link={item} className="xs-phone__link" />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </nav>
              {extras.length > 0 || showLanguage ? (
                <ul className="xs-phone__extras">
                  {extras.map((link) => (
                    <li key={link.key}>
                      <ShellLink link={link} className="xs-phone__extra" />
                    </li>
                  ))}
                  {showLanguage ? (
                    <li>
                      <LanguageSwitch />
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </div>,
          document.querySelector<HTMLElement>(".brand-theme") ?? document.body
        )}
    </div>
  );
}
