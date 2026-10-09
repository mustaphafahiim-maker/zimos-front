import { useState } from "react";
import { Button } from "@store-builder/ui";
import { stockLocationDelete, stockLocationUpdate, type StockLocation } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCheck, IconDelete, IconEdit, IconInventory, IconPackageSearch, IconPlus, IconPower, IconSearch, IconSwap } from "@/components/icons";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { QuickLook } from "@/components/QuickLook";
import { SettingsGroup, SettingsSwitch } from "@/components/settings/SettingsRow";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { canManageInventory } from "@/lib/inventoryAccess";
import { countOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { num } from "./inventoryText";
import { Fact, Facts, InlineSwitch, MoreMenu, TOOL_BUTTON, ViewOnlyNote, foldText, matchesText, useStockLocations } from "./kit";
import { LocationDialog } from "./LocationDialog";
import { PlanUpgradeNotice } from "./PlanUpgradeNotice";
import { INV_UI } from "./sweepStrings";
import { useLast } from "./useLast";

/** Most locations a store can have (the API answers 409 TOO_MANY_LOCATIONS past it). */
const MAX_LOCATIONS = 50;

/** The columns of the locations sheet: which, how many units, its place in line, on or off, its menu. */
const LOCATION_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content]";

/** The footer pills of a preview: a little taller and wider with a mouse than a row's. */
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";

