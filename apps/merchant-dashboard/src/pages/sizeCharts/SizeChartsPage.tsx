import { useMemo, useState } from "react";
import { IconDelete, IconEdit, IconEye, IconPlus, IconRuler, IconSearch } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { sizeChartDelete, sizeChartsList, type SizeChart } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { QuickLook, quickLookRowProps } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { useToast } from "@/components/Toast";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { SIZE_CHART_STRINGS, sizeNames } from "./sizeChartStrings";

type Strings = Record<keyof (typeof SIZE_CHART_STRINGS)["en"], string>;

/** "2 collections · 14 products", or nothing when the chart shows nowhere yet. */
function attachedText(t: Strings, chart: SizeChart): string | null {
  const parts = [
    chart.collectionIds.length > 0 ? pluralOf(t, "collections", chart.collectionIds.length) : null,
    chart.productIds.length > 0 ? pluralOf(t, "products", chart.productIds.length) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Where a chart shows, as the row's chip: green once it reaches a product, quiet until then. */
function AttachedChip({ chart }: { chart: SizeChart }) {
  const t = useT(SIZE_CHART_STRINGS);
  const text = attachedText(t, chart);
  return <StatusBadge value={text ? "on" : "off"} tone={text ? "success" : "neutral"} text={text ?? t.notAttached} />;
}

/**
 * Products → Size charts (read products.view): every chart with
 * its sizes, its unit and what it is attached to. A row opens a Quick Look of
 * the table itself; "open and edit" inside it — or the chart's name — goes to
 * the editor.
 */
export function SizeChartsPage() {
  const t = useT(SIZE_CHART_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => sizeChartsList(apiClient, workspaceId), [workspaceId]);
  const charts = useMemo(() => list.data ?? [], [list.data]);
  const [search, setSearch] = useState("");
  const [peek, setPeek] = useState<{ chart: SizeChart; open: boolean } | null>(null);
  const [removing, setRemoving] = useState<SizeChart | null>(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return charts;
    return charts.filter((chart) => chart.name.toLowerCase().includes(q) || chart.rows.some((row) => (row[0] ?? "").toLowerCase().includes(q)));
  }, [charts, search]);

  const newButton = (
    <Button asChild className="min-h-11 gap-2 rounded-full px-5">
      <ViewLink to="/size-charts/new">
        <IconPlus className="size-4" aria-hidden />
        {t.newChart}
      </ViewLink>
    </Button>
  );

  const open = (chart: SizeChart) => navigate(`/size-charts/${chart.id}`);
  const look = (chart: SizeChart) => setPeek({ chart, open: true });

  const menuOf = (chart: SizeChart): ContextMenuItem[] => [
    { id: "peek", label: t.menuPeek, icon: IconEye, onSelect: () => look(chart) },
    { id: "open", label: t.menuOpen, icon: IconEdit, onSelect: () => open(chart) },
    { id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving(chart) },
  ];

  const columns: Column<SizeChart>[] = [
    {
      key: "name",
      header: t.colName,
      cell: (chart) => (
        <span className="flex min-w-0 flex-col">
          <ViewLink
            to={`/size-charts/${chart.id}`}
            onClick={(e) => e.stopPropagation()}
            className="self-start rounded-sm font-semibold text-ink hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <bdi>{chart.name}</bdi>
          </ViewLink>
          <bdi dir="auto" className="truncate text-xs font-normal text-ink-soft">
            {sizeNames(chart)}
          </bdi>
        </span>
      ),
    },
    {
      key: "sizes",
      header: t.colSizes,
      cell: (chart) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{pluralOf(t, "rows", chart.rows.length)}</span>,
    },
    { key: "unit", header: t.colUnit, cell: (chart) => <span className="text-ink-soft">{t[`unit_${chart.unit}`]}</span> },
    { key: "attached", header: t.colAttached, cell: (chart) => <AttachedChip chart={chart} /> },
    {
      key: "updated",
      header: t.colUpdated,
      cell: (chart) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{formatDate(chart.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.colActions}</span>,
      align: "end",
      cell: (chart) => (
        <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
          <ItemMenu items={menuOf(chart)} label={fmt(t.rowMenu, { name: chart.name })} />
        </span>
      ),
    },
  ];

  // Without products.view the page says so and offers nothing it would refuse.
  const denied = isPermissionError(list.error);

  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} description={t.description} primaryAction={denied || charts.length === 0 ? undefined : newButton} />

      <div className="flex flex-col gap-3">
        {charts.length > 0 && (
          <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
        )}

        <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton rows={4} />}>
          {charts.length === 0 ? (
            <EmptyState icon={<IconRuler aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.noMatch}
              action={
                <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setSearch("")}>
                  {t.clearSearch}
                </Button>
              }
            />
          ) : (
            <>
              <ul aria-label={t.title} className="flex flex-col gap-2.5 md:hidden">
                {shown.map((chart) => (
                  <li key={chart.id}>
                    <ContextMenu items={menuOf(chart)} label={fmt(t.rowMenu, { name: chart.name })}>
                      <ListRowCard
                        title={<bdi>{chart.name}</bdi>}
                        amount={<span className="text-sm font-normal text-ink-soft">{pluralOf(t, "rows", chart.rows.length)}</span>}
                        status={<AttachedChip chart={chart} />}
                        meta={<bdi dir="auto">{sizeNames(chart, 4)}</bdi>}
                        action={<ItemMenu items={menuOf(chart)} label={fmt(t.rowMenu, { name: chart.name })} />}
                        onOpen={() => look(chart)}
                        openLabel={fmt(t.peekNamed, { name: chart.name })}
                        aria-haspopup="dialog"
                        {...quickLookRowProps(() => look(chart))}
                      />
                    </ContextMenu>
                  </li>
                ))}
              </ul>
              <div className="zimos-list-sheet overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line max-md:hidden">
                <DataTable columns={columns} rows={shown} rowKey={(chart) => chart.id} onRowClick={look} minWidth="44rem" phoneCards={false} />
              </div>
            </>
          )}
        </DataState>
      </div>

      <ChartQuickLook
        chart={peek?.chart ?? null}
        open={Boolean(peek?.open)}
        onOpenChange={(next) => setPeek((current) => (current ? { ...current, open: next } : current))}
      />

      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.removeTitle, { name: removing.name }) : ""}
        description={t.removeBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.removing}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const id = removing.id;
          try {
            await sizeChartDelete(apiClient, workspaceId, id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          list.setData((prev) => (prev ?? []).filter((chart) => chart.id !== id));
          setPeek((current) => (current?.chart.id === id ? null : current));
          setRemoving(null);
          toast.success(t.removed);
        }}
      />
    </div>
  );
}

