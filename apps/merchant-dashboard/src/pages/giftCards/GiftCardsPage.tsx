import { useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { giftCardsList, type GiftCard, type GiftCardIssued, type GiftCardState } from "@store-builder/api-client";
import { IconLink, IconPlus, IconSearch, IconTicket } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { storeUrl } from "@/lib/storeAddress";
import { isPermissionError } from "@/lib/errors";
import { useViewNavigate } from "@/lib/viewTransition";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { CopyButton } from "@/components/CopyButton";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { OffersHub } from "@/pages/offers/hub/OffersHub";
import { GiftCardCards, GiftCardsTable } from "@/pages/offers/hub/GiftCardsList";
import { IssueGiftCardDialog, IssuedCodeDialog } from "./IssueGiftCardDialog";
import { GiftCardSettingsCard } from "./GiftCardSettingsCard";
import { GIFT_CARD_STRINGS } from "./giftCardStrings";

type Filter = "all" | GiftCardState;

/**
 * The gift cards tab of «العروض والخصومات» (/gift-cards* discounts.manage): every card with its balance — searched by code, last 4 or
 * email, and narrowed by what it can do now through the chips — as a table
 * from md up and cards on a phone. A row opens the card's own page. «اعمل
 * كارت هدية» opens a sheet with the card as the recipient gets it, then shows
 * the new code once.
 *
 * Under the list, folded: the products sold as gift cards, and the storefront
 * page where shoppers check a balance (its link copies without opening).
 */
export function GiftCardsPage() {
  const t = useT(GIFT_CARD_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const errorMessage = useErrorMessage();
  const desktop = useIsDesktop();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  // The field never waits; the request runs once typing pauses.
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
  // No counts: the list is filtered by the server, a page at a time.
  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll },
    { value: "active", label: t.state_active },
    { value: "empty", label: t.state_empty },
    { value: "expired", label: t.state_expired },
    { value: "disabled", label: t.state_disabled },
  ];

  const issueButton = (
    <Button type="button" className="min-h-11 rounded-full px-5 md:min-h-9" onClick={() => setIssueOpen(true)}>
      <IconPlus className="size-4" aria-hidden />
      {t.issue}
    </Button>
  );

  // No discounts.manage: the page says so, and offers nothing it would refuse.
  const denied = isPermissionError(list.error);
  const balancePage = currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/gift-card` : null;
  const open = (card: GiftCard) => navigate(`/gift-cards/${card.id}`);

  return (
    <OffersHub tab="giftCards" primaryAction={denied ? undefined : issueButton}>
      <DataState loading={false} error={list.error && list.items.length === 0 ? list.error : null} onRetry={list.reload}>
        <div className="flex flex-col gap-3">
          <ListToolbar search={{ value: draft, onChange: setDraft, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
          <ChipRow items={chips} value={filter} onChange={setFilter} label={t.filterLabel} />

          <div className="min-w-0">
            {list.loading ? (
              <ListSkeleton rows={5} />
            ) : list.items.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<IconSearch aria-hidden />}
                  title={t.noMatchTitle}
                  description={t.noMatchHint}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-full px-5"
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
                <EmptyState icon={<IconTicket aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={issueButton} />
              )
            ) : (
              <>
                {/* A later page that failed: what is on screen stays, with the reason and the way to try again. */}
                {list.error != null && (
                  <Alert variant="danger" className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <span>{errorMessage(list.error)}</span>
                  </Alert>
                )}
                {desktop ? <GiftCardsTable rows={list.items} onOpen={open} /> : <GiftCardCards rows={list.items} onOpen={open} />}
              </>
            )}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </div>

          {/* Used rarely: one row each until opened. */}
          <AccordionGroup className="mt-3">
            <GiftCardSettingsCard />
            {balancePage && (
              <AccordionSection
                title={t.balanceLinkTitle}
                icon={IconLink}
                persistKey="gift-cards:balance-link"
                summary={<bdi dir="ltr">{balancePage}</bdi>}
                actions={<CopyButton value={balancePage} iconOnly className="size-9" />}
              >
                <p className="text-[13px] leading-5 text-ink-soft">{t.balanceLinkHint}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-paper-sunken px-3.5 py-1.5">
                  <bdi dir="ltr" className="min-w-0 truncate text-sm text-ink">
                    {balancePage}
                  </bdi>
                  <CopyButton value={balancePage} className="min-h-11" />
                </div>
              </AccordionSection>
            )}
          </AccordionGroup>
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
    </OffersHub>
  );
}
