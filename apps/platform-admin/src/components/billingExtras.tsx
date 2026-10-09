import { useState } from "react";
import { Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import {
  adminPlansCatalog,
  adminPricingOf,
  adminWorkspaceWallet,
  type AdminFeatureCatalogEntry,
  type AdminManualPricing,
  type AdminPricingKind,
  type BillingCycle,
  type PlanFeatureKey,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatDateTime, formatMinorMoneyExact, toMajorAmount, toMinorAmount } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { DataState, EmptyBlock } from "./DataState";
import { DetailRow } from "./Drawer";
import { TextField } from "./forms";
import { Panel, Td, Th } from "./Panel";
import { StatusBadge, type Tone } from "./StatusBadge";

/**
 * Console pieces of handoff items 333–336: the feature catalogue as the
 * server lists it, manual pricing (paid, free, discounted) and a store's
 * prepaid balance. The console is English only.
 */

// ------------------------------------------------------- feature catalogue

/** `featureCatalog` of GET /admin/plans: the features and their names, in the server's order. */
export function useFeatureCatalog() {
  return useAsync(() => adminPlansCatalog(apiClient).then((answer) => answer.featureCatalog), []);
}

/**
 * The feature catalogue as tick boxes for a plan. A feature that isn't built
 * yet can't be ticked — unless the plan already lists it (`listed`): then it
 * may be unticked, never ticked again.
 */
export function CatalogFeaturePicker({
  catalog,
  value,
  listed,
  onChange,
  problems = [],
}: {
  catalog: AdminFeatureCatalogEntry[];
  value: PlanFeatureKey[];
  /** What the plan had when the editor opened. */
  listed: PlanFeatureKey[];
  onChange: (next: PlanFeatureKey[]) => void;
  /** PLAN_FEATURE_NOT_AVAILABLE details, shown under the list. */
  problems?: string[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Features</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {catalog.map((f) => {
          const key = f.key as PlanFeatureKey;
          const checked = value.includes(key);
          const locked = !f.available && !(checked && listed.includes(key));
          return (
            <label
              key={f.key}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-line px-3 py-2 text-sm text-ink",
                locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-ink-soft"
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-primary)]"
                checked={checked}
                disabled={locked}
                onChange={() => onChange(checked ? value.filter((k) => k !== key) : [...value, key])}
              />
              <span>
                {f.label.en}
                <span className="block text-xs text-ink-soft" dir="rtl" lang="ar">
                  {f.label.ar}
                </span>
                {!f.available && <span className="block text-xs text-ink-soft">Not available yet</span>}
              </span>
            </label>
          );
        })}
      </div>
      {problems.map((p) => (
        <p key={p} className="mt-2 text-sm font-medium text-danger">
          {p}
        </p>
      ))}
    </fieldset>
  );
}

// ------------------------------------------------------------ manual pricing

export function pricingLabel(p: AdminManualPricing): { label: string; tone: Tone } {
  if (p.pricingKind === "free") return { label: "Free", tone: "info" };
  if (p.pricingKind === "discounted")
    return p.discountPercent ? { label: `${p.discountPercent}% off`, tone: "warning" } : { label: "Special price", tone: "warning" };
  return { label: "Paid", tone: "neutral" };
}

/** Paid · Free · 25% off · Special price. */
export function PricingBadge({ subscription, className }: { subscription: object; className?: string }) {
  const { label, tone } = pricingLabel(adminPricingOf(subscription));
  return (
    <StatusBadge tone={tone} className={className}>
      {label}
    </StatusBadge>
  );
}

