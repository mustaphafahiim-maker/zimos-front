import { useState } from "react";
import { Button } from "@store-builder/ui";
import { supplierDelete, suppliersList, type Supplier } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconClipboard, IconCopy, IconDelete, IconEdit, IconFactory, IconPlus, IconSearch } from "@/components/icons";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { QuickLook } from "@/components/QuickLook";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageInventory } from "@/lib/inventoryAccess";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { Fact, Facts, MoreMenu, TOOL_BUTTON, ViewOnlyNote, Well, foldText, matchesText } from "./kit";
import { PURCHASING_STRINGS } from "./purchasingStrings";
import { SupplierDialog } from "./SupplierDialog";
import { INV_UI } from "./sweepStrings";
import { useLast } from "./useLast";

const SUPPLIER_COLUMNS = "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_max-content_minmax(0,1.2fr)_max-content]";
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";
const LINK = "rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Inventory → «الموردين» / Suppliers (handoff 207): who the store buys from,
 * with a contact, phone and email. Add, edit, delete — a supplier that has
 * purchase orders can't be deleted (409 SUPPLIER_IN_USE).
 *
 * Calling and WhatsApp are one tap on the row; the row opens a preview with
 * everything written about the supplier, and the way to their purchase orders.
 */
export function SuppliersTab() {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const compact = useIsCompact();
  const list = useCachedAsync<Supplier[]>(`inventory:suppliers:${workspaceId}`, () => suppliersList(apiClient, workspaceId), [workspaceId]);
  const suppliers = list.data ?? [];

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const shownDeleting = useLast(deleting);

  const needle = foldText(search.trim());
  const visible = suppliers.filter((s) => matchesText(needle, [s.name, s.contactName, s.phone, s.email, s.address]));
  const peeked = peek ? (suppliers.find((s) => s.id === peek.id) ?? null) : null;
  const closePeek = () => setPeek((current) => (current ? { ...current, open: false } : current));
  const ordersPath = (s: Supplier) => `/inventory/purchase-orders?supplier=${s.id}`;

  function openDialog(supplier: Supplier | null) {
    closePeek();
    setEditing(supplier);
    setDialogOpen(true);
  }

  function askDelete(supplier: Supplier) {
    closePeek();
    setDeleting(supplier);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await supplierDelete(apiClient, workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err, { SUPPLIER_IN_USE: t.supplierInUse }));
    }
    toast.success(t.supplierDeleted);
    setDeleting(null);
    void list.refresh({ silent: true });
  }

  function menuOf(s: Supplier): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "orders", label: u.supplierOrders, icon: IconClipboard, onSelect: () => navigate(ordersPath(s)) }];
    const phone = s.phone;
    if (phone) items.push({ id: "copy", label: u.copyNumber, icon: IconCopy, onSelect: () => copy(phone, u.copiedNumber) });
    if (canManage) {
      items.push({ id: "edit", label: t.edit, icon: IconEdit, separatorBefore: true, onSelect: () => openDialog(s) });
      items.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, onSelect: () => askDelete(s) });
    }
    return items;
  }

  const addButton = (
    <Button type="button" className={TOOL_BUTTON} onClick={() => openDialog(null)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addSupplier}
    </Button>
  );

  const rows = visible.map((s) => {
    const menu = menuOf(s);
    const menuLabel = fmt(u.actionsFor, { name: s.name });
    const peekLabel = fmt(u.previewOf, { name: s.name });
    const onPeek = () => setPeek({ id: s.id, open: true });
    const keys = rowKeyProps(onPeek);
    const contact = <ContactActions phone={s.phone} name={s.name} variant="icon" />;
    if (compact) {
      return (
        <li key={s.id}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi>{s.name}</bdi>}
              meta={
                s.contactName || s.phone ? (
                  <>
                    {s.contactName && <bdi>{s.contactName}</bdi>}
                    {s.contactName && s.phone && " · "}
                    {s.phone && <bdi dir="ltr">{s.phone}</bdi>}
                  </>
                ) : (
                  (s.email ?? s.address ?? undefined)
                )
              }
              action={s.phone ? contact : undefined}
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
      <DeskRow key={s.id} onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={peek?.open === true && peek.id === s.id} menu={menu} menuLabel={menuLabel}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{s.name}</bdi>
          </p>
          {s.address && (
            <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
              {s.address}
            </p>
          )}
        </div>
        <p className="min-w-0 truncate text-sm text-ink-soft">{s.contactName ? <bdi>{s.contactName}</bdi> : "—"}</p>
        <p className="text-sm whitespace-nowrap text-ink tabular-nums">{s.phone ? <bdi dir="ltr">{s.phone}</bdi> : "—"}</p>
        <p className="min-w-0 truncate text-sm">
          {s.email ? (
            <a href={`mailto:${s.email}`} dir="ltr" className={LINK}>
              {s.email}
            </a>
          ) : (
            <span className="text-ink-soft">—</span>
          )}
        </p>
        <div className="flex items-center justify-end gap-1">
          {contact}
          <MoreMenu items={menu} label={menuLabel} />
        </div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.suppliersHint}</p>
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.supplierSearchPlaceholder, label: u.supplierSearch }}>
        {canManage && suppliers.length > 0 && (
          <Button type="button" className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => openDialog(null)}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.addSupplier}
          </Button>
        )}
      </ListToolbar>

      <DataState
        loading={list.loading}
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {suppliers.length === 0 ? (
          <EmptyState
            icon={<IconFactory aria-hidden />}
            title={t.suppliersEmptyTitle}
            description={canManage ? t.suppliersEmptyHint : t.viewOnly}
            action={canManage ? addButton : undefined}
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
              <ul aria-label={u.supplierList} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={SUPPLIER_COLUMNS}
                label={u.supplierList}
                head={[{ label: t.colSupplier }, { label: t.colContact }, { label: t.colPhone }, { label: t.colEmail }, { label: t.colActions, end: true }]}
              >
                {rows}
              </DeskList>
            )}
            {!canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      {canManage && suppliers.length > 0 && <PageActionBar>{addButton}</PageActionBar>}

      {peeked && (
        <QuickLook
          open={Boolean(peek?.open)}
          onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
          title={<bdi>{peeked.name}</bdi>}
          to={ordersPath(peeked)}
          openLabel={u.supplierOrders}
          actions={
            canManage ? (
              <>
                <RowAction className={FOOTER_PILL} tone="danger" label={t.delete} icon={IconDelete} onClick={() => askDelete(peeked)} />
                <RowAction className={FOOTER_PILL} tone="quiet" label={t.edit} icon={IconEdit} onClick={() => openDialog(peeked)} />
              </>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {peeked.phone && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-medium text-ink tabular-nums">
                  <bdi dir="ltr">{peeked.phone}</bdi>
                </p>
                <ContactActions phone={peeked.phone} name={peeked.name} />
              </div>
            )}
            <Facts>
              <Fact label={t.colContact}>{peeked.contactName ? <bdi>{peeked.contactName}</bdi> : "—"}</Fact>
              <Fact label={t.colEmail}>
                {peeked.email ? (
                  <a href={`mailto:${peeked.email}`} dir="ltr" className={`${LINK} break-all`}>
                    {peeked.email}
                  </a>
                ) : (
                  "—"
                )}
              </Fact>
              {peeked.address && (
                <Fact label={u.factAddress}>
                  <span dir="auto" className="wrap-anywhere">
                    {peeked.address}
                  </span>
                </Fact>
              )}
            </Facts>
            {peeked.notes && (
              <Well>
                <p className="text-xs leading-4 font-medium text-ink-soft">{u.notes}</p>
                <p dir="auto" className="mt-1 text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-ink">
                  {peeked.notes}
                </p>
              </Well>
            )}
          </div>
        </QuickLook>
      )}

      <SupplierDialog
        open={dialogOpen}
        supplier={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={(_saved, created) => {
          setDialogOpen(false);
          toast.success(created ? t.supplierCreated : t.supplierSaved);
          void list.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.supplierDeleteTitle, { name: shownDeleting?.name ?? "" })}
        description={t.supplierDeleteBody}
        confirmLabel={t.supplierDeleteConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
