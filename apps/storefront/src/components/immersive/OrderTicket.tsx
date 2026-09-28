"use client";

import { useStore } from "@/lib/StoreContext";
import { TiltCard } from "./TiltCard";

/**
 * The order as a keepsake: a ticket with a foil sheen that leans as the shopper
 * moves the phone, carrying the order number, the store's name and the total.
 *
 * It replaces nothing — the full order summary still sits below it. This is the
 * part that is nice to screenshot and send to someone.
 *
 * The foil and the lean come from TiltCard, which switches itself off for
 * reduced motion and weak devices; the ticket then reads as a plain card.
 */
export function OrderTicket({
  orderNumber,
  total,
  currency,
  storeName,
  note,
}: {
  orderNumber: string;
  total?: number | null;
  currency?: string;
  storeName: string;
  note?: string;
}) {
  const { t, money } = useStore();

  return (
    <TiltCard className="rounded-2xl" max={8}>
      <div
        className="relative overflow-hidden rounded-2xl border border-line px-5 py-5 text-on-primary sm:px-6"
        style={{
          background:
            "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-accent) 65%, var(--color-primary)) 60%, var(--color-primary-dark) 100%)",
        }}
      >
        {/* The perforated edge of a real ticket stub. */}
        <span
          aria-hidden
          className="absolute inset-y-0 end-16 w-px"
          style={{
            background:
              "repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-paper-raised) 70%, transparent) 0 6px, transparent 6px 12px)",
          }}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-primary/70">
              {t.immersive.ticketOrder}
            </p>
            <p dir="ltr" className="mt-1 text-2xl font-bold tabular-nums">
              #{orderNumber}
            </p>
            <p className="mt-2 truncate text-sm text-on-primary/85">{storeName}</p>
          </div>

          {typeof total === "number" ? (
            <div className="shrink-0 text-end">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-primary/70">
                {t.immersive.ticketTotal}
              </p>
              <p className="mt-1 text-lg font-bold">{money(total, currency)}</p>
            </div>
          ) : null}
        </div>

        {note ? <p className="mt-4 border-t border-on-primary/20 pt-3 text-xs text-on-primary/85">{note}</p> : null}
      </div>
    </TiltCard>
  );
}
