import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
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
  type AffiliateStatus,
  type CommissionStatus,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import {
  IconAffiliates,
  IconChecklist,
  IconCopy,
  IconDelete,
  IconEdit,
  IconExternal,
  IconPause,
  IconPayout,
  IconPhone,
  IconPlay,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSend,
  IconWhatsApp,
} from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { ReportKpiStrip } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AffiliateFormModal, AffiliatePayDialog, AffiliateShareDialog, ShareRow } from "./affiliateDialogs";
import { AFFILIATE_STRINGS, PAYOUT_METHODS, type AffiliateStrings, type PayoutMethod } from "./strings";

type Tab = "affiliates" | "commissions" | "payouts";
const TABS: readonly Tab[] = ["affiliates", "commissions", "payouts"];
const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

type AffiliateList = { affiliates: Affiliate[]; currency: string };

const STATUS_TONE: Record<CommissionStatus, "neutral" | "info" | "success" | "danger"> = {
  pending: "neutral",
  approved: "info",
  paid: "success",
  void: "danger",
};

const AFFILIATE_COLUMNS = "grid-cols-[minmax(0,1.5fr)_max-content_max-content_max-content_max-content_max-content_max-content]";
const COMMISSION_COLUMNS = "grid-cols-[max-content_minmax(0,1fr)_max-content_max-content_max-content_max-content]";
const PAYOUT_COLUMNS = "grid-cols-[max-content_max-content_minmax(0,1fr)_max-content]";

const PILL = "rounded-full px-5";
const LINK = "rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const sum = (affiliates: Affiliate[], key: "pending" | "approved" | "paid") =>
  affiliates.reduce((total, a) => total + Number(a.totals?.[key] ?? 0), 0);

const due = (a: Affiliate) => Number(a.totals?.approved ?? 0);

/** «10٪» or «25 ج.م على كل أوردر»: what an affiliate earns. */
function rateText(a: Affiliate, currency: string, t: AffiliateStrings): string {
  return a.commissionType === "percent" ? fmt(t.percentRate, { n: a.commissionValue / 100 }) : fmt(t.perOrder, { amount: formatMoney(a.commissionValue, currency) });
}

/**
 * Affiliates (SPEC §20.3), laid out in the order the merchant works: add a
 * marketer, send them their link, watch the orders come in, pay what is due
 * and record it.
 *
 * Three views share the page (`?tab=`): the affiliates, their commissions and
 * the payments made to them. A row of the first opens a preview with the
 * affiliate's numbers, links and every action; the row's ONE action is "pay"
 * while money is due and "send link" otherwise.
 */
