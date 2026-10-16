import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { protectionNetworkScores, type NetworkScore, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Customer delivery rate",
    tooltip: "Delivered {delivered} of {finished} orders",
    newCustomer: "New customer (no orders)",
    recommend: "Ask for a deposit or for the shipping fees upfront.",
  },
  ar: {
    label: "نسبة استلام العميل",
    tooltip: "استلم {delivered} من {finished} أوردر",
    newCustomer: "عميل جديد (بدون أوردرات)",
    recommend: "اطلب عربونًا أو مصاريف الشحن مقدمًا.",
  },
} satisfies Messages;

function toneOf(rate: number): string {
  if (rate < 50) return "bg-danger";
  if (rate < 75) return "bg-accent";
  return "bg-success";
}

/**
 * The 4-segment delivery-rate bar: how many of this customer's finished
 * orders, across every store, were actually delivered.
 */
export function NetworkRateBar({ score, showText = false }: { score: NetworkScore; showText?: boolean }) {
  const t = useT(STRINGS);
  const text =
    score.rate === null ? t.newCustomer : fmt(t.tooltip, { delivered: score.delivered, finished: score.finished });
  return (
    <span className="inline-flex flex-wrap items-center gap-2" title={`${t.label}: ${text}`}>
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${t.label}: ${text}`}>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn(
              "h-2 w-4 rounded-sm",
              score.rate !== null && n <= score.segments ? toneOf(score.rate) : "bg-line"
            )}
          />
        ))}
      </span>
      {score.rate !== null && (
        <bdi dir="ltr" className="text-xs font-medium text-ink">
          {score.rate}%
        </bdi>
      )}
      {showText && <span className="text-xs text-ink-soft">{text}</span>}
    </span>
  );
}

/** The recommendation line shown under a low rate. */
export function NetworkRateAdvice({ score }: { score: NetworkScore }) {
  const t = useT(STRINGS);
  if (!score.recommendDeposit) return null;
  return <p className="text-sm font-medium text-danger">{t.recommend}</p>;
}

const ScoresContext = createContext<Record<string, NetworkScore>>({});

/**
 * Loads the delivery rate of every customer on a page of orders in one call
 * and hands each row its score. Renders its children either way: while the
 * feature is off for the store, or the call fails, rows simply show no bar.
 */
export function NetworkScoresProvider({ orders, children }: { orders: readonly Order[]; children: ReactNode }) {
  const workspaceId = useWorkspaceId();
  const [scores, setScores] = useState<Record<string, NetworkScore>>({});
  const ids = useMemo(() => [...new Set(orders.map((o) => o.customerId).filter(Boolean))].sort(), [orders]);
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    protectionNetworkScores(apiClient, workspaceId, ids.slice(0, 200))
      .then((result) => {
        if (!cancelled && result.enabled) setScores((prev) => ({ ...prev, ...result.scores }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return <ScoresContext.Provider value={scores}>{children}</ScoresContext.Provider>;
}

/** A row's bar, inside a NetworkScoresProvider. Nothing until the score is known. */
export function OrderNetworkRate({ order }: { order: Order }) {
  const score = useContext(ScoresContext)[order.customerId];
  if (!score) return null;
  return <NetworkRateBar score={score} />;
}
