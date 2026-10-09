import { Suspense, type ReactNode } from "react";
import { CardSkeleton, PageSkeleton } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "بيحمّل…" },
} satisfies Messages;

/**
 * What stands in for a page while its code is fetched: never a bare spinner,
 * always the shape of what is coming.
 *
 * Inside the dashboard's page pane (`<main>`) that is a page — a title and a
 * description line where PageHeader sits, four tiles, a card of lines — with
 * the spacing of a real page, so nothing jumps when the page arrives. Outside
 * it (the full-screen editors, the app-consent page) there is no page column
 * to stand in, so it is one card in the middle. Both are drawn and CSS shows
 * the one that fits, which keeps this free of layout knowledge.
 */
function RouteSkeleton() {
  const t = useT(STRINGS);
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden>
        <div className="hidden [main_&]:block">
          <PageSkeleton />
        </div>
        <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center p-4 [main_&]:hidden">
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}

/**
 * Suspense boundary for a route whose page is code-split with `lazy()`.
 *
 * The dashboard has no app-level Suspense boundary — every other page is
 * imported eagerly — so a lazy route has to bring its own. Wrapping here
 * rather than in App.tsx keeps the route table to one line per page and gives
 * the chunk fetch the same skeleton a data load gets (components/DataState.tsx).
 *
 * `fallback` replaces the skeleton for a page with a shape of its own.
 */
export function LazyRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <RouteSkeleton />}>{children}</Suspense>;
}
