import { useId, useMemo, useState } from "react";
import { Alert, Button, Card, Input, cn } from "@store-builder/ui";
import {
  ApiError,
  PROTECTION_ACTIONS,
  PROTECTION_NUMBER_RULES,
  PROTECTION_SWITCH_RULES,
  protectionResolveRules,
  protectionSaveRules,
  type ProtectionAction,
  type ProtectionNumberRule,
  type ProtectionRuleKey,
  type ProtectionRules,
  type ProtectionSwitchRule,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * Role keys allowed to change the rules. The backend's real test is the
 * workspace.manage permission, which the dashboard can't see (GET /workspaces
 * exposes only the role key) — these are the two system roles that carry it.
 * A 403 on save flips an editable form to read-only too.
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

/** Backend bounds (workspaceValidation.js) and the value a rule starts at when switched on. */
const NUMBER_BOUNDS: Record<ProtectionNumberRule, { min: number; max: number; initial: number }> = {
  duplicate_window_minutes: { min: 1, max: 10080, initial: 60 },
  max_orders_per_phone_per_day: { min: 1, max: 100, initial: 3 },
  high_rejection_threshold: { min: 1, max: 100, initial: 3 },
  max_items_per_order: { min: 1, max: 1000, initial: 5 },
  min_minutes_between_cod_orders_per_ip: { min: 1, max: 10080, initial: 10 },
  min_network_delivery_rate: { min: 1, max: 100, initial: 40 },
};

