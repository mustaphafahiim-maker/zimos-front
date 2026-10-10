import { useMemo, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  shopperAccountsGet,
  storeCreditCustomerGet,
  storeCreditList,
  storeCreditSettingsSave,
  type StoreCreditHolder,
  type StoreCreditTransactionKind,
} from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCoins, IconCopy, IconPeople, IconPhone, IconSearch, IconUser, IconWhatsApp } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { QuickLook } from "@/components/QuickLook";
import { ReportKpiStrip } from "@/components/report/ReportKpiStrip";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useCommon, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { dialablePhone, orderTelHref } from "@/lib/phoneLinks";
import { ProgrammeNote } from "@/pages/loyalty/programmeKit";
import { RewardsTabs } from "@/pages/loyalty/RewardsTabs";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { STORE_CREDIT_KIND_KEY, STORE_CREDIT_STRINGS } from "./storeCreditStrings";

/** The API lists at most this many holders (the biggest balances first). */
const LIST_CAP = 500;
/** A reason on these was typed by the team; on the others it is the system's own remark and stays out. */
const STAFF_NOTE_KINDS: ReadonlySet<StoreCreditTransactionKind> = new Set(["grant", "adjust"]);

const COLUMNS = "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_max-content]";

/**
 * Customers → Store credit balances (GET customers.view, the
 * switch discounts.manage): who holds credit and how much, what the store
 * owes its customers in all, and whether checkout takes credit. A row opens a
 * preview with the customer's credit history; credit is given and taken on
 * the customer's page, one tap from there.
 */