export function AffiliatesPage() {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const copy = useCopy();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();
  // Shown at once from the last visit, refreshed behind.
  const list = useCachedAsync<AffiliateList>(`affiliates:${workspaceId}`, () => affiliatesList(apiClient, workspaceId), [workspaceId]);
  const affiliates = useMemo(() => list.data?.affiliates ?? [], [list.data]);
  const currency = list.data?.currency ?? "EGP";

  // The view, and the affiliate the commissions and payments are narrowed to ("" = all), live in the address.
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = isTab(tabParam) ? tabParam : "affiliates";
  const focus = params.get("affiliate") ?? "";
  function go(next: { tab?: Tab; affiliate?: string }) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next.tab !== undefined) {
          if (next.tab === "affiliates") out.delete("tab");
          else out.set("tab", next.tab);
        }
        if (next.affiliate !== undefined) {
          if (next.affiliate) out.set("affiliate", next.affiliate);
          else out.delete("affiliate");
        }
        return out;
      },
      { replace: true }
    );
  }

  const [q, setQ] = useState("");
  // Each stays here while its sheet closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [editing, setEditing] = useState<Affiliate | "new" | null>(null);
  const [sharing, setSharing] = useState<Affiliate | null>(null);
  const [paying, setPaying] = useState<Affiliate | null>(null);
  const [removing, setRemoving] = useState<{ affiliate: Affiliate; open: boolean } | null>(null);
  // A payment recorded from the payments view makes that view read its list again.
  const [paidCount, setPaidCount] = useState(0);
  const storeBase = `${STOREFRONT_URL}/store/${workspaceId}`;
  const portal = `${storeBase}/affiliate`;
  const refresh = () => void list.refresh({ silent: true });
  const closePeek = () => setPeek((current) => (current ? { ...current, open: false } : current));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return affiliates;
    return affiliates.filter((a) => [a.name, a.phone, a.code].some((v) => v.toLowerCase().includes(needle)));
  }, [affiliates, q]);

  /** Pause or resume: the row changes at once, goes back if the save is refused, and the toast can take it back. */
  async function setStatus(a: Affiliate, next: AffiliateStatus, undoable = true) {
    const paint = (status: AffiliateStatus) =>
      list.setData((prev) => ({ currency: prev?.currency ?? currency, affiliates: (prev?.affiliates ?? []).map((row) => (row.id === a.id ? { ...row, status } : row)) }));
    const before = a.status;
    paint(next);
    try {
      await affiliatesUpdate(apiClient, workspaceId, a.id, { status: next });
      const message = fmt(next === "paused" ? t.pausedToast : t.resumedToast, { name: a.name });
      if (undoable) toast.undo(message, () => setStatus({ ...a, status: next }, before, false));
      else toast.success(message);
      refresh();
    } catch (err) {
      paint(before);
      toast.error(errorMessage(err));
    }
  }

  async function confirmRemove(a: Affiliate) {
    try {
      await affiliatesDelete(apiClient, workspaceId, a.id);
    } catch (err) {
      throw new Error(err instanceof ApiError && err.code === "AFFILIATE_HAS_COMMISSIONS" ? t.hasCommissions : errorMessage(err));
    }
    toast.success(t.removedToast);
    setRemoving((current) => (current ? { ...current, open: false } : current));
    list.setData((prev) => ({ currency: prev?.currency ?? currency, affiliates: (prev?.affiliates ?? []).filter((row) => row.id !== a.id) }));
    if (focus === a.id) go({ affiliate: "" });
    refresh();
  }

  function showCommissions(a: Affiliate) {
    closePeek();
    go({ tab: "commissions", affiliate: a.id });
  }
  function showPayouts(a: Affiliate) {
    closePeek();
    go({ tab: "payouts", affiliate: a.id });
  }
  /** One sheet at a time: what opens from the preview closes it first. */
  const from = (open: (a: Affiliate) => void) => (a: Affiliate) => {
    closePeek();
    open(a);
  };
  const askPay = from(setPaying);
  const askShare = from(setSharing);
  const askEdit = from(setEditing);
  const askRemove = from((a) => setRemoving({ affiliate: a, open: true }));

  function menuFor(a: Affiliate): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (due(a) > 0) items.push({ id: "pay", label: fmt(t.payAmount, { amount: formatMoney(due(a), currency) }), icon: IconPayout, onSelect: () => askPay(a) });
    items.push({ id: "share", label: t.share, icon: IconSend, onSelect: () => askShare(a) });
    items.push({ id: "copy", label: t.copyLink, icon: IconCopy, onSelect: () => copy(`${storeBase}?ref=${a.code}`, t.linkCopied) });
    items.push({ id: "commissions", label: t.viewCommissions, icon: IconChecklist, separatorBefore: true, onSelect: () => showCommissions(a) });
    items.push({ id: "payouts", label: t.viewPayouts, icon: IconReceipt, onSelect: () => showPayouts(a) });
    items.push({
      id: "call",
      label: t.call,
      icon: IconPhone,
      separatorBefore: true,
      onSelect: () => {
        window.location.href = `tel:+${a.phone}`;
      },
    });
    items.push({
      id: "whatsapp",
      label: t.whatsappChat,
      icon: IconWhatsApp,
      onSelect: () => {
        window.open(`https://wa.me/${a.phone}`, "_blank", "noopener,noreferrer");
      },
    });
    items.push({ id: "edit", label: t.edit, icon: IconEdit, separatorBefore: true, onSelect: () => askEdit(a) });
    items.push(
      a.status === "active"
        ? { id: "pause", label: t.pause, icon: IconPause, onSelect: () => void setStatus(a, "paused") }
        : { id: "resume", label: t.resume, icon: IconPlay, onSelect: () => void setStatus(a, "active") }
    );
    items.push({ id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => askRemove(a) });
    return items;
  }

  const rows = shown.map((a) => {
    const menu = menuFor(a);
    const menuLabel = fmt(t.more, { name: a.name });
    const onPeek = () => setPeek({ id: a.id, open: true });
    const peekLabel = fmt(t.peek, { name: a.name });
    const keys = rowKeyProps(onPeek);
    const owed = due(a);
    const rate = rateText(a, currency, t);
    const orders = a.totals?.orders ?? 0;
    // The row's ONE action: pay while money is due, send the link otherwise.
    const action =
      owed > 0 ? (
        <RowAction label={t.pay} icon={IconPayout} onClick={() => setPaying(a)} />
      ) : (
        <RowAction label={t.share} icon={compact ? undefined : IconSend} tone="quiet" onClick={() => setSharing(a)} />
      );
    const pausedChip = a.status === "paused" ? <StatusBadge value="paused" tone="neutral" text={t.paused} /> : null;

    if (compact) {
      return (
        <li key={a.id}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi>{a.name}</bdi>}
              amount={
                <bdi dir="ltr" className={owed > 0 ? undefined : "font-normal text-ink-soft"}>
                  {formatMoney(owed, currency)}
                </bdi>
              }
              status={pausedChip ?? undefined}
              meta={
                <>
                  <bdi>{rate}</bdi> · {countOf("order", orders)}
                </>
              }
              action={action}
              onOpen={onPeek}
              openLabel={peekLabel}
              aria-haspopup="dialog"
              {...keys}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={a.id} onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={peek?.open === true && peek.id === a.id} menu={menu} menuLabel={menuLabel}>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 text-[15px] leading-6 font-medium text-ink">
            <bdi className="truncate">{a.name}</bdi>
            {pausedChip}
          </p>
          <p className="truncate text-xs leading-5 text-ink-soft">
            <bdi dir="ltr">+{a.phone}</bdi> · <bdi dir="ltr">?ref={a.code}</bdi>
          </p>
        </div>
        <div className="text-sm whitespace-nowrap text-ink">
          <bdi>{rate}</bdi>
        </div>
        <div className="text-end text-sm text-ink tabular-nums">{fmt("{n}", { n: orders })}</div>
        <div className="text-end text-sm whitespace-nowrap text-ink-soft tabular-nums">
          <bdi dir="ltr">{formatMoney(a.totals?.pending ?? 0, currency)}</bdi>
        </div>
        <div className={owed > 0 ? "text-end text-[15px] font-semibold whitespace-nowrap text-ink tabular-nums" : "text-end text-sm whitespace-nowrap text-ink-soft tabular-nums"}>
          <bdi dir="ltr">{formatMoney(owed, currency)}</bdi>
        </div>
        <div className="text-end text-sm whitespace-nowrap text-ink-soft tabular-nums">
          <bdi dir="ltr">{formatMoney(a.totals?.paid ?? 0, currency)}</bdi>
        </div>
        <div className="flex items-center justify-end gap-1">
          {action}
          <ItemMenu items={menu} label={menuLabel} />
        </div>
      </DeskRow>
    );
  });

  const owedCount = affiliates.filter((a) => due(a) > 0).length;
  const empty = affiliates.length === 0;
  const peeked = peek ? (affiliates.find((a) => a.id === peek.id) ?? null) : null;

  const addButton = (
    <Button className={`min-h-11 gap-2 ${PILL}`} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  const tools: ContextMenuItem[] = [
    { id: "copy-portal", label: t.copyPortal, icon: IconCopy, onSelect: () => copy(portal, t.portalCopied) },
    { id: "open-portal", label: t.openPortal, icon: IconExternal, onSelect: () => window.open(portal, "_blank", "noopener,noreferrer") },
  ];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the figures and the list: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        // The portal is one address for every affiliate: it waits in «أدوات», not on the page.
        actions={list.data && !empty ? <ItemMenu items={tools} label={t.tools} /> : undefined}
        // With nobody yet the empty state carries the one action; it is not said twice.
        primaryAction={list.data && !empty ? addButton : undefined}
      />

      <DataState
        loading={list.loading}
        // A refresh that failed behind rows already on screen leaves them there.
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={
          <div className="space-y-4">
            <ReportKpiStrip loading count={4} sparkline={false} />
            <ListSkeleton variant={compact ? "card" : "table"} rows={4} />
          </div>
        }
      >
        {empty ? (
          <div className="space-y-4">
            <EmptyState icon={<IconAffiliates aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} action={addButton} />
            <HowItWorks />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ReportKpiStrip sparkline={false}>
              <KpiCard label={t.kpiDue} value={formatMoney(sum(affiliates, "approved"), currency)} hint={owedCount > 0 ? pluralOf(t, "dueCount", owedCount) : undefined} />
              <KpiCard label={t.kpiPending} value={formatMoney(sum(affiliates, "pending"), currency)} />
              <KpiCard label={t.kpiPaid} value={formatMoney(sum(affiliates, "paid"), currency)} />
              <KpiCard label={t.kpiActive} value={fmt("{n}", { n: affiliates.filter((a) => a.status === "active").length })} />
            </ReportKpiStrip>

            <Segmented
              label={t.tabs}
              value={tab}
              onChange={(next) => go({ tab: next })}
              options={[
                { value: "affiliates", label: t.tabAffiliates, count: affiliates.length },
                { value: "commissions", label: t.tabCommissions },
                { value: "payouts", label: t.tabPayouts },
              ]}
              className="sm:max-w-lg"
            />

            {tab === "affiliates" && (
              <>
                <ListToolbar search={{ value: q, onChange: setQ, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
                {shown.length === 0 ? (
                  <EmptyState
                    icon={<IconSearch aria-hidden />}
                    title={t.noMatchTitle}
                    description={t.noMatchHint}
                    action={
                      <Button type="button" variant="outline" className={PILL} onClick={() => setQ("")}>
                        {t.showAll}
                      </Button>
                    }
                  />
                ) : compact ? (
                  <ul aria-label={t.tabAffiliates} className="flex flex-col gap-2.5">
                    {rows}
                  </ul>
                ) : (
                  <DeskList
                    columns={AFFILIATE_COLUMNS}
                    label={t.tabAffiliates}
                    head={[
                      { label: t.colAffiliate },
                      { label: t.colRate },
                      { label: t.colOrders, end: true },
                      { label: t.colPending, end: true },
                      { label: t.colDue, end: true },
                      { label: t.colPaid, end: true },
                      { label: t.colActions, end: true },
                    ]}
                  >
                    {rows}
                  </DeskList>
                )}
              </>
            )}
            {tab === "commissions" && (
              <CommissionsTab affiliates={affiliates} affiliateId={affiliates.some((a) => a.id === focus) ? focus : ""} onAffiliateChange={(id) => go({ affiliate: id })} compact={compact} />
            )}
            {tab === "payouts" && (
              <PayoutsTab
                key={paidCount}
                affiliates={affiliates}
                affiliateId={affiliates.some((a) => a.id === focus) ? focus : (affiliates[0]?.id ?? "")}
                onAffiliateChange={(id) => go({ affiliate: id })}
                onPay={setPaying}
                currency={currency}
                compact={compact}
              />
            )}
          </div>
        )}
      </DataState>

      <AffiliatePreview
        affiliate={peeked}
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        currency={currency}
        storeBase={storeBase}
        onPay={askPay}
        onShare={askShare}
        onEdit={askEdit}
        onCommissions={showCommissions}
        onPayouts={showPayouts}
      />

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
          setPaidCount((n) => n + 1);
          refresh();
        }}
      />
      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={removing ? fmt(t.removeTitle, { name: removing.affiliate.name }) : ""}
        description={t.removeDescription}
        confirmLabel={t.removeConfirm}
        busyLabel={t.removing}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={() => (removing ? confirmRemove(removing.affiliate) : undefined)}
      />
    </div>
  );
}

