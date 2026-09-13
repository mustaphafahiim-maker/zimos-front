"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { CloseIcon, MenuIcon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { btnGhost, btnPrimary } from "./ui";
import { ZimosLogo } from "./zimos-logo";

export function SiteHeader() {
  const { locale, dict } = useI18n();
  const { nav } = dict;
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sections = [
    { href: "#product", label: nav.product },
    { href: "#solutions", label: nav.solutions },
    { href: "#pricing", label: nav.pricing },
    { href: "#faq", label: nav.faq },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper-raised/85 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only rounded-lg bg-zimos-blue px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
      >
        {nav.skipToContent}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
        <Link
          href={`/${locale}`}
          aria-label={nav.homeAria}
          className="-m-1.5 shrink-0 rounded-lg p-1.5"
          onClick={() => setOpen(false)}
        >
          <ZimosLogo height={32} />
        </Link>

        <nav aria-label={nav.primaryLabel} className="hidden lg:block">
          <ul className="flex items-center gap-1 text-sm">
            {sections.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={`${btnGhost} h-9 px-3`}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <a href={LOGIN_URL} className={`${btnGhost} hidden h-9 px-3 text-sm md:inline-flex`}>
            {nav.signIn}
          </a>
          <a href={REGISTER_URL} className={`${btnPrimary} hidden h-9 px-4 text-sm sm:inline-flex`}>
            {nav.startFree}
          </a>
          <button
            type="button"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-paper-raised text-ink-soft transition-colors hover:text-ink lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? nav.closeMenu : nav.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-[1.15rem]">{open ? <CloseIcon /> : <MenuIcon />}</span>
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!open}
        className="border-t border-line bg-paper-raised px-4 pt-3 pb-5 sm:px-6 lg:hidden"
      >
        <nav aria-label={nav.primaryLabel}>
          <ul className="flex flex-col gap-1 text-base">
            {sections.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 font-medium text-ink transition-colors hover:bg-primary-soft"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <a
            href={LOGIN_URL}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong text-sm font-medium text-ink"
          >
            {nav.signIn}
          </a>
          <a href={REGISTER_URL} className={`${btnPrimary} h-11 text-sm`}>
            {nav.startFree}
          </a>
        </div>
        <LocaleSwitcher className="mt-3 sm:hidden" />
      </div>
    </header>
  );
}