export function StoreCreditPage() {
  const t = useT(STORE_CREDIT_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const copy = useCopy();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  // Shown at once from the last visit, refreshed behind.
  const overview = useCachedAsync(`store-credit:${workspaceId}`, () => storeCreditList(apiClient, workspaceId), [workspaceId]);
  // Spending credit needs a signed-in shopper: say so when the store has no accounts.
  // A role that may not read that setting (website.edit) simply sees no hint.
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  const [q, setQ] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // The customer being previewed stays here while the preview closes, so it does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);

  const data = overview.data;
  const currency = data?.currency ?? "EGP";
  const customers = data?.customers;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = customers ?? [];
    if (!needle) return all;
    return all.filter((c) => [c.fullName, c.phone, c.email].some((v) => v && v.toLowerCase().includes(needle)));
  }, [customers, q]);

  async function setSpending(enabled: boolean, undoable = true) {
    if (!data || switching) return;
    setSwitching(true);
    setSwitchError(null);
    // The switch moves at once and goes back if the save is refused.
    overview.setData({ ...data, spendingEnabled: enabled });
    try {
      const next = await storeCreditSettingsSave(apiClient, workspaceId, enabled);
      overview.setData({ ...data, spendingEnabled: next.spendingEnabled });
      const message = next.spendingEnabled ? t.spendSavedOn : t.spendSavedOff;
      if (undoable) toast.undo(message, () => setSpending(!next.spendingEnabled, false));
      else toast.success(message);
    } catch (err) {
      overview.setData({ ...data, spendingEnabled: !enabled });
      setSwitchError(errorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  const nameOf = (c: StoreCreditHolder) => c.fullName || t.noName;

  function menuFor(c: StoreCreditHolder): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconUser, onSelect: () => navigate(`/customers/${c.customerId}`) }];
    // A masked number is not one to dial or copy.
    const number = dialablePhone(c.phone);
    const whatsapp = number ? toWhatsAppNumber(number) : null;
    if (number) {
      items.push({
        id: "call",
        label: t.menuCall,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = orderTelHref(number);
        },
      });
    }
    if (whatsapp) {
      items.push({
        id: "whatsapp",
        label: t.menuWhatsapp,
        icon: IconWhatsApp,
        onSelect: () => {
          window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
        },
      });
    }
    if (number) items.push({ id: "copy", label: t.menuCopy, icon: IconCopy, separatorBefore: true, onSelect: () => copy(number, t.copied) });
    return items;
  }

  const rows = shown.map((c) => {
    const name = nameOf(c);
    const menu = menuFor(c);
    const menuLabel = fmt(t.menuLabel, { name });
    const onPeek = () => setPeek({ id: c.customerId, open: true });
    const peekLabel = fmt(t.peek, { name });
    const keys = rowKeyProps(onPeek, () => navigate(`/customers/${c.customerId}`));
    const number = dialablePhone(c.phone);
    const contact = c.phone || c.email || "";
    const balance = (
      <bdi dir="ltr" data-vt-part="amount">
        {formatMoney(c.balance, currency)}
      </bdi>
    );

    if (compact) {
      return (
        <li key={c.customerId}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi data-vt-part="title">{name}</bdi>}
              amount={balance}
              meta={contact ? <bdi dir="ltr">{contact}</bdi> : undefined}
              action={number ? <ContactActions phone={number} name={c.fullName} variant="icon" /> : undefined}
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
      <DeskRow
        key={c.customerId}
        onOpen={onPeek}
        openLabel={peekLabel}
        keyProps={keys}
        current={peek?.open === true && peek.id === c.customerId}
        menu={menu}
        menuLabel={menuLabel}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi data-vt-part="title">{name}</bdi>
          </p>
          {contact && (
            <p className="truncate text-xs leading-5 text-ink-soft">
              <bdi dir="ltr">{contact}</bdi>
            </p>
          )}
        </div>
        <div className="text-end text-[15px] font-semibold whitespace-nowrap text-ink tabular-nums">{balance}</div>
        <div className="flex min-w-20 items-center justify-end">{number && <ContactActions phone={number} name={c.fullName} variant="icon" />}</div>
      </DeskRow>
    );
  });

  const peeked = peek ? ((customers ?? []).find((c) => c.customerId === peek.id) ?? null) : null;

  return (
    <div>
      {/* A phone keeps the first screen for the figures and the list: the sentence is said by the switch's group. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />
      <RewardsTabs active="credit" />

      <DataState
        loading={overview.loading}
        // A refresh that failed behind figures already on screen leaves them there.
        error={data ? null : overview.error}
        onRetry={() => void overview.refresh()}
        skeleton={
          <div className="space-y-4">
            <ReportKpiStrip loading count={2} sparkline={false} />
            <div className="flex min-h-16 items-center justify-between gap-4 rounded-[1.25rem] bg-paper-raised px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line">
              <SkeletonBar className="h-3 w-2/5" />
              <SkeletonBar className="h-7 w-12 shrink-0 rounded-full" />
            </div>
            <ListSkeleton variant={compact ? "card" : "table"} rows={5} />
          </div>
        }
      >
        {data && (
          <div className="max-w-4xl space-y-4">
            <ReportKpiStrip sparkline={false}>
              <KpiCard label={t.statOutstanding} value={formatMoney(data.outstanding, currency)} icon={<IconCoins aria-hidden />} />
              <KpiCard
                label={t.statCustomers}
                value={`${new Intl.NumberFormat(getIntlLocale()).format(data.customers.length)}${data.customers.length >= LIST_CAP ? "+" : ""}`}
                icon={<IconPeople aria-hidden />}
              />
            </ReportKpiStrip>

            <SettingsGroup description={phone ? t.customerGets : undefined}>
              <SettingsSwitch
                checked={data.spendingEnabled}
                onChange={(next) => void setSpending(next)}
                label={t.spendTitle}
                hint={data.spendingEnabled ? t.spendHintOn : t.spendHintOff}
                busy={switching}
              />
            </SettingsGroup>
            {switchError && <Alert variant="danger">{switchError}</Alert>}

            {accounts.data && !accounts.data.enabled && data.spendingEnabled && (
              <ProgrammeNote to="/store-settings/customer-accounts" action={t.accountsOffAction}>
                {t.accountsOff}
              </ProgrammeNote>
            )}

            {data.customers.length === 0 ? (
              <EmptyState
                icon={<IconCoins aria-hidden />}
                title={t.emptyTitle}
                description={t.emptyHint}
                action={
                  <Button asChild className="rounded-full px-5">
                    <ViewLink to="/customers">{t.openCustomers}</ViewLink>
                  </Button>
                }
              />
            ) : (
              <>
                <ListToolbar search={{ value: q, onChange: setQ, placeholder: t.searchPlaceholder, label: t.searchLabel }} />

                {shown.length === 0 ? (
                  <EmptyState
                    icon={<IconSearch aria-hidden />}
                    title={t.noMatchTitle}
                    description={t.noMatchHint}
                    action={
                      <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setQ("")}>
                        {t.showAll}
                      </Button>
                    }
                  />
                ) : compact ? (
                  <ul aria-label={t.statCustomers} className="flex flex-col gap-2.5">
                    {rows}
                  </ul>
                ) : (
                  <DeskList columns={COLUMNS} label={t.statCustomers} head={[{ label: t.colCustomer }, { label: t.colBalance, end: true }, { label: t.colContact, end: true }]}>
                    {rows}
                  </DeskList>
                )}
                {data.customers.length >= LIST_CAP && <p className="px-1 text-[13px] leading-5 text-ink-soft">{fmt(t.capped, { n: LIST_CAP })}</p>}
              </>
            )}
          </div>
        )}
      </DataState>

      <QuickLook
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        title={peeked ? <bdi>{nameOf(peeked)}</bdi> : ""}
        subtitle={peeked && (peeked.phone || peeked.email) ? <bdi dir="ltr">{peeked.phone || peeked.email}</bdi> : undefined}
        to={peeked ? `/customers/${peeked.customerId}` : "/customers"}
        openLabel={t.qlOpen}
        actions={peeked && dialablePhone(peeked.phone) ? <ContactActions phone={dialablePhone(peeked.phone)} name={peeked.fullName} /> : undefined}
      >
        {peeked && <HolderPreview key={peeked.customerId} holder={peeked} currency={currency} />}
      </QuickLook>
    </div>
  );
}

/** Inside the preview: the balance, then the customer's credit history (its own request, with its own states). */
function HolderPreview({ holder, currency }: { holder: StoreCreditHolder; currency: string }) {
  const t = useT(STORE_CREDIT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const account = useAsync(() => storeCreditCustomerGet(apiClient, workspaceId, holder.customerId), [workspaceId, holder.customerId]);
  const history = account.data?.history ?? [];
  const unit = account.data?.currency ?? currency;

  return (
    <div className="space-y-5">
      <div data-slot="credit-balance" className="rounded-2xl bg-paper-sunken px-4 py-4">
        <p className="text-xs leading-5 font-medium text-ink-soft">{t.colBalance}</p>
        <p className="text-[28px] leading-9 font-semibold text-ink tabular-nums">
          <bdi dir="ltr">{formatMoney(account.data?.balance ?? holder.balance, unit)}</bdi>
        </p>
        <p className="mt-1 text-[13px] leading-5 text-ink-soft">{t.qlHint}</p>
      </div>

      <section>
        <h3 className="mb-1 text-[13px] leading-5 font-semibold text-ink-soft">{t.history}</h3>
        {account.loading ? (
          <div role="status" aria-busy="true">
            <span className="sr-only">{common.loading}</span>
            <div aria-hidden className="space-y-4 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <SkeletonBar className="h-3 w-2/5" />
                  <SkeletonBar className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : account.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 py-2">
            <p className="min-w-0 flex-1 text-sm text-danger">{t.qlFailed}</p>
            <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void account.refresh()}>
              {common.retry}
            </Button>
          </div>
        ) : history.length === 0 ? (
          <p className="py-2 text-sm text-ink-soft">{t.historyEmpty}</p>
        ) : (
          <ul>
            {history.map((row) => {
              const change = parseMoney(row.amount);
              const money = formatMoney(Math.abs(change), row.currency || unit);
              return (
                <li key={row.id} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-medium text-ink">{t[STORE_CREDIT_KIND_KEY[row.kind]] ?? row.kind}</p>
                    {STAFF_NOTE_KINDS.has(row.kind) && row.note && (
                      <p dir="auto" className="text-[13px] leading-5 wrap-anywhere text-ink-soft">
                        {row.note}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-2 text-xs leading-5 text-ink-soft">
                      <span>{formatDate(row.createdAt)}</span>
                      {row.orderId && (
                        <ViewLink
                          to={`/orders/${row.orderId}`}
                          className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {t.qlOrder}
                        </ViewLink>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className={change > 0 ? "text-sm font-semibold text-success tabular-nums" : "text-sm font-semibold text-ink tabular-nums"}>
                      <bdi dir="ltr">
                        {change > 0 ? "+" : change < 0 ? "−" : ""}
                        {money}
                      </bdi>
                    </p>
                    <p className="text-xs leading-5 text-ink-soft tabular-nums">
                      {fmt(t.qlAfter, { amount: formatMoney(row.balanceAfter, row.currency || unit) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
