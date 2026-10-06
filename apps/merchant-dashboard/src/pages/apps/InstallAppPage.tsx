import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import { Check, Plug } from "lucide-react";
import { ApiError, appsInstallExternal, appsPreviewExternal, type AppInstallLink } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";

/**
 * Where an app install link lands (SPEC §16.3):
 * /install-app?app_name=…&callback_url=…&permissions=…&redirect_url=…
 * The merchant sees who is asking and for what, and approves or leaves.
 * Nothing is created until they approve.
 */

const STRINGS = {
  en: {
    badLinkTitle: "This install link is not valid",
    badLinkBody: "Ask the service that sent you here for a new link.",
    heading: "{app} wants to connect to {store}",
    intro: "Approve only if you know this service and asked to connect it.",
    willBeAble: "It will be able to",
    willReceive: "It will be told when",
    sendsTo: "Connects to {host}",
    approve: "Approve and connect",
    approving: "Connecting…",
    decline: "Not now",
    doneTitle: "{app} is connected",
    doneBody: "You can remove it at any time from Apps → Installed.",
    backToApp: "Back to {app}",
    toApps: "Go to Apps",
    "event.order.created": "a new order is placed",
    "event.order.status_changed": "an order's status changes",
    "scope.orders:read": "See your orders",
    "scope.orders:write": "Create, update and cancel orders",
    "scope.orders:create": "Create orders",
    "scope.orders:update": "Update orders: status, confirmation, notes, tracking",
    "scope.orders:delete": "Cancel orders",
    "scope.products:read": "See your products and stock",
    "scope.products:create": "Add products",
    "scope.products:update": "Edit products and stock",
    "scope.products:delete": "Archive products",
    "scope.categories:read": "See your categories",
    "scope.categories:create": "Add categories",
    "scope.categories:update": "Edit categories",
    "scope.categories:delete": "Delete categories",
    "scope.customers:read": "See your customers",
    "scope.discounts:read": "See your discount codes",
    "scope.discounts:write": "Create and edit discount codes",
    "scope.shipping_areas:read": "See your shipping areas and prices",
    "scope.shipping_areas:write": "Change your shipping prices",
    "scope.webhooks:write": "Register webhooks",
    "scope.analytics:read": "See your sales reports",
  },
  ar: {
    badLinkTitle: "رابط التثبيت ده مش صحيح",
    badLinkBody: "اطلب رابط جديد من الخدمة اللي بعتتك هنا.",
    heading: "{app} عايز يتربط بـ {store}",
    intro: "وافق بس لو عارف الخدمة دي وإنت اللي طلبت تربطها.",
    willBeAble: "هيقدر",
    willReceive: "هيتبلّغ لما",
    sendsTo: "بيتصل بـ {host}",
    approve: "موافقة وربط",
    approving: "بنربط…",
    decline: "مش دلوقتي",
    doneTitle: "اتربط {app}",
    doneBody: "تقدر تشيله في أي وقت من التطبيقات ← المثبّتة.",
    backToApp: "الرجوع إلى {app}",
    toApps: "روح للتطبيقات",
    "event.order.created": "يتعمل طلب جديد",
    "event.order.status_changed": "حالة طلب تتغير",
    "scope.orders:read": "يشوف طلباتك",
    "scope.orders:write": "ينشئ ويعدّل ويلغي الطلبات",
    "scope.orders:create": "ينشئ طلبات",
    "scope.orders:update": "يعدّل الطلبات: الحالة والتأكيد والملاحظات والتتبع",
    "scope.orders:delete": "يلغي طلبات",
    "scope.products:read": "يشوف منتجاتك والمخزون",
    "scope.products:create": "يضيف منتجات",
    "scope.products:update": "يعدّل المنتجات والمخزون",
    "scope.products:delete": "يؤرشف منتجات",
    "scope.categories:read": "يشوف التصنيفات",
    "scope.categories:create": "يضيف تصنيفات",
    "scope.categories:update": "يعدّل التصنيفات",
    "scope.categories:delete": "يحذف تصنيفات",
    "scope.customers:read": "يشوف عملاءك",
    "scope.discounts:read": "يشوف أكواد الخصم",
    "scope.discounts:write": "ينشئ ويعدّل أكواد الخصم",
    "scope.shipping_areas:read": "يشوف مناطق وأسعار الشحن",
    "scope.shipping_areas:write": "يغيّر أسعار الشحن",
    "scope.webhooks:write": "يسجّل webhooks",
    "scope.analytics:read": "يشوف تقارير المبيعات",
  },
} satisfies Messages;

