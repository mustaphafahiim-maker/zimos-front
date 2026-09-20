import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type {
  AutomationPaymentMethod,
  AutomationRule,
  AutomationRulePayload,
  AutomationTrigger,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDateTime, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Automations",
    description: "Send WhatsApp template messages to customers automatically when an order changes.",
    newRule: "New automation",
    notConnected: "WhatsApp isn't connected, so automations can't send messages.",
    connect: "Connect WhatsApp",
    noRules: "No automations yet",
    noRulesDesc: "Create one to message customers when their order is confirmed, shipped or delivered.",
    active: "Active",
    stats: "{sent} sent · {skipped} skipped · {failed} failed",
    lastRun: "Last run {date}",
    never: "Never ran",
    whenTrigger: "When",
    sendTemplate: "Send template {template} ({language})",
    condPayment: "Payment: {method}",
    condMin: "Order total ≥ {amount}",
    edit: "Edit",
    delete: "Delete",
    createTitle: "New automation",
    editTitle: "Edit automation",
    name: "Name",
    trigger: "Trigger",
    templateName: "WhatsApp template name",
    templateHint: "Exactly as approved in Meta: lowercase letters, numbers and underscores.",
    language: "Template language",
    languageHint: "e.g. ar, en or en_US",
    variables: "Template variables",
    variablesHint: "In order: the first box fills the template's first placeholder. Click a token to insert it.",
    variable: "Variable {n}",
    addVariable: "Add variable",
    removeVariable: "Remove variable {n}",
    tokens: "Tokens",
    conditions: "Only when (optional)",
    paymentMethod: "Payment method",
    anyMethod: "Any payment method",
    minTotal: "Minimum order total",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Automation saved",
    errName: "Name must be at least 2 characters.",
    errTemplate: "Use lowercase letters, numbers and underscores only.",
    errLanguage: "Use a language code like ar or en_US.",
    errMin: "Enter a valid amount.",
    deleteTitle: "Delete this automation?",
    deleteDesc: "It stops sending messages. Its past runs stay in the log.",
    deleted: "Automation deleted",
    runsTitle: "Runs log",
    noRuns: "No runs yet",
    noRunsDesc: "Every time an automation fires, the result shows up here.",
    colTime: "Time",
    colRule: "Automation",
    colTrigger: "Trigger",
    colOrder: "Order",
    colStatus: "Status",
    colDetail: "Detail",
    deletedRule: "Deleted automation",
    "order.created": "Order created",
    "order.confirmed": "Order confirmed",
    "order.rejected": "Order rejected",
    "order.cancelled": "Order cancelled",
    "order.shipped": "Order shipped",
    "order.out_for_delivery": "Out for delivery",
    "order.delivered": "Order delivered",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Wallet",
    bank_transfer: "Bank transfer",
  },
  ar: {
    title: "الأتمتة",
    description: "ابعت رسايل واتساب جاهزة للعملاء أوتوماتيك لما حالة الطلب تتغيّر.",
    newRule: "أتمتة جديدة",
    notConnected: "واتساب مش متوصّل، فالأتمتة مش هتقدر تبعت رسايل.",
    connect: "وصّل واتساب",
    noRules: "مفيش أتمتة لسه",
    noRulesDesc: "اعمل واحدة تبعت للعميل لما طلبه يتأكد أو يتشحن أو يتسلّم.",
    active: "شغّالة",
    stats: "{sent} اتبعتت · {skipped} اتخطّت · {failed} فشلت",
    lastRun: "آخر تشغيل {date}",
    never: "لسه مشتغلتش",
    whenTrigger: "لما",
    sendTemplate: "ابعت القالب {template} ({language})",
    condPayment: "الدفع: {method}",
    condMin: "إجمالي الطلب ≥ {amount}",
    edit: "تعديل",
    delete: "مسح",
    createTitle: "أتمتة جديدة",
    editTitle: "تعديل الأتمتة",
    name: "الاسم",
    trigger: "الحدث",
    templateName: "اسم قالب واتساب",
    templateHint: "زي ما هو متوافق عليه في ميتا بالظبط: حروف إنجليزي صغيرة وأرقام و _ بس.",
    language: "لغة القالب",
    languageHint: "مثلاً ar أو en أو en_US",
    variables: "متغيّرات القالب",
    variablesHint: "بالترتيب: أول خانة بتملى أول خانة فاضية في القالب. دوس على أي رمز عشان تحطّه.",
    variable: "متغيّر {n}",
    addVariable: "ضيف متغيّر",
    removeVariable: "شيل المتغيّر {n}",
    tokens: "الرموز",
    conditions: "بس لما (اختياري)",
    paymentMethod: "طريقة الدفع",
    anyMethod: "أي طريقة دفع",
    minTotal: "أقل إجمالي للطلب",
    save: "حفظ",
    saving: "بنحفظ…",
    cancel: "إلغاء",
    saved: "الأتمتة اتحفظت",
    errName: "الاسم لازم يكون حرفين على الأقل.",
    errTemplate: "استخدم حروف إنجليزي صغيرة وأرقام و _ بس.",
    errLanguage: "اكتب كود لغة زي ar أو en_US.",
    errMin: "اكتب مبلغ صحيح.",
    deleteTitle: "مسح الأتمتة دي؟",
    deleteDesc: "هتبطّل تبعت رسايل، والتشغيلات القديمة هتفضل في السجل.",
    deleted: "الأتمتة اتمسحت",
    runsTitle: "سجل التشغيل",
    noRuns: "مفيش تشغيلات لسه",
    noRunsDesc: "كل مرة أتمتة تشتغل، النتيجة هتظهر هنا.",
    colTime: "الوقت",
    colRule: "الأتمتة",
    colTrigger: "الحدث",
    colOrder: "الطلب",
    colStatus: "الحالة",
    colDetail: "التفاصيل",
    deletedRule: "أتمتة اتمسحت",
    "order.created": "طلب جديد",
    "order.confirmed": "الطلب اتأكد",
    "order.rejected": "الطلب اترفض",
    "order.cancelled": "الطلب اتلغى",
    "order.shipped": "الطلب اتشحن",
    "order.out_for_delivery": "خرج للتوصيل",
    "order.delivered": "الطلب اتسلّم",
    cod: "الدفع عند الاستلام",
    card: "كارت",
    wallet: "محفظة",
    bank_transfer: "تحويل بنكي",
  },
} satisfies Messages;

