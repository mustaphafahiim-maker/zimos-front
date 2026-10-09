import { useState } from "react";
import { IconArrowOut, IconPlus, IconPower, IconTag } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import { priceListPayloadOf, priceListUpdate, priceListsList, shopperAccountsGet, type PriceList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useT } from "@/i18n/LocaleContext";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { OfferList, OfferListState, OfferPage, OfferRow, TOUCH_BUTTON } from "@/pages/offers/OfferKit";
import { NEW_PRICE_LIST_PATH, priceListPath } from "./priceListPaths";
import { PRICE_LIST_STRINGS } from "./priceListStrings";

/**
 * Offers → Price lists (handoff 205; read products.view, change
 * products.manage): every list with what it gives, what it is on and the tags
 * it is for, and its state switch. A row opens the list's editor.
 */
export function PriceListsPage() {
  const t = useT(PRICE_LIST_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Shown at once from the session's copy on the way back from an editor, and read again behind it.
  const lists = useCachedAsync(`price-lists:${workspaceId}`, () => priceListsList(apiClient, workspaceId), [workspaceId]);
  // The prices need a signed-in shopper: say so when the store has no accounts.
  // A role that may not read that setting simply sees no hint.
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = lists.data ?? [];

  async function toggle(list: PriceList, isActive: boolean, undoable = true): Promise<void> {
    if (busyId) return;
    setBusyId(list.id);
    try {
      // A full replace: the list goes back as it is, with the switch moved.
      const saved = await priceListUpdate(apiClient, workspaceId, list.id, priceListPayloadOf(list, { isActive }));
      lists.setData((prev) => (prev ?? []).map((other) => (other.id === saved.id ? saved : other)));
      const said = fmt(saved.isActive ? t.turnedOn : t.turnedOff, { name: saved.name });
      if (undoable) toast.undo(said, () => toggle(saved, !saved.isActive, false));
      else toast.success(said);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  // No products.view: the page says so, and offers nothing it would refuse.
  const denied = isPermissionError(lists.error);
  const newButton = (
    <Button asChild className={TOUCH_BUTTON}>
      <ViewLink to={NEW_PRICE_LIST_PATH}>
        <IconPlus className="size-4" weight="bold" aria-hidden />
        {t.newList}
      </ViewLink>
    </Button>
  );

  const menuFor = (list: PriceList): ContextMenuItem[] => [
    { id: "open", label: t.menuOpen, icon: IconArrowOut, onSelect: () => navigate(priceListPath(list.id)) },
    {
      id: "toggle",
      label: list.isActive ? t.menuTurnOff : t.menuTurnOn,
      icon: IconPower,
      disabled: busyId !== null,
      onSelect: () => void toggle(list, !list.isActive),
    },
  ];

  return (
    <OfferPage title={t.title} description={t.description} primaryAction={denied || rows.length === 0 ? undefined : newButton}>
      <OfferListState loading={lists.loading} error={lists.error} onRetry={() => void lists.refresh()}>
        <div className="space-y-4">
          {accounts.data && !accounts.data.enabled && (
            <Alert>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1 basis-64">{t.accountsOff}</span>
                <ViewLink to="/store-settings/customer-accounts" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                  {t.accountsOffAction}
                </ViewLink>
              </div>
            </Alert>
          )}

          {rows.length === 0 ? (
            <EmptyState icon={<IconTag aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
          ) : (
            <OfferList label={t.listLabel}>
              {rows.map((list) => (
                <OfferRow
                  key={list.id}
                  name={list.name}
                  to={priceListPath(list.id)}
                  openLabel={fmt(t.openListNamed, { name: list.name })}
                  line={
                    <span className="tabular-nums">
                      <span className="font-semibold text-ink">{list.kind === "percent" ? fmt(t.typePercent, { percent: list.percent ?? 0 }) : t.typeFixed}</span>
                      {" · "}
                      {list.kind === "fixed"
                        ? pluralOf(t, "scopeVariants", list.prices.length)
                        : list.productIds?.length
                          ? pluralOf(t, "scopeProducts", list.productIds.length)
                          : t.scopeAll}
                    </span>
                  }
                  details={
                    list.customerTags.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>{t.colTags}</span>
                        {list.customerTags.map((tag) => (
                          <span key={tag} data-slot="offer-fact" className="rounded-full bg-paper-sunken px-2 py-0.5 text-xs text-ink ring-1 ring-line">
                            <bdi>{tag}</bdi>
                          </span>
                        ))}
                      </span>
                    ) : undefined
                  }
                  toggle={{
                    checked: list.isActive,
                    busy: busyId === list.id,
                    disabled: busyId !== null && busyId !== list.id,
                    onChange: (next) => void toggle(list, next),
                  }}
                  menu={menuFor(list)}
                />
              ))}
            </OfferList>
          )}
        </div>
      </OfferListState>
    </OfferPage>
  );
}
