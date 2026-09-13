"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { btnPrimary } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * The 404 for anything under a store — a path the merchant never published, or
 * a product that's gone. A client component so it can recover the workspace id
 * from the URL: a not-found boundary is rendered outside its segment, so route
 * params aren't handed to it. Bilingual: the store language first, the other
 * language underneath.
 */
export default function StoreNotFound() {
  const pathname = usePathname() ?? "";
  const workspaceId = pathname.match(/^\/store\/([^/]+)/)?.[1] ?? null;
  const { t, locale } = useStore();
  const other = getDictionary(locale === "ar" ? "en" : "ar");
  const otherLang = locale === "ar" ? "en" : "ar";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-primary" dir="ltr">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-ink">{t.notFound.title}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{t.notFound.body}</p>
      <p lang={otherLang} dir={otherLang === "ar" ? "rtl" : "ltr"} className="mt-4 max-w-md text-xs text-ink-muted">
        {other.notFound.title} — {other.notFound.body}
      </p>
      {workspaceId && (
        <Link href={`/store/${workspaceId}`} className={`${btnPrimary} mt-8`}>
          {t.notFound.cta}
        </Link>
      )}
    </main>
  );
}
