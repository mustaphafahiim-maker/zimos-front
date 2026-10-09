import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  billingCodePreview,
  billingInvoicesList,
  billingPaymentMethodsGet,
  billingPayPerOrderChoose,
  billingPlanChange,
  billingPlansGet,
  billingProofsList,
  billingStartTrialOnPlan,
  billingWalletGet,
  billingWalletLedger,
  type BillingCodePreview,
  type BillingCodeView,
  type BillingCycle,
  type BillingInvoice,
  type BillingLedgerEntry,
  type BillingPaymentProof,
  type BillingPlanOffer,
  type BillingPlans,
  type BillingWallet,
  type WorkspaceBilling,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { closeGoLive } from "@/lib/goLive";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { recallReferralCode } from "@/lib/referralCode";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CycleSwitch, PlanSummary } from "@/components/plans/PlanPicker";
import { BILLING_STRINGS, type BillingText } from "./billingStrings";
import { PayDialog, TopupDialog } from "./TransferDialogs";

type TabKey = "plans" | "balance" | "charges" | "proofs";
const PAGE_SIZE = 20;

/** The code's discount in words: "10% off each payment". */
function codeDiscountText(t: BillingText, code: BillingCodeView): string {
  if (code.discountType === "percentage" && code.discountValue != null) return fmt(t.percentOff, { value: code.discountValue / 100 });
  if (code.discountType === "fixed" && code.discountValue != null && code.discountCurrency)
    return fmt(t.fixedOff, { amount: formatMoney(code.discountValue, code.discountCurrency) });
  return t.noDiscount;
}

function Pager({ page, total, onPage, t }: { page: number; total: number; onPage: (p: number) => void; t: BillingText }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
      <span className="text-xs text-ink-soft">{fmt(t.pageOf, { page, pages })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t.previous}
        </Button>
        <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t.next}
        </Button>
      </div>
    </div>
  );
}

function SupportNote({ children, t }: { children: ReactNode; t: BillingText }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line bg-paper px-4 py-3">
      <p className="min-w-0 flex-[1_1_14rem] text-sm text-ink">{children}</p>
      <Link to="/support" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
        {t.openTicket}
      </Link>
    </div>
  );
}

/**
 * Settings → Subscription, under the plan summary: the plans on offer, the
 * prepaid balance, the charges and the transfer proofs (handoff 333–336).
 * `onBillingChange` re-reads the summary above after anything here changed it.
 */