/** The pricing lines of the store's Subscription panel. */
export function PricingSummaryRows({ subscription }: { subscription: object }) {
  const p = adminPricingOf(subscription);
  const currency = p.currency ?? "EGP";
  return (
    <>
      <DetailRow label="Pricing">
        <PricingBadge subscription={subscription} />
      </DetailRow>
      <DetailRow label="Price paid">
        <span className="tabular">
{formatMinorMoneyExact(p.effectivePrice, currency)}</span>
        <span className="ms-2 text-xs text-ink-soft">per billing period</span>
      </DetailRow>
      {p.pricingExpiredAt && (
        <DetailRow label="Pricing period">
          <span className="text-danger">
            The free/discounted period ended on {formatDate(p.pricingExpiredAt)} — activate or extend it
          </span>
        </DetailRow>
      )}
    </>
  );
}

export const MANUAL_PRICING_HINT = "Free or discounted by the platform — no charges";

export interface PricingChoice {
  kind: AdminPricingKind;
  mode: "percent" | "fixed";
  percent: string;
  /** Whole currency units as typed. */
  fixed: string;
}

export const PAID_PRICING: PricingChoice = { kind: "paid", mode: "percent", percent: "", fixed: "" };

export type PricingProblem = { field: "discountPercent" | "priceOverrideAmount" | "pricingKind"; message: string };

/** What one billing period costs the merchant under `choice`, in minor units; null while the form is incomplete. */
export function pricedAmount(choice: PricingChoice, planPrice: number, currency: string): number | null {
  if (choice.kind === "paid") return planPrice;
  if (choice.kind === "free") return 0;
  if (choice.mode === "percent") {
    const pct = Number(choice.percent);
    if (!Number.isInteger(pct) || pct < 1 || pct > 99) return null;
    return Math.round((planPrice * (100 - pct)) / 100);
  }
  const fixed = Number(choice.fixed);
  if (choice.fixed.trim() === "" || !Number.isFinite(fixed)) return null;
  return toMinorAmount(fixed, currency);
}

/** The form's own check, in the handoff's words. */
export function pricingProblem(choice: PricingChoice, planPrice: number, currency: string): PricingProblem | null {
  if (choice.kind !== "discounted") return null;
  if (choice.mode === "percent") {
    const pct = Number(choice.percent);
    if (choice.percent.trim() === "") return { field: "discountPercent", message: "Choose a percent or a fixed price — one of them" };
    if (!Number.isInteger(pct) || pct < 1 || pct > 99) return { field: "discountPercent", message: "The percent must be 1 to 99" };
    return null;
  }
  const amount = pricedAmount(choice, planPrice, currency);
  if (choice.fixed.trim() === "") return { field: "priceOverrideAmount", message: "Choose a percent or a fixed price — one of them" };
  if (amount === null || amount <= 0 || amount >= planPrice)
    return { field: "priceOverrideAmount", message: "The price must be above zero and below the plan's price" };
  return null;
}

/** The three pricing fields of POST …/subscription/activate. Left out entirely for `paid`. */
export function pricingBody(choice: PricingChoice, currency: string): Record<string, unknown> {
  if (choice.kind === "paid") return {};
  if (choice.kind === "free") return { pricingKind: "free" };
  return choice.mode === "percent"
    ? { pricingKind: "discounted", discountPercent: Number(choice.percent) }
    : { pricingKind: "discounted", priceOverrideAmount: toMinorAmount(Number(choice.fixed), currency) };
}

/** A server VALIDATION_ERROR on a pricing field, in the handoff's words. */
export function pricingServerProblem(field: string): PricingProblem | null {
  if (field === "discountPercent") return { field, message: "Choose a percent or a fixed price — one of them" };
  if (field === "priceOverrideAmount") return { field, message: "The price must be above zero and below the plan's price" };
  if (field === "pricingKind") return { field, message: "A discount needs the discounted pricing" };
  return null;
}

const KINDS: Array<{ value: AdminPricingKind; label: string }> = [
  { value: "paid", label: "Paid — the plan's price" },
  { value: "free", label: "Free (gift)" },
  { value: "discounted", label: "Discounted" },
];

