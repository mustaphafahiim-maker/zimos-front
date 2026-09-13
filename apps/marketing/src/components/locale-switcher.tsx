"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, otherLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

const localePrefix = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);

  const rest = pathname.replace(localePrefix, "");
  const href = `/${target}${rest}`;

  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      aria-label={dict.nav.switchLanguageAria}
      className={`inline-flex h-9 items-center rounded-lg border border-line bg-paper-raised px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink ${className}`}
    >
      {dict.nav.switchLanguage}
    </Link>
  );
}
