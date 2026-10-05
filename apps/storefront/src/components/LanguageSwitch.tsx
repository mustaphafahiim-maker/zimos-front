"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_SHORT, nextLocale, switchLabel } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { iconBtn } from "./ui";

/**
 * ع / EN (/ FR when the store offers French) switch. The choice is persisted in a cookie so server components
 * (including the store layout, which sets lang/dir) render in it on the next
 * request; `router.refresh()` re-renders the current page in place.
 */
export function LanguageSwitch() {
  const { locale, t, store } = useStore();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = nextLocale(locale, store?.languages);

  function toggle() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={switchLabel(t, next)}
      title={switchLabel(t, next)}
      className={`${iconBtn} text-sm font-semibold disabled:opacity-60`}
    >
      <span lang={next}>{LOCALE_SHORT[next]}</span>
    </button>
  );
}