const STRINGS = {
  en: {
    readOnlyTitle: "View only",
    readOnly: "Only the store owner or a workspace manager can change these rules.",
    readOnlyForbidden: "Your role can't change these rules, so they're shown read-only. Ask the store owner if they need changing.",
    orderRules: "Order rules",
    orderRulesHint: "Each rule is off until you switch it on, and each one has its own action.",
    visitorRules: "Where the order comes from",
    visitorRulesHint: "Checked against the shopper's internet address when they order.",
    customerRules: "The customer's history",
    customerRulesHint: "What this customer did before, here and across the platform.",
    then: "Then",
    action_flag: "Flag it for review",
    action_block: "Refuse the order",
    action_require_otp: "Ask for a code first",
    action_to_lost: "Move it to lost orders",
    duplicate_window_minutes: "Duplicate orders",
    duplicate_window_minutesHint: "The same customer orders any of the same products again within this many minutes.",
    duplicate_window_minutesUnit: "minutes",
    max_orders_per_phone_per_day: "Too many orders from one phone",
    max_orders_per_phone_per_dayHint: "The customer already placed this many orders in the last 24 hours.",
    max_orders_per_phone_per_dayUnit: "orders",
    high_rejection_threshold: "Customers who often refuse orders",
    high_rejection_thresholdHint: "The customer has rejected at least this many orders before.",
    high_rejection_thresholdUnit: "rejected orders",
    max_items_per_order: "Too many pieces of one product",
    max_items_per_orderHint: "The order holds more than this many units of the same product.",
    max_items_per_orderUnit: "pieces",
    min_minutes_between_cod_orders_per_ip: "Cash-on-delivery orders too close together",
    min_minutes_between_cod_orders_per_ipHint: "Another cash-on-delivery order came from the same internet address less than this many minutes ago.",
    min_minutes_between_cod_orders_per_ipUnit: "minutes",
    min_network_delivery_rate: "Low delivery rate",
    min_network_delivery_rateHint: "The customer's delivery rate across all stores is below this percentage.",
    min_network_delivery_rateUnit: "%",
    block_outside_country: "Orders from other countries",
    block_outside_countryHint: "The shopper is not in one of the allowed countries.",
    block_vpn: "VPN and server addresses",
    block_vpnHint: "The shopper is hiding behind a VPN or ordering from a data centre.",
    high_risk: "High-risk orders",
    high_riskHint: "The order's risk level came out as high.",
    allowedCountries: "Allowed countries",
    allowedCountriesHint: "Two-letter country codes separated by commas, for example EG, SA. Leave empty for your store's country only.",
    allowedCountriesError: "Use two-letter country codes separated by commas.",
    rangeError: "Enter a whole number from {min} to {max}.",
    visitorsHeading: "Visitors",
    blockedCountries: "Countries that cannot see the store",
    blockedCountriesHint: "Two-letter country codes separated by commas. Visitors from these countries see the store as unavailable. Block single addresses in the Blocklist tab.",
    alwaysHeading: "Always",
    strictPhone: "Only accept real mobile numbers",
    strictPhoneHint: "A number that is not a mobile number of your store's country is refused, and the shopper is asked to correct it.",
    blockBlacklisted: "Always refuse blocked customers",
    blockBlacklistedHint: "When off, orders matching the blocklist are still placed but flagged. Manage it in the Blocklist tab.",
    save: "Save rules",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Rules saved.",
  },
  ar: {
    readOnlyTitle: "عرض فقط",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل فقط تغيير هذه القواعد.",
    readOnlyForbidden: "دورك لا يسمح بتغيير هذه القواعد، لذلك تظهر للعرض فقط. اطلب من مالك المتجر إذا احتاجت إلى تعديل.",
    orderRules: "قواعد الأوردر",
    orderRulesHint: "كل قاعدة متوقفة حتى تفعّلها، ولكل قاعدة إجراء خاص بها.",
    visitorRules: "من أين يأتي الأوردر",
    visitorRulesHint: "تُفحص على عنوان الإنترنت للمشتري وقت الطلب.",
    customerRules: "تاريخ العميل",
    customerRulesHint: "ما فعله هذا العميل من قبل، عندك وعلى مستوى المنصة.",
    then: "الإجراء",
    action_flag: "تمييزه للمراجعة",
    action_block: "رفض الأوردر",
    action_require_otp: "طلب كود تحقق أولًا",
    action_to_lost: "تحويله إلى الطلبات المفقودة",
    duplicate_window_minutes: "الأوردرات المكررة",
    duplicate_window_minutesHint: "يطلب العميل نفسه أيًّا من نفس المنتجات مرة أخرى خلال هذا العدد من الدقائق.",
    duplicate_window_minutesUnit: "دقيقة",
    max_orders_per_phone_per_day: "أوردرات كثيرة من نفس الهاتف",
    max_orders_per_phone_per_dayHint: "سجّل العميل هذا العدد من الأوردرات خلال آخر 24 ساعة.",
    max_orders_per_phone_per_dayUnit: "أوردر",
    high_rejection_threshold: "عملاء يرفضون الأوردرات كثيرًا",
    high_rejection_thresholdHint: "رفض العميل هذا العدد من الأوردرات على الأقل من قبل.",
    high_rejection_thresholdUnit: "أوردر مرفوض",
    max_items_per_order: "قطع كثيرة من نفس المنتج",
    max_items_per_orderHint: "الأوردر فيه أكثر من هذا العدد من القطع من نفس المنتج.",
    max_items_per_orderUnit: "قطعة",
    min_minutes_between_cod_orders_per_ip: "أوردرات دفع عند الاستلام متقاربة",
    min_minutes_between_cod_orders_per_ipHint: "جاء أوردر دفع عند الاستلام آخر من نفس عنوان الإنترنت منذ أقل من هذا العدد من الدقائق.",
    min_minutes_between_cod_orders_per_ipUnit: "دقيقة",
    min_network_delivery_rate: "نسبة استلام منخفضة",
    min_network_delivery_rateHint: "نسبة استلام العميل على مستوى كل المتاجر أقل من هذه النسبة.",
    min_network_delivery_rateUnit: "٪",
    block_outside_country: "أوردرات من دول أخرى",
    block_outside_countryHint: "المشتري ليس في إحدى الدول المسموح بها.",
    block_vpn: "عناوين VPN والسيرفرات",
    block_vpnHint: "المشتري يتخفى وراء VPN أو يطلب من مركز بيانات.",
    high_risk: "الأوردرات عالية الخطورة",
    high_riskHint: "مستوى خطورة الأوردر طلع «عالي».",
    allowedCountries: "الدول المسموح بها",
    allowedCountriesHint: "أكواد الدول من حرفين مفصولة بفواصل، مثل EG, SA. اتركها فارغة لدولة متجرك فقط.",
    allowedCountriesError: "استخدم أكواد دول من حرفين مفصولة بفواصل.",
    rangeError: "أدخل رقمًا صحيحًا من {min} إلى {max}.",
    visitorsHeading: "الزوار",
    blockedCountries: "دول لا ترى المتجر",
    blockedCountriesHint: "أكواد دول من حرفين مفصولة بفواصل. الزوار من هذه الدول يظهر لهم المتجر كغير متاح. احظر العناوين المفردة من تبويب قائمة الحظر.",
    alwaysHeading: "دائمًا",
    strictPhone: "قبول أرقام الموبايل الحقيقية فقط",
    strictPhoneHint: "الرقم الذي ليس رقم موبايل في دولة متجرك يُرفض، ويُطلب من المشتري تصحيحه.",
    blockBlacklisted: "رفض العملاء المحظورين دائمًا",
    blockBlacklistedHint: "عند إيقافها تُسجَّل الأوردرات المطابقة لقائمة الحظر لكن تُميَّز. أدِر القائمة من تبويب قائمة الحظر.",
    save: "حفظ القواعد",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    saved: "تم حفظ القواعد.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const GROUPS: ReadonlyArray<{ title: "orderRules" | "visitorRules" | "customerRules"; rules: ReadonlyArray<ProtectionRuleKey> }> = [
  { title: "orderRules", rules: ["duplicate_window_minutes", "max_orders_per_phone_per_day", "max_items_per_order", "high_risk"] },
  { title: "visitorRules", rules: ["min_minutes_between_cod_orders_per_ip", "block_outside_country", "block_vpn"] },
  { title: "customerRules", rules: ["high_rejection_threshold", "min_network_delivery_rate"] },
];

function isNumberRule(key: ProtectionRuleKey): key is ProtectionNumberRule {
  return (PROTECTION_NUMBER_RULES as readonly string[]).includes(key);
}

interface Draft {
  block_blacklisted: boolean;
  strictPhone: boolean;
  countries: string;
  blockedCountries: string;
  on: Record<ProtectionRuleKey, boolean>;
  /** Raw input text of the number rules. */
  values: Record<ProtectionNumberRule, string>;
  actions: Record<ProtectionRuleKey, ProtectionAction>;
}

function toDraft(rules: ProtectionRules): Draft {
  const on = {} as Record<ProtectionRuleKey, boolean>;
  const values = {} as Record<ProtectionNumberRule, string>;
  for (const key of PROTECTION_NUMBER_RULES) {
    on[key] = rules.numbers[key] != null;
    values[key] = String(rules.numbers[key] ?? NUMBER_BOUNDS[key].initial);
  }
  for (const key of PROTECTION_SWITCH_RULES) on[key] = rules.switches[key];
  return {
    block_blacklisted: rules.block_blacklisted,
    strictPhone: rules.phone_validation === "strict",
    countries: rules.allowed_countries.join(", "),
    blockedCountries: rules.blocked_countries.join(", "),
    on,
    values,
    actions: { ...rules.actions },
  };
}

function parseCountries(text: string): string[] | null {
  const parts = text
    .split(/[\s,،]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (parts.some((p) => !/^[A-Z]{2}$/.test(p))) return null;
  return [...new Set(parts)];
}

function toRules(draft: Draft): ProtectionRules {
  const numbers = {} as Record<ProtectionNumberRule, number | null>;
  for (const key of PROTECTION_NUMBER_RULES) numbers[key] = draft.on[key] ? Number(draft.values[key]) : null;
  const switches = {} as Record<ProtectionSwitchRule, boolean>;
  for (const key of PROTECTION_SWITCH_RULES) switches[key] = draft.on[key];
  return {
    block_blacklisted: draft.block_blacklisted,
    phone_validation: draft.strictPhone ? "strict" : "off",
    allowed_countries: parseCountries(draft.countries) ?? [],
    blocked_countries: parseCountries(draft.blockedCountries) ?? [],
    numbers,
    switches,
    actions: { ...draft.actions },
  };
}

function rangeProblem(key: ProtectionNumberRule, draft: Draft): boolean {
  if (!draft.on[key]) return false;
  const text = draft.values[key].trim();
  if (!/^\d+$/.test(text)) return true;
  const n = Number(text);
  return n < NUMBER_BOUNDS[key].min || n > NUMBER_BOUNDS[key].max;
}

/** Fraud protection → Rules: every checkout rule with its own switch, value and action. */
export function ProtectionRulesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = useMemo(
    () => protectionResolveRules(currentWorkspace?.settings?.fraud_rules),
    [currentWorkspace?.settings?.fraud_rules]
  );
  // The last rule set known to be on the server — replaced by the PATCH
  // response on save, so "dirty" is right before the silent refresh lands.
  const [saved, setSaved] = useState<Draft>(() => toDraft(stored));
  const [draft, setDraft] = useState<Draft>(() => toDraft(stored));
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const disabled = !editable || saving;

  const rangeProblems = PROTECTION_NUMBER_RULES.filter((key) => rangeProblem(key, draft));
  const countriesProblem = draft.on.block_outside_country && parseCountries(draft.countries) === null;
  const blockedCountriesProblem = parseCountries(draft.blockedCountries) === null;
  const invalid = rangeProblems.length > 0 || countriesProblem || blockedCountriesProblem;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    if (invalid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = toDraft(await protectionSaveRules(apiClient, workspaceId, toRules(draft)));
      setSaved(next);
      setDraft(next);
      setShowErrors(false);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Whatever the role key suggested, the server says no — stop offering
        // edits and put the stored rules back.
        setForbidden(true);
        setDraft(saved);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {!editable && (
        <Alert>
          <p className="font-medium">{t.readOnlyTitle}</p>
          <p>{forbidden ? t.readOnlyForbidden : t.readOnly}</p>
        </Alert>
      )}

      {GROUPS.map((group) => (
        <Card key={group.title} className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{t[group.title]}</h2>
            <p className="text-sm text-ink-soft">{t[`${group.title}Hint`]}</p>
          </div>
          <div className="divide-y divide-line">
            {group.rules.map((key) => (
              <RuleRow
                key={key}
                ruleKey={key}
                draft={draft}
                disabled={disabled}
                t={t}
                error={
                  showErrors && isNumberRule(key) && rangeProblems.includes(key)
                    ? fmt(t.rangeError, { min: NUMBER_BOUNDS[key].min, max: NUMBER_BOUNDS[key].max })
                    : undefined
                }
                onToggle={(on) => patch({ on: { ...draft.on, [key]: on } })}
                onValue={(value) => patch({ values: { ...draft.values, [key]: value } })}
                onAction={(action) => patch({ actions: { ...draft.actions, [key]: action } })}
              >
                {key === "block_outside_country" && draft.on.block_outside_country && (
                  <CountriesField
                    value={draft.countries}
                    disabled={disabled}
                    label={t.allowedCountries}
                    hint={t.allowedCountriesHint}
                    error={showErrors && countriesProblem ? t.allowedCountriesError : undefined}
                    onChange={(countries) => patch({ countries })}
                  />
                )}
              </RuleRow>
            ))}
          </div>
        </Card>
      ))}

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.visitorsHeading}</h2>
        <CountriesField
          value={draft.blockedCountries}
          disabled={disabled}
          label={t.blockedCountries}
          hint={t.blockedCountriesHint}
          error={showErrors && blockedCountriesProblem ? t.allowedCountriesError : undefined}
          onChange={(blockedCountries) => patch({ blockedCountries })}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.alwaysHeading}</h2>
        <ChoiceRow
          checked={draft.strictPhone}
          disabled={disabled}
          onChange={(strictPhone) => patch({ strictPhone })}
          label={t.strictPhone}
          hint={t.strictPhoneHint}
        />
        <ChoiceRow
          checked={draft.block_blacklisted}
          disabled={disabled}
          onChange={(block_blacklisted) => patch({ block_blacklisted })}
          label={t.blockBlacklisted}
          hint={t.blockBlacklistedHint}
        />
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || !dirty} className="min-h-11">
            {saving ? t.saving : t.save}
          </Button>
          {dirty && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                setDraft(saved);
                setShowErrors(false);
                setError(null);
              }}
            >
              {t.reset}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** A checkbox with its label and hint — the whole row is the 44px target. */
