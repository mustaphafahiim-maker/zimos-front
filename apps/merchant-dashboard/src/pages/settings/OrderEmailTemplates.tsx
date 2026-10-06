import { useMemo, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  orderEmailDesignList,
  orderEmailDesignPreview,
  orderEmailDesignRemoveOverride,
  orderEmailDesignSave,
  orderEmailDesignSendTest,
  type OrderEmailDesignTemplate,
  type OrderEmailKey,
  type OrderEmailScope,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { OrderEmailEditor, type EditorApi } from "./OrderEmailEditor";

/**
 * The order emails list (SPEC §14.5): each email switched on or off, edited
 * (OrderEmailEditor.tsx), previewed and tested. Without a scope it is the
 * store's set (Settings → Messages). With one it is a funnel's or website's
 * (handoff item 175): every row says whether it is the store's email or that
 * funnel's own version; editing or switching saves the funnel's version, and
 * "Use store email" deletes it again.
 */

const STRINGS = {
  en: {
    readOnly: "Only the store owner or a workspace manager can change these emails.",
    noEmails: "No emails to show.",
    name_order_confirmation: "Order received",
    when_order_confirmation: "When an order is placed",
    name_order_shipped: "Order shipped",
    when_order_shipped: "When the courier picks the order up",
    name_order_cancelled: "Order cancelled",
    when_order_cancelled: "When an order is cancelled",
    name_order_refunded: "Refund issued",
    when_order_refunded: "When an order is refunded",
    name_abandoned_cart: "Abandoned cart",
    when_abandoned_cart: "When a checkout is left unfinished",
    name_digital_delivery: "Digital product delivery",
    when_digital_delivery: "When a digital product is ready",
    name_subscription_started: "Subscription started",
    when_subscription_started: "When a subscription or installment plan starts — with the link where the customer changes their card or cancels. On unless you turn it off.",
    name_transfer_rejected: "Transfer rejected",
    when_transfer_rejected: "When you reject a transfer receipt (unless you untick “Tell the customer”) — with a link to send a new one",
    switchLabel: "Send “{name}”",
    edit: "Edit",
    edited: "Edited",
    designed: "Designed",
    editTitle: "Edit “{name}”",
    saved: "Email saved.",
    enabled: "“{name}” is now sent to customers.",
    disabled: "“{name}” is switched off.",
    // per funnel / website
    storeDefault: "Store default",
    custom_funnel: "Custom for this funnel",
    custom_website: "Custom for this website",
    off_funnel: "Off for this funnel",
    off_website: "Off for this website",
    useStore: "Use store email",
    useStoreBody_funnel: "This funnel's own version of “{name}” will be deleted, and its orders get the store's email again.",
    useStoreBody_website: "This website's own version of “{name}” will be deleted, and its orders get the store's email again.",
    cancel: "Cancel",
    working: "One moment…",
    usingStore: "“{name}” uses the store's email again.",
    enabled_funnel: "“{name}” is on for this funnel.",
    disabled_funnel: "“{name}” is off for this funnel.",
    enabled_website: "“{name}” is on for this website.",
    disabled_website: "“{name}” is off for this website.",
    editorNote_funnel: "Saving makes this funnel's own version. The store's email stays as it is.",
    editorNote_website: "Saving makes this website's own version. The store's email stays as it is.",
    simpleNote: "If the store's version of this email is designed, this one keeps that design until you build its own in the designer.",
  },
  ar: {
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل فقط تغيير هذه الرسائل.",
    noEmails: "مفيش إيميلات تظهر.",
    name_order_confirmation: "استلام الطلب",
    when_order_confirmation: "عند إنشاء الطلب",
    name_order_shipped: "شحن الطلب",
    when_order_shipped: "عند استلام شركة الشحن للطلب",
    name_order_cancelled: "إلغاء الطلب",
    when_order_cancelled: "عند إلغاء الطلب",
    name_order_refunded: "رد المبلغ",
    when_order_refunded: "عند رد مبلغ الطلب",
    name_abandoned_cart: "السلة المتروكة",
    when_abandoned_cart: "عند ترك صفحة الطلب دون إكماله",
    name_digital_delivery: "تسليم المنتج الرقمي",
    when_digital_delivery: "عند جاهزية المنتج الرقمي",
    name_subscription_started: "بداية الاشتراك",
    when_subscription_started: "لما اشتراك أو تقسيط يبدأ — برابط صفحة الاشتراك اللي العميل يغيّر منها بطاقته أو يلغي. شغّالة إلا لو قفلتها.",
    name_transfer_rejected: "رفض التحويل",
    when_transfer_rejected: "لما ترفض إيصال تحويل (إلا لو شلت علامة «بلّغ العميل») — برابط لرفع إيصال جديد",
    switchLabel: "إرسال «{name}»",
    edit: "تعديل",
    edited: "معدّلة",
    designed: "متصممة",
    editTitle: "تعديل «{name}»",
    saved: "تم حفظ الرسالة.",
    enabled: "«{name}» تُرسل الآن للعملاء.",
    disabled: "تم إيقاف «{name}».",
    storeDefault: "زي إيميلات المتجر",
    custom_funnel: "مخصص للفانل ده",
    custom_website: "مخصص للموقع ده",
    off_funnel: "مقفول للفانل ده",
    off_website: "مقفول للموقع ده",
    useStore: "استخدم إيميل المتجر",
    useStoreBody_funnel: "نسخة الفانل ده من «{name}» هتتمسح، وأوردراته هترجع تاخد إيميل المتجر.",
    useStoreBody_website: "نسخة الموقع ده من «{name}» هتتمسح، وأوردراته هترجع تاخد إيميل المتجر.",
    cancel: "إلغاء",
    working: "ثانية واحدة…",
    usingStore: "«{name}» رجع يستخدم إيميل المتجر.",
    enabled_funnel: "«{name}» شغّال للفانل ده.",
    disabled_funnel: "«{name}» اتقفل للفانل ده.",
    enabled_website: "«{name}» شغّال للموقع ده.",
    disabled_website: "«{name}» اتقفل للموقع ده.",
    editorNote_funnel: "الحفظ بيعمل نسخة خاصة بالفانل ده. إيميل المتجر هيفضل زي ما هو.",
    editorNote_website: "الحفظ بيعمل نسخة خاصة بالموقع ده. إيميل المتجر هيفضل زي ما هو.",
    simpleNote: "لو إيميل المتجر ده متصمم، النسخة دي هتفضل بنفس التصميم لحد ما تعملها تصميم خاص بيها من «مصمم».",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
const pick = (t: T, key: string) => (t as Record<string, string>)[key] ?? "";
const orderEmailName = (t: T, key: OrderEmailKey) => pick(t, `name_${key}`) || key;

/** Which funnel's or website's emails; none = the store's. */
export interface EmailScopeRef {
  kind: "funnel" | "website";
  id: string;
}

export function OrderEmailTemplates({ scope, editorLayout = "modal" }: { scope?: EmailScopeRef; editorLayout?: "modal" | "inline" }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const kind = scope?.kind;
  const apiScope = useMemo<OrderEmailScope | undefined>(
    () => (scope ? (scope.kind === "funnel" ? { funnelId: scope.id } : { websiteId: scope.id }) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope?.kind, scope?.id]
  );
  const { data, error, loading, refresh, setData } = useAsync(() => orderEmailDesignList(apiClient, workspaceId, apiScope), [workspaceId, apiScope]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderEmailDesignTemplate | null>(null);
  const [confirming, setConfirming] = useState<OrderEmailKey | null>(null);

  const replace = (template: OrderEmailDesignTemplate) =>
    setData((prev) => (prev ? { ...prev, templates: prev.templates.map((x) => (x.key === template.key ? template : x)) } : (prev as never)));

  // The editor talks to this funnel's or website's version (the store's by default).
  const editingKey = editing?.key;
  const editorApi = useMemo<EditorApi | undefined>(
    () =>
      editingKey && apiScope
        ? {
            save: (patch) => orderEmailDesignSave(apiClient, workspaceId, editingKey, patch, apiScope),
            preview: (draft) => orderEmailDesignPreview(apiClient, workspaceId, editingKey, draft, apiScope),
            sendTest: (draft) => orderEmailDesignSendTest(apiClient, workspaceId, editingKey, draft, apiScope),
          }
        : undefined,
    [editingKey, apiScope, workspaceId]
  );

  async function toggle(template: OrderEmailDesignTemplate) {
    setBusy(template.key);
    try {
      const updated = await orderEmailDesignSave(apiClient, workspaceId, template.key, { isEnabled: !template.isEnabled }, apiScope);
      replace(updated);
      const message = kind ? pick(t, `${updated.isEnabled ? "enabled" : "disabled"}_${kind}`) : updated.isEnabled ? t.enabled : t.disabled;
      toast.success(fmt(message, { name: orderEmailName(t, template.key) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function revertToStore(template: OrderEmailDesignTemplate) {
    if (!apiScope) return;
    setBusy(template.key);
    try {
      replace(await orderEmailDesignRemoveOverride(apiClient, workspaceId, template.key, apiScope));
      setConfirming(null);
      toast.success(fmt(t.usingStore, { name: orderEmailName(t, template.key) }));
    } catch (err) {
      toast.error(errorMessage(err));
      // A version deleted elsewhere (404): show the list as it is now.
      void refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  const editor =
    editing && data ? (
      <OrderEmailEditor
        key={editing.key}
        layout={editorLayout}
        title={fmt(t.editTitle, { name: orderEmailName(t, editing.key) })}
        template={editing}
        tokens={data.tokens}
        api={editorApi}
        note={kind ? <p className="rounded-[var(--radius)] bg-primary-soft px-3 py-2 text-xs text-primary-dark">{pick(t, `editorNote_${kind}`)}</p> : undefined}
        simpleNote={kind ? t.simpleNote : undefined}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          replace(updated);
          setEditing(null);
          toast.success(t.saved);
        }}
      />
    ) : null;

  // Inside another dialog the editor takes the list's place instead of stacking a second one.
  if (editorLayout === "inline" && editor) return editor;

  if (isPermissionError(error)) return <Alert>{t.readOnly}</Alert>;

  return (
    <>
      <DataState loading={loading} error={error} empty={!loading && !error && (data?.templates.length ?? 0) === 0} emptyMessage={t.noEmails} onRetry={() => void refresh()}>
        <ul className="divide-y divide-line">
          {(data?.templates ?? []).map((template) => {
            const name = orderEmailName(t, template.key);
            const own = Boolean(kind && template.overridden);
            return (
              <li key={template.key} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
                      {name}
                      {kind ? (
                        <>
                          <StatusBadge value={own ? "custom" : "store"} tone={own ? "info" : "neutral"} text={own ? pick(t, `custom_${kind}`) : t.storeDefault} />
                          {own && !template.isEnabled && <StatusBadge value="off" tone="warning" text={pick(t, `off_${kind}`)} />}
                        </>
                      ) : (
                        template.isCustomised && (
                          <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-normal text-ink-soft">{template.blocks?.length ? t.designed : t.edited}</span>
                        )
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">{pick(t, `when_${template.key}`)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {own && (
                      <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" disabled={busy === template.key} onClick={() => setConfirming(template.key)}>
                        {t.useStore}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setEditing(template)}>
                      {t.edit}
                    </Button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={template.isEnabled}
                      aria-label={fmt(t.switchLabel, { name })}
                      disabled={busy === template.key}
                      onClick={() => void toggle(template)}
                      className="group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "relative h-6 w-11 rounded-full border transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/40",
                          template.isEnabled ? "border-primary bg-primary" : "border-line-strong bg-paper"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start]",
                            template.isEnabled ? "start-[1.375rem]" : "start-0.5"
                          )}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Asked here rather than in a dialog: this list may itself sit inside one. */}
                {kind && confirming === template.key && (
                  <div role="group" aria-label={t.useStore} className="mt-2 space-y-2 rounded-[var(--radius)] bg-paper-sunken p-3">
                    <p className="text-sm text-ink">{fmt(pick(t, `useStoreBody_${kind}`), { name })}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="min-h-11 sm:min-h-8" disabled={busy === template.key} onClick={() => void revertToStore(template)}>
                        {busy === template.key ? t.working : t.useStore}
                      </Button>
                      <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" disabled={busy === template.key} onClick={() => setConfirming(null)}>
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </DataState>
      {editor}
    </>
  );
}
