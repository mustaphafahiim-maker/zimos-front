import { useEffect, useId, useState } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ApiError,
  manualTransferGetSettings,
  manualTransferSaveSettings,
  type ManualTransferDepositRule,
  type PaymentMethodEntry,
} from "@store-builder/api-client";
import { IconRefresh, IconSettlements } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsGroup, SettingsLinkRow, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FIELD, NoAccess, PaneSkeleton } from "./paneParts";

const STRINGS = {
  en: {
    show: "Offer cash on delivery at checkout",
    showHint: "The shopper pays the courier when the order arrives.",
    alwaysOn: "Cash on delivery is on",
    alwaysOnHint: "Online payments aren't switched on yet, so it is how every order is paid.",
    on: "On",
    howMoney:
      "The courier collects the cash at the door, and the shipping company sends it to you in its settlements, after taking its fees.",
    settlements: "Shipping company settlements",
    settlementsHint: "What each company collected, and what it still owes you.",
    fee: "A fee or a discount for cash on delivery",
    feeHint: "Set in Payment rules; it shows as its own line on the order.",
    open: "Open",
    methodsFailed: "We couldn't load the checkout methods",
    depositTitle: "Deposit before cash on delivery",
    depositDesc: "Ask for part of the order by transfer before a cash-on-delivery order is accepted. The rest is collected on delivery.",
    depositEnabled: "Ask for a deposit",
    amountType: "Deposit amount",
    amountShipping: "The shipping fee",
    amountFixed: "A fixed amount",
    fixedAmount: "Amount",
    appliesTo: "Who pays it",
    appliesAll: "Every customer",
    appliesRisky: "Only customers with a poor delivery record",
    score: "Delivery rate below (%)",
    scoreHint:
      "A customer whose orders across all ZIMOS stores were delivered less than this (or who was reported as spam) pays the deposit. Someone new to the platform is judged by your store's own record; a first-time customer never pays it.",
    needMethodNote: "A deposit is paid by transfer, and no transfer method is shown at checkout yet.",
    addMethod: "Add a transfer method",
    saved: "Cash on delivery settings saved.",
    invalidAmount: "Enter a valid deposit amount.",
    needMethod: "Add a transfer method before asking for a deposit.",
  },
  ar: {
    show: "اعرض الدفع عند الاستلام في الفورم",
    showHint: "العميل بيدفع للمندوب لما الأوردر يوصله.",
    alwaysOn: "الدفع عند الاستلام شغّال",
    alwaysOnHint: "الدفع الأونلاين لسه مش متفعّل، فكل الأوردرات بتتدفع كده.",
    on: "شغّال",
    howMoney: "المندوب بيحصّل الفلوس على الباب، وشركة الشحن بتحوّلهالك في التحصيل بعد ما تخصم مصاريفها.",
    settlements: "تحصيل شركات الشحن",
    settlementsHint: "كل شركة حصّلت كام، ولسه ليك عندها كام.",
    fee: "رسوم أو خصم على الدفع عند الاستلام",
    feeHint: "بتتظبط من قواعد الدفع، وبتظهر بند لوحده في الأوردر.",
    open: "افتح",
    methodsFailed: "معرفناش نحمّل طرق الدفع",
    depositTitle: "عربون قبل الدفع عند الاستلام",
    depositDesc: "اطلب جزء من قيمة الأوردر بالتحويل قبل ما تقبل أوردر الدفع عند الاستلام، والباقي بيتحصّل عند التسليم.",
    depositEnabled: "اطلب عربون",
    amountType: "قيمة العربون",
    amountShipping: "مصاريف الشحن",
    amountFixed: "مبلغ ثابت",
    fixedAmount: "المبلغ",
    appliesTo: "مين يدفعه",
    appliesAll: "كل العملاء",
    appliesRisky: "العملاء اللي سجل استلامهم ضعيف بس",
    score: "نسبة الاستلام أقل من (%)",
    scoreHint:
      "العميل اللي أوردراته في كل متاجر ZIMOS اتسلّمت بنسبة أقل من دي (أو اتبلّغ عنه سبام) بيدفع العربون. العميل الجديد على المنصة بيتحكم عليه بسجله في متجرك، وأول أوردر خالص مش بيدفع.",
    needMethodNote: "العربون بيتدفع بالتحويل، ولسه مفيش طريقة تحويل ظاهرة في الفورم.",
    addMethod: "ضيف طريقة تحويل",
    saved: "اتحفظت إعدادات الدفع عند الاستلام.",
    invalidAmount: "اكتب مبلغ عربون صحيح.",
    needMethod: "ضيف طريقة تحويل قبل ما تطلب عربون.",
  },
} satisfies Messages;

