import { useState } from "react";
import { cn } from "@store-builder/ui";
import { customerFollowupUpdate, customerFollowupsOpen, type CustomerFollowup } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconBellRinging, IconCheck } from "@/components/icons";
import { ListSkeleton } from "@/components/list";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { NOTES_STRINGS } from "./notesStrings";

type Scope = "mine" | "team";

/**
 * Customers → «متابعاتي» (handoff 209): the open follow-ups assigned to the
 * viewer, soonest first, with how many are overdue; «كل الفريق» shows
 * everyone's (and who each one is on).
 *
 * One sheet of rows. A row: the round box that marks it done (it leaves the
 * list at once, and the toast offers to bring it back), what to do, when — in
 * the danger tone once it is late — the customer (their page opens on its
 * notes), and call / WhatsApp at the row's end, because a follow-up is nearly
 * always a call.
 */
export function MyFollowupsTab({ onChanged }: { onChanged?: () => void }) {
  const t = useT(NOTES_STRINGS);
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [scope, setScope] = useState<Scope>("mine");
  const list = useAsync(() => customerFollowupsOpen(apiClient, workspaceId, { all: scope === "team" }), [workspaceId, scope]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const followups = list.data?.followups ?? [];
  // Counted here rather than read from the answer, so a tick updates it at once.
  const overdue = followups.filter((followup) => followup.overdue).length;

  async function markDone(followup: CustomerFollowup) {
    if (busyId !== null) return;
    setBusyId(followup.id);
    try {
      await customerFollowupUpdate(apiClient, workspaceId, followup.id, { done: true });
      list.setData((prev) => {
        const left = (prev?.followups ?? []).filter((f) => f.id !== followup.id);
        return { followups: left, overdue: left.filter((f) => f.overdue).length };
      });
      onChanged?.();
      // Ticked by mistake: the same call the customer's page uses to open one again.
      toast.undo(t.doneToast, async () => {
        await customerFollowupUpdate(apiClient, workspaceId, followup.id, { done: false });
        await list.refresh({ silent: true });
        onChanged?.();
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm leading-6 text-ink-soft">{scope === "team" ? t.teamHint : t.myHint}</p>
          {overdue > 0 && <StatusBadge value="overdue" tone="danger" text={pluralOf(t, "overdueCount", overdue)} />}
        </div>
        <Segmented
          label={t.scopeLabel}
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: t.scopeMine },
            { value: "team", label: t.scopeTeam },
          ]}
        />
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton rows={5} variant="card" />}>
        {followups.length === 0 ? (
          <EmptyState
            tone="success"
            icon={<IconBellRinging aria-hidden />}
            title={scope === "team" ? t.teamEmptyTitle : t.myEmptyTitle}
            description={t.myEmptyHint}
          />
        ) : (
          <ul className="zimos-crm-list overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
            {followups.map((followup) => {
              const busy = busyId === followup.id;
              const name = followup.customer?.fullName?.trim() || t.noName;
              return (
                <li key={followup.id} className="flex items-start gap-1 border-b border-line py-2 ps-1.5 pe-3 last:border-b-0 sm:gap-2 sm:ps-2.5 sm:pe-4">
                  {/* A 44px target around a 24px round box: ticked while it is being saved, then the row leaves. */}
                  <button
                    type="button"
                    disabled={busyId !== null}
                    aria-label={fmt(t.markDone, { title: followup.title })}
                    title={fmt(t.markDone, { title: followup.title })}
                    onClick={() => void markDone(followup)}
                    className="group/done flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed"
                  >
                    <span
                      data-busy={busy ? "" : undefined}
                      className={cn(
                        "zimos-crm-done flex size-6 items-center justify-center rounded-full ring-[1.5px] ring-line-strong transition-[scale,background-color] duration-[var(--dur-pop)] ease-[var(--ease-pop)] group-hover/done:ring-primary group-active/done:scale-90 motion-reduce:transition-none motion-reduce:group-active/done:scale-100",
                        busy ? "bg-primary text-primary-foreground ring-primary" : "bg-paper text-transparent group-hover/done:text-primary"
                      )}
                    >
                      <IconCheck className="size-3.5" weight="bold" aria-hidden />
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 py-1.5">
                    <p dir="auto" className="text-[15px] leading-6 font-medium break-words text-ink">
                      {followup.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                      {followup.overdue && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
                      <time
                        dateTime={followup.dueAt}
                        title={formatDateTime(followup.dueAt)}
                        className={cn("whitespace-nowrap", followup.overdue ? "font-medium text-danger" : "text-ink")}
                      >
                        {formatRelativeTime(followup.dueAt)}
                      </time>
                      <span className="whitespace-nowrap text-xs text-ink-soft max-sm:hidden">{formatDateTime(followup.dueAt)}</span>
                      {scope === "team" && (
                        <span className="text-xs text-ink-soft">
                          <span className="sr-only">{t.colWho}: </span>
                          <bdi>
                            {followup.assignee === null ? t.wholeTeam : followup.assignee.id === user?.id ? t.me : (followup.assignee.fullName ?? t.someone)}
                          </bdi>
                        </span>
                      )}
                    </p>
                    {/* The customer: their page opens on its notes and follow-ups. */}
                    <ViewLink
                      to={`/customers/${followup.customerId}?tab=notes`}
                      className="-ms-2 mt-0.5 inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-[13px] leading-5 font-medium text-ink transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:min-h-11"
                    >
                      <span className="min-w-0 truncate underline decoration-line-strong underline-offset-4">
                        <bdi>{name}</bdi>
                      </span>
                      {followup.customer?.phone && (
                        <span className="shrink-0 text-xs font-normal text-ink-soft tabular-nums">
                          <bdi dir="ltr">{followup.customer.phone}</bdi>
                        </span>
                      )}
                    </ViewLink>
                  </div>

                  {/* One tap to make the call the follow-up is about. */}
                  <ContactActions
                    phone={followup.customer?.phone}
                    name={followup.customer?.fullName}
                    variant="icon"
                    className="shrink-0 self-center"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </DataState>
    </div>
  );
}
