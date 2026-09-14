"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconBtn } from "./ui";

export interface MenuLink {
  href: string;
  label: string;
}

/**
 * Mobile navigation drawer. A native modal <dialog> gives focus trapping,
 * Esc-to-close and an inert background for free; it slides from the
 * inline-start edge, so it opens from the right in Arabic.
 */
export function MobileMenu({
  links,
  storeName,
  labels,
}: {
  links: MenuLink[];
  storeName: string;
  labels: { open: string; close: string; nav: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className={`${iconBtn} lg:hidden`}
        aria-label={labels.open}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <dialog
        ref={ref}
        aria-label={storeName}
        className="my-0 ms-0 me-auto h-dvh max-h-none w-[min(22rem,88vw)] max-w-none border-e border-line bg-paper-raised p-0 text-ink shadow-pop backdrop:bg-black/45 open:flex open:flex-col"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <span className="truncate text-lg font-bold">{storeName}</span>
          <button type="button" className={iconBtn} aria-label={labels.close} onClick={() => ref.current?.close()}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label={labels.nav} className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href + link.label}>
                <Link
                  href={link.href}
                  onClick={() => ref.current?.close()}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-ink transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
