import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { ExternalLink, KeyRound, Workflow } from "lucide-react";
import {
  developersCreateApiKey,
  developersListWebhooks,
  type ApiKeyScope,
  type WebhookEndpointDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { AppOffNotice } from "@/components/AppOffNotice";
import { CopyButton } from "@/components/CopyButton";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import {
  AUTOMATION_SCOPES,
  SUGGESTED_TRIGGERS,
  TOOL_NAME,
  TOOL_SITE,
  WEBHOOK_LIMIT,
  automationOf,
  type AutomationTool,
} from "./automationApps";

const STRINGS = {
  en: {
    title: "Connect {tool}",
    descZapier: "Send new orders, leads and contacts to more than {count} apps — Google Sheets, Slack, your CRM — without code.",
    descMake: "Build scenarios on your orders, leads and contacts in Make — without code.",
    back: "Apps",
    stepsTitle: "How to connect",
    stepsIntro: "Create an API key with the Webhooks scope, then paste it in {tool}",
    step1: "Create an API key with the Webhooks scope (and Orders read, so the order's details come along).",
    step2: "In {tool}, search for Zimos and paste the key when it asks for it.",
    step3: "Pick the trigger that starts your automation, like “New order”. {tool} adds its webhook to your store by itself — it shows under “Your automations”.",
    createKey: "Create API key",
    openTool: "Open {tool}",
    automationsTitle: "Your automations",
    automationsHint: "Every trigger you turn on in {tool} is one webhook in your store.",
    used: "{used} of {max} webhooks used",
    full: "Your store holds {max} webhooks, the most it can. Turn off an automation you no longer use before adding another.",
    noneTitle: "No {tool} automations yet",
    noneBody: "Turn on an automation in {tool} that starts with a Zimos trigger, and it shows here.",
    manage: "Manage webhooks",
    active: "On",
    paused: "Paused",
    status: "Status",
    since: "Since {date}",
    allEvents: "All events",
    triggersTitle: "Triggers you can start from",
    triggersHint: "{tool} shows each of these as a trigger. Its samples are your store's latest real ones.",
    payloadTitle: "What {tool} receives",
    payloadHint: "Every trigger sends the same envelope; the order, lead or contact itself is under “data”.",
    "order.created": "New order",
    "order.paid": "Order paid",
    "order.confirmed": "Order confirmed",
    "shipment.status_changed": "Order shipped or moved",
    "order.fulfilled": "Order delivered",
    "lead.created": "New lead",
    "customer.created": "New customer",
    "contact.updated": "Contact updated",
    "checkout.abandoned": "Checkout left without an order",
    "review.created": "New review",
    // The key dialog
    keyTitle: "API key for {tool}",
    keyName: "Name",
    keyNameHint: "So you can tell this key apart later.",
    access: "What it may do",
    scopeWebhooks: "Start automations from your store's events (Webhooks)",
    scopeWebhooksHint: "Needed: it's how {tool} hears about a new order.",
    scopeOrders: "Read order details",
    scopeOrdersHint: "So the order's products, customer and address reach {tool}.",
    create: "Create key",
    creating: "Creating…",
    cancel: "Cancel",
    createdTitle: "Copy your key",
    createdBody:
      "This is the only time the key is shown. Paste it in {tool} now — if it gets lost, revoke it under Settings → Developers and create another.",
    copyKey: "Copy key",
    next: "Next: open {tool}, search for Zimos and paste the key.",
    done: "Done",
  },
  ar: {
    title: "اربط {tool}",
    descZapier: "ابعت الأوردرات الجديدة والعملاء المحتملين وجهات الاتصال لأكتر من {count} تطبيق — جوجل شيتس وسلاك ونظام العملاء بتاعك — من غير كود.",
    descMake: "اعمل سيناريوهات على أوردراتك وعملائك المحتملين وجهات الاتصال في ميك — من غير كود.",
    back: "التطبيقات",
    stepsTitle: "إزاي تربطه",
    stepsIntro: "اعمل مفتاح API بصلاحية الـ Webhooks، وبعدين الصقه في {tool}",
    step1: "اعمل مفتاح API بصلاحية الـ Webhooks (ومعاها قراءة الأوردرات، عشان تفاصيل الأوردر توصل).",
    step2: "في {tool}، دوّر على Zimos والصق المفتاح لما يطلبه منك.",
    step3: "اختار الحدث اللي يبدأ الأتمتة، زي «أوردر جديد». {tool} هيضيف الـ webhook بتاعه لمتجرك لوحده — وهتلاقيه تحت «الأتمتة بتاعتك».",
    createKey: "اعمل مفتاح API",
    openTool: "افتح {tool}",
    automationsTitle: "الأتمتة بتاعتك",
    automationsHint: "كل حدث بتشغّله في {tool} بيبقى webhook واحد في متجرك.",
    used: "مستخدم {used} من {max} webhook",
    full: "متجرك فيه {max} webhook، وده أقصى عدد. اقفل أتمتة مش بتستخدمها قبل ما تضيف واحدة جديدة.",
    noneTitle: "لسه مفيش أتمتة من {tool}",
    noneBody: "شغّل أتمتة في {tool} بتبدأ بحدث من Zimos، وهتظهر هنا.",
    manage: "إدارة الـ Webhooks",
    active: "شغّالة",
    paused: "متوقفة",
    status: "الحالة",
    since: "من {date}",
    allEvents: "كل الأحداث",
    triggersTitle: "الأحداث اللي تقدر تبدأ منها",
    triggersHint: "{tool} بيعرض كل واحد فيهم كبداية للأتمتة، والأمثلة بتاعته بتيجي من آخر بيانات حقيقية في متجرك.",
    payloadTitle: "{tool} بيستلم إيه",
    payloadHint: "كل حدث بيبعت نفس الشكل، والأوردر أو العميل نفسه جوه «data».",
    "order.created": "أوردر جديد",
    "order.paid": "الأوردر اتدفع",
    "order.confirmed": "الأوردر اتأكد",
    "shipment.status_changed": "الأوردر اتشحن أو اتحرك",
    "order.fulfilled": "الأوردر اتسلّم",
    "lead.created": "عميل محتمل جديد",
    "customer.created": "عميل جديد",
    "contact.updated": "جهة اتصال اتعدلت",
    "checkout.abandoned": "سلة متروكة من غير أوردر",
    "review.created": "تقييم جديد",
    keyTitle: "مفتاح API لـ {tool}",
    keyName: "الاسم",
    keyNameHint: "عشان تعرف المفتاح ده بعدين.",
    access: "يقدر يعمل إيه",
    scopeWebhooks: "يبدأ أتمتة من أحداث متجرك (Webhooks)",
    scopeWebhooksHint: "لازم: كده {tool} بيعرف إن فيه أوردر جديد.",
    scopeOrders: "يقرا تفاصيل الأوردرات",
    scopeOrdersHint: "عشان منتجات الأوردر والعميل والعنوان يوصلوا لـ {tool}.",
    create: "اعمل المفتاح",
    creating: "بيعمل المفتاح…",
    cancel: "إلغاء",
    createdTitle: "انسخ المفتاح",
    createdBody: "المفتاح ده بيظهر مرة واحدة بس. الصقه في {tool} دلوقتي — ولو ضاع، الغيه من الإعدادات ← المطورين واعمل واحد تاني.",
    copyKey: "انسخ المفتاح",
    next: "الخطوة الجاية: افتح {tool}، دوّر على Zimos والصق المفتاح.",
    done: "تمام",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/**
 * Apps → Zapier / Make (frontend-handoff 193): the app card's guide. A store
 * connects with an API key on the public API; each trigger the merchant turns
 * on in Zapier or Make subscribes one webhook here by itself (up to 25 per
 * store). The page makes that key with the two scopes ticked, lists the
 * webhooks the tool added, and names the triggers it can start from.
 *
 * Keys need api_keys.manage and the list webhooks.manage: without them the
 * API answers 403 — the list draws the no-permission card, the dialog says so.
 */
export function AutomationGuidePage({ tool }: { tool: AutomationTool }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const hooks = useAsync(() => developersListWebhooks(apiClient, workspaceId), [workspaceId]);
  const [creating, setCreating] = useState(false);
  const name = TOOL_NAME[tool][locale];

  const endpoints = hooks.data?.endpoints ?? [];
  const mine = endpoints.filter((endpoint) => automationOf(endpoint.url) === tool);
  const offered = new Set((hooks.data?.events ?? []).map((event) => event.name));
  // Before the catalogue loads (or without permission to read it) the README's list stands.
  const triggers = SUGGESTED_TRIGGERS.filter((event) => offered.size === 0 || offered.has(event));

  const steps = [t.step1, t.step2, t.step3];

  return (
    <div>
      <PageHeader
        title={fmt(t.title, { tool: name })}
        description={tool === "zapier" ? fmt(t.descZapier, { count: 6000 }) : t.descMake}
        back={{ to: "/apps", label: t.back }}
      />
      <AppOffNotice app="public_api" />
      <AppOffNotice app="webhooks" />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title={t.stepsTitle} description={fmt(t.stepsIntro, { tool: name })}>
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark"
                >
                  {fmt("{n}", { n: index + 1 })}
                </span>
                <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                  <p className="text-sm text-ink">{fmt(step, { tool: name })}</p>
                  {index === 0 && (
                    <Button type="button" className="min-h-11" onClick={() => setCreating(true)}>
                      <KeyRound className="size-4" aria-hidden />
                      {t.createKey}
                    </Button>
                  )}
                  {index === 1 && (
                    <Button variant="outline" className="min-h-11" asChild>
                      <a href={TOOL_SITE[tool]} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" aria-hidden />
                        {fmt(t.openTool, { tool: name })}
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title={t.automationsTitle}
          description={fmt(t.automationsHint, { tool: name })}
          actions={
            <Link to="/settings?tab=developers" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              {t.manage}
            </Link>
          }
        >
          <DataState loading={hooks.loading && !hooks.data} error={hooks.error} onRetry={() => void hooks.refresh()}>
            <div className="space-y-3">
              {mine.length === 0 ? (
                <EmptyState
                  icon={<Workflow />}
                  title={fmt(t.noneTitle, { tool: name })}
                  description={fmt(t.noneBody, { tool: name })}
                  className="py-8"
                />
              ) : (
                <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
                  {mine.map((endpoint) => (
                    <AutomationRow key={endpoint.id} t={t} endpoint={endpoint} separator={locale === "ar" ? "، " : ", "} />
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-soft">{fmt(t.used, { used: endpoints.length, max: WEBHOOK_LIMIT })}</p>
              {endpoints.length >= WEBHOOK_LIMIT && <Alert>{fmt(t.full, { max: WEBHOOK_LIMIT })}</Alert>}
            </div>
          </DataState>
        </Section>

        <Section title={t.triggersTitle} description={fmt(t.triggersHint, { tool: name })}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {triggers.map((event) => (
              <li key={event} className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
                <p className="text-sm font-medium text-ink">{t[event]}</p>
                <p className="text-xs text-ink-soft">
                  <code dir="ltr" className="font-mono">
                    {event}
                  </code>
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={fmt(t.payloadTitle, { tool: name })} description={t.payloadHint}>
          <pre dir="ltr" className="overflow-x-auto rounded-[var(--radius)] bg-paper-sunken p-3 text-start font-mono text-xs leading-relaxed text-ink">
            {JSON.stringify(
              { id: "evt_…", type: "order.created", createdAt: "2026-10-06T09:30:00.000Z", workspaceId, data: { id: "…", orderNumber: "…" } },
              null,
              2
            )}
          </pre>
        </Section>
      </div>

      <AutomationKeyDialog t={t} tool={tool} toolName={name} open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function AutomationRow({ t, endpoint, separator }: { t: T; endpoint: WebhookEndpointDto; separator: string }) {
  const events = endpoint.events.includes("*")
    ? t.allEvents
    : endpoint.events.map((event) => (t as Record<string, string>)[event] ?? event).join(separator);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{events}</p>
        <p className="text-xs text-ink-soft">{fmt(t.since, { date: formatDate(endpoint.createdAt) })}</p>
      </div>
      <StatusBadge
        value={endpoint.isActive ? "active" : "inactive"}
        label={t.status}
        text={endpoint.isActive ? t.active : t.paused}
      />
    </li>
  );
}

/**
 * The key Zapier / Make connect with: named after the tool, Webhooks always on
 * (nothing reaches the tool without it), Orders read on by default.
 */
function AutomationKeyDialog({
  t,
  tool,
  toolName,
  open,
  onClose,
}: {
  t: T;
  tool: AutomationTool;
  toolName: string;
  open: boolean;
  onClose: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(toolName);
  const [orders, setOrders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const webhooksHint = useId();
  const ordersHint = useId();

  function close() {
    setName(toolName);
    setOrders(true);
    setError(null);
    setSecret(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scopes: ApiKeyScope[] = AUTOMATION_SCOPES.filter((scope) => scope !== "orders:read" || orders);
      const created = await developersCreateApiKey(apiClient, workspaceId, { name: name.trim(), scopes });
      setSecret(created.secret);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (secret) {
    return (
      <Modal open={open} onClose={close} title={t.createdTitle} footer={<Button className="min-h-11" onClick={close}>{t.done}</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">{fmt(t.createdBody, { tool: toolName })}</p>
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-paper-sunken p-2">
            <code dir="ltr" className="min-w-0 flex-1 select-all break-all text-start font-mono text-xs text-ink">
              {secret}
            </code>
            <CopyButton value={secret} label={t.copyKey} />
          </div>
          <p className="text-sm text-ink">{fmt(t.next, { tool: toolName })}</p>
          <a
            href={TOOL_SITE[tool]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden />
            {fmt(t.openTool, { tool: toolName })}
          </a>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={fmt(t.keyTitle, { tool: toolName })}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label={t.keyName}
          hint={t.keyNameHint}
          value={name}
          maxLength={150}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t.access}</legend>
          <label className="flex min-h-11 items-start gap-3 rounded-[var(--radius)] p-3 ring-1 ring-line">
            {/* Always on: without it the tool hears about nothing. */}
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked readOnly aria-disabled aria-describedby={webhooksHint} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{t.scopeWebhooks}</span>
              <span id={webhooksHint} className="block text-xs text-ink-soft">
                {fmt(t.scopeWebhooksHint, { tool: toolName })}
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] p-3 ring-1 ring-line">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
              checked={orders}
              aria-describedby={ordersHint}
              onChange={(e) => setOrders(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{t.scopeOrders}</span>
              <span id={ordersHint} className="block text-xs text-ink-soft">
                {fmt(t.scopeOrdersHint, { tool: toolName })}
              </span>
            </span>
          </label>
        </fieldset>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy || name.trim() === ""}>
            {busy ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