export function SubscriptionPanels({ billing, onBillingChange }: { billing: WorkspaceBilling; onBillingChange: () => void }) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  const plans = useAsync(() => billingPlansGet(apiClient, workspaceId), [workspaceId]);
  // The balance is a side panel: when it can't be read, the section still shows the rest.
  const wallet = useAsync(() => billingWalletGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [version, setVersion] = useState(0);
  const [paying, setPaying] = useState(false);
  const [toppingUp, setToppingUp] = useState(() => params.get("topup") === "1");

  const showBalance = Boolean(wallet.data && (wallet.data.onFeePlan || wallet.data.enabled));
  const wanted = params.get("billing");
  const tab: TabKey =
    wanted === "balance" && showBalance ? "balance" : wanted === "charges" || wanted === "proofs" ? wanted : wanted === "balance" ? "plans" : "plans";

  function selectTab(next: TabKey) {
    const out = new URLSearchParams(params);
    if (next === "plans") out.delete("billing");
    else out.set("billing", next);
    out.delete("topup");
    setParams(out, { replace: true });
  }

  function changed() {
    setVersion((v) => v + 1);
    void plans.refresh({ silent: true });
    void wallet.refresh({ silent: true });
    onBillingChange();
  }

  const plan = billing.subscription.plan;
  const onFeePlan = Boolean(wallet.data?.onFeePlan) || Boolean(plans.data?.payPerOrder?.current);
  const canPay = Boolean(plan && plan.monthlyPrice > 0 && billing.subscription.status !== "draft" && !billing.draft && !onFeePlan);

  const tabs: Array<{ value: TabKey; label: string }> = [
    { value: "plans", label: t.tabPlans },
    ...(showBalance ? [{ value: "balance" as const, label: t.tabBalance }] : []),
    { value: "charges", label: t.tabCharges },
    { value: "proofs", label: t.tabProofs },
  ];

  return (
    <div className="mt-5 space-y-4 border-t border-line pt-5" data-testid="subscription-panels">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs tabs={tabs} value={tab} onChange={selectTab} label={t.tabsLabel} buttonClassName="min-h-11 sm:min-h-0" />
        {canPay && (
          <Button onClick={() => setPaying(true)} className="min-h-11" data-testid="subscription-pay">
            {t.pay}
          </Button>
        )}
      </div>

      {tab === "plans" && (
        <DataState loading={plans.loading && !plans.data} error={plans.error} onRetry={() => void plans.refresh()} skeleton="card">
          {plans.data && <PlansTab data={plans.data} onPlans={(next) => plans.setData(next)} onChanged={changed} />}
        </DataState>
      )}
      {tab === "balance" && wallet.data && (
        <BalanceTab wallet={wallet.data} version={version} onTopUp={() => setToppingUp(true)} />
      )}
      {tab === "charges" && <ChargesTab version={version} />}
      {tab === "proofs" && (
        <ProofsTab
          version={version}
          onPayAgain={canPay ? () => setPaying(true) : undefined}
          onTopUpAgain={wallet.data?.enabled ? () => setToppingUp(true) : undefined}
        />
      )}

      <PayDialog
        open={paying}
        onClose={() => setPaying(false)}
        onSent={() => {
          setPaying(false);
          changed();
          selectTab("proofs");
        }}
      />
      {wallet.data && wallet.data.enabled && (
        <TopupDialog
          open={toppingUp}
          wallet={wallet.data}
          onClose={() => setToppingUp(false)}
          onSent={() => {
            setToppingUp(false);
            changed();
            selectTab("proofs");
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ plans

function PlansTab({ data, onPlans, onChanged }: { data: BillingPlans; onPlans: (next: BillingPlans) => void; onChanged: () => void }) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [cycle, setCycle] = useState<BillingCycle>(data.subscription.billingCycle);
  const [preview, setPreview] = useState<BillingCodePreview | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPpo, setConfirmPpo] = useState(false);
  const [ppoNeedsSupport, setPpoNeedsSupport] = useState(false);

  const overrides = {
    PLAN_NOT_AVAILABLE: t.PLAN_NOT_AVAILABLE,
    OPEN_CHARGE_EXISTS: t.OPEN_CHARGE_EXISTS,
    PLAN_CHANGE_NEEDS_SUPPORT: t.supportNote,
    WALLET_DISABLED: t.WALLET_DISABLED,
    EMAIL_NOT_VERIFIED: t.EMAIL_NOT_VERIFIED,
  };

  function pricesOf(plan: BillingPlanOffer) {
    return preview?.plans.find((p) => p.planId === plan.id)?.prices ?? plan.prices;
  }

  async function choose(plan: BillingPlanOffer) {
    setBusyPlan(plan.id);
    setError(null);
    try {
      const answer = await billingPlanChange(apiClient, workspaceId, plan.id, cycle);
      onPlans(answer.plans);
      toast.success(answer.changed ? t.planChanged : t.planUnchanged);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, overrides));
    } finally {
      setBusyPlan(null);
    }
  }

  async function startTrial(plan: BillingPlanOffer) {
    setBusyPlan(plan.id);
    setError(null);
    try {
      await billingStartTrialOnPlan(apiClient, workspaceId, plan.id);
      toast.success(t.trialStarted);
      closeGoLive(true);
      onChanged();
    } catch (err) {
      const reason = apiErrorDetails<{ reason?: string }>(err)?.reason;
      setError(
        apiErrorCode(err) === "TRIAL_NOT_AVAILABLE"
          ? reason === "no_trial"
            ? t.noTrialOnPlan
            : t.trialUsed
          : errorMessage(err, overrides)
      );
    } finally {
      setBusyPlan(null);
    }
  }

  async function choosePayPerOrder() {
    try {
      await billingPayPerOrderChoose(apiClient, workspaceId);
    } catch (err) {
      if (apiErrorCode(err) === "PLAN_CHANGE_NEEDS_SUPPORT") {
        setConfirmPpo(false);
        setPpoNeedsSupport(true);
        return;
      }
      throw new Error(errorMessage(err, overrides));
    }
    setConfirmPpo(false);
    toast.success(t.ppoChanged);
    closeGoLive(true);
    onChanged();
  }

  const ppo = data.payPerOrder;
  const ppoFee = ppo?.plan ? formatMoney(ppo.plan.fee, ppo.plan.currency) : "";
  const days = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);

  return (
    <div className="space-y-4">
      <CycleSwitch value={cycle} onChange={setCycle} disabled={busyPlan !== null} />
      {data.trial.used && data.subscription.draft && <Alert>{t.trialUsed}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid gap-3 md:grid-cols-2" data-testid="billing-plan-cards">
        {data.plans.map((plan) => {
          const price = pricesOf(plan)[cycle];
          const busy = busyPlan === plan.id;
          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-4",
                plan.isCurrent ? "border-primary ring-1 ring-primary" : "border-line"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-display text-lg font-medium text-ink">{plan.name}</h4>
                <div className="flex flex-wrap gap-1">
                  {plan.isCurrent && <StatusBadge value="current" tone="info" text={t.currentPlan} />}
                  {!plan.isPublic && <StatusBadge value="private" tone="neutral" text={t.privatePlan} />}
                </div>
              </div>
              {price.discount > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  <s className="tabular">{formatMoney(price.gross, plan.currency)}</s>
                  <span className="ms-2 font-medium text-success">{fmt(t.codeDiscount, { amount: formatMoney(price.discount, plan.currency) })}</span>
                </p>
              )}
              <div className="mt-2 flex-1">
                <PlanSummary
                  plan={{ ...plan, monthlyPrice: pricesOf(plan).monthly.net, yearlyPrice: pricesOf(plan).yearly.net }}
                  billingCycle={cycle}
                />
              </div>
              {!plan.isCurrent && plan.isPublic && (data.trial.available || data.planChange === "immediate") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.trial.available && plan.trialDays > 0 && (
                    <Button className="min-h-11" disabled={busyPlan !== null} onClick={() => void startTrial(plan)}>
                      {busy ? t.choosing : fmt(t.startTrial, { days: days(plan.trialDays) })}
                    </Button>
                  )}
                  {data.planChange === "immediate" && (
                    <Button
                      variant={data.trial.available && plan.trialDays > 0 ? "outline" : "default"}
                      className="min-h-11"
                      disabled={busyPlan !== null}
                      onClick={() => void choose(plan)}
                    >
                      {busy ? t.choosing : t.choosePlan}
                    </Button>
                  )}
                </div>
              )}
              {plan.isCurrent && plan.isPublic && data.planChange === "immediate" && cycle !== data.subscription.billingCycle && (
                <div className="mt-4">
                  <Button variant="outline" className="min-h-11" disabled={busyPlan !== null} onClick={() => void choose(plan)}>
                    {busy ? t.choosing : t.choosePlan}
                  </Button>
                </div>
              )}
            </article>
          );
        })}

        {ppo?.plan && (
          <article
            data-testid="pay-per-order-card"
            className={cn(
              "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-4",
              ppo.current ? "border-primary ring-1 ring-primary" : "border-line"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="font-display text-lg font-medium text-ink">{t.ppoTitle}</h4>
              {ppo.current && <StatusBadge value="current" tone="info" text={t.currentPlan} />}
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-soft">{fmt(t.ppoBody, { fee: ppoFee })}</p>
            {ppoNeedsSupport && <p className="mt-3 text-sm text-ink">{t.ppoSupport}</p>}
            {ppo.available && !ppo.current && (
              <div className="mt-4">
                <Button variant="outline" className="min-h-11" onClick={() => setConfirmPpo(true)}>
                  {t.ppoChoose}
                </Button>
              </div>
            )}
          </article>
        )}
      </div>

      {data.planChange === "support" && <SupportNote t={t}>{t.supportNote}</SupportNote>}

      {!data.referralCode && (
        <ReferralCodeTry
          preview={preview}
          onPreview={setPreview}
          onAttached={() => {
            setPreview(null);
            onChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmPpo}
        title={t.ppoConfirmTitle}
        description={fmt(t.ppoConfirm, { fee: ppoFee })}
        confirmLabel={t.ppoChoose}
        onCancel={() => setConfirmPpo(false)}
        onConfirm={choosePayPerOrder}
      />
    </div>
  );
}

/** «جرّب الكود» redraws the prices with the code's discount; «استخدم الكود» attaches it (once, for good). */
function ReferralCodeTry({
  preview,
  onPreview,
  onAttached,
}: {
  preview: BillingCodePreview | null;
  onPreview: (next: BillingCodePreview | null) => void;
  onAttached: () => void;
}) {
  const t = useT(BILLING_STRINGS);
  const id = useId();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState(() => recallReferralCode());
  const [busy, setBusy] = useState<"try" | "use" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overrides = {
    REFERRAL_CODE_INVALID: t.REFERRAL_CODE_INVALID,
    SELF_REFERRAL: t.SELF_REFERRAL,
    RATE_LIMITED: t.RATE_LIMITED,
    REFERRAL_CODE_ALREADY_SET: t.REFERRAL_CODE_ALREADY_SET,
    VALIDATION_ERROR: t.REFERRAL_CODE_INVALID,
  };

  async function tryCode(e: FormEvent) {
    e.preventDefault();
    setBusy("try");
    setError(null);
    try {
      onPreview(await billingCodePreview(apiClient, workspaceId, code.trim()));
    } catch (err) {
      onPreview(null);
      setError(errorMessage(err, overrides));
    } finally {
      setBusy(null);
    }
  }

  async function useCode() {
    if (!preview) return;
    setBusy("use");
    setError(null);
    try {
      await apiClient.attachReferralCode(workspaceId, preview.code.code);
      toast.success(t.codeApplied);
      onAttached();
    } catch (err) {
      setError(errorMessage(err, overrides));
      setBusy(null);
    }
  }

  return (
    <form onSubmit={tryCode} className="space-y-2" data-testid="referral-code-try">
      <Label htmlFor={id}>{t.referralCode}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (preview) onPreview(null);
          }}
          placeholder={t.codePlaceholder}
          maxLength={32}
          dir="ltr"
          className="max-w-60 font-mono"
          disabled={busy !== null}
        />
        <Button type="submit" variant="outline" disabled={busy !== null || code.trim().length < 3} className="min-h-11">
          {busy === "try" ? t.trying : t.tryCode}
        </Button>
        {preview && (
          <Button type="button" onClick={() => void useCode()} disabled={busy !== null} className="min-h-11">
            {busy === "use" ? t.using : t.useCode}
          </Button>
        )}
      </div>
      {preview && (
        <p className="text-sm text-ink-soft" role="status">
          <span className="font-medium text-ink">{codeDiscountText(t, preview.code)}</span> · {fmt(t.codePreviewed, { code: preview.code.code })}
        </p>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
    </form>
  );
}

// ---------------------------------------------------------------- charges

function ChargesTab({ version }: { version: number }) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useAsync(() => billingInvoicesList(apiClient, workspaceId, page, PAGE_SIZE), [workspaceId, page, version]);
  const statusText: Record<BillingInvoice["status"], string> = { paid: t.statusPaid, pending: t.statusPending, failed: t.statusFailed };

  const columns: Column<BillingInvoice>[] = [
    { key: "period", header: t.period, cell: (c) => `${formatDate(c.periodStart)} – ${formatDate(c.periodEnd)}` },
    {
      key: "amount",
      header: t.amount,
      cell: (c) => (
        <span>
          <span className="tabular font-medium text-ink">{formatMoney(c.amountDue, c.currency)}</span>
          {c.discountAmount > 0 && (
            <span className="block text-xs text-ink-soft">
              {fmt(t.gross, { amount: formatMoney(c.grossAmount, c.currency) })} · {fmt(t.discount, { amount: formatMoney(c.discountAmount, c.currency) })}
            </span>
          )}
        </span>
      ),
    },
    { key: "paid", header: t.paid, cell: (c) => <span className="tabular">{c.amountPaid != null ? formatMoney(c.amountPaid, c.currency) : "—"}</span> },
    { key: "status", header: t.status, cell: (c) => <StatusBadge value={c.status} text={statusText[c.status] ?? c.status} /> },
    { key: "paidAt", header: t.paidOn, cell: (c) => (c.paidAt ? formatDate(c.paidAt) : "—") },
  ];

  return (
    <DataState loading={loading && !data} error={error} onRetry={() => void refresh()} skeleton="table">
      {data && data.invoices.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">{t.noCharges}</p>
      ) : (
        data && (
          <>
            <DataTable columns={columns} rows={data.invoices} rowKey={(c) => c.id} phoneCards />
            <Pager page={data.page} total={data.total} onPage={setPage} t={t} />
          </>
        )
      )}
    </DataState>
  );
}

// ----------------------------------------------------------------- proofs

function ProofsTab({ version, onPayAgain, onTopUpAgain }: { version: number; onPayAgain?: () => void; onTopUpAgain?: () => void }) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { data, loading, error, refresh } = useAsync(() => billingProofsList(apiClient, workspaceId), [workspaceId, version]);
  const statusText: Record<BillingPaymentProof["status"], string> = { pending: t.proofPending, approved: t.proofApproved, rejected: t.proofRejected };
  const tone: Record<BillingPaymentProof["status"], "warning" | "success" | "danger"> = { pending: "warning", approved: "success", rejected: "danger" };

  const columns: Column<BillingPaymentProof>[] = [
    { key: "date", header: t.date, cell: (p) => formatDateTime(p.createdAt) },
    { key: "method", header: t.method, cell: (p) => p.method.label[locale] || p.method.label.en },
    { key: "purpose", header: t.purpose, cell: (p) => (p.purpose === "topup" ? t.purposeTopup : t.purposeInvoice) },
    { key: "amount", header: t.amount, cell: (p) => <span className="tabular font-medium text-ink">{formatMoney(p.amount, p.currency)}</span> },
    {
      key: "status",
      header: t.status,
      className: "whitespace-normal",
      cell: (p) => {
        const again = p.purpose === "topup" ? onTopUpAgain : onPayAgain;
        return (
          <span className="block">
            <StatusBadge value={p.status} tone={tone[p.status]} text={statusText[p.status] ?? p.status} />
            {p.status === "rejected" && (
              <>
                {p.reviewNote && <span className="mt-1 block w-40 max-w-full text-xs leading-5 whitespace-normal text-ink-soft">{fmt(t.rejectReason, { note: p.reviewNote })}</span>}
                {again && (
                  <Button variant="outline" size="sm" className="mt-2 min-h-11 sm:min-h-9" onClick={again}>
                    {p.purpose === "topup" ? t.topUpAgain : t.payAgain}
                  </Button>
                )}
              </>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <DataState loading={loading && !data} error={error} onRetry={() => void refresh()} skeleton="table">
      {data && data.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">{t.noProofs}</p>
      ) : (
        data && <DataTable columns={columns} rows={data} rowKey={(p) => p.id} phoneCards />
      )}
    </DataState>
  );
}

// ---------------------------------------------------------------- balance

function BalanceTab({ wallet, version, onTopUp }: { wallet: BillingWallet; version: number; onTopUp: () => void }) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const ledger = useAsync(() => billingWalletLedger(apiClient, workspaceId, page, PAGE_SIZE), [workspaceId, page, version]);
  const money = (n: number) => formatMoney(n, wallet.currency);
  const typeText: Record<string, string> = {
    topup: t.typeTopup,
    order_fee: t.typeFee,
    order_fee_reversal: t.typeReversal,
    order_fee_recharge: t.typeRecharge,
  };

  const columns: Column<BillingLedgerEntry>[] = [
    { key: "date", header: t.date, cell: (e) => formatDateTime(e.createdAt) },
    { key: "type", header: t.type, cell: (e) => typeText[e.type] ?? e.type },
    {
      key: "order",
      header: t.order,
      cell: (e) =>
        e.orderId ? (
          <Link to={`/orders/${e.orderId}`} className="font-mono text-xs text-primary underline-offset-2 hover:underline" dir="ltr">
            {e.orderNumber ?? e.orderId}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "amount",
      header: t.amount,
      align: "end",
      cell: (e) => (
        <span className="block">
          <span className={cn("tabular font-medium", e.amount >= 0 ? "text-success" : "text-danger")} dir="ltr">
            {e.amount >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(e.amount), e.currency)}
          </span>
          {/* The pane is narrow: the balance after sits under the amount instead of in a fifth column. */}
          <span className="tabular block text-xs text-ink-soft">
            {t.balanceAfter}: {formatMoney(e.balanceAfter, e.currency)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="billing-balance">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
        <div className="min-w-0 space-y-1">
          <p className={cn("tabular text-2xl font-semibold", wallet.balance < 0 ? "text-danger" : "text-ink")}>
            {fmt(t.yourBalance, { balance: money(wallet.balance) })}
          </p>
          {wallet.ordersLeft != null && <p className="text-sm text-ink">{fmt(t.enoughFor, { orders: wallet.ordersLeft })}</p>}
          {wallet.fee != null && <p className="text-sm text-ink-soft">{fmt(t.feePerOrder, { fee: money(wallet.fee) })}</p>}
          <p className="text-sm text-ink-soft">{fmt(t.thisMonth, { fees: money(wallet.month.fees), orders: wallet.month.orders })}</p>
          <p className="text-sm text-ink-soft">{fmt(t.toppedUp, { amount: money(wallet.totalToppedUp) })}</p>
        </div>
        {wallet.enabled ? (
          <Button onClick={onTopUp} className="min-h-11" data-testid="balance-topup">
            {t.topUp}
          </Button>
        ) : (
          <p className="max-w-xs text-xs text-ink-soft">{t.readOnlyBalance}</p>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink">{t.activity}</h4>
        <DataState loading={ledger.loading && !ledger.data} error={ledger.error} onRetry={() => void ledger.refresh()} skeleton="table">
          {ledger.data && ledger.data.entries.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">{t.noActivity}</p>
          ) : (
            ledger.data && (
              <>
                <DataTable columns={columns} rows={ledger.data.entries} rowKey={(e) => e.id} phoneCards />
                <Pager page={ledger.data.page} total={ledger.data.total} onPage={setPage} t={t} />
              </>
            )
          )}
        </DataState>
      </div>
    </div>
  );
}

/**
 * In place of «تواصل مع الدعم» for a lapsed plan: while the platform offers a
 * way to pay (a transfer method, a gateway), the Pay button of the section
 * covers it and this shows nothing; otherwise the old note stays.
 */
export function PayBySupportFallback({ children }: { children: ReactNode }) {
  const workspaceId = useWorkspaceId();
  const [offered, setOffered] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    billingPaymentMethodsGet(apiClient, workspaceId)
      .then((answer) => {
        if (!cancelled) setOffered(answer.methods.length > 0);
      })
      .catch(() => {
        if (!cancelled) setOffered(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
  if (offered !== false) return null;
  return <>{children}</>;
}
