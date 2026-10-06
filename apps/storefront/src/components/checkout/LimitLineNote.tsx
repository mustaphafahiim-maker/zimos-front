"use client";

import { useMemo, useState } from "react";
import { purchaseLimitProblems, type PurchaseLimitProblem } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { limitProblemText } from "@/lib/buyInfo";

export interface LimitNotes {
  problems: PurchaseLimitProblem[];
  /** Keeps the refused products of a failed checkout (none for any other failure). */
  capture: (err: unknown) => void;
}

/**
 * The checkout's purchase-limit refusals (handoff 198), kept per product so
 * each summary line can say its own; forgotten as soon as the cart changes.
 */
export function useLimitNotes(cart: unknown): LimitNotes {
  const [problems, setProblems] = useState<PurchaseLimitProblem[]>([]);
  const [seen, setSeen] = useState(cart);
  if (seen !== cart) {
    setSeen(cart);
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
