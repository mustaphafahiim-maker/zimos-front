import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Send } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  dropshipOrderPush,
  dropshipOrderRefresh,
  dropshipOrderState,
  type DropshipOrderState,
  type Order,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, humanize } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { dropshipProviderName, isStoreProvider } from "@/pages/apps/dropshipStores";
import { useOrderLabels } from "../orderLabels";

/** System roles holding orders.manage: forwarding and asking again need it. */
const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

const STRINGS = {
  en: {
    title: "Supplier",
    description: "Dropshipping: send this order to the supplier that ships it, and follow it there.",
    send: "Send to {name}",
    sendAgain: "Send again",
    sending: "Sending…",
    sent: "Sent to {name}.",
    lines: "{n} of this order's products come from {name}.",
    noLines: "None of this order's products is marked as {name}'s. It is sent whole.",
    test: "Test",
    reference: "Order number at {name}:",
    status: "Status there",
    status_none: "Not reported yet",
    ext_received: "Received",
    ext_confirmed: "Confirmed",
    ext_shipped: "Shipped",
    ext_delivered: "Delivered",
    ext_returned: "Returned",
    ext_cancelled: "Cancelled",
    by_auto: "sent automatically {date}",
    by_manual: "sent {date}",
    checked: "Last checked {date}",
    following: "Followed every few minutes until it is delivered, returned or cancelled.",
    means: "Means “{stage}” here.",
    checkError: "The last check failed: {error}",
    refresh: "Ask the supplier now",
    refreshing: "Asking…",
    settings: "Forwarding and following settings",
    forbidden: "You can see this order but not send it to a supplier.",
    // Your other store (frontend-handoff 181): Shopify and WooCommerce words.
    sentToStore: "Sent to your store as order #{id}",
    notInWoo: "This product isn't in your WooCommerce store",
    ext_open: "Not shipped yet",
    ext_partial: "Partly shipped",
    ext_fulfilled: "Shipped",
    ext_pending: "Pending",
    ext_processing: "Processing",
    "ext_on-hold": "On hold",
    ext_completed: "Completed",
    ext_refunded: "Refunded",
    ext_failed: "Failed",
  },
  ar: {
    title: "المورّد",
    description: "دروبشيبنج: ابعت الأوردر للمورّد اللي بيشحنه، وتابعه عنده.",
    send: "ابعت لـ {name}",
    sendAgain: "ابعت تاني",
    sending: "بنبعت…",
    sent: "اتبعت لـ {name}.",
    lines: "{n} من منتجات الأوردر ده من {name}.",
    noLines: "مفيش منتج في الأوردر ده متسجّل إنه من {name}. هيتبعت كله.",
    test: "تجريبي",
    reference: "رقم الأوردر عند {name}:",
    status: "الحالة عنده",
    status_none: "لسه ما اتبلّغتش",
    ext_received: "استلمه",
    ext_confirmed: "أكّده",
    ext_shipped: "شحنه",
    ext_delivered: "اتسلّم",
    ext_returned: "رجع",
    ext_cancelled: "اتلغى",
    by_auto: "اتبعت تلقائيًا {date}",
    by_manual: "اتبعت {date}",
    checked: "آخر متابعة {date}",
    following: "بنتابعه كل كام دقيقة لحد ما يتسلّم أو يرجع أو يتلغي.",
    means: "يعني «{stage}» هنا.",
    checkError: "آخر متابعة فشلت: {error}",
    refresh: "اسأل المورّد دلوقتي",
    refreshing: "بنسأل…",
    settings: "إعدادات الإرسال والمتابعة",
    forbidden: "تقدر تشوف الأوردر ده بس مش مسموح لك تبعته لمورّد.",
    sentToStore: "اتبعت لمتجرك كأوردر رقم {id}",
    notInWoo: "المنتج ده مش موجود في متجر ووكومرس بتاعك",
    ext_open: "لسه ما اتشحنش",
    ext_partial: "اتشحن جزء منه",
    ext_fulfilled: "اتشحن",
    ext_pending: "مستني",
    ext_processing: "بيتجهّز",
    "ext_on-hold": "متعلّق",
    ext_completed: "خلص",
    ext_refunded: "فلوسه رجعت",
    ext_failed: "فشل",
  },
} satisfies Messages;

/**
 * The order page's Supplier card (SPEC §16.5): shown when a dropshipping
 * supplier is connected — what was forwarded, where it stands there, and the
 * buttons to forward and to ask again. Nothing at all for a store without one.
 */
