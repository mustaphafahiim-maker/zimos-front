import { ordersSessionDetails, type OrderSessionDetails, type OrderStage, type OrderTimelineEvent } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, humanize } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Session details",
    description: "What the customer did on the store before ordering.",
    untracked: "The store's analytics did not see this customer (an order typed in by hand, or a browser that blocks tracking).",
    pagesTitle: "Pages viewed",
    pagesMore: "The last {shown} of {total} pages.",
    noPages: "No pages recorded.",
    home: "Home page",
    firstVisit: "First visit",
    timeToPurchase: "Time to order",
    pageViews: "Pages viewed",
    customerOrders: "Customer's orders",
    orderSequence: "Order #{n} of this customer",
    firstOrder: "First order",
    inAll: "{n} in all",
    newCustomer: "New customer",
    returning: "Returning customer · {orders}",
    sec: "{n} s",
    min: "{n} min",
    hours: "{h} h {m} min",
    days: "{days}",
    lastAction: "Last action: {what}, {when}",
    lastActionBy: "Last action: {what}, {when} {by}",
    placed: "Order placed",
    movedTo: "Moved to {stage}",
    note: "Note added",
    automation: "Automation {trigger}",
    webhook: "Webhook {event}",
    courier: "Courier update",
    "a_order.meta_update": "Order details updated",
    "a_order.update": "Order edited",
    "a_order.items_update": "Products edited",
    "a_shipment.create": "Shipment created",
    "a_shipment.update": "Shipment updated",
    "a_refund.create": "Refund recorded",
    by_user: "by {name}",
    by_userUnknown: "by a team member",
    by_carrier: "by the courier",
    by_customer: "by the customer",
    by_api: "through the API",
  },
  ar: {
    title: "تفاصيل الجلسة",
    description: "عمل إيه العميل في المتجر قبل ما يطلب.",
    untracked: "تحليلات المتجر مشافتش العميل ده (أوردر متسجّل يدوي، أو متصفح بيمنع التتبع).",
    pagesTitle: "الصفحات اللي شافها",
    pagesMore: "آخر {shown} من {total} صفحة.",
    noPages: "مفيش صفحات متسجّلة.",
    home: "الصفحة الرئيسية",
    firstVisit: "أول زيارة",
    timeToPurchase: "الوقت لحد الطلب",
    pageViews: "عدد الصفحات",
    customerOrders: "أوردرات العميل",
    orderSequence: "الأوردر رقم {n} للعميل ده",
    firstOrder: "أول أوردر",
    inAll: "{n} إجمالي",
    newCustomer: "عميل جديد",
    returning: "عميل متكرر · {orders}",
    sec: "{n} ث",
    min: "{n} د",
    hours: "{h} س {m} د",
    days: "{days}",
    lastAction: "آخر إجراء: {what}، {when}",
    lastActionBy: "آخر إجراء: {what}، {when} {by}",
    placed: "اتطلب",
    movedTo: "اتنقل لـ {stage}",
    note: "اتضافت ملاحظة",
    automation: "أتمتة {trigger}",
    webhook: "ويب هوك {event}",
    courier: "تحديث من شركة الشحن",
    "a_order.meta_update": "اتحدّثت بيانات الأوردر",
    "a_order.update": "اتعدّل الأوردر",
    "a_order.items_update": "اتعدّلت المنتجات",
    "a_shipment.create": "اتعملت شحنة",
    "a_shipment.update": "اتحدّثت الشحنة",
    "a_refund.create": "اتسجّل استرداد",
    by_user: "بواسطة {name}",
    by_userUnknown: "بواسطة عضو في الفريق",
    by_carrier: "من شركة الشحن",
    by_customer: "من العميل",
    by_api: "عن طريق الـ API",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

/** The order page's session details, customer history and last action; reloaded with the order. */
export function useOrderSessionDetails(orderId: string | undefined, refreshKey: string) {
  const workspaceId = useWorkspaceId();
  return useAsync(
    () => (orderId ? ordersSessionDetails(apiClient, workspaceId, orderId) : Promise.resolve(null)),
    [workspaceId, orderId, refreshKey]
  );
}

function duration(t: Strings, seconds: number): string {
  if (seconds < 60) return fmt(t.sec, { n: seconds });
  if (seconds < 3600) return fmt(t.min, { n: Math.round(seconds / 60) });
  if (seconds < 2 * 86400) return fmt(t.hours, { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60) });
  return fmt(t.days, { days: countOf("day", Math.round(seconds / 86400)) });
}

