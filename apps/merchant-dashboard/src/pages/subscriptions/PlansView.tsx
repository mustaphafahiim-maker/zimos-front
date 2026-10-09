import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  productPlanSet,
  productPlansList,
  type BillingInterval,
  type ProductBillingPlan,
  type ProductPlanRow,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { IconPlus, IconProducts, IconSearch, IconSliders } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { fold, matches } from "@/pages/quotes/kit/Facts";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { SUBSCRIPTION_STRINGS, planText } from "./subscriptionText";

type PlanFilter = "all" | "subscription" | "installments" | "once";
type Mode = "once" | "subscription" | "installments";

const PLAN_COLUMNS = "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_max-content]";
/** The limits the plans API accepts. */
const PAYMENTS = { min: 2, max: 36 } as const;
const TRIAL = { min: 0, max: 90 } as const;

const kindOf = (row: ProductPlanRow): Exclude<PlanFilter, "all"> => (row.billingPlan ? row.billingPlan.mode : "once");

/**
 * How each product is sold: once, as a subscription, or in installments. The
 * list is read whole, so the chips say how many products each way holds and
 * search narrows as it is typed. A row opens the sheet that changes the plan;
 * a saved change shows at once and can be taken back from its toast.
 */
export function PlansView() {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const compact = useIsCompact();

  const list = useCachedAsync<ProductPlanRow[]>(`subscriptions:${workspaceId}:plans`, () => productPlansList(apiClient, workspaceId), [workspaceId]);
  const products = useMemo(() => list.data ?? [], [list.data]);
  const [filter, setFilter] = useState<PlanFilter>("all");
  const [search, setSearch] = useState("");
  // The product being changed stays here while its sheet closes, so the sheet does not empty on its way out.
  const [editing, setEditing] = useState<{ product: ProductPlanRow; open: boolean } | null>(null);

  const query = fold(search.trim());
  const visible = useMemo(
    () => products.filter((p) => (filter === "all" || kindOf(p) === filter) && matches(query, [p.name])),
    [products, filter, query]
  );
  const count = (kind: Exclude<PlanFilter, "all">) => (list.data ? products.filter((p) => kindOf(p) === kind).length : null);
  const chips: ChipItem<PlanFilter>[] = [
    { value: "all", label: t.planAll, count: list.data ? products.length : null },
    { value: "subscription", label: t.mode_subscription, count: count("subscription") },
    { value: "installments", label: t.mode_installments, count: count("installments") },
    { value: "once", label: t.once, count: count("once") },
  ];

  const setPlan = (productId: string, plan: ProductBillingPlan | null) =>
    list.setData((prev) => (prev ?? []).map((p) => (p.id === productId ? { ...p, billingPlan: plan } : p)));

  /** The sheet saved: the row shows the new plan at once, and the toast can put the old one back. */
  function saved(product: ProductPlanRow, plan: ProductBillingPlan | null) {
    const before = product.billingPlan;
    setPlan(product.id, plan);
    setEditing((current) => (current ? { ...current, open: false } : current));
    toast.undo(t.planSaved, async () => {
      try {
        await productPlanSet(apiClient, workspaceId, product.id, before);
      } catch (err) {
        throw new Error(errorMessage(err));
      }
      setPlan(product.id, before);
    });
  }

  const pill = "min-h-11 rounded-full px-5";
  const narrowed = query !== "" || filter !== "all";

  const rows = visible.map((product) => {
    const open = () => setEditing({ product, open: true });
    const editLabel = fmt(t.editName, { name: product.name });
    const menu: ContextMenuItem[] = [
      { id: "edit", label: t.edit, icon: IconSliders, onSelect: open },
      { id: "product", label: t.openProduct, icon: IconProducts, onSelect: () => navigate(`/catalog/${product.id}`) },
    ];
    const badge = product.billingPlan ? (
      <StatusBadge value="plan" tone="info" text={planText(t, product.billingPlan)} className="max-w-full whitespace-normal" />
    ) : (
      <StatusBadge value="once" tone="neutral" text={t.once} />
    );
    if (compact) {
      return (
        <li key={product.id}>
          <ContextMenu items={menu} label={product.name}>
            <ListRowCard title={<bdi>{product.name}</bdi>} status={badge} action={<RowAction tone="quiet" label={t.edit} onClick={open} />} onOpen={open} openLabel={editLabel} aria-haspopup="dialog" />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={product.id} onOpen={open} openLabel={editLabel} current={editing?.open === true && editing.product.id === product.id} menu={menu} menuLabel={product.name}>
        <p className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
          {/* The name is the way to the product's page; the row itself opens the plan. */}
          <ViewLink to={`/catalog/${product.id}`} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <bdi>{product.name}</bdi>
          </ViewLink>
        </p>
        <div className="flex min-w-0 items-center">{badge}</div>
        <div className="flex items-center justify-end">
          <RowAction tone="quiet" icon={IconSliders} label={t.edit} onClick={open} />
        </div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      {/* A phone keeps the first screen for the products: the sentence waits under them, and in the sheet where it matters. */}
      <p className="max-w-3xl text-sm leading-6 text-ink-soft max-md:hidden">{t.plansIntro}</p>

      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.plansSearchPlaceholder, label: t.plansSearchLabel }} />
      <ChipRow items={chips} value={filter} onChange={setFilter} label={t.plansChips} countsLoading={list.loading} />

      <DataState
        loading={list.loading}
        error={products.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {visible.length === 0 ? (
          narrowed ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.emptyPlansFiltered}
              action={
                <Button
                  variant="outline"
                  className={pill}
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  {t.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconProducts aria-hidden />}
              title={t.emptyPlans}
              description={t.emptyPlansHint}
              action={
                <Button asChild className={pill}>
                  <ViewLink to="/catalog/new">
                    <IconPlus className="size-4" weight="bold" aria-hidden />
                    {t.addProduct}
                  </ViewLink>
                </Button>
              }
            />
          )
        ) : compact ? (
          <ul aria-label={t.plansList} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList columns={PLAN_COLUMNS} label={t.plansList} head={[{ label: t.colProductName }, { label: t.colCurrent }, { label: t.edit, end: true }]}>
            {rows}
          </DeskList>
        )}
      </DataState>

      <p className="text-[13px] leading-5 text-ink-soft md:hidden">{t.plansIntro}</p>

      <PlanSheet
        product={editing?.product ?? null}
        open={Boolean(editing?.open)}
        onClose={() => setEditing((current) => (current ? { ...current, open: false } : current))}
        onSaved={saved}
      />
    </div>
  );
}

/**
 * How one product is sold, in a sheet over the list: the model, then only the
 * fields that model needs. A number out of range is said under its field, in
 * words that say what fits, and the caret goes to it.
 */
function PlanSheet({
  product,
  open,
  onClose,
  onSaved,
}: {
  product: ProductPlanRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (product: ProductPlanRow, plan: ProductBillingPlan | null) => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const paymentsBox = useRef<HTMLDivElement>(null);
  const trialBox = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("once");
  const [interval, setIntervalValue] = useState<BillingInterval>("month");
  const [payments, setPayments] = useState("3");
  const [trialDays, setTrialDays] = useState("");
  const [problems, setProblems] = useState<{ payments?: string; trial?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The sheet opens on what is saved: a change left behind by Cancel never comes back.
  useEffect(() => {
    if (!product || !open) return;
    const plan = product.billingPlan;
    setMode(plan ? plan.mode : "once");
    setIntervalValue(plan?.interval ?? "month");
    setPayments(plan && plan.mode === "installments" ? String(plan.payments) : "3");
    setTrialDays(plan && plan.mode === "subscription" && plan.trialDays ? String(plan.trialDays) : "");
    setProblems({});
    setError(null);
  }, [product, open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!product || busy) return;
    const count = Math.floor(Number(payments));
    const trial = trialDays.trim() === "" ? 0 : Math.floor(Number(trialDays));
    const next: typeof problems = {};
    if (mode === "installments" && !(Number.isFinite(count) && count >= PAYMENTS.min && count <= PAYMENTS.max)) next.payments = fmt(t.paymentsError, PAYMENTS);
    if (mode === "subscription" && !(Number.isFinite(trial) && trial >= TRIAL.min && trial <= TRIAL.max)) next.trial = fmt(t.trialError, TRIAL);
    setProblems(next);
    setError(null);
    if (next.payments || next.trial) {
      // The field that needs fixing gets the caret.
      (next.payments ? paymentsBox : trialBox).current?.querySelector("input")?.focus();
      return;
    }

    setBusy(true);
    const plan: ProductBillingPlan | null =
      mode === "once"
        ? null
        : mode === "subscription"
          ? { mode, interval, intervalCount: 1, ...(trial > 0 ? { trialDays: trial } : {}) }
          : { mode, interval, intervalCount: 1, payments: count };
    try {
      await productPlanSet(apiClient, workspaceId, product.id, plan);
      onSaved(product, plan);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open && product !== null}
      onClose={onClose}
      title={product ? fmt(t.planTitle, { name: product.name }) : ""}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancelEdit}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t.mode}</p>
          <Segmented<Mode>
            className="w-full"
            label={t.mode}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setProblems({});
            }}
            options={[
              { value: "once", label: t.mode_once },
              { value: "subscription", label: t.mode_subscription },
              { value: "installments", label: t.mode_installments },
            ]}
          />
          <p className="text-xs leading-5 text-ink-soft">{t[`modeHint_${mode}`]}</p>
        </div>

        {mode !== "once" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t.interval}</p>
            <Segmented<BillingInterval>
              className="w-full"
              label={t.interval}
              value={interval}
              onChange={setIntervalValue}
              options={[
                { value: "week", label: t.int_week },
                { value: "month", label: t.int_month },
                { value: "year", label: t.int_year },
              ]}
            />
          </div>
        )}

        {mode === "installments" && (
          <div ref={paymentsBox}>
            <TextField
              label={t.payments}
              type="number"
              inputMode="numeric"
              min={PAYMENTS.min}
              max={PAYMENTS.max}
              required
              value={payments}
              error={problems.payments}
              onChange={(e) => {
                setPayments(e.target.value);
                setProblems((prev) => ({ ...prev, payments: undefined }));
              }}
            />
          </div>
        )}
        {mode === "subscription" && (
          <div ref={trialBox}>
            <TextField
              label={t.trialDays}
              hint={fmt(t.trialHint, { max: TRIAL.max })}
              type="number"
              inputMode="numeric"
              min={TRIAL.min}
              max={TRIAL.max}
              value={trialDays}
              error={problems.trial}
              onChange={(e) => {
                setTrialDays(e.target.value);
                setProblems((prev) => ({ ...prev, trial: undefined }));
              }}
            />
          </div>
        )}

        {mode !== "once" && <p className="text-xs leading-5 text-ink-soft">{t.plansIntro}</p>}
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
