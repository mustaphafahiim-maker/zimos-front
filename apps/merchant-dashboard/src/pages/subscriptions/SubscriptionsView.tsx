import { renewalHoldOf, subscriptionsOnHoldOf } from "@store-builder/api-client";
import { RenewalHoldTile } from "./RenewalHold";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  customerSubscriptionsChangeStatus,
  customerSubscriptionsList,
  customerSubscriptionsOverview,
  type CustomerSubscription,
  type CustomerSubscriptionStatus,
  type SubscriptionsOverview,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCoins, IconSearch, IconSparkle, IconSubscriptions } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fold, matches } from "@/pages/quotes/kit/Facts";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { SubscriptionQuickLook } from "./SubscriptionQuickLook";
import { SUBSCRIPTION_COLUMNS, SubscriptionRow, type SubscriptionMove } from "./SubscriptionRow";
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_STRINGS } from "./subscriptionText";

type StatusFilter = "all" | CustomerSubscriptionStatus;

/**
 * One card of the strip. On a phone each has the width its figure needs and
 * snaps into place — two show and the third peeks in, which says the row
 * scrolls. From sm the three share the row.
 */
function Slot({ width, children }: { width: string; children: ReactNode }) {
  return <div className={cn("shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1", width)}>{children}</div>;
}

/**
 * The three figures the chips do not already say: what the active
 * subscriptions bring in each period, how many started this month, and what
 * was collected. ONE row — it scrolls sideways on a phone instead of stacking
 * three cards over the list. A role that cannot read the overview gets no
 * strip rather than three dashes.
 */
function SubscriptionKpis({ overview, loading }: { overview: SubscriptionsOverview | null; loading: boolean }) {
  const t = useT(SUBSCRIPTION_STRINGS);
  if (!overview && !loading) return null;
  const busy = !overview;
  const currency = overview?.currency ?? "EGP";
  return (
    <section
      aria-label={t.kpisLabel}
      data-slot="kinds-kpis"
      // The padding is room for the cards' shadow and focus ring, which the scroll box would cut; the top margin takes it back.
      className="-mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-3 [scrollbar-width:none] max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      <Slot width="w-44">
        <KpiCard
          label={t.kpiActive}
          value={overview ? fmt("{n}", { n: overview.active }) : ""}
          hint={overview ? fmt(t.kpiActiveHint, { amount: formatMoney(overview.activeAmount, currency) }) : t.kpiActive}
          loading={busy}
          icon={<IconSubscriptions />}
        />
      </Slot>
      <Slot width="w-36">
        <KpiCard label={t.kpiNew} value={overview ? fmt("{n}", { n: overview.newThisMonth }) : ""} hint={t.kpiNewHint} loading={busy} icon={<IconSparkle />} />
      </Slot>
      <Slot width="w-48">
        <KpiCard
          label={t.kpiRevenue}
          value={overview ? formatMoney(overview.revenue, currency) : ""}
          hint={t.kpiRevenueHint}
          loading={busy}
          icon={<IconCoins />}
        />
      </Slot>
    </section>
  );
}

/**
 * The subscriptions list: the figures in one strip, search, the statuses as
 * chips with how many each holds (from the overview), then the rows — cards
 * on a phone, a sheet from a wide screen. A row opens Quick Look, where a
 * subscription is paused, resumed or cancelled; pausing an active one offers
 * Undo, cancelling asks once.
 */