/** «التسعير»: paid, free or discounted, with the line saying what the merchant pays. */
export function PricingFields({
  value,
  onChange,
  planPrice,
  currency,
  cycle,
  problem,
}: {
  value: PricingChoice;
  onChange: (next: PricingChoice) => void;
  /** The plan's price for the chosen cycle, minor units. */
  planPrice: number;
  currency: string;
  cycle: BillingCycle;
  problem: PricingProblem | null;
}) {
  const amount = pricedAmount(value, planPrice, currency);
  const chip = (on: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm ${on ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-soft"}`;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ink">Pricing</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pricing">
        {KINDS.map((k) => (
          <label key={k.value} className={chip(value.kind === k.value)}>
            <input type="radio" name="pricing-kind" checked={value.kind === k.value} onChange={() => onChange({ ...value, kind: k.value })} />
            {k.label}
          </label>
        ))}
      </div>
      {problem?.field === "pricingKind" && <p className="text-sm font-medium text-danger">{problem.message}</p>}
      {value.kind === "discounted" && (
        <div className="space-y-3 rounded-[10px] border border-line p-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Discount type">
            <label className={chip(value.mode === "percent")}>
              <input type="radio" name="pricing-mode" checked={value.mode === "percent"} onChange={() => onChange({ ...value, mode: "percent" })} />
              Percent off
            </label>
            <label className={chip(value.mode === "fixed")}>
              <input type="radio" name="pricing-mode" checked={value.mode === "fixed"} onChange={() => onChange({ ...value, mode: "fixed" })} />
              Fixed price per period
            </label>
          </div>
          {value.mode === "percent" ? (
            <TextField
              label="Percent off (%)"
              type="number"
              min={1}
              max={99}
              step={1}
              value={value.percent}
              onChange={(e) => onChange({ ...value, percent: e.target.value })}
              error={problem?.field === "discountPercent" ? problem.message : undefined}
              hint="1 to 99."
            />
          ) : (
            <TextField
              label={`Fixed price per period (${currency})`}
              type="number"
              min={0}
              value={value.fixed}
              onChange={(e) => onChange({ ...value, fixed: e.target.value })}
              error={problem?.field === "priceOverrideAmount" ? problem.message : undefined}
              hint={`Less than the plan's price for this cycle (${toMajorAmount(planPrice, currency)} ${currency}).`}
            />
          )}
        </div>
      )}
      {value.kind !== "paid" && (
        <p className="text-xs text-ink-soft">No charges are made for this subscription; when the period ends it becomes past due.</p>
      )}
      {amount !== null && (
        <p className="text-sm text-ink" data-testid="pricing-line">
          The merchant pays <strong className="tabular">{formatMinorMoneyExact(amount, currency)}</strong> a {cycle === "yearly" ? "year" : "month"}
        </p>
      )}
    </fieldset>
  );
}

// ----------------------------------------------------------------- balance

const PHASE: Record<string, { label: string; tone: Tone }> = {
  ok: { label: "OK", tone: "success" },
  low: { label: "Running low", tone: "warning" },
  overdraft: { label: "Below zero", tone: "danger" },
  exhausted: { label: "Ran out — store stopped", tone: "danger" },
};

const LEDGER_TYPE: Record<string, string> = {
  topup: "Top-up",
  order_fee: "Order fee",
  order_fee_reversal: "Fee returned",
  order_fee_recharge: "Order fee (again)",
};

/**
 * The store's prepaid balance (pay per order): the balance, its phase, the fee,
 * the totals and the ledger. Shown for a store on the plan, or one that has
 * ever had activity; otherwise a line saying it pays no fee per order.
 */
export function StoreBalancePanel({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useAsync(() => adminWorkspaceWallet(apiClient, workspaceId, page, 20), [workspaceId, page]);
  const wallet = data?.wallet;
  const ledger = data?.ledger;
  const money = (n: number) => formatMinorMoneyExact(n, wallet?.currency ?? "EGP");
  const pages = ledger ? Math.max(1, Math.ceil(ledger.total / ledger.pageSize)) : 1;
  const phase = wallet ? (PHASE[wallet.phase] ?? { label: wallet.phase, tone: "neutral" as Tone }) : null;

  return (
    <Panel title="Balance" description="The prepaid balance of the pay-per-order plan." flush>
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {wallet && (
          <>
            <dl className="px-5 py-4">
              <DetailRow label="Balance">
                <span className={cn("tabular font-semibold", wallet.balance < 0 ? "text-danger" : "text-ink")}>{money(wallet.balance)}</span>
                {phase && wallet.onFeePlan && (
                  <StatusBadge tone={phase.tone} className="ms-2">
                    {phase.label}
                  </StatusBadge>
                )}
              </DetailRow>
              <DetailRow label="On pay per order">
                {wallet.onFeePlan ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge tone="neutral">No</StatusBadge>}
                {!wallet.enabled && <span className="ms-2 text-xs text-ink-soft">WALLET_ENABLED is off on the server</span>}
              </DetailRow>
              <DetailRow label="Fee per order">{wallet.fee != null ? <span className="tabular">{money(wallet.fee)}</span> : "—"}</DetailRow>
              <DetailRow label="Orders left">
                {wallet.ordersLeft != null ? (
                  <span className="tabular">
                    {wallet.ordersLeft}
                    <span className="ms-2 text-xs text-ink-soft">{wallet.ordersBeforeOverdraft ?? 0} before the balance reaches zero</span>
                  </span>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="This month">
                <span className="tabular">
                  {money(wallet.month.fees)} for {wallet.month.orders} orders
                </span>
              </DetailRow>
              <DetailRow label="Topped up in total">
                <span className="tabular">{money(wallet.totalToppedUp)}</span>
              </DetailRow>
            </dl>
            {ledger && ledger.entries.length === 0 ? (
              <div className="border-t border-line px-5 py-4">
                <EmptyBlock message="No balance activity yet." />
              </div>
            ) : (
              ledger && (
                <div className="border-t border-line">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Date</Th>
                        <Th>Type</Th>
                        <Th>Order</Th>
                        <Th className="text-end">Amount</Th>
                        <Th className="text-end">Balance after</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.entries.map((e) => (
                        <TableRow key={e.id}>
                          <Td>{formatDateTime(e.createdAt)}</Td>
                          <Td>
                            {LEDGER_TYPE[e.type] ?? e.type}
                            {e.note && <span className="block text-xs text-ink-soft">{e.note}</span>}
                          </Td>
                          <Td className="font-mono text-xs">{e.orderNumber ?? "—"}</Td>
                          <Td className={cn("tabular text-end font-medium", e.amount >= 0 ? "text-success" : "text-danger")}>
                            {e.amount >= 0 ? "+" : "−"}
                            {formatMinorMoneyExact(Math.abs(e.amount), e.currency)}
                          </Td>
                          <Td className="tabular text-end">{formatMinorMoneyExact(e.balanceAfter, e.currency)}</Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {pages > 1 && (
                    <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-sm">
                      <span className="text-ink-soft">
                        Page {page} of {pages}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </DataState>
    </Panel>
  );
}

/**
 * Where «Create next charge» would be for a store that has no next charge:
 * for a free or discounted subscription, the button switched off with the
 * reason. Nothing for any other store with no next charge (a free plan).
 */
export function ManualPricingChargeHint({ workspaceId }: { workspaceId: string }) {
  const { data } = useAsync(() => apiClient.adminGetManualSubscription(workspaceId).catch(() => null), [workspaceId]);
  if (!data || adminPricingOf(data.subscription).pricingKind === "paid") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-soft">{MANUAL_PRICING_HINT}</span>
      <Button disabled title={MANUAL_PRICING_HINT}>
        Create next charge
      </Button>
    </div>
  );
}