function ChoiceRow({
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] border px-3 py-2.5 transition-colors",
        checked ? "border-primary/50 bg-primary-soft/40" : "border-line",
        "has-[:disabled]:cursor-default has-[:disabled]:opacity-80"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-5 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-sm text-ink-soft">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function RuleRow({
  ruleKey,
  draft,
  disabled,
  error,
  t,
  onToggle,
  onValue,
  onAction,
  children,
}: {
  ruleKey: ProtectionRuleKey;
  draft: Draft;
  disabled: boolean;
  error?: string;
  t: Strings;
  onToggle: (on: boolean) => void;
  onValue: (value: string) => void;
  onAction: (action: ProtectionAction) => void;
  children?: React.ReactNode;
}) {
  const inputId = useId();
  const actionId = useId();
  const errorId = useId();
  const numeric = isNumberRule(ruleKey);
  const on = draft.on[ruleKey];
  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <ChoiceRow
        checked={on}
        disabled={disabled}
        onChange={onToggle}
        label={t[ruleKey]}
        hint={t[`${ruleKey}Hint` as keyof Strings]}
      />
      {on && (
        <div className="space-y-3 ps-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {numeric && (
              <div className="flex items-center gap-2">
                <label htmlFor={inputId} className="sr-only">
                  {`${t[ruleKey]} (${t[`${ruleKey}Unit` as keyof Strings]})`}
                </label>
                <Input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={NUMBER_BOUNDS[ruleKey].min}
                  max={NUMBER_BOUNDS[ruleKey].max}
                  step={1}
                  value={draft.values[ruleKey]}
                  disabled={disabled}
                  onChange={(e) => onValue(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={cn("h-11 w-28", error && "border-danger")}
                />
                <span className="text-sm text-ink-soft">{t[`${ruleKey}Unit` as keyof Strings]}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor={actionId} className="text-sm text-ink-soft">
                {t.then}
              </label>
              <Select
                id={actionId}
                value={draft.actions[ruleKey]}
                disabled={disabled}
                onChange={(e) => onAction(e.target.value as ProtectionAction)}
                className="h-11 w-auto min-w-52"
              >
                {PROTECTION_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t[`action_${action}`]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && (
            <p id={errorId} className="text-xs font-medium text-danger">
              {error}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function CountriesField({
  value,
  disabled,
  label,
  hint,
  error,
  onChange,
}: {
  value: string;
  disabled: boolean;
  label: string;
  hint: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        dir="ltr"
        value={value}
        disabled={disabled}
        placeholder="EG, SA"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn("h-11 max-w-sm", error && "border-danger")}
      />
      <p className={cn("text-xs", error ? "font-medium text-danger" : "text-ink-soft")}>{error ?? hint}</p>
    </div>
  );
}