export function SubscriptionsView({ onGoToPlans }: { onGoToPlans: () => void }) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  // handoff 394: only the subscriptions whose renewal is held by the store's side.
  const [heldOnly, setHeldOnly] = useState(false);
  const cachePrefix = `subscriptions:${workspaceId}:`;
  const overview = useCachedAsync<SubscriptionsOverview>(`${cachePrefix}overview`, () => customerSubscriptionsOverview(apiClient, workspaceId), [workspaceId]);
  const list = useCachedAsync<CustomerSubscription[]>(
    `${cachePrefix}list:${status}`,
    () => customerSubscriptionsList(apiClient, workspaceId, { status: status === "all" ? undefined : status, limit: 200 }),
    [workspaceId, status]
  );

  // The subscription being looked at, and the one being cancelled. Each stays here while its sheet closes.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [cancelling, setCancelling] = useState<{ sub: CustomerSubscription; open: boolean } | null>(null);
  const [busy, setBusy] = useState<Record<string, SubscriptionMove>>({});

  const subs = useMemo(() => {
    const rows = list.loading ? [] : (list.data ?? []);
    return heldOnly ? rows.filter((row) => renewalHoldOf(row) !== null) : rows;
  }, [list.loading, list.data, heldOnly]);
  const query = fold(search.trim());
  const visible = useMemo(
    () => (query ? subs.filter((s) => matches(query, [s.customerName, s.customerPhone, s.productName])) : subs),
    [subs, query]
  );
  const peeked = peek ? (subs.find((s) => s.id === peek.id) ?? null) : null;

  /** Sends the move and merges the answer into the row. Throws when the server says no. */
  async function act(sub: CustomerSubscription, action: SubscriptionMove) {
    setBusy((prev) => ({ ...prev, [sub.id]: action }));
    try {
      const saved = await customerSubscriptionsChangeStatus(apiClient, workspaceId, sub.id, action);
      // The answer has no customer on it: the row keeps the name and number it had.
      list.setData((prev) => (prev ?? []).map((row) => (row.id === saved.id ? { ...row, ...saved, customerName: row.customerName, customerPhone: row.customerPhone } : row)));
      // The other chips' lists, kept in memory, are out of date now.
      for (const key of ["all", ...SUBSCRIPTION_STATUSES]) if (key !== status) invalidateCached(`${cachePrefix}list:${key}`);
      void overview.refresh({ silent: true });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[sub.id];
        return next;
      });
    }
  }

  function move(sub: CustomerSubscription, action: SubscriptionMove) {
    if (action === "cancel") {
      // Quick Look steps aside for the question: two sheets are never stacked.
      setPeek((current) => (current ? { ...current, open: false } : current));
      setCancelling({ sub, open: true });
      return;
    }
    // Pausing a running subscription with a saved card can be taken straight back; the other moves just say they happened.
    const undoable = action === "pause" && sub.status === "active" && sub.hasCard;
    void act(sub, action)
      .then(() => {
        if (undoable) toast.undo(t.pausedToast, () => act(sub, "resume"));
        else toast.success(action === "pause" ? t.pausedToast : t.resumedToast);
      })
      .catch((err: unknown) => toast.error(errorMessage(err)));
  }

  const counts: Record<CustomerSubscriptionStatus, number> | null = overview.data
    ? {
        active: overview.data.active,
        trialing: overview.data.trialing,
        past_due: overview.data.pastDue,
        paused: overview.data.paused,
        cancelled: overview.data.cancelled,
        completed: overview.data.completed,
      }
    : null;
  const chips: ChipItem<StatusFilter>[] = [
    { value: "all", label: t.anyStatus, count: overview.data ? overview.data.total : null },
    ...SUBSCRIPTION_STATUSES.map((key) => ({
      value: key,
      label: t[`status_${key}`],
      count: counts ? counts[key] : null,
      tone: key === "past_due" ? ("attention" as const) : undefined,
    })),
  ];

  const pill = "min-h-11 rounded-full px-5";
  const empty = query ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptySearch}
      action={
        <Button variant="outline" className={pill} onClick={() => setSearch("")}>
          {t.clearSearch}
        </Button>
      }
    />
  ) : status !== "all" ? (
    <EmptyState
      icon={<IconSubscriptions aria-hidden />}
      title={t.emptyStatus}
      action={
        <Button variant="outline" className={pill} onClick={() => setStatus("all")}>
          {t.showAll}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<IconSubscriptions aria-hidden />}
      title={t.emptyTitle}
      description={t.emptyDescription}
      action={
        <Button className={pill} onClick={onGoToPlans}>
          {t.tabPlans}
        </Button>
      }
    />
  );

  const rows = visible.map((sub) => (
    <SubscriptionRow
      key={sub.id}
      sub={sub}
      workspaceId={workspaceId}
      compact={compact}
      current={peek?.open === true && peek.id === sub.id}
      busy={busy[sub.id] !== undefined}
      onPeek={() => setPeek({ id: sub.id, open: true })}
      onMove={(action) => move(sub, action)}
    />
  ));

  const blocking = list.error != null && (subs.length === 0 || isPermissionError(list.error));
  const who = cancelling ? cancelling.sub.customerName?.trim() || cancelling.sub.customerPhone?.trim() || t.none : "";

  return (
    <div className="flex flex-col gap-3">
      <SubscriptionKpis overview={overview.data} loading={overview.loading} />
      <RenewalHoldTile count={subscriptionsOnHoldOf(overview.data)} active={heldOnly} onToggle={() => setHeldOnly((on) => !on)} />

      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
      <ChipRow items={chips} value={status} onChange={setStatus} label={t.chipsLabel} countsLoading={overview.loading} />

      <DataState
        loading={list.loading}
        error={blocking ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {list.error != null && !blocking && (
          <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.refreshFailed}</span>
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void list.refresh({ silent: true })}>
              {t.retryLoad}
            </Button>
          </Alert>
        )}
        {visible.length === 0 ? (
          empty
        ) : compact ? (
          <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={SUBSCRIPTION_COLUMNS}
            label={t.listLabel}
            head={[{ label: t.colCustomer }, { label: t.colPlan }, { label: t.colNext }, { label: t.colStatus }, { label: t.colActions, end: true }]}
          >
            {rows}
          </DeskList>
        )}
      </DataState>

      <SubscriptionQuickLook
        sub={peeked}
        workspaceId={workspaceId}
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        busy={peeked ? (busy[peeked.id] ?? null) : null}
        onMove={(action) => {
          if (peeked) move(peeked, action);
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelling?.open)}
        title={cancelling ? fmt(t.cancelTitle, { who, product: cancelling.sub.productName }) : ""}
        description={t.cancelDescription}
        confirmLabel={t.cancel}
        busyLabel={t.cancelling}
        cancelLabel={t.keep}
        destructive
        onCancel={() => setCancelling((current) => (current ? { ...current, open: false } : current))}
        onConfirm={async () => {
          const sub = cancelling?.sub;
          if (!sub) return;
          try {
            await act(sub, "cancel");
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setCancelling((current) => (current ? { ...current, open: false } : current));
          toast.success(t.cancelledToast);
        }}
      />
    </div>
  );
}
