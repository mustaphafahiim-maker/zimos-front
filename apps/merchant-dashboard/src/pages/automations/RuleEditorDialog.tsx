import { useRef, useState, type FormEvent } from "react";
import { IconArrowDown, IconArrowUp, IconDelete, IconPlus } from "@/components/icons";
import { FilterGroup } from "@/components/list";
import { focusFirstInvalid } from "@/pages/marketing/kit/form";
import { SwitchRow } from "@/pages/marketing/kit/Switch";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  automationFlowsCreate,
  automationFlowsUpdate,
  parseMoney,
  type AutomationFlowConditions,
  type AutomationFlowRule,
  type AutomationStep,
  type AutomationStepType,
  type AutomationWaitUnit,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { SegmentConditionFields, type SegmentConditions } from "./SegmentConditionFields";
import { ProductFunnelConditionFields } from "./ProductFunnelConditionFields";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { AUTOMATION_STRINGS, emptyStep, stepProblem, stepTypeLabel, triggerLabel } from "./automationText";
import { TemplatePicker } from "@/components/WhatsappTemplates";
import { NotifyChannelFields } from "./NotifyChannelFields";
import { ConfirmLinkTokenHint } from "@/components/ConfirmLinkTokenHint";

const STRINGS = {
  en: {
    createTitle: "New automation",
    editTitle: "Edit automation",
    name: "Name",
    trigger: "When this happens",
    stepsTitle: "Do these steps, in order",
    stepN: "Step {n}",
    addStep: "Add step",
    moveUp: "Move step {n} up",
    moveDown: "Move step {n} down",
    removeStep: "Remove step {n}",
    waitAmount: "How long",
    waitUnit: "Unit",
    templateName: "Template name",
    templateHint: "Exactly as approved in Meta: lowercase letters, numbers and underscores.",
    language: "Language",
    variables: "Template variables",
    variablesHint: "In order: the first box fills the template's first placeholder.",
    variable: "Variable {n}",
    addVariable: "Add variable",
    removeVariable: "Remove variable {n}",
    smsBody: "Message",
    emailSubject: "Subject",
    emailBody: "Message",
    emailHint: "Sent only when the order has an email address.",
    webhookUrl: "URL",
    webhookHint: "Receives a JSON POST with the event and the order's details.",
    tag: "Tag",
    status: "New status",
    statusHint: "Done in the name of the store owner. Confirming applies to cash-on-delivery orders.",
    teamMessage: "Message to the team",
    tokens: "Insert a detail:",
    conditionsTitle: "Only when (optional)",
    paymentMethod: "Payment method",
    any: "Any",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Wallet",
    valu: "valU installments",
    kiosk: "Kiosk (Aman / Masary)",
    paypal: "PayPal",
    bank_transfer: "Bank transfer",
    minTotal: "Order total at least",
    source: "Order came from",
    sourceStore: "The store",
    sourceFunnel: "A funnel",
    governorates: "Governorates",
    listHint: "Separate with commas.",
    tags: "Order has any of these tags",
    firstOrder: "Customer",
    firstOnly: "First order only",
    returningOnly: "Returning customers only",
    risk: "Risk level",
    risk_low: "Low",
    risk_medium: "Medium",
    risk_high: "High",
    coupon: "Coupon code for {{coupon_code}}",
    delayDays: "Days after delivery",
    stopOnChange: "Stop the remaining steps if the order's status changes while waiting",
    nameShort: "Give it a name of two letters or more.",
    conditionsHint: "Leave everything as it is to run for every order.",
    conditionsSet_one: "1 condition set",
    conditionsSet_other: "{n} conditions set",
    fix_wait: "Type how long to wait: 1 to 720.",
    fix_whatsapp_template: "Type the template name as approved in Meta (lowercase letters, numbers, _) and its language, e.g. ar or en_US.",
    fix_sms: "Type the message.",
    fix_email: "Type the subject and the message.",
    fix_webhook: "Type a link that starts with https://",
    fix_add_tag: "Type the tag.",
    fix_notify_team: "Type the message to the team.",
    fix_notify_channel: "Choose the channel and type the message.",
    needsAction: "Add at least one step that is not a wait.",
    endsOnWait: "The sequence cannot end with a wait.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
  },
  ar: {
    createTitle: "أتمتة جديدة",
    editTitle: "عدّل الأتمتة",
    name: "الاسم",
    trigger: "لما ده يحصل",
    stepsTitle: "نفّذ الخطوات دي بالترتيب",
    stepN: "الخطوة {n}",
    addStep: "ضيف خطوة",
    moveUp: "طلّع الخطوة {n} لفوق",
    moveDown: "نزّل الخطوة {n} لتحت",
    removeStep: "امسح الخطوة {n}",
    waitAmount: "المدة",
    waitUnit: "الوحدة",
    templateName: "اسم القالب",
    templateHint: "زي ما هو معتمد في Meta بالظبط: حروف إنجليزي صغيرة وأرقام وشرطة سفلية.",
    language: "اللغة",
    variables: "متغيرات القالب",
    variablesHint: "بالترتيب: أول خانة بتملا أول متغير في القالب.",
    variable: "المتغير {n}",
    addVariable: "ضيف متغير",
    removeVariable: "امسح المتغير {n}",
    smsBody: "نص الرسالة",
    emailSubject: "العنوان",
    emailBody: "نص الرسالة",
    emailHint: "بتتبعت بس لو الأوردر فيه إيميل.",
    webhookUrl: "اللينك",
    webhookHint: "بيوصله POST بصيغة JSON فيه الحدث وبيانات الأوردر.",
    tag: "الوسم",
    status: "الحالة الجديدة",
    statusHint: "بتتنفّذ باسم صاحب المتجر. التأكيد بيخص أوردرات الدفع عند الاستلام.",
    teamMessage: "رسالة للفريق",
    tokens: "حط بيان:",
    conditionsTitle: "بس لو (اختياري)",
    paymentMethod: "طريقة الدفع",
    any: "أي",
    cod: "الدفع عند الاستلام",
    card: "كارت",
    wallet: "محفظة",
    valu: "تقسيط valU",
    kiosk: "الدفع في الكشك (أمان / مصاري)",
    paypal: "باي بال",
    bank_transfer: "تحويل بنكي",
    minTotal: "إجمالي الأوردر مش أقل من",
    source: "مصدر الأوردر",
    sourceStore: "المتجر",
    sourceFunnel: "مسار بيع",
    governorates: "المحافظات",
    listHint: "افصل بينهم بفاصلة.",
    tags: "الأوردر عليه واحد من الوسوم دي",
    firstOrder: "العميل",
    firstOnly: "أول أوردر بس",
    returningOnly: "العملاء اللي اشتروا قبل كده بس",
    risk: "مستوى الخطورة",
    risk_low: "قليل",
    risk_medium: "متوسط",
    risk_high: "عالي",
    coupon: "كود الخصم لـ {{coupon_code}}",
    delayDays: "كام يوم بعد التسليم",
    stopOnChange: "وقّف باقي الخطوات لو حالة الأوردر اتغيّرت وهي مستنية",
    nameShort: "اكتب اسم من حرفين على الأقل.",
    conditionsHint: "سيب كل حاجة زي ما هي عشان تشتغل على كل الأوردرات.",
    conditionsSet_one: "شرط واحد متحدد",
    conditionsSet_two: "شرطين متحددين",
    conditionsSet_few: "{n} شروط متحددة",
    conditionsSet_other: "{n} شرط متحدد",
    fix_wait: "اكتب مدة الانتظار: من 1 لـ 720.",
    fix_whatsapp_template: "اكتب اسم القالب زي ما هو معتمد في Meta (حروف إنجليزي صغيرة وأرقام و _) ولغته، زي ar أو en_US.",
    fix_sms: "اكتب نص الرسالة.",
    fix_email: "اكتب العنوان ونص الرسالة.",
    fix_webhook: "اكتب لينك بيبدأ بـ https://",
    fix_add_tag: "اكتب الوسم.",
    fix_notify_team: "اكتب الرسالة للفريق.",
    fix_notify_channel: "اختار القناة واكتب الرسالة.",
    needsAction: "ضيف خطوة واحدة على الأقل غير الانتظار.",
    endsOnWait: "السلسلة ماينفعش تخلص بانتظار. ضيف خطوة بعده أو امسحه.",
    save: "حفظ",
    saving: "بنحفظ…",
    cancel: "إلغاء",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const splitList = (value: string) =>
  value
    .split(/[,،\n]/)
    .map((v) => v.trim())
    .filter(Boolean);

/** Where a token chip inserts: the text field that had focus last. */
type Target = { step: number; field: string; param?: number } | null;

export function RuleEditorDialog({
  rule,
  triggers,
  tokens,
  stepTypes,
  onClose,
  onSaved,
}: {
  rule: AutomationFlowRule | null;
  triggers: string[];
  tokens: string[];
  stepTypes: AutomationStepType[];
  onClose: () => void;
  onSaved: (rule: AutomationFlowRule, created: boolean) => void;
}) {
  const t = useT(STRINGS);
  const at = useT(AUTOMATION_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();

  const c = rule?.conditions ?? {};
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? triggers[0] ?? "order.created");
  const [steps, setSteps] = useState<AutomationStep[]>(rule?.actions?.length ? rule.actions : [emptyStep("whatsapp_template")]);
  const [paymentMethod, setPaymentMethod] = useState<string>(c.paymentMethod ?? "");
  const [minTotal, setMinTotal] = useState(c.minTotalAmount != null ? String(c.minTotalAmount / 100) : "");
  const [source, setSource] = useState<string>(c.source ?? "");
  const [governorates, setGovernorates] = useState((c.governorates ?? []).join("، "));
  const [tags, setTags] = useState((c.tags ?? []).join("، "));
  const [firstOrder, setFirstOrder] = useState(c.isFirstOrder === true ? "first" : c.isFirstOrder === false ? "returning" : "");
  const [risk, setRisk] = useState<string[]>(c.riskLevel ?? []);
  const [segment, setSegment] = useState<SegmentConditions>({ segmentId: c.segmentId ?? null, excludeSegmentId: c.excludeSegmentId ?? null });
  const [scope, setScope] = useState({ productIds: c.productIds ?? [], funnelIds: c.funnelIds ?? [] });
  const [coupon, setCoupon] = useState(c.couponCode ?? "");
  const [delayDays, setDelayDays] = useState(String(c.delayDays ?? 3));
  const [stopOnChange, setStopOnChange] = useState(c.stopOnStatusChange !== false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const target = useRef<Target>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // True once a save was tried: from then on every problem is said under its field.
  const [tried, setTried] = useState(false);

  const patchStep = (index: number, patch: Partial<AutomationStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? ({ ...s, ...patch } as AutomationStep) : s)));
  const move = (index: number, by: number) =>
    setSteps((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  function insertToken(token: string) {
    const where = target.current;
    if (!where) return;
    const text = `{{${token}}}`;
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== where.step) return s;
        const record = s as unknown as Record<string, unknown>;
        if (where.field === "params" && where.param !== undefined) {
          const params = [...((record.params as string[]) ?? [])];
          params[where.param] = `${params[where.param] ?? ""}${text}`;
          return { ...s, params } as AutomationStep;
        }
        return { ...s, [where.field]: `${(record[where.field] as string) ?? ""}${text}` } as AutomationStep;
      })
    );
  }

  const conditionCount = [
    paymentMethod !== "",
    minTotal.trim() !== "",
    source !== "",
    governorates.trim() !== "",
    tags.trim() !== "",
    firstOrder !== "",
    risk.length > 0,
    segment.segmentId !== null,
    segment.excludeSegmentId !== null,
    scope.productIds.length > 0,
    scope.funnelIds.length > 0,
    coupon.trim() !== "",
  ].filter(Boolean).length;
  const actionable = steps.some((s) => s.type !== "wait");
  const endsOnWait = steps.length > 0 && steps[steps.length - 1].type === "wait";
  const invalid = name.trim().length < 2 || steps.length === 0 || !actionable || endsOnWait || steps.some(stepProblem);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (invalid) {
      setTried(true);
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    setFormError(null);
    const min = minTotal.trim() === "" ? null : Number(parseMoney(minTotal));
    const conditions: AutomationFlowConditions = {
      paymentMethod: (paymentMethod || null) as AutomationFlowConditions["paymentMethod"],
      minTotalAmount: min !== null && Number.isFinite(min) ? min : null,
      source: (source || null) as AutomationFlowConditions["source"],
      governorates: splitList(governorates),
      tags: splitList(tags),
      isFirstOrder: firstOrder === "first" ? true : firstOrder === "returning" ? false : null,
      riskLevel: risk as AutomationFlowConditions["riskLevel"],
      couponCode: coupon.trim() || null,
      ...segment,
      stopOnStatusChange: stopOnChange,
      // Picked in ProductFunnelConditionFields; nothing chosen = any.
      productIds: scope.productIds,
      funnelIds: scope.funnelIds,
      ...(trigger === "review.request" ? { delayDays: Math.min(60, Math.max(1, Number(delayDays) || 3)) } : {}),
    };
    const cleaned = steps.map((s) =>
      s.type === "whatsapp_template" ? { ...s, params: s.params.map((p) => p.trim()).filter(Boolean) } : s.type === "webhook" ? { ...s, url: s.url.trim() } : s
    );
    const payload = { name: name.trim(), trigger, conditions, actions: cleaned };
    try {
      const saved = rule
        ? await automationFlowsUpdate(apiClient, workspaceId, rule.id, payload)
        : await automationFlowsCreate(apiClient, workspaceId, payload);
      onSaved(saved, !rule);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFormError(Object.values(fields)[0] ?? errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? t.editTitle : t.createTitle}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form="automation-rule-form" className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="automation-rule-form" ref={formRef} onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.name}
            required
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            error={tried && name.trim().length < 2 ? t.nameShort : undefined}
          />
          <Field label={t.trigger}>
            {({ id }) => (
              <Select id={id} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {triggers.map((tr) => (
                  <option key={tr} value={tr}>
                    {triggerLabel(at, tr)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">{t.stepsTitle}</h3>
          {tokens.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-soft">{t.tokens}</span>
              {tokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  // Keeps focus (and so the insertion target) in the text field.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(token)}
                  className="zimos-chip inline-flex h-8 cursor-pointer items-center rounded-full bg-paper-raised px-2.5 font-mono text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11 pointer-coarse:px-3.5"
                >
                  {token}
                </button>
              ))}
            </div>
          )}
          {/* What {{confirm_link}} is: the shopper confirms a cash-on-delivery order from it (handoff 388). */}
          <ConfirmLinkTokenHint tokens={tokens} className="mt-2" />

          <ol className="mt-3 space-y-0">
            {steps.map((step, index) => (
              <li key={index} className="relative ps-8">
                {/* The vertical line and the numbered dot of the sequence. */}
                {index < steps.length - 1 && <span className="absolute start-3 top-7 bottom-0 w-px bg-line" aria-hidden />}
                <span
                  className="absolute start-0 top-3 flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-dark dark:text-primary"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div
                  data-slot="sweep-well"
                  // A step that cannot be saved yet says so under its fields, and is where the form goes on a refused save.
                  role="group"
                  aria-label={fmt(t.stepN, { n: index + 1 })}
                  aria-invalid={tried && stepProblem(step) ? true : undefined}
                  tabIndex={-1}
                  className="mb-3 rounded-2xl bg-paper-sunken px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary aria-invalid:ring-2 aria-invalid:ring-danger"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      <span className="sr-only">{fmt(t.stepN, { n: index + 1 })}: </span>
                      {stepTypeLabel(at, step.type)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Button type="button" size="icon-sm" variant="ghost" disabled={index === 0} aria-label={fmt(t.moveUp, { n: index + 1 })} onClick={() => move(index, -1)}>
                        <IconArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === steps.length - 1}
                        aria-label={fmt(t.moveDown, { n: index + 1 })}
                        onClick={() => move(index, 1)}
                      >
                        <IconArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={steps.length === 1}
                        aria-label={fmt(t.removeStep, { n: index + 1 })}
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <IconDelete className="size-4 text-danger" aria-hidden />
                      </Button>
                    </span>
                  </div>
                  <StepFields t={t} at={at} step={step} index={index} onChange={(patch) => patchStep(index, patch)} onFocus={(where) => (target.current = where)} />
                  {tried && stepProblem(step) && (
                    <p className="mt-2 text-xs font-medium text-danger">{(t as Record<string, string>)[`fix_${step.type}`] ?? t.needsAction}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {!actionable && <p className="text-xs font-medium text-danger">{t.needsAction}</p>}
          {actionable && endsOnWait && <p className="text-xs font-medium text-danger">{t.endsOnWait}</p>}

          {steps.length < 12 && (
            <div role="group" aria-label={t.addStep} className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-ink-soft">{t.addStep}:</span>
              {stepTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSteps((prev) => [...prev, emptyStep(type)])}
                  className="zimos-chip inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised ps-3 pe-3.5 text-sm font-medium text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11"
                >
                  <IconPlus className="size-4 text-ink-soft" weight="bold" aria-hidden />
                  {stepTypeLabel(at, type)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Used rarely: folded, with how many are set on the closed row. The fields stay mounted, so nothing typed is lost by folding. */}
        <FilterGroup label={t.conditionsTitle} hint={conditionCount > 0 ? pluralOf(t, "conditionsSet", conditionCount) : t.conditionsHint} collapsible defaultOpen={conditionCount > 0 || trigger === "review.request"}>
          <div className="grid gap-4 sm:grid-cols-2">
            {trigger === "review.request" && (
              <TextField label={t.delayDays} type="number" min={1} max={60} dir="ltr" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
            )}
            <Field label={t.paymentMethod}>
              {({ id }) => (
                <Select id={id} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="cod">{t.cod}</option>
                  <option value="card">{t.card}</option>
                  <option value="wallet">{t.wallet}</option>
                  <option value="valu">{t.valu}</option>
                  <option value="kiosk">{t.kiosk}</option>
                  <option value="paypal">{t.paypal}</option>
                  <option value="bank_transfer">{t.bank_transfer}</option>
                </Select>
              )}
            </Field>
            <TextField label={t.minTotal} dir="ltr" inputMode="decimal" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} />
            <Field label={t.source}>
              {({ id }) => (
                <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="store">{t.sourceStore}</option>
                  <option value="funnel">{t.sourceFunnel}</option>
                </Select>
              )}
            </Field>
            <Field label={t.firstOrder}>
              {({ id }) => (
                <Select id={id} value={firstOrder} onChange={(e) => setFirstOrder(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="first">{t.firstOnly}</option>
                  <option value="returning">{t.returningOnly}</option>
                </Select>
              )}
            </Field>
            <TextField label={t.governorates} hint={t.listHint} value={governorates} onChange={(e) => setGovernorates(e.target.value)} />
            <TextField label={t.tags} hint={t.listHint} value={tags} onChange={(e) => setTags(e.target.value)} />
            <SegmentConditionFields value={segment} onChange={setSegment} />
            <ProductFunnelConditionFields productIds={scope.productIds} funnelIds={scope.funnelIds} onChange={setScope} />
            <TextField label={t.coupon} dir="ltr" value={coupon} maxLength={100} onChange={(e) => setCoupon(e.target.value)} />
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{t.risk}</legend>
              <div className="flex flex-wrap gap-3">
                {(["low", "medium", "high"] as const).map((level) => (
                  <label key={level} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-ink pointer-coarse:min-h-11">
                    <input
                      type="checkbox"
                      className="size-[18px] cursor-pointer accent-primary"
                      checked={risk.includes(level)}
                      onChange={(e) => setRisk((prev) => (e.target.checked ? [...prev, level] : prev.filter((r) => r !== level)))}
                    />
                    {t[`risk_${level}`]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <SwitchRow className="mt-4" checked={stopOnChange} onChange={setStopOnChange} label={t.stopOnChange} />
        </FilterGroup>
      </form>
    </Modal>
  );
}

function StepFields({
  t,
  at,
  step,
  index,
  onChange,
  onFocus,
}: {
  t: T;
  at: Record<string, string>;
  step: AutomationStep;
  index: number;
  onChange: (patch: Partial<AutomationStep>) => void;
  onFocus: (where: Target) => void;
}) {
  const focus = (field: string, param?: number) => () => onFocus({ step: index, field, param });

  switch (step.type) {
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t.waitAmount}
            type="number"
            min={1}
            max={720}
            dir="ltr"
            value={String(step.amount)}
            onChange={(e) => onChange({ amount: Math.round(Number(e.target.value)) || 0 })}
          />
          <Field label={t.waitUnit}>
            {({ id }) => (
              <Select id={id} value={step.unit} onChange={(e) => onChange({ unit: e.target.value as AutomationWaitUnit })}>
                {(["minutes", "hours", "days"] as const).map((unit) => (
                  <option key={unit} value={unit}>
                    {at[`unit_${unit}`]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      );
    case "whatsapp_template":
      return (
        <div className="space-y-3">
          {/* A template synced from Meta fills the name, language and variable count. */}
          <TemplatePicker
            name={step.template}
            language={step.language}
            onPick={(tpl) => onChange({ template: tpl.name, language: tpl.language, params: Array.from({ length: tpl.paramsCount }, (_, i) => step.params[i] ?? "") })}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <TextField label={t.templateName} dir="ltr" hint={t.templateHint} value={step.template} onChange={(e) => onChange({ template: e.target.value.trim() })} />
            <TextField label={t.language} dir="ltr" value={step.language} onChange={(e) => onChange({ language: e.target.value.trim() })} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{t.variables}</p>
            <p className="mb-2 text-xs text-ink-soft">{t.variablesHint}</p>
            <div className="space-y-2">
              {step.params.map((param, p) => (
                <div key={p} className="flex items-center gap-2">
                  <Input
                    aria-label={fmt(t.variable, { n: p + 1 })}
                    placeholder={fmt(t.variable, { n: p + 1 })}
                    dir="auto"
                    value={param}
                    onFocus={focus("params", p)}
                    onChange={(e) => onChange({ params: step.params.map((x, i) => (i === p ? e.target.value : x)) })}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={fmt(t.removeVariable, { n: p + 1 })}
                    onClick={() => onChange({ params: step.params.filter((_, i) => i !== p) })}
                  >
                    <IconDelete className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            {step.params.length < 20 && (
              <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => onChange({ params: [...step.params, ""] })}>
                <IconPlus className="size-4" aria-hidden />
                {t.addVariable}
              </Button>
            )}
          </div>
        </div>
      );
    case "sms":
      return (
        <Field label={t.smsBody}>
          {({ id }) => <Textarea id={id} dir="auto" maxLength={600} value={step.body} onFocus={focus("body")} onChange={(e) => onChange({ body: e.target.value })} />}
        </Field>
      );
    case "email":
      return (
        <div className="space-y-3">
          <TextField label={t.emailSubject} dir="auto" maxLength={200} value={step.subject} onFocus={focus("subject")} onChange={(e) => onChange({ subject: e.target.value })} />
          <Field label={t.emailBody} hint={t.emailHint}>
            {({ id }) => <Textarea id={id} dir="auto" rows={4} maxLength={5000} value={step.body} onFocus={focus("body")} onChange={(e) => onChange({ body: e.target.value })} />}
          </Field>
        </div>
      );
    case "webhook":
      return <TextField label={t.webhookUrl} dir="ltr" placeholder="https://example.com/hook" hint={t.webhookHint} value={step.url} onChange={(e) => onChange({ url: e.target.value })} />;
    case "add_tag":
      return <TextField label={t.tag} maxLength={40} value={step.tag} onChange={(e) => onChange({ tag: e.target.value })} />;
    case "set_status":
      return (
        <Field label={t.status} hint={t.statusHint}>
          {({ id }) => (
            <Select id={id} value={step.status} onChange={(e) => onChange({ status: e.target.value as "confirmed" | "cancelled" })}>
              <option value="confirmed">{at.status_confirmed}</option>
              <option value="cancelled">{at.status_cancelled}</option>
            </Select>
          )}
        </Field>
      );
    case "notify_team":
      return (
        <Field label={t.teamMessage}>
          {({ id }) => <Textarea id={id} dir="auto" maxLength={500} value={step.message} onFocus={focus("message")} onChange={(e) => onChange({ message: e.target.value })} />}
        </Field>
      );
    // A message to one of the store's Telegram / Slack / Discord channels (handoff 378).
    case "notify_channel":
      return <NotifyChannelFields teamChannelId={step.teamChannelId} message={step.message} onChange={onChange} onMessageFocus={focus("message")} />;
    default:
      return null;
  }
}
