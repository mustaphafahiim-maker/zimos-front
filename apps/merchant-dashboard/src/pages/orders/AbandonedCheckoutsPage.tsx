import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Workflow } from "lucide-react";
import { Button, Textarea } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT, useCommon, fmt, type Messages } from "@/i18n/LocaleContext";
import { mockApi } from "@/mock/api";
import type { AbandonedCheckout } from "@/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ltr } from "./orderLabels";

const STRINGS = {
  en: {
    title: "Abandoned checkouts",
    description: "Customers who started checkout but didn't place an order. Reach out to bring them back.",
    automateRecovery: "Automate recovery",
    kpiRecoverable: "Recoverable value",
    kpiRecoverableHint: "Open checkouts not yet recovered or lost",
    kpiRecovered: "Recovered",
    kpiRecoveredHintOne: "{n} checkout turned into an order",
    kpiRecoveredHintMany: "{n} checkouts turned into orders",
    kpiRate: "Recovery rate",
    kpiRateHint: "Recovered ÷ (recovered + lost)",
    anyStatus: "Any status",
    statusFilter: "Filter by recovery status",
    statusNotContacted: "Not contacted",
    statusContacted: "Contacted",
    statusRecovered: "Recovered",
    statusLost: "Lost",
    tip: "Tip: a WhatsApp reminder 30 minutes after abandonment recovers the most carts.",
    setupAutomation: "Set up an automation",
    empty: "No abandoned checkouts match this filter.",
    colCustomer: "Customer",
    colItems: "Items",
    colTotal: "Total",
    colStep: "Step reached",
    colSource: "Source",
    colRecovery: "Recovery",
    colLastActivity: "Last activity",
    anonymous: "Anonymous",
    noContact: "No contact details",
    sourceFunnel: "Funnel",
    sourceStore: "Store",
    sendWhatsApp: "Send WhatsApp",
    noPhone: "No phone number",
    markRecovered: "Recovered",
    markLost: "Lost",
    markedRecovered: "Marked as recovered.",
    markedLost: "Marked as lost.",
    updateError: "Couldn't update this checkout. Try again.",
    sentTo: "WhatsApp message sent to {to}.",
    customer: "customer",
    sendError: "Couldn't send the message. Try again.",
    modalTitle: "Send WhatsApp reminder",
    modalTo: "To {name} · {phone}",
    sending: "Sending…",
    sendMessage: "Send message",
    modalHint: "Edit the message before sending. The cart link restores the customer's items.",
    moreItems: "+{n} more",
  },
  ar: {
    title: "السلات المتروكة",
    description: "عملاء بدأوا إتمام الشراء ولم يكملوا الطلب. تواصل معهم لاستعادتهم.",
    automateRecovery: "أتمتة الاستعادة",
    kpiRecoverable: "قيمة قابلة للاستعادة",
    kpiRecoverableHint: "سلات مفتوحة لم تُستعد ولم تُفقد بعد",
    kpiRecovered: "تمت استعادتها",
    kpiRecoveredHintOne: "{n} سلة تحولت إلى طلب",
    kpiRecoveredHintMany: "{n} سلات تحولت إلى طلبات",
    kpiRate: "معدل الاستعادة",
    kpiRateHint: "المستعادة ÷ (المستعادة + المفقودة)",
    anyStatus: "أي حالة",
    statusFilter: "تصفية حسب حالة الاستعادة",
    statusNotContacted: "لم يتم التواصل",
    statusContacted: "تم التواصل",
    statusRecovered: "تمت الاستعادة",
    statusLost: "مفقودة",
    tip: "نصيحة: تذكير عبر WhatsApp بعد 30 دقيقة من ترك السلة يستعيد أكبر عدد من السلات.",
    setupAutomation: "إعداد أتمتة",
    empty: "لا توجد سلات متروكة تطابق هذه التصفية.",
    colCustomer: "العميل",
    colItems: "المنتجات",
    colTotal: "الإجمالي",
    colStep: "آخر خطوة",
    colSource: "المصدر",
    colRecovery: "الاستعادة",
    colLastActivity: "آخر نشاط",
    anonymous: "مجهول",
    noContact: "لا توجد بيانات تواصل",
    sourceFunnel: "مسار بيع",
    sourceStore: "المتجر",
    sendWhatsApp: "إرسال عبر WhatsApp",
    noPhone: "لا يوجد رقم هاتف",
    markRecovered: "تمت الاستعادة",
    markLost: "مفقودة",
    markedRecovered: "تم التحديد كمستعادة.",
    markedLost: "تم التحديد كمفقودة.",
    updateError: "تعذّر تحديث هذه السلة. حاول مرة أخرى.",
    sentTo: "تم إرسال رسالة WhatsApp إلى {to}.",
    customer: "العميل",
    sendError: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
    modalTitle: "إرسال تذكير عبر WhatsApp",
    modalTo: "إلى {name} · {phone}",
    sending: "جارٍ الإرسال…",
    sendMessage: "إرسال الرسالة",
    modalHint: "عدّل الرسالة قبل الإرسال. رابط السلة يعيد للعميل منتجاته.",
    moreItems: "+{n} أخرى",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type RecoveryStatus = AbandonedCheckout["recoveryStatus"];
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_TONE: Record<RecoveryStatus, Tone> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

const STEP_TONE: Record<AbandonedCheckout["step"], Tone> = {
  contact: "neutral",
  shipping: "info",
  payment: "warning",
};

const STATUSES: RecoveryStatus[] = ["not_contacted", "contacted", "recovered", "lost"];

const STATUS_LABEL_KEY: Record<RecoveryStatus, keyof Strings> = {
  not_contacted: "statusNotContacted",
  contacted: "statusContacted",
  recovered: "statusRecovered",
  lost: "statusLost",
};

/** `moreTemplate` is a "+{n} more" style template. */
function itemsSummary(items: AbandonedCheckout["items"], moreTemplate: string): string {
  if (items.length === 0) return "—";
  const first = items[0];
  const rest = items.length - 1;
  return `${first.quantity} × ${first.productName}${rest > 0 ? ` ${fmt(moreTemplate, { n: rest })}` : ""}`;
}

// The WhatsApp message itself is always Egyptian Arabic (it goes to the customer).
function buildMessage(c: AbandonedCheckout): string {
  const name = c.customerName ? c.customerName.split(" ")[0] : "عميلنا العزيز";
  const link = `https://shop.egystore.com/cart/${c.id.slice(0, 8)}`;
  return `أهلاً ${name} 👋\nلاحظنا إنك سيبت ${itemsSummary(c.items, STRINGS.ar.moreItems)} في السلة بقيمة ${formatMoney(c.totalAmount, c.currency)}.\nكمّل طلبك دلوقتي من هنا: ${link}\nولو عندك أي سؤال ردّ على الرسالة دي وهنساعدك فوراً.`;
}

export function AbandonedCheckoutsPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [status, setStatus] = useState<RecoveryStatus | "">("");
  const [target, setTarget] = useState<AbandonedCheckout | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(() => mockApi.listAbandoned(workspaceId), [workspaceId]);
  const rows = list.data ?? [];
  const currency = rows[0]?.currency ?? "EGP";

  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.recoveryStatus === "not_contacted" || r.recoveryStatus === "contacted");
    const recovered = rows.filter((r) => r.recoveryStatus === "recovered");
    const closed = rows.filter((r) => r.recoveryStatus === "recovered" || r.recoveryStatus === "lost");
    return {
      recoverable: open.reduce((a, r) => a + Number(r.totalAmount), 0),
      recoveredValue: recovered.reduce((a, r) => a + Number(r.totalAmount), 0),
      recoveredCount: recovered.length,
      rateBp: closed.length > 0 ? Math.round((recovered.length / closed.length) * 10000) : 0,
    };
  }, [rows]);

  const visible = useMemo(() => (status ? rows.filter((r) => r.recoveryStatus === status) : rows), [rows, status]);

  function openWhatsApp(c: AbandonedCheckout) {
    setTarget(c);
    setMessage(buildMessage(c));
  }

  async function updateStatus(c: AbandonedCheckout, next: RecoveryStatus, successText: string) {
    setBusyId(c.id);
    try {
      await mockApi.setAbandonedStatus(workspaceId, c.id, next);
      list.setData((prev) => (prev ?? []).map((r) => (r.id === c.id ? { ...r, recoveryStatus: next } : r)));
      toast.success(successText);
    } catch {
      toast.error(t.updateError);
    } finally {
      setBusyId(null);
    }
  }

  async function sendWhatsApp() {
    if (!target) return;
    setSending(true);
    try {
      await mockApi.setAbandonedStatus(workspaceId, target.id, "contacted");
      list.setData((prev) => (prev ?? []).map((r) => (r.id === target.id ? { ...r, recoveryStatus: "contacted" } : r)));
      toast.success(fmt(t.sentTo, { to: target.phone ? ltr(target.phone) : t.customer }));
      setTarget(null);
    } catch {
      toast.error(t.sendError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-6xl min-w-0">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/automations">
              <Workflow />
              {t.automateRecovery}
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiRecoverable} value={formatMoney(kpis.recoverable, currency)} hint={t.kpiRecoverableHint} />
        <KpiCard
          label={t.kpiRecovered}
          value={formatMoney(kpis.recoveredValue, currency)}
          hint={fmt(kpis.recoveredCount === 1 ? t.kpiRecoveredHintOne : t.kpiRecoveredHintMany, { n: kpis.recoveredCount })}
        />
        <KpiCard
          label={t.kpiRate}
          value={<span dir="ltr">{`${(kpis.rateBp / 100).toFixed(1)}%`}</span>}
          hint={t.kpiRateHint}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label={t.statusFilter}
          value={status}
          onChange={(e) => setStatus(e.target.value as RecoveryStatus | "")}
          className="sm:w-56"
        >
          <option value="">{t.anyStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t[STATUS_LABEL_KEY[s]]}
            </option>
          ))}
        </Select>
        <p className="min-w-0 text-xs text-ink-soft">
          {t.tip}{" "}
          <Link to="/automations" className="text-primary hover:underline">
            {t.setupAutomation}
          </Link>
          .
        </p>
      </div>

      <DataState loading={list.loading} error={list.error} empty={visible.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-paper-raised text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colItems}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colStep}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colSource}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRecovery}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colLastActivity}</th>
                <th className="px-4 py-3 text-end font-medium">{common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const busy = busyId === c.id;
                const closed = c.recoveryStatus === "recovered" || c.recoveryStatus === "lost";
                const contact = c.phone ?? c.email;
                return (
                  <tr key={c.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 text-start">
                      <p className="font-medium text-ink">{c.customerName ?? t.anonymous}</p>
                      <p className="text-xs text-ink-soft">
                        {contact ? <span dir="ltr">{contact}</span> : t.noContact}
                      </p>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft">{itemsSummary(c.items, t.moreItems)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{formatMoney(c.totalAmount, c.currency)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <StatusBadge value={c.step} tone={STEP_TONE[c.step]} />
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft">
                      <span className="block">{c.sourceLabel}</span>
                      <span className="block text-xs">{c.source === "funnel" ? t.sourceFunnel : t.sourceStore}</span>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <StatusBadge value={c.recoveryStatus} tone={STATUS_TONE[c.recoveryStatus]} />
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft">{formatDateTime(c.lastActivityAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" disabled={busy || closed || !c.phone} onClick={() => openWhatsApp(c)} title={c.phone ? t.sendWhatsApp : t.noPhone}>
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
      </DataState>

      <Modal
        open={target !== null}
        onClose={() => (sending ? undefined : setTarget(null))}
        title={t.modalTitle}
        description={
          target
            ? fmt(t.modalTo, { name: target.customerName ?? t.customer, phone: target.phone ? ltr(target.phone) : "" })
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={sending}>
              {common.cancel}
            </Button>
            <Button onClick={sendWhatsApp} disabled={sending || message.trim() === ""}>
              {sending ? t.sending : t.sendMessage}
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