/**
 * Used only until the first `GET /automations` lands — the server sends its
 * own `triggers` / `tokens` and those always win, so a trigger the backend
 * adds needs no release here.
 */
const FALLBACK_TRIGGERS: AutomationTrigger[] = [
  "order.created",
  "order.confirmed",
  "order.rejected",
  "order.cancelled",
  "order.shipped",
  "order.out_for_delivery",
  "order.delivered",
];
const FALLBACK_TOKENS = [
  "customer_name",
  "order_number",
  "order_total",
  "store_name",
  "tracking_url",
  "city",
];
const PAYMENT_METHODS: AutomationPaymentMethod[] = ["cod", "card", "wallet", "bank_transfer"];
const RUN_TONE = { sent: "success", skipped: "neutral", failed: "danger" } as const;

interface FormState {
  name: string;
  trigger: AutomationTrigger;
  template: string;
  language: string;
  params: string[];
  paymentMethod: "" | AutomationPaymentMethod;
  /** Major-unit text, as typed. */
  minTotal: string;
}

function formFromRule(rule: AutomationRule | null): FormState {
  // The API allows up to five actions; the editor writes one, which is what
  // every rule the backend can send today actually carries.
  const action = rule?.actions[0];
  return {
    name: rule?.name ?? "",
    trigger: rule?.trigger ?? "order.confirmed",
    template: action?.template ?? "",
    language: action?.language ?? "ar",
    params: action?.params.length ? [...action.params] : [""],
    paymentMethod: rule?.conditions.paymentMethod ?? "",
    minTotal:
      rule?.conditions.minTotalAmount != null ? minorToMajorInput(rule.conditions.minTotalAmount) : "",
  };
}

