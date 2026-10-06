import { useState } from "react";
import { ArrowDown, ArrowUp, Code2, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  STORE_SCRIPTS_DEFAULT_OPTIONS,
  storeScriptsDelete,
  storeScriptsList,
  storeScriptsUpdate,
  type StoreScript,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { StoreScriptDialog } from "./StoreScriptDialog";
import { SCRIPT_STRINGS } from "./storeScriptsStrings";

/** The store's own order: sortOrder, then the order the server sent. */
function ordered(list: StoreScript[]): StoreScript[] {
  return list
    .map((script, i) => ({ script, i }))
    .sort((a, b) => a.script.sortOrder - b.script.sortOrder || a.i - b.i)
    .map(({ script }) => script);
}

/**
 * Store settings → Custom code → Scripts (customCode/storeScripts.js,
 * website.publish): named snippets of the merchant's code, each in <head>,
 * at the start or the end of <body>, on the kinds of pages it names. A table
 * on wide screens, a list of cards on phones; add and edit in a dialog.
 */
export function StoreScriptsTab() {
  const t = useT(SCRIPT_STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // A 403 here (no website.publish) is the no-permission state DataState draws.
  const state = useAsync(() => storeScriptsList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<StoreScript | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoreScript | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const options = state.data?.options ?? STORE_SCRIPTS_DEFAULT_OPTIONS;
  const scripts = ordered(state.data?.scripts ?? []);
  const full = scripts.length >= options.maxScripts;
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const limitText = fmt(t.limit, { max: number(options.maxScripts) });

  const replace = (saved: StoreScript) =>
    state.setData((prev) => ({
      options: prev?.options ?? options,
      scripts: (prev?.scripts ?? []).some((s) => s.id === saved.id)
        ? (prev?.scripts ?? []).map((s) => (s.id === saved.id ? saved : s))
        : [...(prev?.scripts ?? []), saved],
    }));

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(script: StoreScript) {
    setEditing(script);
    setDialogOpen(true);
  }

  async function toggle(script: StoreScript, isActive: boolean) {
    setBusyId(script.id);
    replace({ ...script, isActive });
    try {
      replace(await storeScriptsUpdate(apiClient, workspaceId, script.id, { isActive }));
      toast.success(isActive ? t.turnedOn : t.turnedOff);
    } catch (err) {
      replace(script);
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  /** Swaps a script with its neighbour; two equal places are numbered afresh first. */
  async function move(index: number, by: -1 | 1) {
    const other = scripts[index + by];
    const script = scripts[index];
    if (!other || !script) return;
    const next = [...scripts];
    next[index] = other;
    next[index + by] = script;
    const distinct = new Set(scripts.map((s) => s.sortOrder)).size === scripts.length;
    const places = distinct ? scripts.map((s) => s.sortOrder) : scripts.map((_, i) => i + 1);
    const changes = next.map((s, i) => ({ script: s, sortOrder: places[i] })).filter((c) => c.script.sortOrder !== c.sortOrder);

    setBusyId(script.id);
    state.setData((prev) => ({ options: prev?.options ?? options, scripts: next.map((s, i) => ({ ...s, sortOrder: places[i] })) }));
    try {
      for (const change of changes) replace(await storeScriptsUpdate(apiClient, workspaceId, change.script.id, { sortOrder: change.sortOrder }));
      toast.success(t.moved);
    } catch (err) {
      toast.error(errorMessage(err));
      await state.refresh({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const script = pendingDelete;
    if (!script) return;
    await storeScriptsDelete(apiClient, workspaceId, script.id);
    setPendingDelete(null);
    state.setData((prev) => ({ options: prev?.options ?? options, scripts: (prev?.scripts ?? []).filter((s) => s.id !== script.id) }));
    toast.success(t.deleted);
  }

  const pageChips = (script: StoreScript) => (
    <span className="flex flex-wrap gap-1">
      {script.pages.map((page) => (
        <span key={page} className="rounded-[var(--radius-pill)] bg-paper-sunken px-2 py-0.5 text-xs text-ink-soft">
          {t[page]}
        </span>
      ))}
    </span>
  );

  const activeSwitch = (script: StoreScript, withWord = true) => (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink md:min-h-0">
      <input
        type="checkbox"
        role="switch"
        className="size-5 cursor-pointer accent-primary disabled:cursor-default"
        checked={script.isActive}
        disabled={busyId !== null}
        aria-label={fmt(t.toggle, { name: script.name })}
        onChange={(e) => void toggle(script, e.target.checked)}
      />
      {withWord && <span aria-hidden>{script.isActive ? t.on : t.off}</span>}
    </label>
  );

  const reorder = (script: StoreScript, index: number) => (
    <span className="flex gap-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={fmt(t.moveUp, { name: script.name })}
        title={fmt(t.moveUp, { name: script.name })}
        disabled={index === 0 || busyId !== null}
        onClick={() => void move(index, -1)}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={fmt(t.moveDown, { name: script.name })}
        title={fmt(t.moveDown, { name: script.name })}
        disabled={index === scripts.length - 1 || busyId !== null}
        onClick={() => void move(index, 1)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </span>
  );

  const rowActions = (script: StoreScript) => (
    <span className="flex justify-end gap-0.5">
      <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.edit, { name: script.name })} title={fmt(t.edit, { name: script.name })} onClick={() => openEdit(script)}>
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={fmt(t.remove, { name: script.name })}
        title={fmt(t.remove, { name: script.name })}
        className="text-danger hover:bg-danger-soft hover:text-danger"
        onClick={() => setPendingDelete(script)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </span>
  );

  const columns: Column<StoreScript>[] = [
    { key: "order", header: t.order, cell: (s, i) => reorder(s, i), className: "w-[5rem] px-2" },
    { key: "name", header: t.name, cell: (s) => <span className="font-medium text-ink" dir="auto">{s.name}</span> },
    { key: "position", header: t.position, cell: (s) => <span className="whitespace-nowrap text-ink-soft">{t[s.position]}</span> },
    { key: "pages", header: t.pages, cell: pageChips },
    { key: "active", header: t.active, cell: (s) => activeSwitch(s, false) },
    { key: "updated", header: t.updated, cell: (s) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDate(s.updatedAt)}</span> },
    { key: "actions", header: <span className="sr-only">{t.actions}</span>, cell: rowActions, align: "end" },
  ];

  const addButton = (
    <Button type="button" disabled={full} onClick={openNew}>
      <Plus className="size-4" aria-hidden />
      {t.add}
    </Button>
  );

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
      <div className="space-y-5">
        <Alert>
          <p className="font-medium">{t.liveOnly}</p>
          <p className="text-ink-soft">{t.trust}</p>
        </Alert>

        <Section
          title={t.title}
          description={t.description}
          flush
          actions={
            scripts.length > 0 ? (
              <>
                {full && <span className="text-xs text-ink-soft">{limitText}</span>}
                {addButton}
              </>
            ) : undefined
          }
        >
          {scripts.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState icon={<Code2 aria-hidden />} title={t.empty} description={t.emptyHint} action={addButton} />
            </div>
          ) : (
            <>
              {/* Phones: one card per script. */}
              <ul className="divide-y divide-line border-t border-line md:hidden">
                {scripts.map((script, index) => (
                  <li key={script.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink" dir="auto">
                          {script.name}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {t[script.position]} · {t.updated} {formatDate(script.updatedAt)}
                        </p>
                      </div>
                      {rowActions(script)}
                    </div>
                    {pageChips(script)}
                    <div className="flex items-center justify-between gap-2">
                      {activeSwitch(script)}
                      {reorder(script, index)}
                    </div>
                  </li>
                ))}
              </ul>
              {/* Wider screens: the table. */}
              <div className="hidden md:block">
                <DataTable columns={columns} rows={scripts} rowKey={(s) => s.id} minWidth="38rem" />
              </div>
            </>
          )}
          {scripts.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-xs text-ink-soft">
              {fmt(t.usage, { count: number(scripts.length), max: number(options.maxScripts) })}
            </p>
          )}
        </Section>
      </div>

      <StoreScriptDialog
        open={dialogOpen}
        script={editing}
        options={options}
        onClose={() => setDialogOpen(false)}
        onSaved={(saved, created) => {
          replace(saved);
          setDialogOpen(false);
          toast.success(created ? t.added : t.saved);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <p className="text-sm text-ink-soft">{fmt(t.deleteBody, { name: pendingDelete?.name ?? "" })}</p>
      </ConfirmDialog>
    </DataState>
  );
}
