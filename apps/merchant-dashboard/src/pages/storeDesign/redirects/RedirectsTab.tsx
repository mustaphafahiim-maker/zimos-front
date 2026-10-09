import { useEffect, useId, useState } from "react";
import { IconClose, IconDelete, IconEdit, IconEnter, IconExternal, IconFileUp, IconPlus, IconSearch } from "@/components/icons";
import { Button, Input } from "@store-builder/ui";
import { urlRedirectDelete, urlRedirectsList, type UrlRedirect, type UrlRedirectSource } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ImportRedirectsDialog } from "./ImportRedirectsDialog";
import { RedirectDialog } from "./RedirectDialog";
import { REDIRECT_STRINGS, SOURCE_KEY, STATUS_KEY } from "./redirectStrings";
import { STACK } from "../sections/parts";

type Filter = "all" | UrlRedirectSource;

const PAGE_SIZE = 50;

/** An address as typed: left to right whatever the page's direction; a long one breaks at a hyphen first, then wherever it must. */
function Address({ value, className }: { value: string; className?: string }) {
  return (
    <bdi dir="ltr" className={`font-mono text-[13px] [overflow-wrap:anywhere] ${className ?? ""}`}>
      {value}
    </bdi>
  );
}

/**
 * Store settings → URL redirects (frontend-handoff 232, website.edit): the
 * store's old address → new address list — typed here, added by itself when a
 * product's or collection's address changes, or imported as CSV — with how
 * often each one was used. Without the permission the list answers 403 and
 * DataState draws the no-permission card.
 */