/** The parts of the deposit rule a merchant edits here (the fixed amount is typed separately, as text). */
function ruleKey(rule: ManualTransferDepositRule): string {
  return JSON.stringify([rule.enabled, rule.amountType, rule.appliesTo, rule.maxReliabilityScore]);
}

/**
 * Payments → Cash on delivery: everything the dashboard holds about COD in
 * one pane — whether checkout offers it (the `cod` entry of the checkout
 * methods), the deposit asked before a COD order (saved with the manual
 * transfer settings), where its fee lives, and where the collected cash is
 * followed. Both saves are the ones the page always made, from one save bar.
 */
export function CodSection({
  workspaceId,
  currency,
  canManage,
  methods,
  methodsLoading,
  methodsError,
  onRetryMethods,
  configured,
  hasRules,
  onForbidden,
  onMethodsSaved,
  onGoto,
}: {
  workspaceId: string;
  currency: string;
  canManage: boolean;
  /** The checkout methods as saved; null while they load, or where online payments are not set up. */
  methods: PaymentMethodEntry[] | null;
  methodsLoading: boolean;
  methodsError: unknown;
  onRetryMethods: () => void;
  /** false: the platform has no gateways, so the methods list does not exist and COD is simply on. null: not known yet. */
  configured: boolean | null;
  /** Whether the Payment rules section is listed (it is not where online payments are not set up). */
  hasRules: boolean;
  onForbidden: () => void;
  onMethodsSaved: (next: PaymentMethodEntry[]) => void;
  onGoto: (section: "rules" | "transfer") => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const amountTypeId = useId();
  const fixedId = useId();
  const appliesId = useId();
  const scoreId = useId();

  // Null = this role may not read the transfer settings (the deposit lives with them).
  const transfer = useAsync(
    () => manualTransferGetSettings(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );

  const savedCod = methods?.find((m) => m.method === "cod") ?? null;
  const [codOn, setCodOn] = useState<boolean>(savedCod?.enabled ?? true);
  useEffect(() => {
    if (savedCod) setCodOn(savedCod.enabled);
  }, [savedCod?.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const [rule, setRule] = useState<ManualTransferDepositRule | null>(null);
  const [fixed, setFixed] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedRule = transfer.data?.depositRule ?? null;
  const savedFixed = savedRule ? minorToMajorInput(savedRule.fixedAmount) : "";
  useEffect(() => {
    if (!transfer.data) return;
    setRule(transfer.data.depositRule);
    setFixed(minorToMajorInput(transfer.data.depositRule.fixedAmount));
  }, [transfer.data]);

  const codDirty = savedCod !== null && codOn !== savedCod.enabled;
  const depositDirty =
    rule !== null &&
    savedRule !== null &&
    (ruleKey(rule) !== ruleKey(savedRule) || (rule.amountType === "fixed" && fixed !== savedFixed));
  const dirty = codDirty || depositDirty;
  useReportDirty(dirty);

  const transferMethods = transfer.data?.methods ?? [];
  const noTransferMethod = !transferMethods.some((m) => m.enabled);

  async function save() {
    setError(null);
    let fixedAmount = 0;
    if (depositDirty && rule) {
      // The same checks the transfer settings always made before a save.
      fixedAmount = rule.amountType === "fixed" ? majorToMinor(fixed) : rule.fixedAmount;
      if (rule.enabled && rule.amountType === "fixed" && (!Number.isFinite(fixedAmount) || fixedAmount <= 0)) {
        toast.error(t.invalidAmount);
        return;
      }
      if (rule.enabled && noTransferMethod) {
        toast.error(t.needMethod);
        return;
      }
    }
    setSaving(true);
    try {
      if (codDirty && methods) {
        // The full ordered list, as the checkout methods save it; only the COD entry differs.
        const result = await apiClient.updatePaymentMethods(
          workspaceId,
          methods.map((m) => ({ id: m.id, enabled: m.method === "cod" ? codOn : m.enabled }))
        );
        onMethodsSaved(result.methods);
      }
      if (depositDirty && rule) {
        const next = await manualTransferSaveSettings(apiClient, workspaceId, {
          methods: transferMethods,
          depositRule: { ...rule, fixedAmount: Number.isFinite(fixedAmount) ? fixedAmount : 0 },
        });
        transfer.setData(next);
      }
      toast.success(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onForbidden();
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (savedCod) setCodOn(savedCod.enabled);
    if (savedRule) {
      setRule(savedRule);
      setFixed(savedFixed);
    }
    setError(null);
  }

  return (
    <>
      <SettingsGroup footer={t.howMoney}>
        {savedCod ? (
          <SettingsSwitch
            label={t.show}
            hint={t.showHint}
            checked={codOn}
            disabled={!canManage || saving}
            onChange={setCodOn}
          />
        ) : configured === false ? (
          <SettingsRow label={t.alwaysOn} hint={t.alwaysOnHint} control={<StatusBadge value="on" tone="success" text={t.on} />} />
        ) : methodsLoading || configured === null ? (
          <SettingsRow label={t.show} hint={common.loading} control={<span className="h-7 w-12 rounded-full bg-ink/8" aria-hidden />} />
        ) : methodsError ? (
          <SettingsRow
            label={t.methodsFailed}
            hint={errorMessage(methodsError)}
            control={
              <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={onRetryMethods}>
                <IconRefresh className="size-4" weight="bold" aria-hidden />
                {common.retry}
              </Button>
            }
          />
        ) : null}
        {hasRules && (
          <SettingsRow
            label={t.fee}
            hint={t.feeHint}
            control={
              <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => onGoto("rules")}>
                {t.open}
              </Button>
            }
          />
        )}
        <SettingsLinkRow to="/settlements" icon={IconSettlements} tone="green" label={t.settlements} hint={t.settlementsHint} />
      </SettingsGroup>

      <DataState
        loading={transfer.loading}
        error={transfer.error}
        onRetry={() => void transfer.refresh()}
        skeleton={<PaneSkeleton rows={2} />}
      >
        {!rule ? (
          <NoAccess />
        ) : (
          <SettingsGroup title={t.depositTitle} description={t.depositDesc}>
            <SettingsSwitch
              label={t.depositEnabled}
              checked={rule.enabled}
              disabled={!canManage || saving}
              onChange={(v) => setRule({ ...rule, enabled: v })}
            />
            {rule.enabled && (
              <SettingsRow
                label={t.amountType}
                htmlFor={amountTypeId}
                control={
                  <Select
                    id={amountTypeId}
                    className={FIELD}
                    value={rule.amountType}
                    disabled={!canManage}
                    onChange={(e) => setRule({ ...rule, amountType: e.target.value as ManualTransferDepositRule["amountType"] })}
                  >
                    <option value="shipping">{t.amountShipping}</option>
                    <option value="fixed">{t.amountFixed}</option>
                  </Select>
                }
              />
            )}
            {rule.enabled && rule.amountType === "fixed" && (
              <SettingsRow
                label={t.fixedAmount}
                htmlFor={fixedId}
                control={
                  <div className="relative w-full">
                    <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-ink-soft">
                      {currency}
                    </span>
                    <Input
                      id={fixedId}
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`${FIELD} ps-14`}
                      value={fixed}
                      disabled={!canManage}
                      onChange={(e) => setFixed(e.target.value)}
                    />
                  </div>
                }
              />
            )}
            {rule.enabled && (
              <SettingsRow
                label={t.appliesTo}
                htmlFor={appliesId}
                control={
                  <Select
                    id={appliesId}
                    className={FIELD}
                    value={rule.appliesTo}
                    disabled={!canManage}
                    onChange={(e) => setRule({ ...rule, appliesTo: e.target.value as ManualTransferDepositRule["appliesTo"] })}
                  >
                    <option value="all">{t.appliesAll}</option>
                    <option value="risky">{t.appliesRisky}</option>
                  </Select>
                }
              />
            )}
            {rule.enabled && rule.appliesTo === "risky" && (
              <SettingsRow
                label={t.score}
                hint={t.scoreHint}
                htmlFor={scoreId}
                control={
                  <Input
                    id={scoreId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    dir="ltr"
                    className={FIELD}
                    value={String(rule.maxReliabilityScore)}
                    disabled={!canManage}
                    onChange={(e) =>
                      setRule({ ...rule, maxReliabilityScore: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                }
              />
            )}
            {rule.enabled && noTransferMethod && (
              <SettingsRow
                label={t.needMethodNote}
                control={
                  <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => onGoto("transfer")}>
                    {t.addMethod}
                  </Button>
                }
              />
            )}
          </SettingsGroup>
        )}
      </DataState>

      {error && <Alert variant="danger">{error}</Alert>}
      {canManage && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />}
    </>
  );
}
