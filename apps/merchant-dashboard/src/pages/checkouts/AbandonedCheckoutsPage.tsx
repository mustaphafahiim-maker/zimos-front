import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ShoppingCart, Wallet } from "lucide-react";
import { Button } from "@store-builder/ui";
import type {
  CheckoutRecoveryStatus,
  CheckoutSession,
  CheckoutSessionItem,
  CheckoutSessionStatus,
  CheckoutSessionView,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDateTime, formatMoney, formatPercentValue } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const PAGE_LIMIT = 50;

const STRINGS = {
  en: {
    title: "Abandoned checkouts",
    description:
      "Shoppers who typed their phone number on a checkout form and left without ordering. A cart counts as abandoned after 30 minutes with no activity.",
    viewLabel: "Which checkouts to show",
    viewAbandoned: "Abandoned",
    viewConverted: "Ordered later",
    kpiRecoverable: "Still open",
    kpiRecoverableHint: "Value of the loaded carts you haven't closed yet",
    kpiRecovered: "Recovered",
    kpiRecoveredHint: "Value of the loaded carts that ended in an order",
    kpiRate: "Recovery rate",
    kpiRateHint: "Recovered ÷ (recovered + lost), in the loaded carts",
    statusFilter: "Filter by follow-up status",
    anyStatus: "Any follow-up status",
    statusNotContacted: "Not contacted",
    statusContacted: "Contacted",
    statusRecovered: "Recovered",
    statusLost: "Lost",
    stateAbandoned: "Left the checkout",
    stateInProgress: "Still filling it in",
    stateConverted: "Ordered",
    colCustomer: "Customer",
    colItems: "Cart",
    colTotal: "Subtotal",
    colState: "Cart",
    colSource: "Came from",
    colRecovery: "Follow-up",
    colLastActivity: "Last activity",
    anonymous: "Unnamed shopper",
    noContact: "No phone or email",
    noItems: "Empty cart",
    moreItems: "+{n} more",
    sourceStore: "Store",
    sourceFunnel: "Funnel",
    orderLink: "Order {number}",
    whatsapp: "WhatsApp",
    whatsappTitle: "Message {name} on WhatsApp",
    noPhone: "No phone number on this checkout",
    markRecovered: "Recovered",
    markLost: "Lost",
    markedRecovered: "Marked as recovered.",
    markedLost: "Marked as lost.",
    empty: "No abandoned checkouts",
    emptyDesc:
      "When a shopper types their phone number on your checkout form and leaves, their cart shows up here so you can follow it up.",
    emptyConverted: "Nothing recovered yet",
    emptyConvertedDesc: "Carts that turned into a real order after you reached out will be listed here.",
    modalTitle: "Send a WhatsApp message",
    modalTo: "To {name} · {phone}",
    modalHint:
      "WhatsApp opens in a new tab with this message ready to send. The checkout is marked as contacted.",
    openWhatsApp: "Open WhatsApp",
    customer: "the customer",
  },
  ar: {
    title: "السلات المتروكة",
    description:
      "عملاء كتبوا رقم تليفونهم في فورم الطلب ومشيوا من غير ما يطلبوا. السلة بتتحسب متروكة بعد نص ساعة من غير أي حركة.",
    viewLabel: "السلات اللي تظهر",
    viewAbandoned: "متروكة",
    viewConverted: "طلبوا بعدين",
    kpiRecoverable: "لسه مفتوحة",
    kpiRecoverableHint: "قيمة السلات المحمّلة اللي لسه مقفلتهاش",
    kpiRecovered: "رجعت",
    kpiRecoveredHint: "قيمة السلات المحمّلة اللي بقت طلبات",
    kpiRate: "نسبة الاسترجاع",
    kpiRateHint: "اللي رجعت ÷ (اللي رجعت + اللي ضاعت)، في السلات المحمّلة",
    statusFilter: "فلتر حسب حالة المتابعة",
    anyStatus: "كل حالات المتابعة",
    statusNotContacted: "لسه متكلمناش",
    statusContacted: "اتكلمنا معاه",
    statusRecovered: "رجع وطلب",
    statusLost: "ضاع",
    stateAbandoned: "ساب الطلب",
    stateInProgress: "لسه بيملى",
    stateConverted: "طلب",
    colCustomer: "العميل",
    colItems: "السلة",
    colTotal: "الإجمالي",
    colState: "السلة",
    colSource: "جه من",
    colRecovery: "المتابعة",
    colLastActivity: "آخر نشاط",
    anonymous: "عميل من غير اسم",
    noContact: "مفيش رقم ولا إيميل",
    noItems: "سلة فاضية",
    moreItems: "+{n} كمان",
    sourceStore: "المتجر",
    sourceFunnel: "مسار بيع",
    orderLink: "طلب {number}",
    whatsapp: "واتساب",
    whatsappTitle: "ابعت لـ {name} على واتساب",
    noPhone: "مفيش رقم على السلة دي",
    markRecovered: "رجع",
    markLost: "ضاع",
    markedRecovered: "اتعلّم إنه رجع.",
    markedLost: "اتعلّم إنه ضاع.",
    empty: "مفيش سلات متروكة",
    emptyDesc:
      "لما عميل يكتب رقمه في فورم الطلب ويمشي، سلته هتظهر هنا عشان تقدر تتابعه.",
    emptyConverted: "مفيش حاجة رجعت لسه",
    emptyConvertedDesc: "السلات اللي بقت طلبات حقيقية بعد ما كلمت صاحبها هتتعرض هنا.",
    modalTitle: "ابعت رسالة واتساب",
    modalTo: "إلى {name} · {phone}",
    modalHint: "هيفتح واتساب في تاب جديدة بالرسالة دي جاهزة، والسلة هتتعلّم إنك كلمته.",
    openWhatsApp: "افتح واتساب",
    customer: "العميل",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const RECOVERY_STATUSES: CheckoutRecoveryStatus[] = [
  "not_contacted",
  "contacted",
  "recovered",
  "lost",
];

const RECOVERY_LABEL: Record<CheckoutRecoveryStatus, keyof Strings> = {
  not_contacted: "statusNotContacted",
  contacted: "statusContacted",
  recovered: "statusRecovered",
  lost: "statusLost",
};

const RECOVERY_TONE: Record<CheckoutRecoveryStatus, "neutral" | "info" | "success" | "warning"> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

const STATE_LABEL: Record<CheckoutSessionStatus, keyof Strings> = {
  abandoned: "stateAbandoned",
  in_progress: "stateInProgress",
  converted: "stateConverted",
};

/** "2 × Linen shirt +1 more" — enough to recognise the cart in one glance. */
function cartSummary(items: CheckoutSessionItem[], t: Strings): string {
  if (items.length === 0) return t.noItems;
  const [first, ...rest] = items;
  const head = `${first.quantity} × ${first.productName ?? "—"}`;
  return rest.length > 0 ? `${head} ${fmt(t.moreItems, { n: rest.length })}` : head;
}

/**
 * wa.me wants digits with a country code and no punctuation. A local Egyptian
 * number ("01098…") is the common case, so a leading 0 becomes 20.
 */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

/**
 * The draft that opens in WhatsApp. It is written to the shopper, not to the
 * merchant, so it is Egyptian Arabic whatever language the dashboard is in —
 * and it stays editable in the dialog before it is sent.
 */
function draftMessage(session: CheckoutSession, storeUrl: string): string {
  const firstName = session.customerName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `أهلاً ${firstName} 👋` : "أهلاً 👋";
  const value = formatMoney(session.subtotalAmount, session.currency);
  return [
    greeting,
    `شوفنا إنك كنت بتكمّل طلب بقيمة ${value} ومخلّصتوش.`,
    `تقدر تكمّله من هنا: ${storeUrl}`,
    "ولو محتاج أي مساعدة ردّ على الرسالة دي.",
  ].join("\n");
}

export function AbandonedCheckoutsPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const [view, setView] = useState<CheckoutSessionView>("abandoned");
  const [recoveryStatus, setRecoveryStatus] = useState<CheckoutRecoveryStatus | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [target, setTarget] = useState<CheckoutSession | null>(null);
  const [message, setMessage] = useState("");

  const list = useCursorList<CheckoutSession>(
    async (before) => {
      const page = await apiClient.listCheckoutSessions(workspaceId, {
        view,
        limit: PAGE_LIMIT,
        ...(recoveryStatus ? { recoveryStatus } : {}),
        ...(before ? { before } : {}),
      });
      return { items: page.sessions, nextCursor: page.nextCursor };
    },
    [workspaceId, view, recoveryStatus]
  );

  const rows = list.items;
  // One currency per store in practice; the rows carry their own anyway.
  const currency = rows[0]?.currency ?? "EGP";
  const storeUrl = `${STOREFRONT_URL}/store/${workspaceId}`;

  // Counted over the carts actually loaded, which is what the merchant is
  // looking at — the API has no aggregate endpoint for these.
  const kpis = useMemo(() => {
    let open = 0;
    let recovered = 0;
    let recoveredCount = 0;
    let lostCount = 0;
    for (const row of rows) {
      if (row.recoveryStatus === "recovered") {
        recovered += row.subtotalAmount;
        recoveredCount += 1;
      } else if (row.recoveryStatus === "lost") {
        lostCount += 1;
      } else if (row.status !== "converted") {
        open += row.subtotalAmount;
      }
    }
    const closed = recoveredCount + lostCount;
    return { open, recovered, rate: closed > 0 ? recoveredCount / closed : null };
  }, [rows]);

  async function setStatus(
    session: CheckoutSession,
    next: CheckoutRecoveryStatus,
    successText?: string
  ) {
    setBusyId(session.id);
    try {
      const updated = await apiClient.setCheckoutSessionRecovery(workspaceId, session.id, next);
      list.setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      if (successText) toast.success(successText);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function openWhatsApp() {
    if (!target?.phone) return;
    const session = target;
    window.open(
      `https://wa.me/${waNumber(session.phone!)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setTarget(null);
    // Reaching out is the whole point of the dialog, so record it.
    if (session.recoveryStatus === "not_contacted") void setStatus(session, "contacted");
  }

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={t.kpiRecoverable}
          value={<bdi dir="ltr">{formatMoney(kpis.open, currency)}</bdi>}
          hint={t.kpiRecoverableHint}
          icon={<ShoppingCart />}
        />
        <KpiCard
          label={t.kpiRecovered}
          value={<bdi dir="ltr">{formatMoney(kpis.recovered, currency)}</bdi>}
          hint={t.kpiRecoveredHint}
          icon={<Wallet />}
        />
        <KpiCard
          label={t.kpiRate}
          value={<bdi dir="ltr">{formatPercentValue(kpis.rate)}</bdi>}
          hint={t.kpiRateHint}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          label={t.viewLabel}
          value={view}
          onChange={setView}
          tabs={[
            { value: "abandoned", label: t.viewAbandoned },
            { value: "converted", label: t.viewConverted },
            { value: "all", label: common.all },
          ]}
        />
        <Select
          aria-label={t.statusFilter}
          value={recoveryStatus}
          onChange={(e) => setRecoveryStatus(e.target.value as CheckoutRecoveryStatus | "")}
          className="w-auto min-w-48"
        >
          <option value="">{t.anyStatus}</option>
          {RECOVERY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t[RECOVERY_LABEL[status]]}
            </option>
          ))}
        </Select>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart />}
            title={view === "converted" ? t.emptyConverted : t.empty}
            description={view === "converted" ? t.emptyConvertedDesc : t.emptyDesc}
          />
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper-raised">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
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
                {rows.map((row) => {
                  const busy = busyId === row.id;
                  const contact = row.phone ?? row.email;
                  const closed =
                    row.status === "converted" ||
                    row.recoveryStatus === "recovered" ||
                    row.recoveryStatus === "lost";
                  const name = row.customerName ?? t.anonymous;
                  return (
                    <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-3 text-start">
                        <p className="font-medium text-ink" dir="auto">
                          {name}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {contact ? <bdi dir="ltr">{contact}</bdi> : t.noContact}
                        </p>
                      </td>
                      <td
                        className="max-w-[240px] truncate px-4 py-3 text-start text-ink-soft"
                        dir="auto"
                      >
                        {cartSummary(row.items, t)}
                      </td>
                      <td className="tabular-nums px-4 py-3 text-end text-ink">
                        <bdi dir="ltr">{formatMoney(row.subtotalAmount, row.currency)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <span className="block text-ink">{t[STATE_LABEL[row.status]]}</span>
                        {row.convertedOrder && (
                          <Link
                            to={`/orders/${row.convertedOrder.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {fmt(t.orderLink, { number: row.convertedOrder.orderNumber })}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft">
                        {row.source === "funnel" ? t.sourceFunnel : t.sourceStore}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <StatusBadge
                          value={row.recoveryStatus}
                          tone={RECOVERY_TONE[row.recoveryStatus]}
                          text={t[RECOVERY_LABEL[row.recoveryStatus]]}
                        />
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft">
                        {formatDateTime(row.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy || closed || !row.phone}
                            title={row.phone ? undefined : t.noPhone}
                            aria-label={fmt(t.whatsappTitle, { name })}
                            onClick={() => {
                              setTarget(row);
                              setMessage(draftMessage(row, storeUrl));
                            }}
                          >
                            <MessageCircle aria-hidden />
                            {t.whatsapp}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            disabled={busy || row.recoveryStatus === "recovered"}
                            onClick={() => setStatus(row, "recovered", t.markedRecovered)}
                          >
                            {t.markRecovered}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            disabled={busy || row.recoveryStatus === "lost"}
                            onClick={() => setStatus(row, "lost", t.markedLost)}
                          >
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
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={t.modalTitle}
        description={
          target
            ? fmt(t.modalTo, {
                name: target.customerName ?? t.customer,
                phone: target.phone ?? "",
              })
            : undefined
        }
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
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          dir="rtl"
          aria-label={t.modalTitle}
          className="text-sm"
        />
      </Modal>
    </div>
  );
}
