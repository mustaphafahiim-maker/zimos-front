import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2, ShoppingBag, ShoppingCart, Users, Wallet } from "lucide-react";
import { Button, Card, cn } from "@store-builder/ui";
import { funnelsList, liveStreamUrl, type LiveBlock, type LiveSnapshot, type LiveStreamEvent } from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { Select } from "@/components/Select";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    live: "Live",
    reconnecting: "Reconnecting…",
    allStore: "Whole store",
    funnelFilter: "Store or funnel",
    fullscreen: "Full screen",
    visitorsToday: "Visitors today",
    ordersToday: "Orders today",
    salesToday: "Sales today",
    checkingOut: "Checking out now",
    noCheckouts: "Nobody is at checkout right now.",
    checkout: "{items} items · {amount}",
    purchases: "Latest purchases",
    noPurchases: "No orders in the last 24 hours.",
    sec: "{s}s ago",
    min: "{m} min ago",
    hour: "{h} h ago",
    funnel: "Funnel",
  },
  ar: {
    live: "مباشر",
    reconnecting: "جارٍ إعادة الاتصال…",
    allStore: "المتجر كله",
    funnelFilter: "المتجر أو مسار البيع",
    fullscreen: "ملء الشاشة",
    visitorsToday: "زوار اليوم",
    ordersToday: "طلبات اليوم",
    salesToday: "مبيعات اليوم",
    checkingOut: "يُتمّون الطلب الآن",
    noCheckouts: "لا أحد في صفحة إتمام الطلب الآن.",
    checkout: "{items} منتج · {amount}",
    purchases: "أحدث المشتريات",
    noPurchases: "لا توجد طلبات خلال آخر 24 ساعة.",
    sec: "منذ {s} ث",
    min: "منذ {m} د",
    hour: "منذ {h} س",
    funnel: "مسار بيع",
  },
} satisfies Messages;

/**
 * The live stream (SPEC §15.2): the newest snapshot the server pushed, and
 * whether the stream is connected. A dropped connection is reopened with a
 * fresh ticket, backing off up to 30 s; while it is down the page's own
 * polling keeps the numbers moving.
 */
export function useLiveView(workspaceId: string, funnelId: string) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!workspaceId || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;
    setSnapshot(null);

    const schedule = () => {
      if (closed) return;
      setConnected(false);
      retry += 1;
      timer = window.setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** Math.min(retry, 5)));
    };
    const connect = async () => {
      if (closed) return;
      try {
        const url = await liveStreamUrl(apiClient, workspaceId, apiBaseUrl, funnelId || undefined);
        if (closed) return;
        source = new EventSource(url);
        source.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data) as LiveStreamEvent;
            if (event.type !== "snapshot") return;
            retry = 0;
            setConnected(true);
            setSnapshot(event);
          } catch {
            /* not ours */
          }
        };
        source.onerror = () => {
          // The ticket in this URL is spent: never let EventSource retry it.
          source?.close();
          source = null;
          schedule();
        };
      } catch {
        schedule();
      }
    };
    void connect();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      source?.close();
      setConnected(false);
    };
  }, [workspaceId, funnelId]);

  return { snapshot, connected };
}

/** Today's numbers, who is checking out, the latest purchases, the funnel filter and full screen. */
export function LivePanel({
  workspaceId,
  live,
  connected,
  funnelId,
  onFunnelChange,
  fullscreenTarget,
}: {
  workspaceId: string;
  live: LiveBlock | null;
  connected: boolean;
  funnelId: string;
  onFunnelChange: (funnelId: string) => void;
  /** The element the full-screen button expands. */
  fullscreenTarget: React.RefObject<HTMLElement | null>;
}) {
  const t = useT(STRINGS);
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  // Re-render every few seconds so "12s ago" keeps counting between snapshots.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return fmt(t.sec, { s });
    if (s < 3600) return fmt(t.min, { m: Math.floor(s / 60) });
    return fmt(t.hour, { h: Math.floor(s / 3600) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-[0.5rem] border px-3 text-sm font-medium",
            connected ? "border-success/40 text-success" : "border-line text-ink-soft"
          )}
          role="status"
        >
          <span className={cn("size-2 rounded-full", connected ? "animate-pulse bg-success" : "bg-line-strong")} aria-hidden />
          {connected ? t.live : t.reconnecting}
        </span>
        {(funnels.data?.length ?? 0) > 0 && (
          <Select
            aria-label={t.funnelFilter}
            value={funnelId}
            onChange={(e) => onFunnelChange(e.target.value)}
            className="h-9 w-auto max-w-[14rem] font-medium"
          >
            <option value="">{t.allStore}</option>
            {funnels.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ms-auto"
          onClick={() => {
            const el = fullscreenTarget.current;
            if (!el) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen?.();
          }}
        >
          <Maximize2 className="size-4" aria-hidden />
          {t.fullscreen}
        </Button>
      </div>

      {live && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Today icon={<Users />} label={t.visitorsToday} value={formatCount(live.today.visitors)} />
            <Today icon={<ShoppingBag />} label={t.ordersToday} value={formatCount(live.today.orders)} />
            <Today icon={<Wallet />} label={t.salesToday} value={formatMoney(live.today.sales, live.currency)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <ShoppingCart className="size-4" aria-hidden />
                {t.checkingOut}
                <bdi dir="ltr" className="tabular-nums text-ink-soft">
                  {formatCount(live.checkingOut.length)}
                </bdi>
              </h2>
              {live.checkingOut.length === 0 ? (
                <p className="py-3 text-sm text-ink-soft">{t.noCheckouts}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {live.checkingOut.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink" dir="auto">
                        {fmt(t.checkout, { items: c.items, amount: formatMoney(c.subtotalAmount, c.currency) })}
                        {c.governorate ? ` · ${c.governorate}` : ""}
                        {c.source === "funnel" ? ` · ${t.funnel}` : ""}
                      </span>
                      <span className="tabular-nums shrink-0 text-xs text-ink-soft">{ago(c.lastActivityAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <ShoppingBag className="size-4" aria-hidden />
                {t.purchases}
              </h2>
              {live.purchases.length === 0 ? (
                <p className="py-3 text-sm text-ink-soft">{t.noPurchases}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {live.purchases.map((p) => (
                    <li key={p.orderId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link to={`/orders/${p.orderId}`} className="min-w-0 truncate text-ink hover:text-primary">
                        <bdi dir="ltr" className="font-medium">
                          {p.orderNumber}
                        </bdi>
                        {p.governorate ? ` · ${p.governorate}` : ""}
                        {p.inFunnel ? ` · ${t.funnel}` : ""}
                      </Link>
                      <span className="shrink-0 text-end">
                        <bdi dir="ltr" className="tabular-nums block font-medium text-ink">
                          {formatMoney(p.totalAmount, p.currency)}
                        </bdi>
                        <span className="tabular-nums text-xs text-ink-soft">{ago(p.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Today({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-soft [&>svg]:size-4">
        {icon}
        {label}
      </div>
      <p className="tabular-nums mt-1 text-3xl font-semibold tracking-tight text-ink">
        <bdi dir="ltr">{value}</bdi>
      </p>
    </Card>
  );
}
