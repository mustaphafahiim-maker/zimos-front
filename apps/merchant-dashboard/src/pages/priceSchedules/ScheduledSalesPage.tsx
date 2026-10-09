import { useMemo, useState } from "react";
import { IconArrowOut, IconPlus, IconSchedule, IconSearch } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { PRICE_SCHEDULE_STATUSES, priceSchedulesList, type PriceSchedule, type PriceScheduleStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { canManageProducts } from "@/lib/productAccess";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { ChipRow, ListSkeleton, type ChipItem } from "@/components/list";
import { OfferList, OfferPage, OfferRow, TOUCH_BUTTON } from "@/pages/offers/OfferKit";
import { PRICE_SCHEDULE_STRINGS, SCHEDULE_STATUS_KEY, SCHEDULE_STATUS_TONE } from "./priceScheduleStrings";
import { changeSummary, targetSummary } from "./scheduleText";
import { formatStoreDateTime } from "./storeTime";

type Filter = "all" | PriceScheduleStatus;

/**
 * Offers → «التخفيضات المجدولة» / Scheduled sales (handoff 227, read
 * products.view): every sale with its status chip, its discount and what it
 * is on in one line, and its window on the store's clock. A row opens the
 * sale — a form while it has not started, its prices once it has.
 */
export function ScheduledSalesPage() {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageProducts(currentWorkspace?.role);
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const zone = currentWorkspace?.timezone ?? null;

  const [filter, setFilter] = useState<Filter>("all");
  // Each status keeps its own copy for the session: going back to a chip shows it at once, and it is read again behind.
  const list = useCachedAsync(
    `price-schedules:${workspaceId}:${filter}`,
    () => priceSchedulesList(apiClient, workspaceId, filter === "all" ? undefined : filter),
    [workspaceId, filter]
  );
  // Only to name a sale's collection; the list reads fine without it.
  const collections = useAsync(() => apiClient.listCollections(workspaceId).catch(() => []), [workspaceId]);
  const collectionNames = useMemo(() => new Map((collections.data ?? []).map((c) => [c.id, c.name])), [collections.data]);
  const sales = list.data ?? [];

  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll },
    ...PRICE_SCHEDULE_STATUSES.map((status) => ({ value: status as Filter, label: t[SCHEDULE_STATUS_KEY[status]] })),
  ];

  const newButton = (
    <Button asChild className={TOUCH_BUTTON}>
      <ViewLink to="/offers/scheduled-sales/new">
        <IconPlus className="size-4" weight="bold" aria-hidden />
        {t.newSale}
      </ViewLink>
    </Button>
  );
  const failed = Boolean(list.error) && sales.length === 0;
  const pathOf = (sale: PriceSchedule) => `/offers/scheduled-sales/${sale.id}`;

  return (
    <OfferPage
      title={t.title}
      description={t.description}
      // With no sales at all, the empty state below carries the button.
      primaryAction={canManage && !failed && (sales.length > 0 || filter !== "all") ? newButton : undefined}
    >
      <DataState loading={false} error={failed ? list.error : null} onRetry={() => void list.refresh()}>
        <div className="space-y-3">
          <ChipRow items={chips} value={filter} onChange={setFilter} label={t.filterLabel} />

          {list.loading ? (
            <ListSkeleton rows={4} />
          ) : sales.length === 0 ? (
            filter !== "all" ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noMatchTitle}
                action={
                  <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setFilter("all")}>
                    {t.showAll}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<IconSchedule aria-hidden />}
                title={t.emptyTitle}
                description={canManage ? t.emptyHint : t.viewOnly}
                action={canManage ? newButton : undefined}
              />
            )
          ) : (
            <OfferList label={t.title}>
              {sales.map((sale) => (
                <OfferRow
                  key={sale.id}
                  name={sale.name}
                  to={pathOf(sale)}
                  openLabel={fmt(t.openSaleNamed, { name: sale.name })}
                  badge={<StatusBadge value={sale.status} tone={SCHEDULE_STATUS_TONE[sale.status]} text={t[SCHEDULE_STATUS_KEY[sale.status]]} />}
                  line={
                    <>
                      <span className="font-semibold text-ink tabular-nums">
                        <bdi>{changeSummary(t, sale.change, currency)}</bdi>
                      </span>
                      {" · "}
                      <bdi>{targetSummary(t, sale.target, collectionNames)}</bdi>
                    </>
                  }
                  details={
                    <span className="tabular-nums">
                      <bdi>
                        {fmt(t.window, {
                          from: formatStoreDateTime(sale.startsAt, zone),
                          to: sale.endsAt ? formatStoreDateTime(sale.endsAt, zone) : t.noEnd,
                        })}
                      </bdi>
                    </span>
                  }
                  menu={[{ id: "open", label: t.openSaleMenu, icon: IconArrowOut, onSelect: () => navigate(pathOf(sale)) }]}
                />
              ))}
            </OfferList>
          )}
        </div>
      </DataState>
    </OfferPage>
  );
}
