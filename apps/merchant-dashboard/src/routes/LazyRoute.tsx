import { Suspense, type ReactNode } from "react";
import { Spinner } from "@store-builder/ui";

/**
 * Suspense boundary for a route whose page is code-split with `lazy()`.
 *
 * The dashboard has no app-level Suspense boundary — every other page is
 * imported eagerly — so a lazy route has to bring its own. Wrapping here
 * rather than in App.tsx keeps the route table to one line per page and gives
 * the chunk fetch the same spinner a data load gets.
 */
export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-ink-soft">
          <Spinner className="size-6" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