export function RedirectsTab() {
  const t = useT(REDIRECT_STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const searchId = useId();

  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  // The search runs once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  // The API pages by offset; the list's cursor is the next offset.
  const [total, setTotal] = useState(0);
  // The first answer has arrived: from then on a new search keeps the page in place while it loads.
  const [ready, setReady] = useState(false);
  const list = useCursorList<UrlRedirect>(
    async (cursor) => {
      const offset = cursor ? Number(cursor) : 0;
      const page = await urlRedirectsList(apiClient, workspaceId, {
        q: q || undefined,
        source: filter === "all" ? undefined : filter,
        limit: PAGE_SIZE,
        offset,
      });
      setTotal(page.total);
      setReady(true);
      const next = offset + page.redirects.length;
      return { items: page.redirects, nextCursor: page.redirects.length > 0 && next < page.total ? String(next) : null };
    },
    [workspaceId, filter, q]
  );

  const [editing, setEditing] = useState<UrlRedirect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UrlRedirect | null>(null);

  const filtered = filter !== "all" || q !== "";
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const tabs: FilterTab<Filter>[] = [
    { value: "all", label: t.filterAll },
    { value: "manual", label: t.source_manual },
    { value: "auto", label: t.source_auto },
    { value: "import", label: t.source_import },
  ];

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    const redirect = pendingDelete;
    if (!redirect) return;
    await urlRedirectDelete(apiClient, workspaceId, redirect.id);
    setPendingDelete(null);
    list.setItems((prev) => prev.filter((r) => r.id !== redirect.id));
    setTotal((n) => Math.max(0, n - 1));
    toast.success(t.deleted);
  }

  const addButton = (
    <Button type="button" className="min-h-11 md:min-h-9" onClick={openNew}>
      <IconPlus className="size-4" aria-hidden />
      {t.add}
    </Button>
  );
  const importButton = (
    <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={() => setImportOpen(true)}>
      <IconFileUp className="size-4" aria-hidden />
      {t.importCsv}
    </Button>
  );

  const rowActions = (redirect: UrlRedirect) => {
    const tryLabel = fmt(t.tryIt, { path: redirect.fromPath });
    const editLabel = fmt(t.edit, { path: redirect.fromPath });
    const removeLabel = fmt(t.remove, { path: redirect.fromPath });
    return (
      <span className="flex justify-end gap-0.5">
        <Button asChild size="icon-sm" variant="ghost" className="size-11 md:size-8">
          <a href={`${STOREFRONT_URL}/store/${workspaceId}${redirect.fromPath}`} target="_blank" rel="noreferrer" aria-label={tryLabel} title={tryLabel}>
            <IconExternal className="size-4" aria-hidden />
          </a>
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-11 md:size-8"
          aria-label={editLabel}
          title={editLabel}
          onClick={() => {
            setEditing(redirect);
            setDialogOpen(true);
          }}
        >
          <IconEdit className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-11 text-danger hover:bg-danger-soft hover:text-danger md:size-8"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={() => setPendingDelete(redirect)}
        >
          <IconDelete className="size-4" aria-hidden />
        </Button>
      </span>
    );
  };

  const columns: Column<UrlRedirect>[] = [
    {
      key: "from",
      header: t.colFrom,
      cell: (r) => (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Address value={r.fromPath} className="font-medium text-ink" />
          {r.source !== "manual" && (
            <span className="rounded-[var(--radius-pill)] bg-paper-sunken px-2 py-0.5 text-xs font-normal whitespace-nowrap text-ink-soft">
              {t[SOURCE_KEY[r.source]]}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "to",
      header: t.colTo,
      cell: (r) => (
        <Address value={r.toPath} className="text-ink" />
      ),
    },
    {
      key: "type",
      header: t.colType,
      cell: (r) => <StatusBadge value={String(r.statusCode)} tone={r.statusCode === 301 ? "info" : "warning"} text={t[STATUS_KEY[r.statusCode]]} />,
    },
    {
      key: "hits",
      header: t.colHits,
      align: "end",
      cell: (r) => (
        <span className="flex flex-col items-end leading-tight" title={r.lastHitAt ? formatDateTime(r.lastHitAt) : t.neverHit}>
          <span className="tabular-nums text-ink">{number(r.hits)}</span>
          {r.lastHitAt && <span className="text-xs whitespace-nowrap text-ink-soft">{fmt(t.lastHit, { when: formatRelativeTime(r.lastHitAt) })}</span>}
        </span>
      ),
    },
    { key: "actions", header: <span className="sr-only">{t.colActions}</span>, cell: rowActions, align: "end", className: "w-[7.5rem]" },
  ];

  const nothingYet = !list.loading && list.items.length === 0 && !filtered;

  return (
    <DataState loading={list.loading && !ready} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton="table">
      <div className={STACK}>
        <Section
          title={t.title}
          description={t.description}
          actions={
            nothingYet ? undefined : (
              <>
                {importButton}
                {addButton}
              </>
            )
          }
        >
          {nothingYet ? (
            <EmptyState
              icon={<IconEnter aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyHint}
              action={
                <span className="flex flex-wrap justify-center gap-2">
                  {importButton}
                  {addButton}
                </span>
              }
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1 basis-56">
                <label htmlFor={searchId} className="sr-only">
                  {t.searchLabel}
                </label>
                <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  id={searchId}
                  // Text, not "search": the browser would add a second clear button beside ours.
                  type="text"
                  enterKeyHint="search"
                  dir="auto"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={200}
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
                    <IconClose className="size-4" aria-hidden />
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
          )}
        </Section>

        {!nothingYet &&
          (list.items.length === 0 && !list.loading ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
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
            <>
              <div className="md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line">
                <DataTable columns={columns} rows={list.items} rowKey={(r) => r.id} loading={list.loading} minWidth="38rem" />
              </div>
              {list.items.length > 0 && (
                <p className="text-xs text-ink-soft" aria-live="polite">
                  {pluralOf(t, "count", total)}
                </p>
              )}
              <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
            </>
          ))}
      </div>

      <RedirectDialog
        open={dialogOpen}
        redirect={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={(saved, created) => {
          setDialogOpen(false);
          toast.success(created ? t.added : t.saved);
          if (created) {
            // A new one is manual: it joins a list that shows manual ones and is not searching.
            if (!q && (filter === "all" || filter === "manual")) {
              list.setItems((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
              setTotal((n) => n + 1);
            } else {
              list.reload();
            }
          } else {
            list.setItems((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
          }
        }}
      />

      <ImportRedirectsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        // Imported paths may be new rows or changed ones anywhere in the list: read it again.
        onImported={list.reload}
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
        <p className="text-sm text-ink-soft">{fmt(t.deleteBody, { path: pendingDelete?.fromPath ?? "" })}</p>
        {pendingDelete?.source === "auto" && <p className="mt-2 text-sm text-ink-soft">{t.autoNote}</p>}
      </ConfirmDialog>
    </DataState>
  );
}