export function OrderSupplierCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const [forbidden, setForbidden] = useState(false);
  const canManage = MANAGE_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { locale } = useLocale();
  const nameOf = (code: string, fallback: string) => dropshipProviderName(code, fallback, locale);
  const [sentBefore, sentAfter] = t.sentToStore.split("{id}");

  // The supplier's own word, in the teammate's language when it is one of the usual ones.
  const supplierStatus = (status: string) => {
    const key = `ext_${status}` as keyof typeof t;
    return key in t ? String(t[key]) : humanize(status);
  };

  const state = useAsync<DropshipOrderState>(() => dropshipOrderState(apiClient, workspaceId, order.id), [workspaceId, order.id, order.updatedAt]);
  const data = state.data;

  // No supplier connected and nothing forwarded: the card has nothing to say. A 403 hides it too.
  if (state.error instanceof ApiError && state.error.status === 403) return null;
  if (!state.error && (!data || (data.refs.length === 0 && data.suppliers.length === 0))) return null;

  async function run(key: string, work: () => Promise<DropshipOrderState>, done?: string | ((next: DropshipOrderState) => string)) {
    setBusy(key);
    setError(null);
    try {
      const next = await work();
      state.setData(next);
      if (done) toast.success(typeof done === "function" ? done(next) : done);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      // WooCommerce names the line it does not have: «"Demo T-Shirt" is not a product of the WooCommerce store».
      const missing = err instanceof ApiError ? /"(.+)" is not a product of the WooCommerce store/.exec(err.message)?.[1] : undefined;
      setError(errorMessage(err, missing ? { DROPSHIP_ORDER_REJECTED: `${t.notInWoo}: «${missing}»` } : undefined));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title={t.title}
      description={t.description}
      actions={
        <Link to="/apps/dropshipping" className="text-sm font-medium text-primary hover:underline">
          {t.settings}
        </Link>
      }
    >
      {state.error ? (
        <Alert variant="danger">
          {errorMessage(state.error)}{" "}
          <button type="button" className="font-medium underline" onClick={() => void state.refresh()}>
            ↻
          </button>
        </Alert>
      ) : data ? (
        <div className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {forbidden && <Alert>{t.forbidden}</Alert>}

          {data.refs.map((ref) => (
            <div key={ref.provider} className="space-y-1 rounded-md border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {isStoreProvider(ref.provider) ? (
                  <span className="font-medium text-ink">{nameOf(ref.provider, ref.providerName)}</span>
                ) : (
                  <span className="font-medium text-ink">
                    {fmt(t.reference, { name: ref.providerName })}{" "}
                    <bdi dir="ltr" className="font-mono text-xs">
                      {ref.externalOrderId}
                    </bdi>
                  </span>
                )}
                <StatusBadge
                  label={t.status}
                  value={ref.externalStatus ?? "none"}
                  tone={
                    ref.externalStatus === "cancelled" || ref.externalStatus === "failed"
                      ? "danger"
                      : ref.externalStatus === "delivered" || ref.externalStatus === "completed"
                        ? "success"
                        : "info"
                  }
                  text={ref.externalStatus ? supplierStatus(ref.externalStatus) : t.status_none}
                />
              </div>
              {isStoreProvider(ref.provider) && (
                <p className="text-ink">
                  {sentBefore}
                  <bdi dir="ltr" className="font-mono text-xs font-semibold">
                    {ref.externalOrderId}
                  </bdi>
                  {sentAfter}
                </p>
              )}
              <p className="text-xs text-ink-soft">
                {fmt(ref.forwardedBy === "auto" ? t.by_auto : t.by_manual, { date: formatDateTime(ref.pushedAt) })}
                {ref.checkedAt && ` · ${fmt(t.checked, { date: formatDateTime(ref.checkedAt) })}`}
              </p>
              {ref.suggestedStage && <p className="text-xs text-ink-soft">{fmt(t.means, { stage: labels.stage(ref.suggestedStage) })}</p>}
              {ref.followed && <p className="text-xs text-ink-soft">{t.following}</p>}
              {ref.lastError && <p className="text-xs text-danger">{fmt(t.checkError, { error: ref.lastError })}</p>}
            </div>
          ))}

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {data.suppliers.map((s) => {
                const done = data.refs.some((r) => r.provider === s.code);
                const name = nameOf(s.code, s.name);
                // The merchant's own store answers with its order number: say it.
                const sent = isStoreProvider(s.code)
                  ? (next: DropshipOrderState) => {
                      const ref = next.refs.find((r) => r.provider === s.code);
                      return ref ? fmt(t.sentToStore, { id: ref.externalOrderId }) : fmt(t.sent, { name });
                    }
                  : fmt(t.sent, { name });
                return (
                  <Button
                    key={s.code}
                    variant={done ? "outline" : "default"}
                    size="sm"
                    className="min-h-11"
                    disabled={busy !== null}
                    title={s.lines > 0 ? fmt(t.lines, { n: s.lines, name }) : fmt(t.noLines, { name })}
                    onClick={() => void run(`push:${s.code}`, () => dropshipOrderPush(apiClient, workspaceId, order.id, s.code), sent)}
                  >
                    <Send className="size-4" aria-hidden />
                    {busy === `push:${s.code}` ? t.sending : done ? `${t.sendAgain} · ${name}` : fmt(t.send, { name })}
                    {s.isTest && <span className="text-xs opacity-80">({t.test})</span>}
                  </Button>
                );
              })}
              {data.refs.some((r) => r.followed) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={busy !== null}
                  onClick={() => void run("refresh", () => dropshipOrderRefresh(apiClient, workspaceId, order.id))}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {busy === "refresh" ? t.refreshing : t.refresh}
                </Button>
              )}
            </div>
          )}
          {canManage && data.refs.length === 0 && data.suppliers.length > 0 && (
            <p className="text-xs text-ink-soft">
              {data.suppliers[0].lines > 0
                ? fmt(t.lines, { n: data.suppliers[0].lines, name: nameOf(data.suppliers[0].code, data.suppliers[0].name) })
                : fmt(t.noLines, { name: nameOf(data.suppliers[0].code, data.suppliers[0].name) })}
            </p>
          )}
        </div>
      ) : null}
    </Section>
  );
}
