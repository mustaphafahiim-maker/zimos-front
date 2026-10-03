import { ordersStatusHistory, type Order, type OrderStatusHistoryEntry } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { STAGE_TONE, useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Status history",
    description: "Every change of this order's status, who made it and why.",
    empty: "No status changes recorded yet.",
    placed: "Order placed",
    by_user: "by {name}",
    by_userUnknown: "by a team member",
    by_system: "automatically",
    by_carrier: "by the courier",
    by_customer: "by the customer",
    by_api: "through the API",
    reason_baseline: "Status when history started",
    reason_payment_expired: "Payment window expired",
    reason_customer_blocked: "Customer is blocked",
    reason_switched_to_cod: "Switched to cash on delivery",
  },
  ar: {
    title: "سجل الحالات",
    description: "كل تغيير في حالة الأوردر، ومن قام به ولماذا.",
    empty: "لا توجد تغييرات مسجّلة بعد.",
    placed: "تم إنشاء الأوردر",
    by_user: "بواسطة {name}",
    by_userUnknown: "بواسطة أحد أعضاء الفريق",
    by_system: "تلقائيًا",
    by_carrier: "من شركة الشحن",
    by_customer: "من العميل",
    by_api: "عن طريق الـ API",
    reason_baseline: "الحالة عند بدء السجل",
    reason_payment_expired: "انتهت مهلة الدفع",
    reason_customer_blocked: "العميل محظور",
    reason_switched_to_cod: "تم التحويل إلى الدفع عند الاستلام",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function actorText(t: Strings, entry: OrderStatusHistoryEntry): string {
  if (entry.actorType === "user") {
    return entry.actorName ? t.by_user.replace("{name}", entry.actorName) : t.by_userUnknown;
  }
  return t[`by_${entry.actorType}`] ?? t.by_system;
}

function reasonText(t: Strings, reason: string | null): string | null {
  if (!reason) return null;
  const key = `reason_${reason}` as keyof Strings;
  return key in t ? t[key] : reason;
}

/**
 * The order's moves between stages, newest first. `refreshKey` changes when
 * the order is reloaded, so a change made on the page shows up at once.
 */
export function StatusHistorySection({ order, refreshKey }: { order: Order; refreshKey: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const history = useAsync(
    () => ordersStatusHistory(apiClient, workspaceId, order.id),
    [workspaceId, order.id, refreshKey]
  );
  const rows = history.data ? [...history.data].reverse() : [];

  return (
    <Section title={t.title} description={t.description}>
      <DataState
        loading={history.loading && !history.data}
        error={history.error}
        onRetry={() => history.refresh()}
        empty={rows.length === 0}
        emptyMessage={t.empty}
      >
        <ol className="space-y-3">
          {rows.map((entry) => {
            const reason = reasonText(t, entry.reason);
            return (
              <li key={entry.id} className="flex gap-3">
                <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-line-strong" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {entry.fromStatus ? (
                      <>
                        <StatusBadge
                          value={entry.fromStatus}
                          tone="neutral"
                          text={labels.stage(entry.fromStatus)}
                        />
                        <span aria-hidden className="text-ink-soft rtl:rotate-180">
                          →
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-soft">{t.placed}</span>
                    )}
                    <StatusBadge
                      value={entry.toStatus}
                      tone={STAGE_TONE[entry.toStatus]}
                      text={labels.stage(entry.toStatus)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    {" · "}
                    {actorText(t, entry)}
                  </p>
                  {reason && <p className="mt-1 text-sm text-ink">{reason}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </DataState>
    </Section>
  );
}