/** The four steps, shown while there is nobody to list yet. */
function HowItWorks() {
  const t = useT(AFFILIATE_STRINGS);
  const headingId = useId();
  const steps = [
    [t.step1, t.step1Desc],
    [t.step2, t.step2Desc],
    [t.step3, t.step3Desc],
    [t.step4, t.step4Desc],
  ] as const;
  return (
    <section
      aria-labelledby={headingId}
      data-slot="card"
      className="rounded-[var(--radius-card)] bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <h2 id={headingId} className="text-[15px] font-semibold text-ink">
        {t.howTitle}
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, description], index) => (
          <li key={title} className="flex gap-3">
            <span
              data-slot="affiliate-step"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-dark tabular-nums dark:text-primary"
            >
              {fmt("{n}", { n: index + 1 })}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{title}</span>
              <span className="block text-[13px] leading-5 text-ink-soft">{description}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One figure of the preview: its name over the number. */
function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div data-slot="affiliate-figure" className="rounded-2xl bg-paper-sunken px-3 py-2.5">
      <p className="truncate text-xs leading-5 text-ink-soft">{label}</p>
      <p className={strong ? "text-[17px] leading-6 font-semibold text-ink tabular-nums" : "text-[15px] leading-6 font-medium text-ink tabular-nums"}>
        <bdi dir="ltr">{value}</bdi>
      </p>
    </div>
  );
}

