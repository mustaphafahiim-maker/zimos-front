import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { stockLocationStock, stockTransfersList, type LocationStockVariant, type StockLocation, type StockTransfer } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconPackageSearch, IconSearch, IconSwap } from "@/components/icons";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { QuickLook } from "@/components/QuickLook";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { canManageInventory } from "@/lib/inventoryAccess";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { variantDetail, variantFullName } from "./inventoryText";
import { BlockLabel, Fact, Facts, TOOL_BUTTON, ViewOnlyNote, Well, foldText, matchesText, useStockLocations } from "./kit";
import { INV_UI } from "./sweepStrings";
import { TransferSheet } from "./TransferSheet";

/** How many of a transfer's lines a row names before "+N more". */
const HISTORY_ITEMS = 3;

/** The columns of the transfers sheet: from where to where, what moved, the note, when. */
const TRANSFER_COLUMNS = "grid-cols-[minmax(0,1.2fr)_minmax(0,1.7fr)_minmax(0,1fr)_max-content]";

const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";

/** One transfer, with the names its ids stand for. */
interface TransferView {
  transfer: StockTransfer;
  from: string;
  to: string;
  route: string;
  pieces: number;
  /** «تيشيرت · مقاس M × ٣», one per line. */
  items: string[];
}

/**
 * «نقل مخزون» / Transfer stock (handoff 206). The tab is the history of
 * transfers — newest first, searchable — and «نقل مخزون» opens the form in a
 * sheet over it (./TransferSheet.tsx). `?new=1` opens that sheet on arrival,
 * with `&from=` / `&to=` naming an end, so "transfer stock" elsewhere in the
 * dashboard still lands on the form.
 *
 * A row opens its preview: every line of the transfer (a row names three),
 * its note, and the way to the two locations.
 */