const NAME_LINK =
  "min-w-0 truncate rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * «المخازن» / Locations (handoff 206, GET /stock-locations): every warehouse
 * or shop with the units it holds, its shipping priority and whether new
 * orders may be assigned to it. Add, edit, make default, switch off, delete.
 * The first location is free; on a plan without multiple warehouses the
 * upgrade prompt stands where "Add location" would be.
 *
 * A row opens its preview (Space too; Enter, or the name on a desktop, opens
 * the location's stock); the rest is in the row's «…» menu — the same menu a
 * right-click or a long press gives. Switching a location on or off happens at
 * once and offers Undo.
 *
 * Shown as the first tab of Inventory and, with its heading, in Settings.
 */
/** `inPane`: drawn inside a settings pane that already carries the title and the description, so they are not said twice. */
export function LocationsSection({ inSettings = false, inPane = false }: { inSettings?: boolean; inPane?: boolean }) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const list = useStockLocations(workspaceId);
  const locations = list.data?.locations ?? [];
  const multiWarehouse = list.data?.multiWarehouse ?? false;

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const [defaulting, setDefaulting] = useState<StockLocation | null>(null);
  const [deleting, setDeleting] = useState<StockLocation | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  // The location being looked at stays here while its preview closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const shownDefaulting = useLast(defaulting);
  const shownDeleting = useLast(deleting);

  const reload = () => list.refresh({ silent: true });
  const loaded = list.data !== null && !list.loading;
  const planFull = loaded && !multiWarehouse && locations.length >= 1;
  const canAdd = canManage && loaded && !planFull && locations.length < MAX_LOCATIONS;

  const needle = foldText(search.trim());
  const visible = locations.filter((l) => matchesText(needle, [l.name, l.address]));
  const peeked = peek ? (locations.find((l) => l.id === peek.id) ?? null) : null;

  /** A preview steps aside for a dialog: two sheets are never stacked. */
  function closePeek() {
    setPeek((current) => (current ? { ...current, open: false } : current));
  }

  function openDialog(location: StockLocation | null) {
    closePeek();
    setEditing(location);
    setDialogOpen(true);
  }

  function askDefault(location: StockLocation) {
    closePeek();
    setDefaulting(location);
  }

  function askDelete(location: StockLocation) {
    closePeek();
    setDeleting(location);
  }

  /**
   * On or off, at once: the row changes before the answer, goes back if the
   * server refuses, and the toast offers the way back (the same call, the
   * other way round).
   */
  async function toggle(location: StockLocation, on: boolean, undoing = false): Promise<void> {
    const apply = (value: boolean) =>
      list.setData((prev) => ({
        multiWarehouse: prev?.multiWarehouse ?? false,
        locations: (prev?.locations ?? []).map((l) => (l.id === location.id ? { ...l, isActive: value } : l)),
      }));
    setToggling(location.id);
    apply(on);
    try {
      await stockLocationUpdate(apiClient, workspaceId, location.id, { isActive: on });
      const message = fmt(on ? t.turnedOn : t.turnedOff, { name: location.name });
      if (undoing) toast.success(message);
      else toast.undo(message, () => toggle(location, !on, true));
    } catch (err) {
      apply(!on);
      // An undo that failed is said by the toast itself («معرفناش نتراجع»).
      if (undoing) throw err;
      toast.error(errorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  async function confirmDefault() {
    if (!defaulting) return;
    try {
      await stockLocationUpdate(apiClient, workspaceId, defaulting.id, { isDefault: true });
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.madeDefault, { name: defaulting.name }));
    setDefaulting(null);
    void reload();
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await stockLocationDelete(apiClient, workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err, { LOCATION_HAS_STOCK: t.deleteHasStock, LOCATION_IS_DEFAULT: t.deleteIsDefault }));
    }
    toast.success(t.deleted);
    setDeleting(null);
    void reload();
  }

  const stockPath = (location: StockLocation) => `/inventory/locations/${location.id}`;

  /** Everything that can be done to one location: the «…» of its row, and its right-click / long-press menu. */
  function menuOf(location: StockLocation): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      { id: "open", label: u.openStock, icon: IconPackageSearch, onSelect: () => navigate(stockPath(location)) },
    ];
    if (!canManage) return items;
    items.push({ id: "edit", label: t.edit, icon: IconEdit, separatorBefore: true, onSelect: () => openDialog(location) });
    if (!location.isDefault) {
      items.push({
        id: "toggle",
        label: location.isActive ? u.turnOff : u.turnOn,
        icon: IconPower,
        disabled: toggling === location.id,
        onSelect: () => void toggle(location, !location.isActive),
      });
      items.push({ id: "default", label: t.makeDefault, icon: IconCheck, onSelect: () => askDefault(location) });
    }
    items.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => askDelete(location) });
    return items;
  }

  const addButton = (
    <Button type="button" className={TOOL_BUTTON} onClick={() => openDialog(null)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addLocation}
    </Button>
  );

  const rows = visible.map((location) => (
    <LocationRow
      key={location.id}
      location={location}
      compact={compact}
      canManage={canManage}
      busy={toggling === location.id}
      current={peek?.open === true && peek.id === location.id}
      menu={menuOf(location)}
      onPeek={() => setPeek({ id: location.id, open: true })}
      onOpenFully={() => navigate(stockPath(location))}
      onToggle={(on) => void toggle(location, on)}
    />
  ));

  return (
    <section id={inSettings ? "locations" : undefined} className="flex scroll-mt-24 flex-col gap-3">
      {inSettings ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Inside a settings pane the pane's own header says both lines. */}
          {!inPane && (
            <div className="min-w-0 flex-1 basis-64">
              <h2 className="font-display text-lg font-medium text-ink">{t.locationsTitle}</h2>
              <p className="mt-1 text-sm text-ink-soft">{t.locationsDescription}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {locations.length > 0 && (
              <Button asChild variant="outline" className={TOOL_BUTTON}>
                <ViewLink to="/inventory/locations">{t.openInventory}</ViewLink>
              </Button>
            )}
            {canAdd && locations.length > 0 && addButton}
          </div>
        </div>
      ) : (
        <>
          {/* What the tab is for, where there is room for a sentence: a phone keeps the first screen for the list. */}
          <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.locationsDescription}</p>
          <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.locationSearchPlaceholder, label: u.locationSearch }}>
            {locations.length >= 2 && (
              <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-3.5 sm:px-4">
                {/* Whoever may move stock lands on the form itself; a viewer on the history. */}
                <ViewLink to={canManage ? "/inventory/transfers?new=1" : "/inventory/transfers"} aria-label={t.transferStock}>
                  <IconSwap className="size-4" aria-hidden />
                  <span className="max-sm:sr-only">{t.transferStock}</span>
                </ViewLink>
              </Button>
            )}
            {/* On a phone the one creation action is the bar above the dock (below); from md it closes the toolbar. */}
            {canAdd && locations.length > 0 && (
              <Button type="button" className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => openDialog(null)}>
                <IconPlus className="size-4" weight="bold" aria-hidden />
                {t.addLocation}
              </Button>
            )}
          </ListToolbar>
        </>
      )}

      <DataState
        loading={list.loading}
        // A refresh that failed behind rows already on screen leaves them there.
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={3} />}
      >
        {locations.length === 0 ? (
          <EmptyState
            icon={<IconInventory aria-hidden />}
            title={t.emptyTitle}
            description={canManage ? t.emptyHint : t.viewOnlyHint}
            action={canAdd ? addButton : undefined}
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
        ) : (
          <div className="flex flex-col gap-3">
            {compact ? (
              <ul aria-label={t.locationsTitle} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={LOCATION_COLUMNS}
                label={t.locationsTitle}
                head={[
                  { label: t.colLocation },
                  { label: t.colUnits, end: true },
                  { label: t.colPriority, end: true },
                  { label: t.colActive },
                  { label: canManage ? t.colActions : "", end: true },
                ]}
              >
                {rows}
              </DeskList>
            )}
            {planFull && <PlanUpgradeNotice />}
            {!canManage && <ViewOnlyNote>{t.viewOnlyHint}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      {!inSettings && canAdd && locations.length > 0 && <PageActionBar>{addButton}</PageActionBar>}

      <LocationQuickLook
        location={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        canManage={canManage}
        busy={peeked ? toggling === peeked.id : false}
        onToggle={(on) => {
          if (peeked) void toggle(peeked, on);
        }}
        onEdit={() => {
          if (peeked) openDialog(peeked);
        }}
        onMakeDefault={() => {
          if (peeked) askDefault(peeked);
        }}
        onDelete={() => {
          if (peeked) askDelete(peeked);
        }}
      />

      <LocationDialog
        open={dialogOpen}
        location={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={(_saved, created) => {
          setDialogOpen(false);
          toast.success(created ? (locations.length === 0 ? t.createdFirst : t.created) : t.saved);
          void reload();
        }}
      />

      <ConfirmDialog
        open={defaulting !== null}
        title={fmt(t.makeDefaultTitle, { name: shownDefaulting?.name ?? "" })}
        description={fmt(t.makeDefaultBody, { name: shownDefaulting?.name ?? "" })}
        confirmLabel={t.makeDefaultConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setDefaulting(null)}
        onConfirm={confirmDefault}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: shownDeleting?.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

/** «الأساسي», «متوقف» or «شغّال»: where a location stands, as the chip of its row. */
function LocationBadges({ location }: { location: StockLocation }) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  return (
    <>
      {location.isDefault && <StatusBadge value="default" tone="info" text={t.defaultBadge} />}
      {!location.isActive ? (
        <StatusBadge value="inactive" tone="neutral" text={t.inactiveBadge} />
      ) : (
        !location.isDefault && <StatusBadge value="active" tone="success" text={u.activeBadge} />
      )}
    </>
  );
}

/**
 * One location: a card on a narrow screen (its name and its units first, its
 * chip and the «…» under them), a line of the sheet on a wide one, where the
 * switch sits in the row itself.
 */
function LocationRow({
  location,
  compact,
  canManage,
  busy,
  current,
  menu,
  onPeek,
  onOpenFully,
  onToggle,
}: {
  location: StockLocation;
  compact: boolean;
  canManage: boolean;
  /** Its switch is being saved. */
  busy: boolean;
  /** Its preview is open. */
  current: boolean;
  menu: ContextMenuItem[];
  onPeek: () => void;
  onOpenFully: () => void;
  onToggle: (on: boolean) => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  const units = location.totals?.units ?? 0;
  const menuLabel = fmt(u.actionsFor, { name: location.name });
  const peekLabel = fmt(u.previewOf, { name: location.name });
  const keys = rowKeyProps(onPeek, onOpenFully);

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={menuLabel}>
          <ListRowCard
            title={<bdi data-vt-part="title">{location.name}</bdi>}
            amount={<span>{countOf("piece", units)}</span>}
            status={<LocationBadges location={location} />}
            meta={location.address ? <span dir="auto">{location.address}</span> : fmt(t.priorityLine, { n: location.priority })}
            action={canManage ? <MoreMenu items={menu} label={menuLabel} /> : undefined}
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
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={menuLabel}>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-[15px] leading-6 font-medium text-ink">
          {/* The name is the way to the location's stock; the row itself opens the preview. */}
          <ViewLink to={`/inventory/locations/${location.id}`} className={NAME_LINK}>
            <bdi data-vt-part="title">{location.name}</bdi>
          </ViewLink>
          <LocationBadges location={location} />
        </p>
        {location.address && (
          <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
            {location.address}
          </p>
        )}
      </div>

      <div className="text-end text-sm font-medium text-ink tabular-nums">{num(units)}</div>

      <div className="text-end text-sm text-ink-soft tabular-nums">{num(location.priority)}</div>

      <div className="flex items-center">
        <InlineSwitch
          checked={location.isActive}
          label={fmt(t.activeFor, { name: location.name })}
          // The default location cannot be switched off (the API refuses it).
          disabled={!canManage || location.isDefault}
          busy={busy}
          title={location.isDefault ? t.defaultAlwaysOn : undefined}
          onChange={onToggle}
        />
      </div>

      <div className="flex items-center justify-end">{canManage && <MoreMenu items={menu} label={menuLabel} />}</div>
    </DeskRow>
  );
}

/**
 * The preview of a location: what it holds, where it is, its place in line
 * when an order is assigned, and whether it takes new orders — a switch that
 * saves itself. Edit and delete are in the footer beside «افتح مخزونه»; making
 * it the default asks first, as before.
 */
function LocationQuickLook({
  location,
  open,
  onOpenChange,
  canManage,
  busy,
  onToggle,
  onEdit,
  onMakeDefault,
  onDelete,
}: {
  location: StockLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  if (!location) return null;
  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{location.name}</bdi>}
      status={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <LocationBadges location={location} />
        </span>
      }
      to={`/inventory/locations/${location.id}`}
      openLabel={u.openStock}
      actions={
        canManage ? (
          <>
            <RowAction className={FOOTER_PILL} tone="danger" label={t.delete} icon={IconDelete} onClick={onDelete} />
            <RowAction className={FOOTER_PILL} tone="quiet" label={t.edit} icon={IconEdit} onClick={onEdit} />
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Facts>
          <Fact label={u.factUnits}>
            <bdi className="tabular-nums">{countOf("piece", location.totals?.units ?? 0)}</bdi>
          </Fact>
          <Fact label={t.colPriority}>
            <bdi dir="ltr" className="tabular-nums">
              {num(location.priority)}
            </bdi>
          </Fact>
          {location.address && (
            <Fact label={u.factAddress}>
              <span dir="auto" className="wrap-anywhere">
                {location.address}
              </span>
            </Fact>
          )}
          <Fact label={u.factAdded}>{formatDate(location.createdAt)}</Fact>
        </Facts>
        <p className="px-1 text-[13px] leading-5 text-ink-soft">{t.priorityHint}</p>

        <SettingsGroup>
          <SettingsSwitch
            checked={location.isActive}
            label={u.takesOrders}
            // The default location cannot be switched off (the API refuses it).
            hint={location.isDefault ? t.defaultAlwaysOn : u.takesOrdersHint}
            disabled={!canManage || location.isDefault}
            busy={busy}
            onChange={onToggle}
          />
        </SettingsGroup>

        {canManage && !location.isDefault && (
          <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-full px-4" onClick={onMakeDefault}>
            <IconCheck className="size-4" aria-hidden />
            {t.makeDefault}
          </Button>
        )}
        {!canManage && <ViewOnlyNote>{t.viewOnlyHint}</ViewOnlyNote>}
      </div>
    </QuickLook>
  );
}
