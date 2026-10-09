import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { trashList, trashPurge, trashRestore, type TrashItem, type TrashKind } from "@store-builder/api-client";
import { IconDelete, IconRefresh, IconUndo } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { canPublishFunnels } from "@/pages/funnels/editor/funnelMeta";
import { TRASH_STRINGS, trashCacheKey } from "./trashStrings";

type Tab = "all" | TrashKind;
const KINDS: readonly TrashKind[] = ["funnel", "website", "page"];
const TAB_LABEL = { funnel: "funnels", website: "websites", page: "pages" } as const;

/**
 * /trash (handoff 373): the funnels, websites and pages deleted in the last 30
 * days, in one table, with a chip per kind. Each row can be restored (it comes
 * back exactly as it was: a published one is live again at once) or deleted
 * for good, behind a confirmation. Reached from «سلة المحذوفات» on the funnels
 * list and the online store page; `?from=` says which one the back link names.
 *
 * The list holds only the kinds the teammate may manage, so a chip with nothing
 * behind it is not drawn; with neither permission the read is a 403 and
 * DataState says so.
 */
export function TrashPage() {
  const t = useT(TRASH_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  // Putting a published funnel or website back is putting it live: the same role as publishing.
  const mayPublish = canPublishFunnels(currentWorkspace?.role);
  const [params, setParams] = useSearchParams();
  const fromWebsite = params.get("from") === "website";
  const asked = params.get("kind");
  const tab: Tab = KINDS.includes(asked as TrashKind) ? (asked as TrashKind) : "all";

  const trash = useCachedAsync(trashCacheKey(workspaceId), () => trashList(apiClient, workspaceId), [workspaceId]);
  const items = useMemo(() => trash.data?.items ?? [], [trash.data]);
  const shown = tab === "all" ? items : items.filter((item) => item.kind === tab);
  const days = trash.data?.retentionDays ?? 30;

  const [busy, setBusy] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);

  const overrides = {
    PAGE_PATH_IN_TRASH: t.PAGE_PATH_IN_TRASH,
    WEBSITE_HAS_DOMAINS: t.WEBSITE_HAS_DOMAINS,
    WEBSITE_IN_TRASH: t.WEBSITE_IN_TRASH,
    NOT_FOUND: t.NOT_FOUND,
    FUNNEL_SUBDOMAIN_TAKEN: t.FUNNEL_SUBDOMAIN_TAKEN,
  };

  /** The lists these things come back to (or leave for good) are read again on their next visit. */
  function forgetLists() {
    invalidateCached("trash:");
    invalidateCached("funnels:");
    invalidateCached("funnel-steps:");
    invalidateCached("website");
  }

  async function restore(item: TrashItem) {
    setBusy(item.id);
    try {
      await trashRestore(apiClient, workspaceId, item.kind, item.id);
      toast.success(fmt(item.kind !== "page" && item.status === "published" ? t.restoredLive : t.restored, { name: item.name }));
      forgetLists();
      await trash.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, overrides));
      // Gone meanwhile (restored or purged in another tab): the list says so.
      void trash.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    if (!purging) return;
    try {
      await trashPurge(apiClient, workspaceId, purging.kind, purging.id);
    } catch (err) {
      throw new Error(errorMessage(err, overrides));
    }
    toast.success(fmt(t.purged, { name: purging.name }));
    setPurging(null);
    forgetLists();
    await trash.refresh({ silent: true });
  }

  /** Why Restore is off for this row, in words; null when it may be pressed. */
  function blocked(item: TrashItem): string | null {
    if (item.kind === "page" && item.websiteInTrash) return t.websiteFirst;
    if (item.kind !== "page" && item.status === "published" && !mayPublish) return t.needsPublish;
    return null;
  }

  const number = (n: number) => new Intl.NumberFormat(getIntlLocale()).format(n);
  const present = KINDS.filter((kind) => items.some((item) => item.kind === kind));
  const chips: ChipItem<Tab>[] = [
    { value: "all", label: t.all, count: items.length },
    ...present.map((kind) => ({ value: kind as Tab, label: t[TAB_LABEL[kind]], count: items.filter((item) => item.kind === kind).length })),
  ];
  const setTab = (next: Tab) => {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("kind");
    else query.set("kind", next);
    setParams(query, { replace: true });
  };

  const columns: Column<TrashItem>[] = [
    {
      key: "name",
      header: t.colName,
      cell: (item) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <bdi className="min-w-0 truncate font-medium text-ink">{item.name}</bdi>
            {item.kind !== "page" && item.status === "published" && <StatusBadge value="published" tone="neutral" text={t.wasPublished} />}
          </p>
          {item.kind === "page" ? (
            <p className="mt-0.5 text-xs text-ink-soft">
              <bdi dir="ltr">{item.path}</bdi>
              {item.websiteName ? (
                <>
                  {" · "}
                  <bdi>{item.websiteName}</bdi>
                </>
              ) : null}
            </p>
          ) : (
            item.subdomain && (
              <p className="mt-0.5 text-xs text-ink-soft">
                <bdi dir="ltr">{item.subdomain}</bdi>
              </p>
            )
          )}
        </div>
      ),
    },
    { key: "kind", header: t.colKind, cell: (item) => t[`kind_${item.kind}`] },
    {
      key: "deleted",
      header: t.colDeleted,
      cell: (item) => (
        <div>
          <p>{formatDate(item.deletedAt)}</p>
          {item.deletedBy?.fullName && <p className="text-xs text-ink-soft">{fmt(t.by, { name: item.deletedBy.fullName })}</p>}
        </div>
      ),
    },
    { key: "purge", header: t.colPurge, cell: (item) => formatDate(item.purgeAt) },
    {
      key: "actions",
      header: <span className="sr-only">{t.colActions}</span>,
      align: "end",
      cell: (item) => {
        const reason = blocked(item);
        const working = busy === item.id;
        return (
          <div className="flex flex-col items-stretch gap-1 md:items-end">
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 rounded-full px-4 md:min-h-9"
                disabled={reason !== null || busy !== null}
                aria-describedby={reason ? `trash-why-${item.id}` : undefined}
                onClick={() => void restore(item)}
              >
                <IconUndo className="size-4" aria-hidden />
                {working ? t.restoring : t.restore}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11 rounded-full px-4 text-danger hover:bg-danger-soft hover:text-danger md:min-h-9"
                disabled={busy !== null}
                onClick={() => setPurging(item)}
              >
                <IconDelete className="size-4" aria-hidden />
                {t.purge}
              </Button>
            </div>
            {reason && (
              <p id={`trash-why-${item.id}`} className="text-xs leading-5 text-ink-soft md:text-end">
                {reason}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={days === 30 ? t.hint : fmt(t.hintDays, { n: number(days) })}
        back={fromWebsite ? { to: "/website", label: t.backWebsite } : { to: "/funnels", label: t.backFunnels }}
        actions={
          <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => void trash.refresh({ silent: true })}>
            <IconRefresh className="size-4" aria-hidden />
            {t.refresh}
          </Button>
        }
      />

      <DataState loading={trash.loading && !trash.data} error={trash.data ? null : trash.error} onRetry={() => void trash.refresh()} skeleton="table">
        {items.length === 0 ? (
          <EmptyState icon={<IconDelete aria-hidden />} title={t.emptyTitle} description={days === 30 ? t.hint : fmt(t.hintDays, { n: number(days) })} />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <ChipRow items={chips} value={tab} onChange={setTab} label={t.tabs} collapseEmpty={false} />
            <DataTable
              columns={columns}
              rows={shown}
              rowKey={(item) => `${item.kind}:${item.id}`}
              minWidth="52rem"
              empty={<EmptyState icon={<IconDelete aria-hidden />} title={t.emptyKind} />}
            />
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={purging !== null}
        title={fmt(t.purgeTitle, { name: purging?.name ?? "" })}
        description={purging?.kind === "funnel" ? t.purgeBodyFunnel : t.purgeBody}
        confirmLabel={t.purge}
        cancelLabel={t.cancel}
        busyLabel={t.purging}
        destructive
        onCancel={() => setPurging(null)}
        onConfirm={purge}
      />
    </div>
  );
}
