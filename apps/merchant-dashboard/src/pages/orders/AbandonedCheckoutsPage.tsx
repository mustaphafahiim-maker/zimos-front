import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button, Textarea } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT, useCommon, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ltr } from "./orderLabels";

const STOREFRONT_URL = ((import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "http://localhost:3000").replace(/\/+$/, "");

/** GET /workspaces/:ws/checkout-sessions — real sessions recorded by the storefront checkout forms. */
type RecoveryStatus = "not_contacted" | "contacted" | "recovered" | "lost";
type View = "abandoned" | "converted" | "all";
interface CheckoutSession {
  id: string;
  status: "in_progress" | "abandoned" | "converted";
  recoveryStatus: RecoveryStatus;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  items: Array<{ productName: string | null; quantity: number; lineTotalAmount: number; offerName: string | null }>;
  subtotalAmount: number;
  currency: string;
  source: "store" | "funnel";
  lastActivityAt: string;
  contactedAt: string | null;
  convertedOrder: { id: string; orderNumber: string } | null;
}

const STRINGS = {
  en: {
    title: "Abandoned checkouts",
    description: "Shoppers who typed their number on a checkout form and left without ordering (no activity for 30 minutes).",
    viewAbandoned: "Abandoned",
    viewConverted: "Ordered later",
    viewAll: "All",
    kpiRecoverable: "Value to recover",
    kpiRecoverableHint: "Not contacted or contacted",
    kpiRecovered: "Recovered",
    kpiRecoveredHint: "Orders placed after you reached out",
    kpiRate: "Recovery rate",
    kpiRateHint: "Recovered ÷ (recovered + lost)",
    anyStatus: "Any status",
    statusFilter: "Filter by recovery status",
    statusNotContacted: "Not contacted",
    statusContacted: "Contacted",
    statusRecovered: "Recovered",
    statusLost: "Lost",
    stateAbandoned: "Abandoned",
    stateInProgress: "Still filling in",
    stateConverted: "Ordered",
    colCustomer: "Customer",
    colItems: "Items",
    colTotal: "Subtotal",
    colState: "State",
    colSource: "Source",
    colRecovery: "Recovery",
    colLastActivity: "Last activity",
    anonymous: "Unnamed shopper",
    noContact: "No contact",
    moreItems: "+{n} more",
    sourceStore: "Store",
    sourceFunnel: "Funnel",
    order: "Order #{number}",
    sendWhatsApp: "Message on WhatsApp",
    noPhone: "No phone number",
    markRecovered: "Recovered",
    markLost: "Lost",
    markedRecovered: "Marked as recovered.",
    markedLost: "Marked as lost.",
    updateError: "Couldn't update this checkout.",
    empty: "No abandoned checkouts yet. They appear here when a shopper types their number and leaves.",
    loadMore: "Load more",
    modalTitle: "Send a WhatsApp message",
    modalTo: "To {name} · {phone}",
    modalHint: "WhatsApp opens with this message. The checkout is marked as contacted.",
    openWhatsApp: "Open WhatsApp",
    customer: "customer",
  },
  ar: {
    title: "السلات المتروكة",
    description: "عملاء كتبوا رقمهم في فورم الطلب ومشيوا من غير ما يطلبوا (مفيش أي نشاط من 30 دقيقة).",
    viewAbandoned: "متروكة",
    viewConverted: "طلبوا بعدين",
    viewAll: "الكل",
    kpiRecoverable: "قيمة ممكن ترجع",
    kpiRecoverableHint: "اللي لسه متكلمناش معاهم أو كلمناهم",
    kpiRecovered: "رجعت",
    kpiRecoveredHint: "طلبات اتعملت بعد ما كلمتهم",
    kpiRate: "نسبة الاسترجاع",
    kpiRateHint: "اللي رجعت ÷ (اللي رجعت + اللي ضاعت)",
    anyStatus: "كل الحالات",
    statusFilter: "فلترة حسب حالة المتابعة",
    statusNotContacted: "متكلمناش معاه",
    statusContacted: "اتكلمنا معاه",
    statusRecovered: "رجع وطلب",
    statusLost: "ضاع",
    stateAbandoned: "متروكة",
    stateInProgress: "لسه بيملى",
    stateConverted: "طلب",
    colCustomer: "العميل",
    colItems: "المنتجات",
    colTotal: "الإجمالي",
    colState: "الحالة",
    colSource: "المصدر",
    colRecovery: "المتابعة",
    colLastActivity: "آخر نشاط",
    anonymous: "عميل من غير اسم",
    noContact: "مفيش وسيلة تواصل",
    moreItems: "+{n} كمان",
    sourceStore: "المتجر",
    sourceFunnel: "مسار بيع",
    order: "طلب #{number}",
    sendWhatsApp: "ابعتله واتساب",
    noPhone: "مفيش رقم",
    markRecovered: "رجع",
    markLost: "ضاع",
    markedRecovered: "اتعلّم إنه رجع.",
    markedLost: "اتعلّم إنه ضاع.",
    updateError: "مقدرناش نحدّث الحالة.",
    empty: "لسه مفيش سلات متروكة. هتظهر هنا لما عميل يكتب رقمه ويمشي.",
    loadMore: "حمّل أكتر",
    modalTitle: "ابعت رسالة واتساب",
    modalTo: "إلى {name} · {phone}",
    modalHint: "هيفتح واتساب بالرسالة دي، والسلة هتتعلّم إنك كلمته.",
    openWhatsApp: "افتح واتساب",
    customer: "العميل",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_TONE: Record<RecoveryStatus, Tone> = { not_contacted: "warning", contacted: "info", recovered: "success", lost: "neutral" };
const STATUSES: RecoveryStatus[] = ["not_contacted", "contacted", "recovered", "lost"];
const STATUS_LABEL_KEY: Record<RecoveryStatus, keyof Strings> = {
  not_contacted: "statusNotContacted",
  contacted: "statusContacted",
  recovered: "statusRecovered",
  lost: "statusLost",
};

function itemsSummary(items: CheckoutSession["items"], moreTemplate: string): string {
  if (items.length === 0) return "—";
  const first = items[0];
  const rest = items.length - 1;
  return `${first.quantity} × ${first.productName ?? "—"}${rest > 0 ? ` ${fmt(moreTemplate, { n: rest })}` : ""}`;
}

/** wa.me wants digits with country code (Egypt by default). */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

// The WhatsApp message goes to the customer, so it is Egyptian Arabic.
function buildMessage(c: CheckoutSession, storeUrl: string): string {
  const name = c.customerName ? c.customerName.split(" ")[0] : "عميلنا العزيز";
  return `أهلاً ${name} 👋\nلاحظنا إنك كنت هتطلب ${itemsSummary(c.items, STRINGS.ar.moreItems)} بقيمة ${formatMoney(c.subtotalAmount, c.currency)}.\nتقدر تكمّل طلبك من هنا: ${storeUrl}\nولو عندك أي سؤال ردّ على الرسالة دي وهنساعدك.`;
}

export function AbandonedCheckoutsPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [view, setView] = useState<View>("abandoned");
  const [status, setStatus] = useState<RecoveryStatus | "">("");
  const [target, setTarget] = useState<CheckoutSession | null>(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [extra, setExtra] = useState<{ rows: CheckoutSession[]; cursor: string | null } | null>(null);

  const query = (before?: string) =>
    apiClient.request<{ sessions: CheckoutSession[]; nextCursor: string | null }>(
      `/workspaces/${workspaceId}/checkout-sessions?${new URLSearchParams({ view, limit: "50", ...(status ? { recoveryStatus: status } : {}), ...(before ? { before } : {}) })}`
    );
  const list = useAsync(() => {
    setExtra(null);
    return query();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, view, status]);

  const rows = useMemo(() => [...(list.data?.sessions ?? []), ...(extra?.rows ?? [])], [list.data, extra]);
  const nextCursor = extra ? extra.cursor : (list.data?.nextCursor ?? null);
  const currency = rows[0]?.currency ?? "EGP";
  const storeUrl = `${STOREFRONT_URL}/store/${workspaceId}`;

  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.recoveryStatus === "not_contacted" || r.recoveryStatus === "contacted");
    const recovered = rows.filter((r) => r.recoveryStatus === "recovered");
    const closed = rows.filter((r) => r.recoveryStatus === "recovered" || r.recoveryStatus === "lost");
    return {
      recoverable: open.filter((r) => r.status !== "converted").reduce((a, r) => a + r.subtotalAmount, 0),
      recoveredValue: recovered.reduce((a, r) => a + r.subtotalAmount, 0),
      rate: closed.length > 0 ? (recovered.length / closed.length) * 100 : null,
    };
  }, [rows]);

  function patchRow(updated: CheckoutSession) {
    list.setData((prev) => (prev ? { ...prev, sessions: prev.sessions.map((r) => (r.id === updated.id ? updated : r)) } : prev));
    setExtra((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.id === updated.id ? updated : r)) } : prev));
  }

  async function updateStatus(c: CheckoutSession, next: RecoveryStatus, successText?: string) {
    setBusyId(c.id);
    try {
      const { session } = await apiClient.request<{ session: CheckoutSession }>(`/workspaces/${workspaceId}/checkout-sessions/${c.id}`, {
        method: "PATCH",
        body: { recoveryStatus: next },
      });
      patchRow(session);
      if (successText) toast.success(successText);
    } catch {
      toast.error(t.updateError);
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const res = await query(nextCursor);
      setExtra((prev) => ({ rows: [...(prev?.rows ?? []), ...res.sessions], cursor: res.nextCursor }));
    } catch {
      toast.error(t.updateError);
    }
  }

  function openWhatsApp() {
    if (!target?.phone) return;
    window.open(`https://wa.me/${waNumber(target.phone)}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    if (target.recoveryStatus === "not_contacted") void updateStatus(target, "contacted");
    setTarget(null);
  }

  const stateLabel = (s: CheckoutSession["status"]) => (s === "converted" ? t.stateConverted : s === "abandoned" ? t.stateAbandoned : t.stateInProgress);

  return (
    <div className="max-w-6xl min-w-0">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiRecoverable} value={<bdi>{formatMoney(kpis.recoverable, currency)}</bdi>} hint={t.kpiRecoverableHint} />
        <KpiCard label={t.kpiRecovered} value={<bdi>{formatMoney(kpis.recoveredValue, currency)}</bdi>} hint={t.kpiRecoveredHint} />
        <KpiCard label={t.kpiRate} value={<span dir="ltr">{kpis.rate === null ? "—" : `${kpis.rate.toFixed(1)}%`}</span>} hint={t.kpiRateHint} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-[10px] border border-line bg-paper-raised p-0.5">
          {(["abandoned", "converted", "all"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? "bg-primary text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {v === "abandoned" ? t.viewAbandoned : v === "converted" ? t.viewConverted : t.viewAll}
            </button>
          ))}
        </div>
        <Select aria-label={t.statusFilter} value={status} onChange={(e) => setStatus(e.target.value as RecoveryStatus | "")} className="sm:w-56">
          <option value="">{t.anyStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t[STATUS_LABEL_KEY[s]]}
            </option>
          ))}
        </Select>
      </div>

      <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colItems}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colState}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colSource}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRecovery}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colLastActivity}</th>
                <th className="px-4 py-3 text-end font-medium">{common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const busy = busyId === c.id;
                const closed = c.status === "converted" || c.recoveryStatus === "recovered" || c.recoveryStatus === "lost";
                const contact = c.phone ?? c.email;
                return (
                  <tr key={c.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 text-start">
                      <p className="font-medium text-ink">{c.customerName ?? t.anonymous}</p>
                      <p className="text-xs text-ink-soft">{contact ? <span dir="ltr">{contact}</span> : t.noContact}</p>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft">{itemsSummary(c.items, t.moreItems)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{formatMoney(c.subtotalAmount, c.currency)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <span className="block text-ink">{stateLabel(c.status)}</span>
                      {c.convertedOrder && (
                        <Link to={`/orders/${c.convertedOrder.id}`} className="text-xs text-primary hover:underline">
                          {fmt(t.order, { number: c.convertedOrder.orderNumber })}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft">{c.source === "funnel" ? t.sourceFunnel : t.sourceStore}</td>
                    <td className="px-4 py-3 text-start">
                      <StatusBadge value={t[STATUS_LABEL_KEY[c.recoveryStatus]]} tone={STATUS_TONE[c.recoveryStatus]} />
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft">{formatDateTime(c.lastActivityAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy || closed || !c.phone}
                          onClick={() => {
                            setTarget(c);
                            setMessage(buildMessage(c, storeUrl));
                          }}
                          title={c.phone ? t.sendWhatsApp : t.noPhone}
                        >
                          <MessageCircle />
                          WhatsApp
                        </Button>
                        <Button size="xs" variant="ghost" disabled={busy || c.recoveryStatus === "recovered"} onClick={() => updateStatus(c, "recovered", t.markedRecovered)}>
                          {t.markRecovered}
                        </Button>
                        <Button size="xs" variant="ghost" disabled={busy || c.recoveryStatus === "lost"} onClick={() => updateStatus(c, "lost", t.markedLost)}>
                          {t.markLost}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              {t.loadMore}
            </Button>
          </div>
        )}
      </DataState>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={t.modalTitle}
        description={target ? fmt(t.modalTo, { name: target.customerName ?? t.customer, phone: target.phone ? ltr(target.phone) : "" }) : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>
              {common.cancel}
            </Button>
            <Button onClick={openWhatsApp} disabled={message.trim() === ""}>
              {t.openWhatsApp}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-xs text-ink-soft">{t.modalHint}</p>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} dir="rtl" className="text-sm" />
      </Modal>
    </div>
  );
}
