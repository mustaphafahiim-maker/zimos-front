"use client";

import { useMemo, useState } from "react";
import { purchaseLimitProblems, type PurchaseLimitProblem } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { limitProblemText } from "@/lib/buyInfo";

/** The cart's lines as text: variant and quantity of each, in order. */
function linesKey(cart: unknown): string {
  const items = (cart as { items?: Array<{ variantId?: string; quantity?: number }> } | null | undefined)?.items;
  return Array.isArray(items) ? items.map((item) => `${item.variantId}:${item.quantity}`).join("|") : "";
}

export interface LimitNotes {
  problems: PurchaseLimitProblem[];
  /** Keeps the refused products of a failed checkout (none for any other failure). */
  capture: (err: unknown) => void;
}

/**
 * The checkout's purchase-limit refusals, kept per product so
 * each summary line can say its own; forgotten as soon as the cart changes.
 */
export function useLimitNotes(cart: unknown): LimitNotes {
  const [problems, setProblems] = useState<PurchaseLimitProblem[]>([]);
  // What the cart holds, not which object carries it: a cart handed over anew on every render is still the same cart.
  const lines = linesKey(cart);
  const [seen, setSeen] = useState(lines);
  if (seen !== lines) {
    setSeen(lines);
    setProblems([]);
  }
  return useMemo(() => ({ problems, capture: (err: unknown) => setProblems(purchaseLimitProblems(err)) }), [problems]);
}

/** Under a summary line: what the product's limits refused, in the shopper's words. */
export function LimitLineNote({ notes, productId }: { notes: LimitNotes; productId: string | null | undefined }) {
  const { t } = useStore();
  const mine = productId ? notes.problems.filter((p) => p.productId === productId) : [];
  if (mine.length === 0) return null;
  return (
    <span className="mt-1 block text-xs font-medium text-danger">{mine.map((p) => limitProblemText(p, t.buyInfo, false)).join(" · ")}</span>
  );
}