/** The chart as the shopper will read it: the table, the unit, the note and the picture, and where it shows. */
function ChartQuickLook({ chart, open, onOpenChange }: { chart: SizeChart | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(SIZE_CHART_STRINGS);
  const { locale } = useLocale();
  if (!chart) return null;

  const text = (value: { ar?: string | null; en?: string | null } | null | undefined) => {
    const ar = value?.ar?.trim() ?? "";
    const en = value?.en?.trim() ?? "";
    return locale === "ar" ? ar || en : en || ar;
  };
  const note = text(chart.note);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{chart.name}</bdi>}
      subtitle={`${pluralOf(t, "rows", chart.rows.length)} · ${t[`unitLong_${chart.unit}`]}`}
      status={<AttachedChip chart={chart} />}
      to={`/size-charts/${chart.id}`}
      openLabel={t.openEdit}
    >
      <div className="space-y-4">
        <div className="zimos-chart-peek overflow-x-auto rounded-[1rem] bg-paper-sunken/60 ring-1 ring-line">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                {chart.columns.map((column, index) => (
                  <th key={index} scope="col" className="border-b border-line px-3 py-2.5 text-start text-xs font-semibold text-ink-soft">
                    <bdi>{text(column)}</bdi>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-b-0">
                  {chart.columns.map((_, c) => (
                    <td key={c} className={c === 0 ? "px-3 py-2.5 font-semibold text-ink" : "px-3 py-2.5 tabular-nums text-ink"}>
                      <bdi dir="ltr">{row[c]?.trim() || t.emptyCell}</bdi>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {note && (
          <p className="text-sm text-ink">
            <bdi>{note}</bdi>
          </p>
        )}

        {chart.imageUrl && (
          <img src={chart.imageUrl} alt={t.image} loading="lazy" className="max-h-64 w-full rounded-[1rem] bg-paper-sunken object-contain ring-1 ring-line" />
        )}

        <p className="text-xs tabular-nums text-ink-soft">{fmt(t.updatedOn, { date: formatDate(chart.updatedAt) })}</p>
      </div>
    </QuickLook>
  );
}
