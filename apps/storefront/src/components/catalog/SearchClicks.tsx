"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { storefrontSearchClick } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { swipeStep } from "@/lib/swipe";

/**
 * Reports the result a shopper opens from a search (frontend-handoff 211:
 * POST /store/:ws/search/click). It wraps the grid of matches and listens for
 * a click on any link to one of them — the picture, the name, a middle-click
 * into a new tab — so the product card itself stays as it is. The server
 * counts the first click of a search only, so one report is sent per search.
 *
 * Only the first page of a search has a `searchId`. It is kept for this tab
 * (sessionStorage, an hour — the server's own window), so a result opened
 * from page 2 of the same search still counts.
 */

const HOUR_MS = 60 * 60 * 1000;
const storageKey = (workspaceId: string) => `zimos_search_${workspaceId}`;

interface Kept {
  q: string;
  id: string;
  at: number;
}

function keep(workspaceId: string, value: Kept): void {
  try {
    window.sessionStorage.setItem(storageKey(workspaceId), JSON.stringify(value));
  } catch {
    /* storage blocked: page 1 still reports from its own id */
  }
}

function kept(workspaceId: string, query: string): string | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey(workspaceId)) ?? "null") as Kept | null;
    return value && value.q === query && Date.now() - value.at < HOUR_MS ? value.id : null;
  } catch {
    return null;
  }
}

/** "/store/x/products/demo-t-shirt?from=…" → "demo-t-shirt"; null for any other link. */
function productSlugOf(href: string | null): string | null {
  if (!href) return null;
  try {
    const match = /\/products\/([^/]+)\/?$/.exec(new URL(href, window.location.origin).pathname);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function SearchClicks({
  searchId,
  query,
  products,
  children,
}: {
  /** The search's id (first page), or null. */
  searchId: string | null;
  query: string;
  /** The matches shown, to tell which product a link leads to. */
  products: Array<{ id: string; slug: string }>;
  children: ReactNode;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  // One report per search: the id it was sent for.
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (searchId) keep(workspaceId, { q: query, id: searchId, at: Date.now() });
  }, [workspaceId, query, searchId]);

  // Where the press began: a card with several photos turns a sideways drag over
  // its picture into "next photo" and swallows the click that follows (ProductCard).
  const pressed = useRef<{ x: number; y: number } | null>(null);

  function onOpen(e: MouseEvent<HTMLDivElement>) {
    const start = pressed.current;
    pressed.current = null;
    // A right-click opens a menu, not the product; a swipe turns the photo.
    if (e.button === 2) return;
    if (start && swipeStep(start, { x: e.clientX, y: e.clientY }, 1) !== null) return;
    const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
    const slug = productSlugOf(link?.getAttribute("href") ?? null);
    const product = slug ? products.find((p) => p.slug === slug) : undefined;
    if (!product) return;
    const id = searchId ?? kept(workspaceId, query);
    if (!id || reported.current === id) return;
    reported.current = id;
    void storefrontSearchClick(createStorefrontApiClient(), workspaceId, { searchId: id, productId: product.id });
  }

  return (
    <div
      onPointerDownCapture={(e) => {
        pressed.current = { x: e.clientX, y: e.clientY };
      }}
      onClickCapture={onOpen}
      onAuxClickCapture={onOpen}
    >
      {children}
    </div>
  );
}
