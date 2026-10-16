import Link from "next/link";
import { btnPrimary } from "./ui";

/**
 * The branded 404 body, shared by both not-found boundaries.
 *
 * Where a shopper is sent back to depends on which boundary caught the 404 —
 * the store's own home page when there is a store, the site root when there
 * isn't — so the caller decides the link and this only draws it. The copy comes
 * from the caller too, because only the store boundary sits inside a store and
 * therefore knows the store's language; above it there is nothing to translate
 * into, so the defaults here are English.
 *
 * Deliberately not a client component: it needs no hooks, which leaves the root
 * boundary a plain server component and keeps `"use client"` to the store
 * boundary that actually reads the pathname.
 */
export function NotFoundContent({
  homeHref,
  homeLabel,
  title = "Page not found",
  body = "We couldn’t find that page. It may have been moved or removed.",
  secondary,
}: {
  homeHref: string;
  homeLabel: string;
  title?: string;
  body?: string;
  /** The same message in the store's other language, shown quietly underneath. */
  secondary?: { lang: "ar" | "en"; text: string };
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-5xl font-medium text-primary" dir="ltr">
        404
      </p>
      <h1 className="mt-4 font-display text-2xl font-medium text-ink">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{body}</p>
      {secondary && (
        <p
          lang={secondary.lang}
          dir={secondary.lang === "ar" ? "rtl" : "ltr"}
          className="mt-4 max-w-md text-xs text-ink-soft"
        >
          {secondary.text}
        </p>
      )}
      <Link href={homeHref} className={`${btnPrimary} mt-8`}>
        {homeLabel}
      </Link>
    </main>
  );
}
