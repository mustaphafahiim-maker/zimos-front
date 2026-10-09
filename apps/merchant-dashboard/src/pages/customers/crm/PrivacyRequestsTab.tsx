import { useState } from "react";
import { Link } from "react-router-dom";
import { IconShield } from "@/components/icons";
import { Button } from "@store-builder/ui";
import {
  PRIVACY_NOTE_MAX,
  isApiErrorCode,
  privacyRequestComplete,
  privacyRequestDecline,
  privacyRequestsList,
  type PrivacyRequest,
  type PrivacyRequestKind,
  type PrivacyRequestStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { TABLE_SHEET, canManageCustomers } from "./crmAccess";
import { EraseDialog } from "./EraseDialog";
import { PRIVACY_STRINGS } from "./privacyStrings";

type StatusFilter = PrivacyRequestStatus | "all";
type KindFilter = PrivacyRequestKind | "all";

const STATUS_TONE: Record<PrivacyRequestStatus, "warning" | "success" | "neutral"> = {
  pending: "warning",
  completed: "success",
  declined: "neutral",
};

/**
 * Customers → «طلبات الخصوصية» (handoff 235): what shoppers asked for from
 * their account. A request to delete an account waits here: «نفّذ المسح»
 * erases the customer (it can't be undone; orders still on their way block it
 * unless forced), «ارفض» answers with a reason the shopper reads. A copy of
 * their data needs no decision and is listed as done.
 */
export function PrivacyRequestsTab({ onChanged }: { onChanged?: () => void }) {
  const t = useT(PRIVACY_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const manager = canManageCustomers(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [kind, setKind] = useState<KindFilter>("all");
  const list = useAsync(
    () => privacyRequestsList(apiClient, workspaceId, { status: status === "all" ? undefined : status, kind: kind === "all" ? undefined : kind }),
    [workspaceId, status, kind]
  );
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [declining, setDeclining] = useState<PrivacyRequest | null>(null);
  const [reason, setReason] = useState("");

  const requests = list.data?.requests ?? [];
  const nameOf = (request: PrivacyRequest) => request.requesterLabel?.trim() || t.someone;
  const afterDecision = () => {
    void list.refresh({ silent: true });
    onChanged?.();
  };
  // Someone else decided it meanwhile: say so, and show the list as it is now.
  const handled = (err: unknown): string | null => {
    if (!isApiErrorCode(err, "REQUEST_NOT_PENDING")) return null;
    afterDecision();
    return t.notPending;
  };

  async function confirmDecline() {
    if (!declining) return;
    if (!reason.trim()) throw new Error(t.declineReasonRequired);
    try {
      await privacyRequestDecline(apiClient, workspaceId, declining.id, reason.trim());
    } catch (err) {
      throw new Error(handled(err) ?? errorMessage(err));
    }
    setDeclining(null);
    toast.success(t.declined);
    afterDecision();
  }

  const statusTabs: FilterTab<StatusFilter>[] = [
    { value: "pending", label: t.status_pending },
    { value: "completed", label: t.status_completed },
    { value: "declined", label: t.status_declined },
    { value: "all", label: t.status_all },
  ];

  const columns: Column<PrivacyRequest>[] = [
    {
      key: "requester",
      header: t.colRequester,
      cell: (request) =>
        request.customerId ? (
          <Link to={`/customers/${request.customerId}`} className="font-medium text-primary hover:underline">
            <bdi>{nameOf(request)}</bdi>
          </Link>
        ) : (
          <bdi className="font-medium text-ink">{nameOf(request)}</bdi>
        ),
    },
    {
      key: "kind",
      header: t.colKind,
      cell: (request) => <span className="whitespace-nowrap text-ink">{request.kind === "erase" ? t.kind_erase : t.kind_export}</span>,
    },
    {
      key: "status",
      header: t.colStatus,
      cell: (request) => <StatusBadge value={request.status} tone={STATUS_TONE[request.status] ?? "neutral"} text={t[`status_${request.status}`] ?? request.status} />,
    },
    {
      key: "asked",
      header: t.colAsked,
      cell: (request) => (
        <time dateTime={request.createdAt} title={formatDateTime(request.createdAt)} className="whitespace-nowrap text-ink-soft">
          {formatRelativeTime(request.createdAt)}
        </time>
      ),
    },
    {
      key: "reason",
      header: t.colReason,
      phoneSkip: (request) => !request.reason,
      cell: (request) =>
        request.reason ? (
          <span dir="auto" className="line-clamp-3 max-w-xs break-words text-ink">
            {request.reason}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "decision",
      header: t.colDecision,
      phoneSkip: (request) => !request.decisionNote,
      cell: (request) =>
        request.decisionNote ? (
          <span dir="auto" className="line-clamp-3 max-w-xs break-words text-ink-soft">
            {request.decisionNote}
          </span>
        ) : (
          "—"
        ),
    },
  ];
  if (manager) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">{t.colActions}</span>,
      cell: (request) =>
        request.status === "pending" && request.kind === "erase" ? (
          <span className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="min-h-11 md:min-h-8"
              aria-label={fmt(t.completeFor, { name: nameOf(request) })}
              onClick={() => setCompleting(request)}
            >
              {t.complete}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 md:min-h-8"
              aria-label={fmt(t.declineFor, { name: nameOf(request) })}
              onClick={() => {
                setReason("");
                setDeclining(request);
              }}
            >
              {t.decline}
            </Button>
          </span>
        ) : null,
    });
  }

  const filtered = status !== "all" || kind !== "all";

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-ink-soft">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-full overflow-x-auto">
          <FilterTabs tabs={statusTabs} value={status} onChange={setStatus} label={t.statusLabel} buttonClassName="min-h-11 whitespace-nowrap md:min-h-0" />
        </div>
        <Field label={t.kindLabel} labelHidden className="min-w-0 flex-1 basis-40 md:max-w-56 md:flex-none">
          {(props) => (
            <Select {...props} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
              <option value="all">
                {t.kindLabel}: {t.kind_all}
              </option>
              <option value="erase">{t.kind_erase}</option>
              <option value="export">{t.kind_export}</option>
            </Select>
          )}
        </Field>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton="table">
        {requests.length === 0 ? (
          status === "pending" && kind === "all" ? (
            <EmptyState
              icon={<IconShield aria-hidden />}
              title={t.emptyPendingTitle}
              description={t.emptyPendingHint}
              action={
                <Button type="button" variant="outline" onClick={() => setStatus("all")}>
                  {t.showAll}
                </Button>
              }
            />
          ) : filtered ? (
            <EmptyState
              title={t.emptyFiltered}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatus("all");
                    setKind("all");
                  }}
                >
                  {t.showAll}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<IconShield aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
          )
        ) : (
          <div className={TABLE_SHEET}>
            <DataTable columns={columns} rows={requests} rowKey={(request) => request.id} minWidth="56rem" />
          </div>
        )}
      </DataState>

      <EraseDialog
        open={completing !== null}
        title={completing ? fmt(t.completeTitle, { name: nameOf(completing) }) : ""}
        confirmLabel={t.completeConfirm}
        onCancel={() => setCompleting(null)}
        describeError={handled}
        onErase={async (body) => {
          if (!completing) return;
          await privacyRequestComplete(apiClient, workspaceId, completing.id, body);
          setCompleting(null);
          toast.success(t.completed);
          afterDecision();
        }}
      />
      <ConfirmDialog
        open={declining !== null}
        title={t.declineTitle}
        description={t.declineBody}
        confirmLabel={t.declineConfirm}
        cancelLabel={common.cancel}
        busyLabel={t.declining}
        onCancel={() => setDeclining(null)}
        onConfirm={confirmDecline}
      >
        <Field label={t.declineReason} required>
          {(props) => <Textarea {...props} dir="auto" rows={3} maxLength={PRIVACY_NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </ConfirmDialog>
    </div>
  );
}
