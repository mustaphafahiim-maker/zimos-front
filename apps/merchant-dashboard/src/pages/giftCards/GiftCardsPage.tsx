import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Ticket, X } from "lucide-react";
import { Button, Input } from "@store-builder/ui";
import { giftCardsList, type GiftCard, type GiftCardIssued, type GiftCardState } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { formatDate, formatMoney } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { isPermissionError } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { IssueGiftCardDialog, IssuedCodeDialog } from "./IssueGiftCardDialog";
import { GiftCardSettingsCard } from "./GiftCardSettingsCard";
import { GIFT_CARD_STRINGS, STATE_KEY, STATE_TONE } from "./giftCardStrings";

type Filter = "all" | GiftCardState;

/**
 * Marketing → Gift cards (handoff 189, discounts.manage): every card with its
 * balance, filtered by what it can do now and searched by code, last 4 or
 * email; "Issue gift card" shows the new code once. Below: the products sold
 * as gift cards, and the storefront page where shoppers check a balance.
 */
export function GiftCardsPage() {
  const t = useT(GIFT_CARD_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const searchId = useId();

  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  // The search runs once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const list = useCursorList<GiftCard>(
    async (cursor) => {
      const page = await giftCardsList(apiClient, workspaceId, {
        state: filter === "all" ? undefined : filter,
        q: q || undefined,
        before: cursor,
        limit: 50,
      });
      return { items: page.giftCards, nextCursor: page.nextBefore };
    },
    [workspaceId, filter, q]
  );

  const [issueOpen, setIssueOpen] = useState(false);
  const [issued, setIssued] = useState<{ card: GiftCardIssued; emailedTo: string | null } | null>(null);

  const filtered = filter !== "all" || q !== "";
  const tabs: FilterTab<Filter>[] = [
    { value: "all", label: t.filterAll },
    { value: "active", label: t.state_active },
    { value: "empty", label: t.state_empty },
    { value: "expired", label: t.state_expired },
    { value: "disabled", label: t.state_disabled },
  ];

  const stateBadge = (card: GiftCard) => (
    <StatusBadge value={card.state} tone={STATE_TONE[card.state]} text={t[STATE_KEY[card.state]]} />
  );

  const columns: Column<GiftCard>[] = [
    {
      key: "card",
      header: t.colCard,
      cell: (card) => (
        <span className="flex min-w-0 flex-col">
          <bdi dir="ltr" className="font-mono font-semibold text-ink">
            {fmt(t.cardName, { last4: card.last4 })}
          </bdi>
          <span className="truncate text-xs font-normal text-ink-soft">
            <bdi>{card.recipientName || card.recipientEmail || (card.source === "order" ? t.sourceOrder : t.noRecipient)}</bdi>
          </span>
        </span>
      ),
    },
    {
      key: "balance",
      header: t.colBalance,
      align: "end",
      cell: (card) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className="font-semibold text-ink">{formatMoney(card.balanceAmount, card.currency)}</span>
          <span className="text-xs text-ink-soft"> / {formatMoney(card.initialAmount, card.currency)}</span>
        </span>
      ),
    },
    { key: "state", header: t.colState, cell: stateBadge },
    {
      key: "expires",
      header: t.colExpires,
      cell: (card) => <span className="whitespace-nowrap text-ink-soft">{card.expiresAt ? formatDate(card.expiresAt) : t.noExpiry}</span>,
    },
    {
      key: "created",
      header: t.colCreated,
      phoneHidden: true,
      cell: (card) => <span className="whitespace-nowrap text-ink-soft">{formatDate(card.createdAt)}</span>,
    },
  ];

  const issueButton = (
    <Button type="button" className="min-h-11" onClick={() => setIssueOpen(true)}>
      <Plus className="size-4" aria-hidden />
      {t.issue}
    </Button>
  );

  // No discounts.manage: the page says so, and offers nothing it would refuse.
  const denied = isPermissionError(list.error);
  const balancePage = currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/gift-card` : null;

  return (
    <div>
      <PageHeader title={t.title} description={t.description} actions={denied ? undefined : issueButton} />

      <DataState loading={false} error={list.error && list.items.length === 0 ? list.error : null} onRetry={list.reload}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-64">
              <label htmlFor={searchId} className="sr-only">
                {t.searchLabel}
              </label>
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
              <Input
                id={searchId}
                type="search"
                dir="auto"
                autoComplete="off"
                maxLength={100}
                value={draft}
                placeholder={t.searchPlaceholder}
                onChange={(e) => setDraft(e.target.value)}
                className="h-11 ps-9 pe-11"
              />
              {draft && (
                <button
                  type="button"
                  aria-label={t.clearSearch}
                  onClick={() => setDraft("")}
                  className="absolute end-0 top-0 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <div className="max-w-full overflow-x-auto">
              <FilterTabs
                tabs={tabs}
                value={filter}
                onChange={setFilter}
                label={t.filterLabel}
                className="flex-nowrap"
                buttonClassName="min-h-11 whitespace-nowrap sm:min-h-0"
              />
            </div>
          </div>

          {list.loading ? (
            <DataState loading error={null}>
              {null}
            </DataState>
          ) : list.items.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<Search aria-hidden />}
                title={t.noMatchTitle}
                description={t.noMatchHint}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setDraft("");
                      setQ("");
                      setFilter("all");
                    }}
                  >
                    {t.showAll}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={<Ticket aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={issueButton} />
            )
          ) : (
            <div className="md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line">
              <DataTable
                columns={columns}
                rows={list.items}
                rowKey={(card) => card.id}
                onRowClick={(card) => navigate(`/gift-cards/${card.id}`)}
                minWidth="40rem"
              />
            </div>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />

          <GiftCardSettingsCard />

          {balancePage && (
            <section className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
              <h2 className="text-sm font-semibold text-ink">{t.balanceLinkTitle}</h2>
              <p className="mt-0.5 text-xs text-ink-soft">{t.balanceLinkHint}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-paper-sunken px-3 py-1.5">
                <bdi dir="ltr" className="min-w-0 truncate text-sm text-ink">
                  {balancePage}
                </bdi>
                <CopyButton value={balancePage} className="min-h-11" />
              </div>
            </section>
          )}
        </div>
      </DataState>

      <IssueGiftCardDialog
        open={issueOpen}
        currency={currency}
        onClose={() => setIssueOpen(false)}
        onIssued={(card, emailedTo) => {
          setIssueOpen(false);
          setIssued({ card, emailedTo });
          // A new card is active: it joins the list when the list shows active cards.
          if (!q && (filter === "all" || filter === "active")) list.setItems((prev) => [card.giftCard, ...prev.filter((c) => c.id !== card.giftCard.id)]);
        }}
      />
      <IssuedCodeDialog issued={issued?.card ?? null} emailedTo={issued?.emailedTo ?? null} onClose={() => setIssued(null)} />
    </div>
  );
}