export function TransfersTab() {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const [params, setParams] = useSearchParams();

  const locations = useStockLocations(workspaceId);
  const all = useMemo(() => locations.data?.locations ?? [], [locations.data]);
  const history = useCachedAsync<StockTransfer[]>(`inventory:transfers:${workspaceId}`, () => stockTransfersList(apiClient, workspaceId), [workspaceId]);

  // A transfer carries variant ids only. A location's stock lists every variant with its name: the default one is read for them.
  const nameSourceId = (all.find((l) => l.isDefault) ?? all[0])?.id ?? "";
  const stock = useCachedAsync<LocationStockVariant[]>(
    nameSourceId ? `inventory:variant-names:${workspaceId}:${nameSourceId}` : null,
    () =>
      nameSourceId
        ? stockLocationStock(apiClient, workspaceId, nameSourceId)
            .then((r) => r.variants)
            .catch(() => [] as LocationStockVariant[])
        : Promise.resolve([] as LocationStockVariant[]),
    [workspaceId, nameSourceId]
  );

  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ open: boolean; preset?: { from?: string | null; to?: string | null } }>({ open: false });
  // The transfer being looked at stays here while its preview closes.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);

  // A link that asks for the form (`?new=1`) opens it once the locations are known, then leaves the address clean.
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (!wantsNew || all.length < 2) return;
    if (canManage) setSheet({ open: true, preset: { from: params.get("from"), to: params.get("to") } });
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        out.delete("new");
        out.delete("from");
        out.delete("to");
        return out;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew, all.length, canManage]);

  const views: TransferView[] = useMemo(() => {
    const locationName = (id: string) => all.find((l) => l.id === id)?.name ?? t.deletedLocation;
    const names = new Map(
      (stock.data ?? []).map((v) => [v.variantId, variantFullName(v.productName ?? t.unknownProduct, variantDetail(v.optionValues, v.sku))])
    );
    return (history.data ?? []).map((transfer) => {
      const from = locationName(transfer.fromLocationId);
      const to = locationName(transfer.toLocationId);
      return {
        transfer,
        from,
        to,
        route: fmt(t.routeText, { from, to }),
        pieces: transfer.lines.reduce((sum, line) => sum + line.quantity, 0),
        items: transfer.lines.map((line) => fmt(t.itemLine, { name: names.get(line.variantId) ?? t.unknownProduct, n: line.quantity })),
      };
    });
  }, [history.data, stock.data, all, t]);

  const needle = foldText(search.trim());
  const visible = views.filter((view) => matchesText(needle, [view.from, view.to, view.transfer.note, ...view.items]));
  const peeked = peek ? (views.find((view) => view.transfer.id === peek.id) ?? null) : null;
  const exists = (id: string): StockLocation | null => all.find((l) => l.id === id) ?? null;

  function openSheet(preset?: { from?: string | null; to?: string | null }) {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setSheet({ open: true, preset });
  }

  function menuOf(view: TransferView): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const from = exists(view.transfer.fromLocationId);
    const to = exists(view.transfer.toLocationId);
    if (from) items.push({ id: "from", label: fmt(u.openNamed, { name: from.name }), icon: IconPackageSearch, onSelect: () => navigate(`/inventory/locations/${from.id}`) });
    if (to) items.push({ id: "to", label: fmt(u.openNamed, { name: to.name }), icon: IconPackageSearch, onSelect: () => navigate(`/inventory/locations/${to.id}`) });
    if (canManage && from && to) {
      items.push({
        id: "again",
        label: u.transferAgain,
        icon: IconSwap,
        separatorBefore: true,
        onSelect: () => openSheet({ from: from.id, to: to.id }),
      });
    }
    return items;
  }

  const newButton = (
    <Button type="button" className={TOOL_BUTTON} onClick={() => openSheet()}>
      <IconSwap className="size-4" weight="bold" aria-hidden />
      {t.transferStock}
    </Button>
  );

  const rows = visible.map((view) => (
    <TransferRow
      key={view.transfer.id}
      view={view}
      compact={compact}
      current={peek?.open === true && peek.id === view.transfer.id}
      menu={menuOf(view)}
      onPeek={() => setPeek({ id: view.transfer.id, open: true })}
    />
  ));

  return (
    <>
      <DataState
        loading={locations.loading}
        error={locations.data ? null : locations.error}
        onRetry={() => void locations.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {all.length < 2 ? (
          <EmptyState
            icon={<IconSwap aria-hidden />}
            title={t.needTwoTitle}
            description={t.needTwoHint}
            action={
              <Button asChild className="rounded-full px-5">
                <ViewLink to="/inventory/locations">{t.goToLocations}</ViewLink>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* What the tab is for, where there is room for a sentence: a phone keeps the first screen for the list. */}
            <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.transferDescription}</p>
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.transferSearchPlaceholder, label: u.transferSearch }}>
              {/* On a phone the one creation action is the bar above the dock (below); from md it closes the toolbar. */}
              {canManage && (
                <Button type="button" className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => openSheet()}>
                  <IconSwap className="size-4" weight="bold" aria-hidden />
                  {t.transferStock}
                </Button>
              )}
            </ListToolbar>

            <DataState
              loading={history.loading}
              error={history.data ? null : history.error}
              onRetry={() => void history.refresh()}
              skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
            >
              {views.length === 0 ? (
                <EmptyState
                  icon={<IconSwap aria-hidden />}
                  title={t.historyEmpty}
                  description={canManage ? t.transferDescription : t.viewOnlyHint}
                  action={canManage ? newButton : undefined}
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  icon={<IconSearch aria-hidden />}
                  title={u.noMatch}
                  action={
                    <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setSearch("")}>
                      {u.clearSearch}
                    </Button>
                  }
                />
              ) : compact ? (
                <ul aria-label={t.historyTitle} className="flex flex-col gap-2.5">
                  {rows}
                </ul>
              ) : (
                <DeskList
                  columns={TRANSFER_COLUMNS}
                  label={t.historyTitle}
                  head={[{ label: t.colRoute }, { label: t.colItems }, { label: t.colNote }, { label: t.colDate, end: true }]}
                >
                  {rows}
                </DeskList>
              )}
            </DataState>

            {!canManage && <ViewOnlyNote>{t.viewOnlyHint}</ViewOnlyNote>}
            {canManage && views.length > 0 && <PageActionBar>{newButton}</PageActionBar>}
          </div>
        )}
      </DataState>

      <TransferQuickLook
        view={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        target={peeked ? (exists(peeked.transfer.toLocationId) ?? exists(peeked.transfer.fromLocationId)) : null}
        onAgain={
          peeked && canManage && exists(peeked.transfer.fromLocationId) && exists(peeked.transfer.toLocationId)
            ? () => openSheet({ from: peeked.transfer.fromLocationId, to: peeked.transfer.toLocationId })
            : undefined
        }
      />

      <TransferSheet
        open={sheet.open}
        locations={all}
        preset={sheet.preset}
        onClose={() => setSheet((current) => ({ ...current, open: false }))}
        onDone={() => {
          setSheet((current) => ({ ...current, open: false }));
          toast.success(t.transferred);
          void history.refresh({ silent: true });
          // The units of each location changed with it.
          void locations.refresh({ silent: true });
        }}
      />
    </>
  );
}

