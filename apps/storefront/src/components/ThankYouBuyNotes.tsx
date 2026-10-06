"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/StoreContext";
import { formatShopDay, getOrderBuyNotes } from "@/lib/buyInfo";
import { useIsClient } from "@/lib/useIsClient";
import { BoxIcon } from "./Icons";
import { card } from "./ui";

/**
 * Thank-you page: the lines this device ordered as pre-orders, with their
 * ship date (handoff 195), read from what checkout answered. Nothing when
 * the order holds none.
 */
export function ThankYouBuyNotes({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const { t, intlLocale } = useStore();
  // localStorage, read once hydrated so the server and the first render agree.
  const isClient = useIsClient();
  const notes = useMemo(() => (isClient ? getOrderBuyNotes(workspaceId, orderId) : null), [isClient, workspaceId, orderId]);
  if (!notes || notes.preorders.length === 0) return null;
  return (
    <section className={`${card} mt-6 space-y-2 p-5 text-sm`}>
      {notes.preorders.map((line, i) => (
        <p key={i} className="flex items-start gap-2">
          <BoxIcon size={18} className="mt-0.5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="font-semibold text-ink">{t.buyInfo.preorderLine(formatShopDay(line.shipsAt, intlLocale))}</span>
            {line.name && <span className="block text-ink-soft">{line.name}</span>}
          </span>
        </p>
      ))}
    </section>
  );
}