/** "Last action: Moved to Confirmed, 4 Oct 2026, 16:15 by Mona" — for the header line. */
export function useLastActionText(): (event: OrderTimelineEvent | null | undefined) => string | null {
  const t = useT(STRINGS) as Strings;
  const labels = useOrderLabels();
  return (event) => {
    if (!event) return null;
    const d = event.data;
    const what =
      event.type === "status"
        ? d.from
          ? fmt(t.movedTo, { stage: labels.stage(d.to as OrderStage) })
          : t.placed
        : event.type === "note"
          ? t.note
          : event.type === "automation"
            ? fmt(t.automation, { trigger: String(d.trigger ?? "") })
            : event.type === "webhook"
              ? fmt(t.webhook, { event: String(d.eventType ?? "") })
              : event.type === "courier"
                ? t.courier
                : ((t as Record<string, string>)[`a_${String(d.action)}`] ?? humanize(String(d.action ?? "").replace(/\./g, " ")));
    const a = event.actor;
    const by =
      a.type === "user"
        ? a.name
          ? fmt(t.by_user, { name: a.name })
          : t.by_userUnknown
        : ((t as Record<string, string>)[`by_${a.type}`] ?? "");
    const when = formatDateTime(event.at);
    return by ? fmt(t.lastActionBy, { what, when, by }) : fmt(t.lastAction, { what, when });
  };
}

/** "New customer" / "Returning customer · 4 orders", next to the order's other badges. */
export function CustomerHistoryBadge({ details }: { details: OrderSessionDetails | null | undefined }) {
  const t = useT(STRINGS) as Strings;
  const c = details?.customer;
  if (!c || c.orderSequence === null) return null;
  return c.isNewCustomer ? (
    <StatusBadge value="new_customer" tone="success" text={t.newCustomer} />
  ) : (
    <StatusBadge value="returning_customer" tone="info" text={fmt(t.returning, { orders: countOf("order", c.totalOrders) })} />
  );
}

/** A stored page path as the merchant reads it: without the dev `/store/<id>` prefix. */
function pagePath(path: string): string {
  const stripped = path.replace(/^\/store\/[0-9a-f-]{36}(?=\/|$)/i, "");
  return stripped || "/";
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-36 shrink-0 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-ink">{value}</dd>
    </div>
  );
}

/** SPEC §4.4 card 4 + the "first order" of card 5. Nothing while loading or when it could not load. */
export function OrderSessionCard({ details }: { details: OrderSessionDetails | null | undefined }) {
  const t = useT(STRINGS) as Strings;
  if (!details) return null;
  const c = details.customer;
  const sequence = c && c.orderSequence !== null ? (c.orderSequence === 1 ? t.firstOrder : fmt(t.orderSequence, { n: c.orderSequence })) : null;

  return (
    <Section title={t.title} description={t.description}>
      <div className="space-y-4">
        <dl className="space-y-1 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:space-y-0">
          <Fact label={t.customerOrders} value={sequence && c ? `${sequence} · ${fmt(t.inAll, { n: c.totalOrders })}` : null} />
          <Fact label={t.firstVisit} value={details.firstVisitAt ? formatDateTime(details.firstVisitAt) : null} />
          <Fact
            label={t.timeToPurchase}
            value={details.timeToPurchaseSeconds !== null ? duration(t, details.timeToPurchaseSeconds) : null}
          />
          <Fact label={t.pageViews} value={details.tracked ? String(details.pageViews) : null} />
        </dl>

        {!details.tracked ? (
          <p className="text-sm text-ink-soft">{t.untracked}</p>
        ) : (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.pagesTitle}</h3>
            {details.pages.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noPages}</p>
            ) : (
              <>
                <ol className="max-h-72 space-y-1 overflow-y-auto border-s border-line ps-3 text-sm">
                  {details.pages.map((page, i) => {
                    const path = pagePath(page.path);
                    return (
                      <li key={`${page.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="min-w-0 text-ink">{page.title || (path === "/" ? t.home : path)}</span>
                        <bdi dir="ltr" className="min-w-0 break-all text-xs text-ink-soft">
                          {path}
                        </bdi>
                        <time dateTime={page.at} className="ms-auto text-xs text-ink-soft">
                          {formatDateTime(page.at)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
                {details.pageViews > details.pages.length && (
                  <p className="mt-1 text-xs text-ink-soft">{fmt(t.pagesMore, { shown: details.pages.length, total: details.pageViews })}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
