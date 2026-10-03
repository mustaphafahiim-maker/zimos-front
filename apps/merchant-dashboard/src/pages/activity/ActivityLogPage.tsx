import { useState } from "react";
import { History } from "lucide-react";
import { activityLogList, type ActivityLogEntry } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";

/**
 * Activity log (SPEC §17.2): who did what in the store and when, newest
 * first, from the audit trail every change already writes.
 */

const STRINGS = {
  en: {
    title: "Activity log",
    description: "Every change made in this store: who made it and when.",
    area: "Area",
    person: "Person",
    period: "Period",
    all: "Everything",
    everyone: "Everyone",
    anytime: "Any time",
    today: "Today",
    week: "Last 7 days",
    month: "Last 30 days",
    emptyTitle: "Nothing recorded",
    emptyBody: "No change matches these filters.",
    system: "System",
    details: "Details",
    before: "Before",
    after: "After",
    "area.order": "Orders",
    "area.shipment": "Shipments",
    "area.product": "Products",
    "area.customer": "Customers",
    "area.discount": "Discounts",
    "area.membership": "Team",
    "area.role": "Roles",
    "area.workspace": "Store settings",
    "area.funnel": "Funnels",
    "area.website": "Store design",
    "area.webhook": "Webhooks",
    "area.api_key": "API keys",
    "area.app": "Apps",
    "area.support": "Support access",
    "area.automation": "Automations",
  },
  ar: {
    title: "سجل النشاط",
    description: "كل تغيير اتعمل في المتجر: مين عمله وإمتى.",
    area: "القسم",
    person: "الشخص",
    period: "الفترة",
    all: "الكل",
    everyone: "الكل",
    anytime: "أي وقت",
    today: "النهارده",
    week: "آخر ٧ أيام",
    month: "آخر ٣٠ يوم",
    emptyTitle: "مفيش حاجة مسجّلة",
    emptyBody: "مفيش تغيير مطابق للفلاتر دي.",
    system: "النظام",
    details: "التفاصيل",
    before: "قبل",
    after: "بعد",
    "area.order": "الطلبات",
    "area.shipment": "الشحنات",
    "area.product": "المنتجات",
    "area.customer": "العملاء",
    "area.discount": "الخصومات",
    "area.membership": "الفريق",
    "area.role": "الأدوار",
    "area.workspace": "إعدادات المتجر",
    "area.funnel": "الفانلز",
    "area.website": "تصميم المتجر",
    "area.webhook": "الـ Webhooks",
    "area.api_key": "مفاتيح الـ API",
    "area.app": "التطبيقات",
    "area.support": "إذن الدعم",
    "area.automation": "الأتمتة",
  },
} satisfies Messages;

const AREAS = ["order", "shipment", "product", "customer", "discount", "membership", "role", "workspace", "funnel", "website", "webhook", "api_key", "app", "support", "automation"];
const PAGE = 40;
type Period = "any" | "today" | "week" | "month";

function fromOf(period: Period): string | undefined {
  if (period === "any") return undefined;
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return new Date(now.getTime() - (period === "week" ? 7 : 30) * 86400000).toISOString();
}

/** "order.status_change" → "Order · status change" */
const readable = (action: string) => {
  const [head, ...rest] = action.split(".");
  const words = (text: string) => text.replace(/_/g, " ");
  return rest.length ? `${words(head)[0].toUpperCase()}${words(head).slice(1)} · ${words(rest.join(" "))}` : words(action);
};

export function ActivityLogPage() {
  const t = useT(STRINGS);
  const labels = t as Record<string, string>;
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [area, setArea] = useState("");
  const [person, setPerson] = useState("");
  const [period, setPeriod] = useState<Period>("any");
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const members = useAsync(() => apiClient.listWorkspaceMembers(workspaceId).catch(() => []), [workspaceId]);
  const query = { action: area || undefined, actorUserId: person || undefined, from: fromOf(period), limit: PAGE };

  const first = useAsync(async () => {
    const page = await activityLogList(apiClient, workspaceId, query);
    setRows(page.logs);
    setCursor(page.nextCursor);
    return page;
  }, [workspaceId, area, person, period]);

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await activityLogList(apiClient, workspaceId, { ...query, before: cursor });
      setRows((prev) => [...prev, ...page.logs]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMore(false);
    }
  }

  const people = (members.data ?? []).filter((m) => m.user);

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label={t.area} className="h-9 w-auto" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">
            {t.area}: {t.all}
          </option>
          {AREAS.map((key) => (
            <option key={key} value={key}>
              {labels[`area.${key}`]}
            </option>
          ))}
        </Select>
        <Select aria-label={t.person} className="h-9 w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">
            {t.person}: {t.everyone}
          </option>
          {people.map((member) => (
            <option key={member.id} value={member.user?.id ?? ""}>
              {member.user?.fullName || member.user?.email}
            </option>
          ))}
        </Select>
        <Select aria-label={t.period} className="h-9 w-auto" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="any">
            {t.period}: {t.anytime}
          </option>
          <option value="today">{t.today}</option>
          <option value="week">{t.week}</option>
          <option value="month">{t.month}</option>
        </Select>
      </div>

      <DataState loading={first.loading} error={first.error} onRetry={() => void first.refresh()}>
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title={t.emptyTitle} description={t.emptyBody} />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-md border border-line bg-paper-raised">
              {rows.map((row) => {
                const hasDetails = row.before !== null || row.after !== null;
                return (
                  <li key={row.id} className="p-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-ink">{readable(row.action)}</span>
                      <span className="text-xs text-ink-soft">
                        {row.actor ? row.actor.fullName || row.actor.email : t.system} · {new Date(row.createdAt).toLocaleString()}
                        {row.ipAddress ? (
                          <>
                            {" · "}
                            <span dir="ltr">{row.ipAddress}</span>
                          </>
                        ) : null}
                      </span>
                      {hasDetails && (
                        <button
                          type="button"
                          className="ms-auto text-xs font-medium text-primary hover:underline"
                          aria-expanded={open === row.id}
                          onClick={() => setOpen(open === row.id ? null : row.id)}
                        >
                          {t.details}
                        </button>
                      )}
                    </div>
                    {open === row.id && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            [t.before, row.before],
                            [t.after, row.after],
                          ] as const
                        ).map(([label, value]) =>
                          value === null || value === undefined ? null : (
                            <div key={label} className="min-w-0">
                              <p className="text-xs font-medium text-ink-soft">{label}</p>
                              <pre dir="ltr" className="mt-1 max-h-56 overflow-auto rounded-md bg-paper p-2 text-start font-mono text-xs text-ink">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <LoadMore hasMore={Boolean(cursor)} loading={more} onClick={loadMore} />
          </>
        )}
      </DataState>
    </div>
  );
}