/**
 * Quick Look for an affiliate: who they are and what they earn, their four
 * numbers, their two links ready to copy, and every action — pay, send the
 * link, edit, their commissions and payments. A bottom sheet on a phone, a
 * panel on the end edge from 640px; the list stays behind it.
 */
function AffiliatePreview({
  affiliate,
  open,
  onOpenChange,
  currency,
  storeBase,
  onPay,
  onShare,
  onEdit,
  onCommissions,
  onPayouts,
}: {
  affiliate: Affiliate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  storeBase: string;
  onPay: (a: Affiliate) => void;
  onShare: (a: Affiliate) => void;
  onEdit: (a: Affiliate) => void;
  onCommissions: (a: Affiliate) => void;
  onPayouts: (a: Affiliate) => void;
}) {
  const t = useT(AFFILIATE_STRINGS);
  if (!affiliate) return null;
  const a = affiliate;
  const owed = due(a);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="auto-end"
      title={<bdi>{a.name}</bdi>}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge value={a.status} tone={a.status === "active" ? "success" : "neutral"} text={a.status === "active" ? t.active : t.paused} />
          <bdi>{rateText(a, currency, t)}</bdi>
        </span>
      }
      footer={
        <>
          <Button type="button" variant="outline" className={`gap-2 ${PILL}`} onClick={() => onEdit(a)}>
            <IconEdit className="size-4" aria-hidden />
            {t.edit}
          </Button>
          {owed > 0 ? (
            <Button type="button" className={`gap-2 ${PILL}`} onClick={() => onPay(a)}>
              <IconPayout className="size-4" weight="bold" aria-hidden />
              {fmt(t.payAmount, { amount: formatMoney(owed, currency) })}
            </Button>
          ) : (
            <Button type="button" className={`gap-2 ${PILL}`} onClick={() => onShare(a)}>
              <IconSend className="size-4 rtl:-scale-x-100" weight="bold" aria-hidden />
              {t.share}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <ContactActions phone={`+${a.phone}`} name={a.name} />

        <section>
          <h3 className="mb-2 text-[13px] leading-5 font-semibold text-ink-soft">{t.qlTotals}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Figure label={t.colDue} value={formatMoney(owed, currency)} strong />
            <Figure label={t.colPending} value={formatMoney(a.totals?.pending ?? 0, currency)} />
            <Figure label={t.colPaid} value={formatMoney(a.totals?.paid ?? 0, currency)} />
            <Figure label={t.colOrders} value={fmt("{n}", { n: a.totals?.orders ?? 0 })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-4" onClick={() => onCommissions(a)}>
              <IconChecklist className="size-4" aria-hidden />
              {t.viewCommissions}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-4" onClick={() => onPayouts(a)}>
              <IconReceipt className="size-4" aria-hidden />
              {t.viewPayouts}
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.qlLinks}</h3>
          <ShareRow label={t.theirLink} hint={t.theirLinkHint} value={`${storeBase}?ref=${a.code}`} copyLabel={t.copyLink} />
          <ShareRow label={t.portalLink} hint={fmt(t.portalLinkHint, { phone: `+${a.phone}` })} value={`${storeBase}/affiliate`} copyLabel={t.copyLink} />
          {owed > 0 && (
            <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-4" onClick={() => onShare(a)}>
              <IconSend className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.share}
            </Button>
          )}
        </section>

        {a.notes && (
          <section>
            <h3 className="mb-1 text-[13px] leading-5 font-semibold text-ink-soft">{t.qlNote}</h3>
            <p dir="auto" className="text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-ink">
              {a.notes}
            </p>
          </section>
        )}

        <p className="text-xs leading-5 text-ink-soft">{fmt(t.qlSince, { date: formatDate(a.createdAt) })}</p>
      </div>
    </Sheet>
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
  const id = useId();
  return (
    <div className="w-full sm:w-64">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-full px-4 text-base md:text-sm">
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {affiliates.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

type StatusChip = "all" | CommissionStatus;

function CommissionsTab({
  affiliates,
  affiliateId,
  onAffiliateChange,
  compact,
}: {
  affiliates: Affiliate[];
  affiliateId: string;
  onAffiliateChange: (id: string) => void;
  compact: boolean;
}) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const [status, setStatus] = useState<StatusChip>("all");
  const list = useAsync(
    () => affiliatesCommissions(apiClient, workspaceId, { affiliateId: affiliateId || undefined, status: status === "all" ? undefined : status, limit: 200 }),
    [workspaceId, affiliateId, status]
  );
  const filtered = affiliateId !== "" || status !== "all";
  const commissions = list.data ?? [];

  const chips: ChipItem<StatusChip>[] = [
    { value: "all", label: t.anyStatus },
    { value: "approved", label: t.status_approved },
    { value: "pending", label: t.status_pending },
    { value: "paid", label: t.status_paid },
    { value: "void", label: t.status_void },
  ];

  const rows = commissions.map((c: AffiliateCommission) => {
    const to = `/orders/${c.orderId}`;
    const badge = <StatusBadge value={c.status} tone={STATUS_TONE[c.status]} text={t[`status_${c.status}`]} />;
    const amount = <bdi dir="ltr">{formatMoney(c.amount, c.currency)}</bdi>;
    if (compact) {
      return (
        <li key={c.id}>
          <ListRowCard
            title={<bdi dir="ltr">{c.orderNumber}</bdi>}
            amount={amount}
            status={badge}
            meta={<bdi>{c.affiliateName}</bdi>}
            footer={
              <>
                <span className="text-xs leading-5 text-ink-soft">{formatDate(c.orderedAt)}</span>
                <span className="text-xs leading-5 text-ink-soft tabular-nums">{fmt(t.baseOf, { amount: formatMoney(c.baseAmount, c.currency) })}</span>
              </>
            }
            onOpen={() => navigate(to)}
            openLabel={fmt(t.openOrder, { number: c.orderNumber })}
          />
        </li>
      );
    }
    return (
      <DeskRow key={c.id}>
        <div>
          <ViewLink to={to} aria-label={fmt(t.openOrder, { number: c.orderNumber })} className={LINK}>
            <bdi dir="ltr">{c.orderNumber}</bdi>
          </ViewLink>
        </div>
        <div className="min-w-0 truncate text-ink">
          <bdi>{c.affiliateName}</bdi>
        </div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{formatDate(c.orderedAt)}</div>
        <div className="text-end whitespace-nowrap text-ink-soft tabular-nums">
          <bdi dir="ltr">{formatMoney(c.baseAmount, c.currency)}</bdi>
        </div>
        <div className="text-end font-semibold whitespace-nowrap text-ink tabular-nums">{amount}</div>
        <div className="flex justify-end">{badge}</div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <AffiliateSelect affiliates={affiliates} value={affiliateId} onChange={onAffiliateChange} label={t.affiliateFilter} allLabel={t.anyAffiliate} />
      <ChipRow items={chips} value={status} onChange={setStatus} label={t.statusFilter} collapseEmpty={false} />
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}>
        {commissions.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.emptyCommissionsFiltered}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className={PILL}
                  onClick={() => {
                    onAffiliateChange("");
                    setStatus("all");
                  }}
                >
                  {t.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<IconChecklist aria-hidden />} title={t.emptyCommissions} description={t.emptyCommissionsHint} />
          )
        ) : compact ? (
          <ul aria-label={t.tabCommissions} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={COMMISSION_COLUMNS}
            label={t.tabCommissions}
            head={[{ label: t.colOrder }, { label: t.colAffiliate }, { label: t.colDate }, { label: t.colBase, end: true }, { label: t.colAmount, end: true }, { label: t.colStatus, end: true }]}
          >
            {rows}
          </DeskList>
        )}
      </DataState>
    </div>
  );
}

function PayoutsTab({
  affiliates,
  affiliateId,
  onAffiliateChange,
  onPay,
  currency,
  compact,
}: {
  affiliates: Affiliate[];
  affiliateId: string;
  onAffiliateChange: (id: string) => void;
  onPay: (a: Affiliate) => void;
  currency: string;
  compact: boolean;
}) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => (affiliateId ? affiliatesPayouts(apiClient, workspaceId, affiliateId) : Promise.resolve([])), [workspaceId, affiliateId]);
  // Stored as a key by this screen; anything else (older rows, another client) is shown as written.
  const methodLabel = (method: string | null) => (method && (PAYOUT_METHODS as readonly string[]).includes(method) ? t[`method_${method as PayoutMethod}`] : method || "—");
  const selected = affiliates.find((a) => a.id === affiliateId) ?? null;
  const payouts = list.data ?? [];

  if (!selected) return <EmptyState icon={<IconReceipt aria-hidden />} title={t.pickAffiliate} />;

  const owed = due(selected);
  const payButton =
    owed > 0 ? (
      <Button type="button" className={`min-h-11 gap-2 ${PILL}`} onClick={() => onPay(selected)}>
        <IconPayout className="size-4" weight="bold" aria-hidden />
        {fmt(t.payAmount, { amount: formatMoney(owed, currency) })}
      </Button>
    ) : undefined;

  const rows = payouts.map((p: AffiliatePayout) => {
    const amount = <bdi dir="ltr">{formatMoney(p.amount, p.currency)}</bdi>;
    if (compact) {
      return (
        <li key={p.id}>
          <ListRowCard
            title={formatDate(p.paidAt)}
            amount={amount}
            meta={methodLabel(p.method)}
            footer={
              p.note ? (
                <p dir="auto" className="basis-full text-[13px] leading-5 wrap-anywhere text-ink-soft">
                  {p.note}
                </p>
              ) : undefined
            }
          />
        </li>
      );
    }
    return (
      <DeskRow key={p.id}>
        <div className="whitespace-nowrap text-ink">{formatDate(p.paidAt)}</div>
        <div className="whitespace-nowrap text-ink-soft">{methodLabel(p.method)}</div>
        <div className="min-w-0 truncate text-ink-soft">
          <bdi dir="auto">{p.note || "—"}</bdi>
        </div>
        <div className="text-end font-semibold whitespace-nowrap text-ink tabular-nums">{amount}</div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AffiliateSelect affiliates={affiliates} value={affiliateId} onChange={onAffiliateChange} label={t.payoutsFor} />
        {payouts.length > 0 && payButton}
      </div>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={3} />}>
        {payouts.length === 0 ? (
          <EmptyState icon={<IconReceipt aria-hidden />} title={fmt(t.emptyPayouts, { name: selected.name })} description={t.emptyPayoutsHint} action={payButton} />
        ) : compact ? (
          <ul aria-label={t.tabPayouts} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList columns={PAYOUT_COLUMNS} label={t.tabPayouts} head={[{ label: t.colDate }, { label: t.colMethod }, { label: t.colNote }, { label: t.colAmount, end: true }]}>
            {rows}
          </DeskList>
        )}
      </DataState>
    </div>
  );
}