export function AutomationsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const rules = useAsync(() => apiClient.listAutomations(workspaceId), [workspaceId]);
  const runs = useAsync(() => apiClient.listAutomationRuns(workspaceId, { limit: 50 }), [workspaceId]);

  const [editing, setEditing] = useState<AutomationRule | "new" | null>(null);
  const [form, setForm] = useState<FormState>(formFromRule(null));
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "template" | "language" | "minTotal", string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AutomationRule | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const paramRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeParam, setActiveParam] = useState(0);

  const triggers = rules.data?.triggers?.length ? rules.data.triggers : FALLBACK_TRIGGERS;
  const tokens = rules.data?.tokens?.length ? rules.data.tokens : FALLBACK_TOKENS;
  const list = rules.data?.rules ?? [];
  const ruleNames = new Map(list.map((r) => [r.id, r.name]));
  const runList = runs.data?.runs ?? [];

  /** Translates a trigger or payment-method key, falling back to the raw value. */
  const label = (v: string) => (t as Record<string, string>)[v] ?? v;

  function openEditor(rule: AutomationRule | null) {
    setForm(formFromRule(rule));
    setErrors({});
    setActiveParam(0);
    setEditing(rule ?? "new");
  }

  /** Inserts `{{token}}` at the caret of the variable box the user last touched. */
  function insertToken(token: string) {
    const text = `{{${token}}}`;
    const idx = Math.min(activeParam, form.params.length - 1);
    const input = paramRefs.current[idx];
    const current = form.params[idx] ?? "";
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    setForm((f) => ({ ...f, params: f.params.map((p, i) => (i === idx ? next : p)) }));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function save() {
    // Mirrors the route's Joi schema so a typo is caught before the round trip.
    const errs: typeof errors = {};
    if (form.name.trim().length < 2) errs.name = t.errName;
    if (!/^[a-z0-9_]{1,512}$/.test(form.template.trim())) errs.template = t.errTemplate;
    if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(form.language.trim())) errs.language = t.errLanguage;
    const min = form.minTotal.trim() === "" ? null : majorToMinor(form.minTotal);
    if (min !== null && (!Number.isFinite(min) || min < 0)) errs.minTotal = t.errMin;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload: AutomationRulePayload = {
      name: form.name.trim(),
      trigger: form.trigger,
      conditions: { paymentMethod: form.paymentMethod || null, minTotalAmount: min },
      actions: [
        {
          type: "whatsapp_template",
          template: form.template.trim(),
          language: form.language.trim(),
          params: form.params.map((p) => p.trim()).filter((p) => p !== ""),
        },
      ],
    };
    setSaving(true);
    try {
      if (editing === "new") await apiClient.createAutomation(workspaceId, { ...payload, isActive: true });
      else if (editing) await apiClient.updateAutomation(workspaceId, editing.id, payload);
      toast.success(t.saved);
      setEditing(null);
      rules.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: AutomationRule, next: boolean) {
    setToggling(rule.id);
    try {
      await apiClient.updateAutomation(workspaceId, rule.id, { isActive: next });
      rules.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => openEditor(null)}>
            <Plus className="size-4" />
            {t.newRule}
          </Button>
        }
      />

      {integration.data && !integration.data.connected && (
        <Alert
          variant="default"
          className="mb-6 border-accent/40 bg-accent-soft text-accent-dark dark:text-accent"
        >
          <p>
            {t.notConnected}{" "}
            <Link to="/settings#whatsapp" className="font-medium underline">
              {t.connect}
            </Link>
          </p>
        </Alert>
      )}

      <section className="mb-8">
        <DataState
          loading={rules.loading && !rules.data}
          error={rules.error}
          onRetry={() => rules.refresh()}
        >
          {list.length === 0 ? (
            <EmptyState
              icon={<Bot />}
              title={t.noRules}
              description={t.noRulesDesc}
              action={<Button onClick={() => openEditor(null)}>{t.newRule}</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((rule) => {
                const action = rule.actions[0];
                return (
                  <div
                    key={rule.id}
                    className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-ink" dir="auto">
                          {rule.name}
                        </h3>
                        <p className="text-sm text-ink-soft">
                          {t.whenTrigger}: {label(rule.trigger)}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.isActive}
                        aria-label={`${t.active}: ${rule.name}`}
                        disabled={toggling === rule.id}
                        onClick={() => toggle(rule, !rule.isActive)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          rule.isActive ? "border-primary bg-primary" : "border-line-strong bg-paper"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start]",
                            rule.isActive ? "start-[1.375rem]" : "start-0.5"
                          )}
                        />
                      </button>
                    </div>
                    {action && (
                      <p className="mt-2 text-sm text-ink">
                        {fmt(t.sendTemplate, { template: action.template, language: action.language })}
                      </p>
                    )}
                    {(rule.conditions.paymentMethod || rule.conditions.minTotalAmount != null) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {rule.conditions.paymentMethod && (
                          <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft">
                            {fmt(t.condPayment, { method: label(rule.conditions.paymentMethod) })}
                          </span>
                        )}
                        {rule.conditions.minTotalAmount != null && (
                          <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft">
                            {fmt(t.condMin, { amount: formatMoney(rule.conditions.minTotalAmount) })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="text-xs text-ink-soft">
                        {fmt(t.stats, {
                          sent: rule.stats.sent,
                          skipped: rule.stats.skipped,
                          failed: rule.stats.failed,
                        })}{" "}
                        ·{" "}
                        {rule.stats.lastRunAt
                          ? fmt(t.lastRun, { date: formatDateTime(rule.stats.lastRunAt) })
                          : t.never}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEditor(rule)}
                          aria-label={`${t.edit} ${rule.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setToDelete(rule)}
                          aria-label={`${t.delete} ${rule.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataState>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-medium text-ink">{t.runsTitle}</h2>
        <DataState loading={runs.loading && !runs.data} error={runs.error} onRetry={() => runs.refresh()}>
          {runList.length === 0 ? (
            <EmptyState title={t.noRuns} description={t.noRunsDesc} />
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper-raised">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 text-start font-medium">{t.colTime}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colRule}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colTrigger}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colStatus}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colDetail}</th>
                  </tr>
                </thead>
                <tbody>
                  {runList.map((run) => (
                    <tr key={run.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-start text-ink-soft">
                        {formatDateTime(run.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-start text-ink" dir="auto">
                        {ruleNames.get(run.ruleId) ?? t.deletedRule}
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft">{label(run.trigger)}</td>
                      <td className="px-4 py-3 text-start">
                        {run.order ? (
                          <Link
                            to={`/orders/${run.order.id}`}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            <bdi dir="ltr">{run.order.orderNumber ?? "—"}</bdi>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <StatusBadge value={run.status} tone={RUN_TONE[run.status]} />
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-start",
                          run.status === "failed" ? "text-danger" : "text-ink-soft"
                        )}
                        dir="auto"
                      >
                        {run.detail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.createTitle : t.editTitle}
        className="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t.cancel}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label={t.name}
            required
            dir="auto"
            value={form.name}
            error={errors.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Field label={t.trigger}>
            {(props) => (
              <Select
                {...props}
                value={form.trigger}
                onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value as AutomationTrigger }))}
              >
                {triggers.map((tr) => (
                  <option key={tr} value={tr}>
                    {label(tr)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.templateName}
              required
              dir="ltr"
              hint={t.templateHint}
              value={form.template}
              error={errors.template}
              onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
            />
            <TextField
              label={t.language}
              required
              dir="ltr"
              hint={t.languageHint}
              value={form.language}
              error={errors.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-ink">{t.variables}</p>
            <p className="mb-2 text-xs text-ink-soft">{t.variablesHint}</p>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-soft">{t.tokens}:</span>
              {tokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  // Keeps the caret in the variable box so the token lands there.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(token)}
                  className="cursor-pointer rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink hover:border-primary hover:text-primary"
                  dir="ltr"
                >
                  {token}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {form.params.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-ink-soft" dir="ltr">{`{{${i + 1}}}`}</span>
                  <Input
                    ref={(el) => {
                      paramRefs.current[i] = el;
                    }}
                    value={p}
                    dir="auto"
                    aria-label={fmt(t.variable, { n: i + 1 })}
                    onFocus={() => setActiveParam(i)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        params: f.params.map((x, j) => (j === i ? e.target.value : x)),
                      }))
                    }
                  />
                  {form.params.length > 1 && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={fmt(t.removeVariable, { n: i + 1 })}
                      onClick={() => {
                        setForm((f) => ({ ...f, params: f.params.filter((_, j) => j !== i) }));
                        setActiveParam(0);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {/* The route caps a template at 20 params. */}
            {form.params.length < 20 && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setForm((f) => ({ ...f, params: [...f.params, ""] }));
                  setActiveParam(form.params.length);
                }}
              >
                <Plus className="size-4" />
                {t.addVariable}
              </Button>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">{t.conditions}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.paymentMethod}>
                {(props) => (
                  <Select
                    {...props}
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paymentMethod: e.target.value as FormState["paymentMethod"] }))
                    }
                  >
                    <option value="">{t.anyMethod}</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t[m]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <MoneyInput
                label={t.minTotal}
                value={form.minTotal}
                error={errors.minTotal}
                onChange={(v) => setForm((f) => ({ ...f, minTotal: v }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={t.deleteTitle}
        description={t.deleteDesc}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await apiClient.deleteAutomation(workspaceId, toDelete.id);
          toast.success(t.deleted);
          setToDelete(null);
          rules.refresh({ silent: true });
          runs.refresh({ silent: true });
        }}
      />
    </div>
  );
}
