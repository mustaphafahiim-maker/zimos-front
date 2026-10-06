import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, HandCoins, ListChecks, MoreHorizontal, Pause, Pencil, Play, Plus, Send, Trash2, UsersRound } from "lucide-react";
import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@store-builder/ui";
import {
  ApiError,
  affiliatesCommissions,
  affiliatesDelete,
  affiliatesList,
  affiliatesPayouts,
  affiliatesUpdate,
  type Affiliate,
  type AffiliateCommission,
  type AffiliatePayout,
  type CommissionStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { AffiliateFormModal, AffiliatePayDialog, AffiliateShareDialog } from "./affiliateDialogs";
import { AFFILIATE_STRINGS, PAYOUT_METHODS, type PayoutMethod } from "./strings";

type Tab = "affiliates" | "commissions" | "payouts";

const STATUS_TONE: Record<CommissionStatus, "neutral" | "info" | "success" | "danger"> = {
  pending: "neutral",
  approved: "info",
  paid: "success",
  void: "danger",
};

const sum = (affiliates: Affiliate[], key: "pending" | "approved" | "paid") =>
  affiliates.reduce((total, a) => total + Number(a.totals?.[key] ?? 0), 0);

const due = (a: Affiliate) => Number(a.totals?.approved ?? 0);

/**
 * Affiliates (SPEC §20.3), laid out in the order the merchant works: add a
 * marketer, send them their link, watch the orders come in, pay what is due
 * and record it.
 */
export function AffiliatesPage() {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => affiliatesList(apiClient, workspaceId), [workspaceId]);
  const affiliates = list.data?.affiliates ?? [];
  const currency = list.data?.currency ?? "EGP";
  const [tab, setTab] = useState<Tab>("affiliates");
  // The affiliate the commissions and payments tabs are narrowed to; "" = all.
  const [focus, setFocus] = useState("");
  const [editing, setEditing] = useState<Affiliate | "new" | null>(null);
  const [sharing, setSharing] = useState<Affiliate | null>(null);
  const [paying, setPaying] = useState<Affiliate | null>(null);
  const [removing, setRemoving] = useState<Affiliate | null>(null);
  const storeBase = `${STOREFRONT_URL}/store/${workspaceId}`;
  const refresh = () => void list.refresh({ silent: true });

  const rate = (a: Affiliate) =>
    a.commissionType === "percent" ? `${a.commissionValue / 100}%` : fmt(t.perOrder, { amount: formatMoney(a.commissionValue, currency) });

  async function toggleStatus(a: Affiliate) {
    const next = a.status === "active" ? "paused" : "active";
    try {
      await affiliatesUpdate(apiClient, workspaceId, a.id, { status: next });
      toast.success(fmt(next === "paused" ? t.pausedToast : t.resumedToast, { name: a.name }));
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await affiliatesDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(err instanceof ApiError && err.code === "AFFILIATE_HAS_COMMISSIONS" ? t.hasCommissions : errorMessage(err));
    }
    toast.success(t.removedToast);
    setRemoving(null);
    refresh();
  }

  function showCommissions(a: Affiliate) {
    setFocus(a.id);
    setTab("commissions");
  }

  const columns: Column<Affiliate>[] = [
    {
      key: "affiliate",
      header: t.colAffiliate,
      cell: (a) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            <bdi>{a.name}</bdi>
            {a.status === "paused" && <StatusBadge value="paused" tone="neutral" text={t.paused} />}
          </p>
          <p className="text-xs text-ink-soft">
            <bdi dir="ltr">+{a.phone}</bdi> · <bdi dir="ltr">?ref={a.code}</bdi>
          </p>
        </div>
      ),
    },
    { key: "rate", header: t.colRate, cell: (a) => <span className="text-ink">{rate(a)}</span> },
    { key: "orders", header: t.colOrders, align: "end", cell: (a) => <span className="tabular-nums">{a.totals?.orders ?? 0}</span> },
    { key: "pending", header: t.colPending, align: "end", cell: (a) => <span className="tabular-nums text-ink-soft">{formatMoney(a.totals?.pending ?? 0, currency)}</span> },
    {
      key: "due",
      header: t.colDue,
      align: "end",
      cell: (a) => <span className={due(a) > 0 ? "tabular-nums font-semibold text-ink" : "tabular-nums text-ink-soft"}>{formatMoney(due(a), currency)}</span>,
    },
    { key: "paid", header: t.colPaid, align: "end", cell: (a) => <span className="tabular-nums text-ink-soft">{formatMoney(a.totals?.paid ?? 0, currency)}</span> },
    {
      key: "actions",
      // A visible heading: an sr-only one is positioned outside the table's
      // scroll area and widens the whole page on a phone.
      header: t.colActions,
      align: "end",
      cell: (a) => (
        <div className="flex items-center justify-end gap-2">
          {due(a) > 0 ? (
            <Button size="sm" className="min-h-9" onClick={() => setPaying(a)}>
              <HandCoins className="size-4" aria-hidden />
              {t.pay}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="min-h-9" onClick={() => setSharing(a)}>
              <Send className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.share}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon" variant="ghost" className="min-h-9 min-w-9" aria-label={fmt(t.more, { name: a.name })} />}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {due(a) > 0 && (
                <DropdownMenuItem onClick={() => setSharing(a)}>
                  <Send className="size-4 rtl:-scale-x-100" aria-hidden />
                  {t.share}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => showCommissions(a)}>
                <ListChecks className="size-4" aria-hidden />
                {t.viewCommissions}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditing(a)}>
                <Pencil className="size-4" aria-hidden />
                {t.edit}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void toggleStatus(a)}>
                {a.status === "active" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {a.status === "active" ? t.pause : t.resume}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setRemoving(a)}>
                <Trash2 className="size-4" aria-hidden />
                {t.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const owed = affiliates.filter((a) => due(a) > 0).length;
  const empty = !list.loading && !list.error && affiliates.length === 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {empty ? (
          <Card className="gap-6 p-6">
            <EmptyState
              icon={<UsersRound className="size-6" aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyDescription}
              action={
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-4" aria-hidden />
                  {t.add}
                </Button>
              }
            />
            <HowItWorks />
          </Card>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t.kpiDue} value={formatMoney(sum(affiliates, "approved"), currency)} hint={owed > 0 ? fmt(t.dueCount, { count: owed }) : undefined} />
              <KpiCard label={t.kpiPending} value={formatMoney(sum(affiliates, "pending"), currency)} />
              <KpiCard label={t.kpiPaid} value={formatMoney(sum(affiliates, "paid"), currency)} />
              <KpiCard label={t.kpiActive} value={affiliates.filter((a) => a.status === "active").length} />
            </div>

            <Card className="mb-4 flex-row flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{t.portal}</p>
                <p className="text-xs text-ink-soft">{t.portalHint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={`${storeBase}/affiliate`} label={t.copyLink} />
                <Button asChild size="sm" variant="outline" className="min-h-9">
                  <a href={`${storeBase}/affiliate`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    {t.openPortal}
                  </a>
                </Button>
              </div>
            </Card>

            <FilterTabs
              className="mb-4"
              label={t.tabs}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "affiliates", label: t.tabAffiliates },
                { value: "commissions", label: t.tabCommissions },
                { value: "payouts", label: t.tabPayouts },
              ]}
            />

            {tab === "affiliates" && (
              <Card className="p-0">
                <DataTable columns={columns} rows={affiliates} rowKey={(a) => a.id} minWidth="58rem" />
              </Card>
            )}
            {tab === "commissions" && <CommissionsTab affiliates={affiliates} affiliateId={focus} onAffiliateChange={setFocus} />}
            {tab === "payouts" && <PayoutsTab affiliates={affiliates} affiliateId={focus || affiliates[0]?.id || ""} onAffiliateChange={setFocus} />}
          </>
        )}
      </DataState>

      <AffiliateFormModal
        affiliate={editing}
        currency={currency}
        storeBase={storeBase}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          setEditing(null);
          refresh();
          // A new marketer cannot sell until they have the link: go straight to step 2.
          if (created) setSharing(saved);
        }}
      />
      <AffiliateShareDialog affiliate={sharing} storeBase={storeBase} onClose={() => setSharing(null)} />
      <AffiliatePayDialog
        affiliate={paying}
        currency={currency}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          refresh();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.removeTitle, { name: removing.name }) : ""}
        description={t.removeDescription}
        confirmLabel={t.removeConfirm}
        busyLabel={t.removing}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/** The four steps, shown while there is nobody to list yet. */
