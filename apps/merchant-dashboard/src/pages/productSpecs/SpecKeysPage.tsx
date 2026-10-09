import { useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconChecklist, IconDelete, IconEdit, IconPlus } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { SPEC_LIMITS, specKeyDelete, specKeysList, specKeyUpdate, type SpecKey } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageProducts } from "@/lib/productAccess";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ListRowCard, ListSkeleton } from "@/components/list";
import { useToast } from "@/components/Toast";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { SpecKeyDialog } from "./SpecKeyDialog";
import { SPEC_STRINGS, specKeyName } from "./specStrings";

const ARROW =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:size-11";

/** A control inside a row that opens on a press: its own press stays its own. */
function Own({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

/**
 * Products → «المواصفات» / Specifications (handoff 231, read products.view):
 * the store's own list of specifications — a name in Arabic / English, a
 * unit, whether shoppers can filter by it — in the order shoppers will see
 * them. A row opens its edit sheet; moving one up or down and deleting it are
 * in its «…» menu (and, with a mouse, the arrows in the row). Each product
 * then gets its values on its own page.
 */
export function SpecKeysPage() {
  const t = useT(SPEC_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageProducts(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const list = useAsync(() => specKeysList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<SpecKey | "new" | null>(null);
  const [removing, setRemoving] = useState<SpecKey | null>(null);
  const [moving, setMoving] = useState(false);

  const keys = list.data ?? [];
  const full = keys.length >= SPEC_LIMITS.keys;
  const nextPosition = keys.reduce((max, k) => Math.max(max, k.position), -1) + 1;

  /** Swaps a specification with its neighbour, then saves the positions that changed. */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (moving || target < 0 || target >= keys.length) return;
    const next = [...keys];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((k, position) => ({ ...k, position }));
    // Only the rows whose place differs from what the server holds are written.
    const changed = renumbered.filter((k) => keys.find((old) => old.id === k.id)?.position !== k.position);
    list.setData(renumbered);
    setMoving(true);
    try {
      await Promise.all(
        changed.map((k) => specKeyUpdate(apiClient, workspaceId, k.id, { name: k.name, unit: k.unit, filterable: k.filterable, position: k.position }))
      );
    } catch {
      toast.error(t.moveFailed);
      await list.refresh({ silent: true });
    } finally {
      setMoving(false);
    }
  }

  async function confirmDelete() {
    if (!removing) return;
    try {
      await specKeyDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    list.setData(keys.filter((k) => k.id !== removing.id));
    setRemoving(null);
    toast.success(t.deletedToast);
  }

  /** The name in the dashboard's language, and the other one when it says something else. */
  const names = (k: SpecKey) => {
    const main = specKeyName(k.name);
    const other = [k.name.ar, k.name.en].map((s) => s?.trim()).find((s) => s && s !== main);
    return { main, other };
  };

  const menuOf = (k: SpecKey, index: number): ContextMenuItem[] => [
    { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(k) },
    { id: "up", label: t.menuUp, icon: IconArrowUp, separatorBefore: true, disabled: moving || index === 0, onSelect: () => void move(index, -1) },
    { id: "down", label: t.menuDown, icon: IconArrowDown, disabled: moving || index === keys.length - 1, onSelect: () => void move(index, 1) },
    { id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving(k) },
  ];

  const filterChip = (k: SpecKey) => (
    <StatusBadge value={k.filterable ? "on" : "off"} tone={k.filterable ? "success" : "neutral"} text={k.filterable ? t.filterOn : t.filterOff} />
  );

  const columns: Column<SpecKey>[] = [
    {
      key: "name",
      header: t.colName,
      cell: (k) => {
        const { main, other } = names(k);
        return (
          <span className="flex min-w-0 flex-col">
            <span className="font-medium text-ink">
              <bdi>{main}</bdi>
            </span>
            {other && (
              <span className="text-xs font-normal text-ink-soft">
                <bdi>{other}</bdi>
              </span>
            )}
          </span>
        );
      },
    },
    { key: "unit", header: t.colUnit, cell: (k) => (k.unit ? <bdi className="text-ink-soft">{k.unit}</bdi> : t.noUnit) },
    { key: "filter", header: t.colFilter, cell: filterChip },
    ...(canManage
      ? ([
          {
            key: "order",
            header: t.colOrder,
            cell: (k, index) => (
              <Own>
                <button
                  type="button"
                  disabled={moving || index === 0}
                  onClick={() => void move(index, -1)}
                  aria-label={fmt(t.moveUp, { name: specKeyName(k.name) })}
                  title={fmt(t.moveUp, { name: specKeyName(k.name) })}
                  className={ARROW}
                >
                  <IconArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={moving || index === keys.length - 1}
                  onClick={() => void move(index, 1)}
                  aria-label={fmt(t.moveDown, { name: specKeyName(k.name) })}
                  title={fmt(t.moveDown, { name: specKeyName(k.name) })}
                  className={ARROW}
                >
                  <IconArrowDown className="size-4" aria-hidden />
                </button>
              </Own>
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only">{t.colActions}</span>,
            align: "end",
            className: "whitespace-nowrap",
            cell: (k, index) => (
              <Own>
                <ItemMenu items={menuOf(k, index)} label={fmt(t.rowMenu, { name: specKeyName(k.name) })} />
              </Own>
            ),
          },
        ] satisfies Column<SpecKey>[])
      : []),
  ];

  const addButton = (
    <Button type="button" className="min-h-11 gap-2 rounded-full px-5" disabled={full} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/catalog", label: t.back }}
        // With no specifications at all, the empty state below carries the button.
        primaryAction={canManage && keys.length > 0 ? addButton : undefined}
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton rows={5} />}>
        {keys.length === 0 ? (
          <EmptyState
            icon={<IconChecklist weight="duotone" aria-hidden />}
            title={t.emptyTitle}
            description={canManage ? t.emptyHint : t.viewOnly}
            action={canManage ? addButton : undefined}
          />
        ) : (
          <div className="space-y-3">
            {/* A phone: one card per specification — its name and unit, the filter chip, its menu. */}
            <ul aria-label={t.title} className="flex flex-col gap-2.5 md:hidden">
              {keys.map((k, index) => {
                const { main, other } = names(k);
                const menu = canManage ? menuOf(k, index) : [];
                return (
                  <li key={k.id}>
                    <ContextMenu items={menu} label={fmt(t.rowMenu, { name: main })} disabled={!canManage}>
                      <ListRowCard
                        title={<bdi>{main}</bdi>}
                        amount={k.unit ? <bdi className="text-sm font-normal text-ink-soft">{k.unit}</bdi> : undefined}
                        status={filterChip(k)}
                        meta={other ? <bdi>{other}</bdi> : undefined}
                        action={canManage ? <ItemMenu items={menu} label={fmt(t.rowMenu, { name: main })} /> : undefined}
                        onOpen={canManage ? () => setEditing(k) : undefined}
                        openLabel={canManage ? fmt(t.editNamed, { name: main }) : undefined}
                      />
                    </ContextMenu>
                  </li>
                );
              })}
            </ul>
            <div className="zimos-list-sheet overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line max-md:hidden">
              <DataTable
                columns={columns}
                rows={keys}
                rowKey={(k) => k.id}
                minWidth="40rem"
                phoneCards={false}
                onRowClick={canManage ? (k) => setEditing(k) : undefined}
              />
            </div>
            <p className="text-xs text-ink-soft">
              <span className="tabular-nums">{fmt(t.countOf, { count: keys.length, max: SPEC_LIMITS.keys })}</span>
              {full && ` · ${fmt(t.limit, { max: SPEC_LIMITS.keys })}`}
              {!canManage && ` · ${t.viewOnly}`}
            </p>
          </div>
        )}
      </DataState>

      <SpecKeyDialog
        open={editing !== null}
        specKey={editing === "new" ? null : editing}
        nextPosition={nextPosition}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          setEditing(null);
          list.setData(created ? [...keys, saved] : keys.map((k) => (k.id === saved.id ? saved : k)));
          toast.success(created ? t.addedToast : t.savedToast);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.deleteTitle, { name: specKeyName(removing.name) }) : ""}
        description={t.deleteBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
