import { useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, Input, Label, cn } from "@store-builder/ui";
import { ArrowDown, ArrowUp, Clock, Mail, MessageCircle, MessageSquare, Pencil, Play, Plus, Trash2, Webhook, Zap } from "lucide-react";
import type { Automation, AutomationChannel, AutomationStep, AutomationTrigger } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { nowIso, uid } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
import { CHANNEL_LABEL, RECIPE_TEXT, STRINGS, TRIGGER_LABEL, type RecipeKey } from "./automations.strings";

type T = (typeof STRINGS)["en"];

const TRIGGERS = Object.keys(TRIGGER_LABEL.en) as AutomationTrigger[];

const TRIGGER_TONE: Record<AutomationTrigger, string> = {
  order_created: "bg-primary-soft text-primary-dark",
  order_confirmed: "bg-success-soft text-success",
  order_shipped: "bg-primary-soft text-primary-dark",
  order_delivered: "bg-success-soft text-success",
  order_cancelled: "bg-danger-soft text-danger",
  checkout_abandoned: "bg-warning-soft text-warning",
  confirmation_unreachable: "bg-warning-soft text-warning",
};

// WhatsApp keeps its recognisable third-party green; everything else stays on the ZIMOS blue family.
const CHANNEL: Record<AutomationChannel, { icon: typeof Mail; tone: string }> = {
  whatsapp: { icon: MessageCircle, tone: "bg-[#25D366]/15 text-[#128C7E]" },
  sms: { icon: MessageSquare, tone: "bg-primary-soft text-primary-dark" },
  email: { icon: Mail, tone: "bg-accent-soft text-accent-dark" },
  webhook: { icon: Webhook, tone: "bg-paper text-ink-soft border border-line" },
};

const CHANNELS = Object.keys(CHANNEL) as AutomationChannel[];

const VARIABLES = ["{{customer.firstName}}", "{{order.number}}", "{{order.total}}", "{{cart.link}}", "{{shipment.trackingUrl}}"];

function sampleValues(): Record<string, string> {
  return {
    "customer.firstName": "أحمد",
    "customer.name": "أحمد محمود",
    "order.number": "#10482",
    "order.total": formatMoney(129900),
    "cart.link": "zimos.app/c/8f2a1c",
    "cart.itemCount": "2",
    "shipment.trackingUrl": "bosta.co/t/EG7731",
    "shipment.carrier": "Bosta",
    "store.name": "EgyStore",
  };
}

function substitute(body: string): string {
  const sample = sampleValues();
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => sample[key] ?? `{{${key}}}`);
}

type DelayUnit = "minutes" | "hours" | "days";

