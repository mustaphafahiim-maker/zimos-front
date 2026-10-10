import { useEffect, useState } from "react";
import { Button } from "@store-builder/ui";
import { ApiError, emailSuppressionsLift, emailSuppressionsList, isInvalidCursorError, type EmailSuppression, type EmailSuppressionReason } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconEmail } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { TABLE_SHEET, canManageCustomers } from "../crm/crmAccess";
import { SUPPRESSION_STRINGS, suppressionReason } from "./suppressionStrings";

export const SUPPRESSED_TAB = "suppressed";

export function isSuppressedTab(value: string | null | undefined): value is typeof SUPPRESSED_TAB {
  return value === SUPPRESSED_TAB;
}

/** The chip of the Customers page's tab row. A place opened now and then: a tab, not a line in the side menu. */
export function useSuppressedContactTab(): ChipItem<typeof SUPPRESSED_TAB> {
  const t = useT(SUPPRESSION_STRINGS);
  return { value: SUPPRESSED_TAB, label: t.tab };
}

type ReasonFilter = EmailSuppressionReason | "all";

/**
 * Customers → «عناوين موقوفة»: the addresses no email goes to,
 * because one bounced for good or the customer marked one as spam — why, what
 * the provider said, since when, and «رفع الإيقاف» to let emails through
 * again (customers.manage; it asks first, since a wrong address only bounces
 * again). The server finds one address at a time, so the search takes a whole
 * address; the list pages back with «اعرض كمان».
 */
export function EmailSuppressionsTab() {
  const t = useT(SUPPRESSION_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const manager = canManageCustomers(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [reason, setReason] = useState<ReasonFilter>("all");
  const [search, setSearch] = useState("");
  // The request waits for the typing to stop; the field never does.
  const [email, setEmail] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setEmail(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [lifting, setLifting] = useState<EmailSuppression | null>(null);

  const list = useCursorList<EmailSuppression>(
    async (cursor) => {
      const page = await emailSuppressionsList(apiClient, workspaceId, { email: email || undefined, reason: reason === "all" ? undefined : reason, limit: 50, cursor });
      return { items: page.suppressions, nextCursor: page.next };
    },
    [workspaceId, email, reason],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  const filtered = reason !== "all" || email !== "";
  const reasonTabs: FilterTab<ReasonFilter>[] = [
    { value: "all", label: t.reason_all },
    { value: "hard_bounce", label: t.reason_hard_bounce },
    { value: "complaint", label: t.reason_complaint },
  ];

  const columns: Column<EmailSuppression>[] = [
    {
      key: "email",
      header: t.email,
      cell: (row) => (
        <bdi dir="ltr" className="font-medium break-all text-ink">
          {row.email}
        </bdi>
      ),
    },
    {
      key: "reason",
      header: t.reason,
      cell: (row) => <StatusBadge value={row.reason} tone={row.reason === "complaint" ? "warning" : "danger"} text={suppressionReason(t, row.reason)} />,
    },
    {
      key: "detail",
      header: t.detail,
      cell: (row) =>
        row.detail ? (
          <bdi dir="ltr" className="text-[13px] break-words text-ink-soft">
            {row.detail}
          </bdi>
        ) : (
          "—"
        ),
    },
    { key: "date", header: t.date, cell: (row) => <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>, className: "whitespace-nowrap" },
    ...(manager
      ? [
          {
            key: "actions",
            header: <span className="sr-only">{t.lift}</span>,
            align: "end" as const,
            cell: (row: EmailSuppression) => (
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" aria-label={fmt(t.liftFor, { email: row.email })} onClick={() => setLifting(row)}>
                {t.lift}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-ink-soft">{t.help}</p>

      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.search }}>
        <div className="max-w-full overflow-x-auto">
          <FilterTabs tabs={reasonTabs} value={reason} onChange={setReason} label={t.reasonFilter} buttonClassName="min-h-11 whitespace-nowrap md:min-h-0" />
        </div>
      </ListToolbar>

      <DataState loading={list.loading} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton="table">
        {list.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title={t.emptyFiltered}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReason("all");
                    setSearch("");
                  }}
                >
                  {t.showAll}
                </Button>
              }
            />
          ) : (
            <EmptyState tone="success" icon={<IconEmail aria-hidden />} title={t.emptyTitle} />
          )
        ) : (
          <>
            <div className={TABLE_SHEET}>
              <DataTable columns={columns} rows={list.items} rowKey={(row) => row.id} minWidth="44rem" />
            </div>
            {list.error ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage(list.error)}
              </p>
            ) : null}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </DataState>

      <ConfirmDialog
        open={lifting !== null}
        title={lifting ? fmt(t.confirmTitle, { email: lifting.email }) : ""}
        description={t.confirmBody}
        confirmLabel={t.confirm}
        onCancel={() => setLifting(null)}
        onConfirm={async () => {
          if (!lifting) return;
          const target = lifting;
          try {
            await emailSuppressionsLift(apiClient, workspaceId, target.id);
            toast.success(fmt(t.lifted, { email: target.email }));
          } catch (err) {
            // Lifted meanwhile by someone else: the row leaves the list all the same.
            if (!(err instanceof ApiError && err.status === 404)) throw err;
            toast.success(t.gone);
          }
          list.setItems((rows) => rows.filter((row) => row.id !== target.id));
          setLifting(null);
        }}
      />
    </div>
  );
}