function HowItWorks() {
  const t = useT(AFFILIATE_STRINGS);
  const steps = [
    [t.step1, t.step1Desc],
    [t.step2, t.step2Desc],
    [t.step3, t.step3Desc],
    [t.step4, t.step4Desc],
  ] as const;
  return (
    <section aria-labelledby="affiliates-how" className="border-t border-line pt-5">
      <h2 id="affiliates-how" className="text-sm font-semibold text-ink">
        {t.howTitle}
      </h2>
      <ol className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, description], index) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold tabular-nums text-primary-dark dark:text-primary">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{title}</span>
              <span className="block text-xs leading-relaxed text-ink-soft">{description}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AffiliateSelect({
  affiliates,
  value,
  onChange,
  label,
  allLabel,
}: {
  affiliates: Affiliate[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Omit when one affiliate has to be chosen. */
  allLabel?: string;
}) {
  return (
    <Field label={label} labelHidden className="w-56">
      {(props) => (
        <Select {...props} value={value} onChange={(e) => onChange(e.target.value)}>
          {allLabel !== undefined && (
            <option value="">
              {label}: {allLabel}
            </option>
          )}
          {affiliates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CommissionsTab({ affiliates, affiliateId, onAffiliateChange }: { affiliates: Affiliate[]; affiliateId: string; onAffiliateChange: (id: string) => void }) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const [status, setStatus] = useState<"" | CommissionStatus>("");
  const list = useAsync(
    () => affiliatesCommissions(apiClient, workspaceId, { affiliateId: affiliateId || undefined, status: status || undefined, limit: 200 }),
    [workspaceId, affiliateId, status]
  );
  const filtered = affiliateId !== "" || status !== "";

  const columns: Column<AffiliateCommission>[] = [
    {
      key: "order",
      header: t.colOrder,
      cell: (c) => (
        <Link to={`/orders/${c.orderId}`} className="font-medium text-ink hover:text-primary">
          <bdi dir="ltr">{c.orderNumber}</bdi>
        </Link>
      ),
    },
    { key: "affiliate", header: t.colAffiliate, cell: (c) => <bdi>{c.affiliateName}</bdi> },
    { key: "date", header: t.colDate, cell: (c) => <span className="text-ink-soft">{formatDate(c.orderedAt)}</span> },
    { key: "base", header: t.colBase, align: "end", cell: (c) => <span className="tabular-nums text-ink-soft">{formatMoney(c.baseAmount, c.currency)}</span> },
    { key: "amount", header: t.colAmount, align: "end", cell: (c) => <span className="tabular-nums font-medium">{formatMoney(c.amount, c.currency)}</span> },
    { key: "status", header: t.colStatus, cell: (c) => <StatusBadge value={c.status} tone={STATUS_TONE[c.status]} text={t[`status_${c.status}`]} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <AffiliateSelect affiliates={affiliates} value={affiliateId} onChange={onAffiliateChange} label={t.affiliateFilter} allLabel={t.anyAffiliate} />
        <Field label={t.statusFilter} labelHidden className="w-56">
          {(props) => (
            <Select {...props} value={status} onChange={(e) => setStatus(e.target.value as "" | CommissionStatus)}>
              <option value="">
                {t.statusFilter}: {t.anyStatus}
              </option>
              {(["pending", "approved", "paid", "void"] as const).map((key) => (
                <option key={key} value={key}>
                  {t[`status_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={list.data ?? []}
            rowKey={(c) => c.id}
            minWidth="48rem"
            empty={
              <EmptyState
                title={filtered ? t.emptyCommissionsFiltered : t.emptyCommissions}
                action={
                  filtered ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onAffiliateChange("");
                        setStatus("");
                      }}
                    >
                      {t.clearFilters}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </Card>
      </DataState>
    </div>
  );
}

function PayoutsTab({ affiliates, affiliateId, onAffiliateChange }: { affiliates: Affiliate[]; affiliateId: string; onAffiliateChange: (id: string) => void }) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => (affiliateId ? affiliatesPayouts(apiClient, workspaceId, affiliateId) : Promise.resolve([])), [workspaceId, affiliateId]);
  // Stored as a key by this screen; anything else (older rows, another client) is shown as written.
  const methodLabel = (method: string | null) => (method && (PAYOUT_METHODS as readonly string[]).includes(method) ? t[`method_${method as PayoutMethod}`] : method || "—");

  const columns: Column<AffiliatePayout>[] = [
    { key: "date", header: t.colDate, cell: (p) => <span className="text-ink">{formatDate(p.paidAt)}</span> },
    { key: "method", header: t.colMethod, cell: (p) => <span className="text-ink-soft">{methodLabel(p.method)}</span> },
    { key: "note", header: t.colNote, cell: (p) => <bdi className="text-ink-soft">{p.note || "—"}</bdi> },
    { key: "amount", header: t.colAmount, align: "end", cell: (p) => <span className="tabular-nums font-medium">{formatMoney(p.amount, p.currency)}</span> },
  ];

  if (!affiliateId) return <EmptyState title={t.pickAffiliate} />;
  return (
    <div className="space-y-3">
      <AffiliateSelect affiliates={affiliates} value={affiliateId} onChange={onAffiliateChange} label={t.payoutsFor} />
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(p) => p.id} minWidth="36rem" empty={<EmptyState title={t.emptyPayouts} />} />
        </Card>
      </DataState>
    </div>
  );
}