function splitDelay(minutes: number): { value: number; unit: DelayUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

function delayLabel(minutes: number, t: T): string {
  if (minutes === 0) return t.immediately;
  const { value, unit } = splitDelay(minutes);
  const n = formatNumber(value);
  if (unit === "days") return value === 1 ? t.afterDay : fmt(t.afterDays, { n });
  if (unit === "hours") return value === 1 ? t.afterHour : fmt(t.afterHours, { n });
  return fmt(t.afterMin, { n });
}

interface Recipe {
  key: RecipeKey;
  icon: typeof Zap;
  build: () => Omit<Automation, "id" | "workspaceId" | "runs" | "lastRunAt" | "createdAt">;
}

// Recipe build() output is persisted sample content for Egyptian merchants; it stays in Arabic.
const RECIPES: Recipe[] = [
  {
    key: "confirm",
    icon: MessageCircle,
    build: () => ({
      name: "تأكيد الطلب على واتساب",
      trigger: "order_created",
      status: "active",
      steps: [{ id: uid(), delayMinutes: 0, channel: "whatsapp", templateName: "order_confirm", body: "أهلاً {{customer.firstName}} 👋 وصلنا طلبك رقم {{order.number}} بقيمة {{order.total}}. رد بـ 1 لتأكيد الطلب." }],
    }),
  },
  {
    key: "abandoned",
    icon: Zap,
    build: () => ({
      name: "استرجاع السلة المتروكة",
      trigger: "checkout_abandoned",
      status: "active",
      steps: [
        { id: uid(), delayMinutes: 30, channel: "whatsapp", templateName: "cart_recovery_1", body: "سيبت منتجات في السلة! كمّل طلبك دلوقتي: {{cart.link}}" },
        { id: uid(), delayMinutes: 1440, channel: "sms", templateName: "cart_recovery_2", body: "خصم 10% لو كملت طلبك النهاردة بكود BACK10 — {{cart.link}}" },
      ],
    }),
  },
  {
    key: "shipped",
    icon: Play,
    build: () => ({
      name: "إشعار الشحن + رقم التتبع",
      trigger: "order_shipped",
      status: "active",
      steps: [{ id: uid(), delayMinutes: 0, channel: "sms", templateName: "shipped", body: "طلبك {{order.number}} اتشحن. تتبع الشحنة: {{shipment.trackingUrl}}" }],
    }),
  },
  {
    key: "review",
    icon: MessageSquare,
    build: () => ({
      name: "طلب تقييم بعد التوصيل",
      trigger: "order_delivered",
      status: "active",
      steps: [{ id: uid(), delayMinutes: 2880, channel: "whatsapp", templateName: "review_request", body: "{{customer.firstName}}، وصلك طلبك {{order.number}}؟ يهمنا رأيك ⭐ رد بتقييم من 1 لـ 5." }],
    }),
  },
];

type Draft = Omit<Automation, "id" | "workspaceId" | "runs" | "lastRunAt" | "createdAt"> & { id?: string };

export function AutomationsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listAutomations(workspaceId), [workspaceId]);

  const [editing, setEditing] = useState<{ existing: Automation | null; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const automations = list.data ?? [];
  const reload = () => list.refresh({ silent: true });
  const triggerLabel = TRIGGER_LABEL[locale];
  const channelLabel = CHANNEL_LABEL[locale];
  const recipeText = RECIPE_TEXT[locale];

  const kpis = useMemo(() => {
    const active = automations.filter((a) => a.status === "active").length;
    // Fabricated: each run sends every step; ~28% of this month's runs.
    const sent = Math.round(automations.reduce((a, x) => a + x.runs * x.steps.length, 0) * 0.28);
    const recovery = automations.filter((a) => a.trigger === "checkout_abandoned" || a.trigger === "confirmation_unreachable");
    const recovered = recovery.reduce((a, x) => a + Math.round(x.runs * 0.14) * 89900, 0);
    return { active, sent, recovered };
  }, [automations]);

  async function toggleStatus(a: Automation, next: boolean) {
    const status: Automation["status"] = next ? "active" : "paused";
    list.setData((prev) => (prev ?? []).map((x) => (x.id === a.id ? { ...x, status } : x)));
    try {
      await mockApi.saveAutomation(workspaceId, { ...a, status });
      toast.success(next ? t.toastActivated : t.toastPaused);
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteAutomation(workspaceId, deleting.id);
    toast.success(t.toastDeleted);
    setDeleting(null);
    reload();
  }

  function openNew() {
    setEditing({
      existing: null,
      draft: { name: "", trigger: "order_created", status: "active", steps: [{ id: uid(), delayMinutes: 0, channel: "whatsapp", templateName: "", body: "" }] },
    });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={openNew}>
            <Plus /> {t.newAutomation}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiActive} value={<bdi dir="ltr">{formatNumber(kpis.active)}</bdi>} hint={fmt(t.kpiActiveHint, { n: formatNumber(automations.length) })} icon={<Zap />} />
        <KpiCard label={t.kpiSent} value={<bdi dir="ltr">{formatNumber(kpis.sent)}</bdi>} hint={t.kpiSentHint} icon={<MessageCircle />} />
        <KpiCard label={t.kpiRecovered} value={<bdi dir="ltr">{formatMoney(kpis.recovered)}</bdi>} hint={t.kpiRecoveredHint} icon={<Play />} className="col-span-2 lg:col-span-1" />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.recipes}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RECIPES.map((r) => {
            const Icon = r.icon;
            const text = recipeText[r.key];
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setEditing({ existing: null, draft: r.build() })}
                className="rounded-2xl border border-line bg-paper-raised p-4 text-start transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-dark">
                  <Icon className="size-4" />
                </span>
                <p className="mt-2 text-sm font-semibold text-ink">{text.title}</p>
                <p className="mt-1 text-xs text-ink-soft">{text.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {automations.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyDescription}
            icon={<Zap />}
            action={
              <Button variant="outline" onClick={openNew}>
                <Plus /> {t.newAutomation}
              </Button>
            }
            className="rounded-2xl"
          />
        ) : (
          <div className="space-y-3">
            {automations.map((a) => (
              <Card key={a.id} size="sm" className="gap-3 rounded-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink" dir="auto">
                        {a.name}
                      </h3>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TRIGGER_TONE[a.trigger])}>{triggerLabel[a.trigger]}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{fmt(t.runsLine, { runs: formatNumber(a.runs), date: formatDateTime(a.lastRunAt) })}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Toggle checked={a.status === "active"} onChange={(next) => toggleStatus(a, next)} />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={c.edit}
                      title={c.edit}
                      onClick={() => setEditing({ existing: a, draft: { id: a.id, name: a.name, trigger: a.trigger, status: a.status, steps: a.steps } })}
                    >
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t.deleteAutomation} title={t.deleteAutomation} className="text-danger hover:bg-danger-soft" onClick={() => setDeleting(a)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <ol className="flex flex-wrap items-center gap-2 px-4 text-xs">
                  <li className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-1 text-ink-soft">
                    <Zap className="size-3" /> {triggerLabel[a.trigger]}
                  </li>
                  {a.steps.map((s) => {
                    const ch = CHANNEL[s.channel];
                    const Icon = ch.icon;
                    return (
                      <li key={s.id} className="flex min-w-0 items-center gap-2">
                        <span className="inline-block text-ink-soft rtl:rotate-180" aria-hidden="true">
                          →
                        </span>
                        <span className="inline-flex items-center gap-1 text-ink-soft">
                          <Clock className="size-3" /> {delayLabel(s.delayMinutes, t)}
                        </span>
                        <span className="inline-block text-ink-soft rtl:rotate-180" aria-hidden="true">
                          →
                        </span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium", ch.tone)}>
                          <Icon className="size-3" /> {channelLabel[s.channel]}
                        </span>
                        <span className="max-w-[220px] truncate font-mono text-ink" dir="ltr">
                          {s.templateName || t.untitled}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.existing ? t.editAutomation : t.newAutomation} className="max-w-4xl">
        {editing && (
          <AutomationEditor
            key={editing.existing?.id ?? "new"}
            existing={editing.existing}
            draft={editing.draft}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.confirmDeleteNamed, { name: deleting.name }) : t.confirmDelete}
        description={t.confirmDeleteDescription}
        confirmLabel={t.deleteAutomation}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Editor --

interface StepDraft {
  id: string;
  delayValue: string;
  delayUnit: DelayUnit;
  channel: AutomationChannel;
  templateName: string;
  body: string;
}

function toStepDraft(s: AutomationStep): StepDraft {
  const { value, unit } = splitDelay(s.delayMinutes);
  return { id: s.id, delayValue: String(value), delayUnit: unit, channel: s.channel, templateName: s.templateName, body: s.body };
}

function toMinutes(d: StepDraft): number {
  const v = Math.max(0, Math.floor(Number(d.delayValue) || 0));
  return d.delayUnit === "days" ? v * 1440 : d.delayUnit === "hours" ? v * 60 : v;
}

function AutomationEditor({ existing, draft, onDone, onCancel }: { existing: Automation | null; draft: Draft; onDone: () => void; onCancel: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const triggerLabel = TRIGGER_LABEL[locale];
  const channelLabel = CHANNEL_LABEL[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const [name, setName] = useState(draft.name);
  const [trigger, setTrigger] = useState<AutomationTrigger>(draft.trigger);
  const [steps, setSteps] = useState<StepDraft[]>(draft.steps.map(toStepDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  function updateStep(id: string, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: uid(), delayValue: "1", delayUnit: "hours", channel: "whatsapp", templateName: "", body: "" }]);
  }

  function insertVariable(step: StepDraft, variable: string) {
    const el = bodyRefs.current[step.id];
    const start = el?.selectionStart ?? step.body.length;
    const end = el?.selectionEnd ?? step.body.length;
    const body = step.body.slice(0, start) + variable + step.body.slice(end);
    updateStep(step.id, { body });
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + variable.length;
        el.setSelectionRange(pos, pos);
      });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.errName;
    if (steps.length === 0) errs.steps = t.errSteps;
    steps.forEach((s) => {
      if (!s.templateName.trim()) errs[`tpl-${s.id}`] = s.channel === "webhook" ? t.errWebhook : t.errTemplate;
      if (s.channel !== "webhook" && !s.body.trim()) errs[`body-${s.id}`] = t.errBody;
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const next: Automation = {
      id: existing?.id ?? uid(),
      workspaceId,
      name: name.trim(),
      trigger,
      status: existing?.status ?? draft.status,
      steps: steps.map((s) => ({ id: s.id, delayMinutes: toMinutes(s), channel: s.channel, templateName: s.templateName.trim(), body: s.body })),
      runs: existing?.runs ?? 0,
      lastRunAt: existing?.lastRunAt ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
    };
    setSaving(true);
    try {
      await mockApi.saveAutomation(workspaceId, next);
      toast.success(existing ? t.toastSaved : t.toastCreated);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const previewStep = steps.find((s) => s.channel !== "webhook") ?? steps[0];

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.name} required value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} placeholder={t.namePlaceholder} dir="auto" />
          <Field label={t.trigger} required>
            {({ id }) => (
              <Select id={id} value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
                {TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {triggerLabel[tr]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t.steps}</Label>
            <Button type="button" size="sm" variant="outline" onClick={addStep}>
              <Plus /> {t.addStep}
            </Button>
          </div>
          {fieldErrors.steps && <p className="text-xs font-medium text-danger">{fieldErrors.steps}</p>}

          {steps.map((s, i) => {
            const ch = CHANNEL[s.channel];
            const Icon = ch.icon;
            return (
              <div key={s.id} className="rounded-2xl border border-line bg-paper p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs text-primary-dark">{formatNumber(i + 1)}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", ch.tone)}>
                      <Icon className="size-3" /> {channelLabel[s.channel]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={t.moveUp} title={t.moveUp} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={t.moveDown} title={t.moveDown} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t.removeStep}
                      title={t.removeStep}
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setSteps((prev) => prev.filter((x) => x.id !== s.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[100px_120px_1fr]">
                  <Field label={t.delay}>
                    {({ id }) => <Input id={id} type="number" min={0} dir="ltr" value={s.delayValue} onChange={(e) => updateStep(s.id, { delayValue: e.target.value })} />}
                  </Field>
                  <Field label={t.unit}>
                    {({ id }) => (
                      <Select id={id} value={s.delayUnit} onChange={(e) => updateStep(s.id, { delayUnit: e.target.value as DelayUnit })}>
                        <option value="minutes">{t.minutes}</option>
                        <option value="hours">{t.hours}</option>
                        <option value="days">{t.days}</option>
                      </Select>
                    )}
                  </Field>
                  <Field label={t.channel}>
                    {({ id }) => (
                      <Select id={id} value={s.channel} onChange={(e) => updateStep(s.id, { channel: e.target.value as AutomationChannel })}>
                        {CHANNELS.map((chKey) => (
                          <option key={chKey} value={chKey}>
                            {channelLabel[chKey]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <div className="mt-3">
                  <TextField
                    label={s.channel === "webhook" ? t.webhookUrl : t.templateName}
                    required
                    value={s.templateName}
                    onChange={(e) => updateStep(s.id, { templateName: e.target.value })}
                    error={fieldErrors[`tpl-${s.id}`]}
                    placeholder={s.channel === "webhook" ? "https://hooks.example.com/…" : "order_confirm_v2"}
                    hint={s.channel === "whatsapp" ? t.whatsappHint : undefined}
                    dir="ltr"
                    className={s.channel === "webhook" ? "font-mono" : undefined}
                  />
                </div>

                {s.channel !== "webhook" && (
                  <div className="mt-3 space-y-1.5">
                    <Label>{t.message}</Label>
                    <div className="flex flex-wrap gap-1">
                      {VARIABLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          dir="ltr"
                          onClick={() => insertVariable(s, v)}
                          className="rounded-full border border-line bg-paper-raised px-2 py-0.5 font-mono text-[11px] text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      ref={(el) => {
                        bodyRefs.current[s.id] = el;
                      }}
                      value={s.body}
                      onChange={(e) => updateStep(s.id, { body: e.target.value })}
                      rows={3}
                      dir="auto"
                      placeholder={t.bodyPlaceholder}
                      className={cn(fieldErrors[`body-${s.id}`] && "border-danger focus-visible:ring-danger/30")}
                    />
                    {fieldErrors[`body-${s.id}`] && <p className="text-xs font-medium text-danger">{fieldErrors[`body-${s.id}`]}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {c.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? c.saving : existing ? t.saveAutomation : t.createAutomation}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.preview}</p>
        <PhonePreview step={previewStep} />
        <p className="text-xs text-ink-soft">{t.previewHint}</p>
      </div>
    </form>
  );
}

function PhonePreview({ step }: { step: StepDraft | undefined }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const isWhatsApp = !step || step.channel === "whatsapp";
  const body = step && step.channel !== "webhook" ? substitute(step.body) : "";
  const channelLabel = step ? CHANNEL_LABEL[locale][step.channel] : "WhatsApp";
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[2rem] border-[6px] border-ink/80 bg-ink/80 p-1 shadow-xl">
      <div className={cn("flex h-[440px] flex-col overflow-hidden rounded-[1.6rem]", isWhatsApp ? "bg-[#ECE5DD]" : "bg-paper")}>
        <div className={cn("flex items-center gap-2 px-3 py-2 text-white", isWhatsApp ? "bg-[#075E54]" : "bg-primary")}>
          <div className="size-7 rounded-full bg-white/30" />
          <div className="leading-tight">
            <p className="text-xs font-semibold">EgyStore</p>
            <p className="text-[10px] opacity-80">
              {channelLabel} · {t.business}
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {step && step.channel !== "webhook" && <p className="text-center text-[10px] text-ink-soft">{delayLabel(toMinutes(step), t)}</p>}
          {body ? (
            <div
              className={cn("relative max-w-[92%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-black shadow-sm", isWhatsApp ? "bg-white" : "bg-paper-raised text-ink")}
              dir="auto"
            >
              <p className="whitespace-pre-wrap break-words">{body}</p>
              <p className="mt-1 text-end text-[9px] text-black/40" dir="ltr">
                12:04 ✓✓
              </p>
            </div>
          ) : step?.channel === "webhook" ? (
            <p className="rounded-lg bg-white/70 p-2 text-center font-mono text-[11px] text-ink-soft break-all" dir="ltr">
              POST {step.templateName || "https://…"}
            </p>
          ) : (
            <p className="text-center text-[11px] text-ink-soft">{t.typeToPreview}</p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-black/5 bg-white/70 px-3 py-2">
          <div className="h-7 flex-1 rounded-full bg-white shadow-inner" />
          <div className={cn("size-7 rounded-full", isWhatsApp ? "bg-[#25D366]" : "bg-primary")} />
        </div>
      </div>
    </div>
  );
}
