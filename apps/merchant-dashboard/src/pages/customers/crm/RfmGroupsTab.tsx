import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { rfmOverview, type RfmLabelSummary } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCaretLeft, IconPeople } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { RFM_STRINGS, RFM_TONE, rfmLabelHelp, rfmLabelName } from "./rfmStrings";

/**
 * Customers → «تقسيم العملاء»: the nine RFM groups, each a card
 * with how many customers it holds, what the group means, what they spent and
 * their average orders. A group with customers in it opens the customers list
 * filtered to it (`/customers?group=`); an empty one is a quiet card with
 * nothing to open. Looking only: nothing here sends messages.
 */
export function RfmGroupsTab() {
  const t = useT(RFM_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  // Remembered for the session: coming back from a group's list shows the cards at once.
  const overview = useCachedAsync(`rfm-overview:${workspaceId}`, () => rfmOverview(apiClient, workspaceId), [workspaceId]);
  const data = overview.data;

  const tile = (group: RfmLabelSummary): ReactNode => {
    const name = rfmLabelName(t, group.label);
    const filled = group.customers > 0;
    const body = (
      <div
        className={cn(
          "zimos-crm-card flex h-full flex-col rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line",
          !filled && "opacity-70"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <StatusBadge value={group.label} tone={RFM_TONE[group.label]} text={name} className="text-sm" />
          <p className="flex shrink-0 items-center gap-1 text-sm leading-6 font-semibold text-ink tabular-nums">
            {pluralOf(t, "customers", group.customers)}
            {filled && <IconCaretLeft className="size-4 text-ink-soft ltr:rotate-180" aria-hidden />}
          </p>
        </div>
        <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">{rfmLabelHelp(t, group.label)}</p>
        <dl className="zimos-crm-card-foot mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div className="min-w-0">
            <dt className="text-xs leading-4 text-ink-soft">{t.spent}</dt>
            <dd className="mt-0.5 truncate text-[15px] leading-6 font-semibold text-ink tabular-nums">
              <bdi>{formatMoney(group.spent, currency)}</bdi>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs leading-4 text-ink-soft">{t.avgOrders}</dt>
            <dd className="mt-0.5 text-[15px] leading-6 font-semibold text-ink tabular-nums">{fmt("{n}", { n: group.avgOrders })}</dd>
          </div>
        </dl>
      </div>
    );
    // An empty group has no list to open.
    if (!filled) return body;
    return (
      <ViewLink
        to={`/customers?group=${group.label}`}
        aria-label={fmt(t.open, { label: name })}
        className="block h-full rounded-[var(--radius-card)] transition-[translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
      >
        {body}
      </ViewLink>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-3xl space-y-1">
        <p className="text-sm leading-6 text-ink-soft">{t.intro}</p>
        <p className="text-xs leading-5 text-ink-soft">{t.introNote}</p>
      </div>

      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()} skeleton="tiles">
        {data &&
          (data.total === 0 ? (
            <EmptyState icon={<IconPeople aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
          ) : (
            <div className="space-y-3">
              <p className="text-xs leading-5 text-ink-soft">
                <span className="font-medium text-ink">{pluralOf(t, "scored", data.total)}</span>
                {" · "}
                <time dateTime={data.computedAt} title={formatDateTime(data.computedAt)}>
                  {fmt(t.updated, { when: formatRelativeTime(data.computedAt) })}
                </time>
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.labels.map((group) => (
                  <li key={group.label}>{tile(group)}</li>
                ))}
              </ul>
            </div>
          ))}
      </DataState>
    </div>
  );
}
