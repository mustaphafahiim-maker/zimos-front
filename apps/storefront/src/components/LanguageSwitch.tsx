"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { iconBtn } from "./ui";

/**
 * ع / EN toggle. The choice is persisted in a cookie so server components
 * (including the store layout, which sets lang/dir) render in it on the next
 * request; `router.refresh()` re-renders the current page in place.
 */
export function LanguageSwitch() {
  const { locale, t } = useStore();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  function toggle() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={next === "en" ? t.common.switchToEnglish : t.common.switchToArabic}
      title={next === "en" ? t.common.switchToEnglish : t.common.switchToArabic}
      className={`${iconBtn} text-sm font-semibold disabled:opacity-60`}
    >
      <span lang={next}>{next === "en" ? "EN" : "ع"}</span>
    </button>
  );
}
