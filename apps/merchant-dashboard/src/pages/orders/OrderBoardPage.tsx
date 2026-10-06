import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { ordersChangeStatus, type Order, type OrderPipeline, type OrderStage } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useOrderLabels } from "./orderLabels";
import { useOrderErrorMessage } from "./orderErrors";

const STRINGS = {
  en: {
    title: "Orders board",
    description: "Every order in its stage. Drag a card to another column, or use its menu, to move it on.",
    list: "List",
    refresh: "Refresh",
    empty: "No orders here",
    more: "Load more",
    loading: "Loading…",
    moveTo: "Move {order} to",
    moveLabel: "Move to…",
    moved: "{order} moved to {stage}.",
  },
  ar: {
    title: "لوحة الطلبات",
    description: "كل طلب في مرحلته. اسحب البطاقة لعمود آخر، أو استخدم قائمتها، لنقلها.",
    list: "القائمة",
    refresh: "تحديث",
    empty: "مفيش طلبات هنا",
    more: "عرض المزيد",
    loading: "بنحمّل…",
    moveTo: "نقل {order} إلى",
    moveLabel: "نقل إلى…",
    moved: "{order} اتنقل لـ «{stage}».",
  },
} satisfies Messages;

// The stages an order is worked through; cancelled and awaiting-payment orders stay in the list.
const COLUMNS: OrderStage[] = ["pending_confirmation", "needs_follow_up", "ready_to_ship", "shipped", "out_for_delivery", "delivery_failed", "delivered", "returned"];
const PAGE = 20;
const DRAG_TYPE = "application/x-zimos-order";

/**
 * The orders pipeline as a board (SPEC §4.3 "Pipeline page"): each column
 * pages its own stage from GET /orders?stage= with the cursor, and a move —
 * dragged or from the card's menu — is PATCH /orders/:id/status, so the
 * server's stage rules decide what is allowed.
 */
export function OrderBoardPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const labels = useOrderLabels();
  const errorMessage = useOrderErrorMessage();
  const counts = useAsync<OrderPipeline>(() => apiClient.getOrderPipeline(workspaceId), [workspaceId]);
  // Bumped to reload every column (refresh) or the two columns a move touched.
  const [version, setVersion] = useState<Record<string, number>>({});
  const [moving, setMoving] = useState<string | null>(null);

  const reload = useCallback(
    (stages: OrderStage[] = COLUMNS) => {
      setVersion((v) => Object.fromEntries(COLUMNS.map((s) => [s, (v[s] ?? 0) + (stages.includes(s) ? 1 : 0)])));
      void counts.refresh({ silent: true });
    },
    [counts]
  );

  async function move(order: Order, to: OrderStage) {
    const from = order.stage as OrderStage;
    if (!to || to === from) return;
    setMoving(order.id);
    try {
      await ordersChangeStatus(apiClient, workspaceId, order.id, { status: to });
      toast.success(fmt(t.moved, { order: order.orderNumber, stage: labels.stage(to) }));
      reload([from, to]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMoving(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/orders", label: t.list }}
        actions={
          <Button variant="outline" className="min-h-11" onClick={() => reload()}>
            <RefreshCw className="size-4" aria-hidden />
            {t.refresh}
          </Button>
        }
      />
      <DataState loading={counts.loading && !counts.data} error={counts.error} onRetry={() => void counts.refresh()}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((stage) => (
            <BoardColumn
              key={stage}
              stage={stage}
              count={counts.data?.stages[stage] ?? 0}
              version={version[stage] ?? 0}
              moving={moving}
              onMove={move}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function BoardColumn({
  stage,
  count,
  version,
  moving,
  onMove,
}: {
  stage: OrderStage;
  count: number;
  version: number;
  moving: string | null;
  onMove: (order: Order, to: OrderStage) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [over, setOver] = useState(false);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      try {
        const page = await apiClient.listOrders(workspaceId, { stage, limit: PAGE, ...(after ? { cursor: after } : {}) });
        setOrders((prev) => (after ? [...prev, ...page.orders] : page.orders));
        setCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, stage]
  );

  useEffect(() => {
    void load(null).catch(() => setOrders([]));
  }, [load, version]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    void onMove(JSON.parse(raw) as Order, stage);
  }

  return (
    <section
      aria-label={labels.stage(stage)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-[var(--radius-card)] border bg-paper-raised",
        over ? "border-primary ring-1 ring-primary/30" : "border-line"
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{labels.stage(stage)}</h2>
        <span className="rounded-full bg-paper px-2 text-xs font-medium text-ink-soft">{count}</span>
      </header>
      <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
        {orders.map((order) => (
          <li
            key={order.id}
            draggable={moving !== order.id}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(order));
              e.dataTransfer.effectAllowed = "move";
            }}
            className={cn("cursor-grab rounded-lg border border-line bg-paper p-3 text-sm shadow-sm", moving === order.id && "opacity-50")}
          >
            <div className="flex items-center justify-between gap-2">
              <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                <bdi dir="ltr">{order.orderNumber}</bdi>
              </Link>
              <span className="text-xs font-semibold text-ink">{formatMoney(order.totalAmount, order.currency)}</span>
            </div>
            <p className="mt-1 truncate text-ink">{order.contactSnapshot?.fullName || "—"}</p>
            <p className="text-xs text-ink-soft">{formatDateTime(order.createdAt)}</p>
            <Select
              aria-label={fmt(t.moveTo, { order: order.orderNumber })}
              value=""
              disabled={moving === order.id}
              onChange={(e) => void onMove(order, e.target.value as OrderStage)}
              className="mt-2 h-9 text-xs"
            >
              <option value="">{t.moveLabel}</option>
              {COLUMNS.filter((s) => s !== stage).map((s) => (
                <option key={s} value={s}>
                  {labels.stage(s)}
                </option>
              ))}
            </Select>
          </li>
        ))}
        {!loading && orders.length === 0 && <li className="px-1 py-6 text-center text-xs text-ink-soft">{t.empty}</li>}
        {loading && <li className="px-1 py-2 text-center text-xs text-ink-soft">{t.loading}</li>}
        {!loading && cursor && (
          <li>
            <Button type="button" size="sm" variant="ghost" className="min-h-11 w-full" onClick={() => void load(cursor)}>
              {t.more}
            </Button>
          </li>
        )}
      </ul>
    </section>
  );
}