/** «من ٣ ساعات», with the exact moment for whoever hovers or asks. */
function Age({ at }: { at: string }) {
  return (
    <time dateTime={at} title={formatDateTime(at)}>
      {formatRelativeTime(at)}
    </time>
  );
}

/**
 * One transfer: on a narrow screen a card — the route and how many pieces
 * moved, then what moved and when — and on a wide one a line of the sheet.
 */
function TransferRow({
  view,
  compact,
  current,
  menu,
  onPeek,
}: {
  view: TransferView;
  compact: boolean;
  /** Its preview is open. */
  current: boolean;
  menu: ContextMenuItem[];
  onPeek: () => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  const { transfer } = view;
  const peekLabel = fmt(u.previewOf, { name: view.route });
  const keys = rowKeyProps(onPeek);
  const more = view.items.length - HISTORY_ITEMS;

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={u.transferMenu}>
          <ListRowCard
            title={<bdi>{view.route}</bdi>}
            amount={<span>{countOf("piece", view.pieces)}</span>}
            meta={
              <bdi>
                {view.items[0]}
                {view.items.length > 1 && ` · ${fmt(t.moreItems, { n: view.items.length - 1 })}`}
              </bdi>
            }
            footer={
              <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs leading-5 text-ink-soft">
                <Age at={transfer.createdAt} />
                {transfer.note && (
                  <>
                    <span aria-hidden>·</span>
                    <span dir="auto" className="min-w-0 truncate">
                      {transfer.note}
                    </span>
                  </>
                )}
              </p>
            }
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
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={u.transferMenu}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <bdi>{view.route}</bdi>
        </p>
        <p className="text-xs leading-5 text-ink-soft tabular-nums">{countOf("piece", view.pieces)}</p>
      </div>

      <div className="min-w-0 text-sm leading-5 text-ink">
        {view.items.slice(0, HISTORY_ITEMS).map((item, index) => (
          <p key={index} className="truncate">
            <bdi>{item}</bdi>
          </p>
        ))}
        {more > 0 && <p className="text-xs text-ink-soft">{fmt(t.moreItems, { n: more })}</p>}
      </div>

      {transfer.note ? (
        <p dir="auto" className="line-clamp-2 min-w-0 text-sm leading-5 wrap-anywhere text-ink-soft">
          {transfer.note}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">—</p>
      )}

      <div className="text-end text-xs leading-5 whitespace-nowrap text-ink-soft">
        <Age at={transfer.createdAt} />
      </div>
    </DeskRow>
  );
}

/**
 * The preview of a transfer: every line (a row names three), the two ends,
 * when, and the note. «افتح …» goes to the stock of where the units went (or
 * where they came from, when that location is gone).
 */
function TransferQuickLook({
  view,
  open,
  onOpenChange,
  target,
  onAgain,
}: {
  view: TransferView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The location "open fully" goes to; null when both ends were deleted. */
  target: StockLocation | null;
  /** Start a new transfer between the same two locations. Left out for a viewer, or when an end is gone. */
  onAgain?: () => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  if (!view) return null;
  const { transfer } = view;
  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{view.route}</bdi>}
      to={target ? `/inventory/locations/${target.id}` : "/inventory/locations"}
      openLabel={target ? fmt(u.openNamed, { name: target.name }) : t.goToLocations}
      actions={onAgain ? <RowAction className={FOOTER_PILL} tone="quiet" label={u.transferAgain} icon={IconSwap} onClick={onAgain} /> : undefined}
    >
      <div className="space-y-4">
        <Facts>
          <Fact label={t.from}>
            <bdi>{view.from}</bdi>
          </Fact>
          <Fact label={t.to}>
            <bdi>{view.to}</bdi>
          </Fact>
          <Fact label={u.factMoved}>
            <bdi className="tabular-nums">{countOf("piece", view.pieces)}</bdi>
          </Fact>
          <Fact label={t.colDate}>{formatDateTime(transfer.createdAt)}</Fact>
        </Facts>

        <section>
          <BlockLabel>{t.colItems}</BlockLabel>
          <ul className="space-y-1.5">
            {view.items.map((item, index) => (
              <li key={index} className="text-sm leading-6 text-ink">
                <bdi>{item}</bdi>
              </li>
            ))}
          </ul>
        </section>

        {transfer.note && (
          <Well>
            <p className="text-xs leading-4 font-medium text-ink-soft">{t.colNote}</p>
            <p dir="auto" className="mt-1 text-sm leading-6 wrap-anywhere text-ink">
              {transfer.note}
            </p>
          </Well>
        )}
      </div>
    </QuickLook>
  );
}