const LINK_KEYS = ["app_name", "app_description", "app_icon", "callback_url", "orders_webhook", "order_status_webhook", "permissions", "redirect_url"] as const;

export function InstallAppPage() {
  const t = useT(STRINGS);
  const labels = t as Record<string, string>;
  const [params] = useSearchParams();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const errorMessage = useErrorMessage();
  const link = useMemo(() => {
    const out: AppInstallLink = {};
    for (const key of LINK_KEYS) {
      const value = params.get(key);
      if (value) out[key] = value;
    }
    return out;
  }, [params]);
  const preview = useAsync(() => appsPreviewExternal(apiClient, workspaceId, link), [workspaceId, link]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ redirectUrl: string | null } | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const result = await appsInstallExternal(apiClient, workspaceId, link);
      setDone({ redirectUrl: result.redirectUrl });
      // Back to the app that sent the merchant here, once they have seen it worked.
      if (result.redirectUrl) window.setTimeout(() => window.location.assign(result.redirectUrl as string), 1500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // A link the server refuses is the sender's mistake, not something to retry.
  const linkProblems = (() => {
    const err = preview.error;
    if (!(err instanceof ApiError) || err.status !== 422) return null;
    const details = (err.details as { error?: { details?: Array<{ field: string; message: string }> } } | null)?.error?.details;
    return Array.isArray(details) ? details : [];
  })();

  const data = preview.data;
  const appName = data?.app.name ?? link.app_name ?? "";

  return (
    <div className="mx-auto max-w-xl py-6">
      {linkProblems ? (
        <Card className="gap-3 p-6">
          <h1 className="font-display text-xl font-medium text-ink">{t.badLinkTitle}</h1>
          <p className="text-sm text-ink-soft">{t.badLinkBody}</p>
          <ul className="space-y-1 text-sm text-danger" dir="ltr">
            {linkProblems.map((problem, index) => (
              <li key={index}>
                <code className="font-mono">{problem.field}</code>: {problem.message}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link to="/apps">{t.toApps}</Link>
            </Button>
          </div>
        </Card>
      ) : (
      <DataState loading={preview.loading} error={preview.error} onRetry={() => void preview.refresh()}>
        {data && (
          <Card className="gap-5 p-6">
            <div className="flex items-center gap-3">
              {data.app.icon ? (
                <img src={data.app.icon} alt="" className="size-12 rounded-2xl border border-line object-cover" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Plug className="size-6" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-xl font-medium text-ink">
                  {done ? fmt(t.doneTitle, { app: appName }) : fmt(t.heading, { app: appName, store: currentWorkspace?.name ?? "" })}
                </h1>
                <p className="text-xs text-ink-soft" dir="ltr">
                  {fmt(t.sendsTo, { host: data.app.callbackHost })}
                </p>
              </div>
            </div>

            {done ? (
              <>
                <p className="text-sm text-ink-soft">{t.doneBody}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/apps">{t.toApps}</Link>
                  </Button>
                  {done.redirectUrl && (
                    <Button asChild>
                      <a href={done.redirectUrl}>{fmt(t.backToApp, { app: appName })}</a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {data.app.description && <p className="text-sm text-ink">{data.app.description}</p>}
                <p className="text-sm text-ink-soft">{t.intro}</p>

                <div>
                  <h2 className="text-sm font-semibold text-ink">{t.willBeAble}</h2>
                  <ul className="mt-2 space-y-1.5">
                    {data.scopes.map((scope) => (
                      <li key={scope} className="flex items-start gap-2 text-sm text-ink">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        <span>{labels[`scope.${scope}`] ?? scope}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {data.webhooks.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{t.willReceive}</h2>
                    <ul className="mt-2 space-y-1.5">
                      {data.webhooks.map((hook) => (
                        <li key={hook.event} className="flex items-start gap-2 text-sm text-ink">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                          <span>{labels[`event.${hook.event}`] ?? hook.event}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && <Alert variant="danger">{error}</Alert>}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/apps">{t.decline}</Link>
                  </Button>
                  <Button onClick={approve} disabled={busy}>
                    {busy ? t.approving : t.approve}
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}
      </DataState>
      )}
    </div>
  );
}
