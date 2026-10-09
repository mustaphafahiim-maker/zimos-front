import { useMemo } from "react";
import { Input } from "@store-builder/ui";
import { CUSTOMER_FOLLOWUP_TITLE_MAX, apiFieldProblems, type CustomerFollowup } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { canListTeam } from "./crmAccess";
import type { NotesStrings } from "./notesStrings";

/** A follow-up as the form holds it. `who` is "me", "team" (the whole team) or a teammate's user id. */
export interface FollowupDraft {
  title: string;
  /** A `datetime-local` value on the viewer's own clock. */
  when: string;
  who: string;
}

export interface FollowupErrors {
  title?: string;
  when?: string;
  who?: string;
}

export interface Teammate {
  id: string;
  fullName: string;
}

/** `datetime-local` value on the viewer's own clock for an ISO time, and back. */
export function localInputOf(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isoOfLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A new follow-up starts at 10 tomorrow morning, assigned to whoever writes it. */
export function emptyFollowupDraft(): FollowupDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return { title: "", when: localInputOf(tomorrow.toISOString()), who: "me" };
}

export function followupDraftOf(followup: CustomerFollowup, myId: string | undefined): FollowupDraft {
  const who = followup.assignee === null ? "team" : followup.assignee.id === myId ? "me" : followup.assignee.id;
  return { title: followup.title, when: localInputOf(followup.dueAt), who };
}

/** The API's `assigneeUserId` for a form choice: the caller's own id, null for the whole team, or the teammate's. */
export function assigneeIdOf(who: string, myId: string | undefined): string | null | undefined {
  if (who === "team") return null;
  if (who === "me") return myId;
  return who;
}

/** What is missing in a draft, in the viewer's words; empty when it can be sent. */
export function checkFollowupDraft(draft: FollowupDraft, t: NotesStrings): FollowupErrors {
  const errors: FollowupErrors = {};
  if (!draft.title.trim()) errors.title = t.whatRequired;
  if (!isoOfLocalInput(draft.when)) errors.when = t.whenRequired;
  return errors;
}

/** The form's field errors for a refused save: a teammate who can't see customers, a bad time. */
export function followupErrorsOf(err: unknown, t: NotesStrings): FollowupErrors | null {
  const fields = apiFieldProblems(err).map((problem) => problem.field);
  if (fields.length === 0) return null;
  const errors: FollowupErrors = {};
  if (fields.includes("assigneeUserId")) errors.who = t.whoInvalid;
  if (fields.includes("dueAt")) errors.when = t.whenRequired;
  if (fields.includes("title")) errors.title = t.whatRequired;
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * The teammates a follow-up can be given to. Reading the team needs
 * users.manage: without it the list is empty and the form offers «أنا» and
 * «كل الفريق» only (the API still checks that the assignee can see customers).
 */
export function useTeammates(): Teammate[] {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const allowed = canListTeam(currentWorkspace?.role);
  const members = useAsync(() => (allowed ? apiClient.listWorkspaceMembers(workspaceId) : Promise.resolve([])), [workspaceId, allowed]);
  return useMemo(
    () =>
      (members.data ?? []).flatMap((member) =>
        member.status === "active" && member.user ? [{ id: member.user.id, fullName: member.user.fullName }] : []
      ),
    [members.data]
  );
}

/**
 * The three fields of a follow-up — what, when, who — shared by the add form
 * on the customer page and the edit dialog.
 */
export function FollowupFields({
  t,
  draft,
  errors,
  teammates,
  current,
  disabled,
  onChange,
}: {
  t: NotesStrings;
  draft: FollowupDraft;
  errors: FollowupErrors;
  teammates: Teammate[];
  /** The follow-up being edited: its assignee stays choosable even when the team list can't be read. */
  current?: CustomerFollowup;
  disabled?: boolean;
  onChange: (next: FollowupDraft) => void;
}) {
  const { user } = useAuth();
  const others = teammates.filter((mate) => mate.id !== user?.id);
  const kept = current?.assignee && current.assignee.id !== user?.id && !others.some((mate) => mate.id === current.assignee?.id) ? current.assignee : null;

  return (
    // Two columns where the form has the room for them (a dialog, the main column), one in the narrow side column:
    // measured on the form itself, not on the screen.
    <div className="@container">
    <div className="grid gap-4 @md:grid-cols-2">
      <TextField
        className="@md:col-span-2"
        label={t.whatLabel}
        required
        dir="auto"
        maxLength={CUSTOMER_FOLLOWUP_TITLE_MAX}
        placeholder={t.whatPlaceholder}
        value={draft.title}
        disabled={disabled}
        error={errors.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />
      <Field label={t.whenLabel} required error={errors.when}>
        {(props) => (
          <Input
            {...props}
            type="datetime-local"
            dir="ltr"
            value={draft.when}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, when: e.target.value })}
            className="min-h-11 md:min-h-10"
          />
        )}
      </Field>
      <Field label={t.whoLabel} error={errors.who}>
        {(props) => (
          <Select
            {...props}
            value={draft.who}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, who: e.target.value })}
            className="min-h-11 md:min-h-10"
          >
            <option value="me">{t.me}</option>
            <option value="team">{t.wholeTeam}</option>
            {kept && <option value={kept.id}>{kept.fullName ?? t.someone}</option>}
            {others.map((mate) => (
              <option key={mate.id} value={mate.id}>
                {mate.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
    </div>
  );
}
