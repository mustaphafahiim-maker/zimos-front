import { useId, useState, type FormEvent, type ReactNode } from "react";
import { IconDelete, IconEdit, IconPin, IconPlus, IconUnpin } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  CUSTOMER_NOTE_MAX,
  customerFollowupAdd,
  customerFollowupDelete,
  customerFollowupUpdate,
  customerNoteAdd,
  customerNoteDelete,
  customerNoteUpdate,
  type CustomerFollowup,
  type CustomerFollowupPatch,
  type CustomerNote,
  type CustomerNotesAndFollowups,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import type { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { DataState, SkeletonBar } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { canManageCustomers } from "./crmAccess";
import {
  FollowupFields,
  assigneeIdOf,
  checkFollowupDraft,
  emptyFollowupDraft,
  followupDraftOf,
  followupErrorsOf,
  isoOfLocalInput,
  useTeammates,
  type FollowupDraft,
  type FollowupErrors,
  type Teammate,
} from "./FollowupFields";
import { NOTES_STRINGS, type NotesStrings } from "./notesStrings";

/** The customer's notes and follow-ups as the page loaded them (the section's folded row reads the same answer for its line). */
export type CustomerNotesState = ReturnType<typeof useAsync<CustomerNotesAndFollowups>>;

/** Pinned first, then newest first — the order the API lists them in. */
function sortNotes(notes: CustomerNote[]): CustomerNote[] {
  return [...notes].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt));
}

/** Open ones first by their time, then the done ones, the latest done first. */
function sortFollowups(followups: CustomerFollowup[]): CustomerFollowup[] {
  return [...followups].sort((a, b) => {
    if (!a.doneAt !== !b.doneAt) return a.doneAt ? 1 : -1;
    return a.doneAt && b.doneAt ? b.doneAt.localeCompare(a.doneAt) : a.dueAt.localeCompare(b.dueAt);
  });
}

/** A square icon button: 44 px on a phone, compact beside a mouse. */
const ICON_BUTTON = "size-11 text-ink-soft hover:text-ink pointer-fine:size-9";

/**
 * One of the panel's two halves — the notes, the follow-ups — inside the
 * section that holds both: a small heading with its line of help, an optional
 * control at its end, and a hairline between the two. No pane of its own: the
 * folding section around them is the pane.
 */
function Block({ title, hint, action, first, children }: { title: string; hint?: string; action?: ReactNode; first?: boolean; children: ReactNode }) {
  return (
    <section className={cn("min-w-0", !first && "mt-5 border-t border-line pt-4")}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-5 text-ink-soft">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The panel while the notes load: the field and two lines, at the height they will have. */
function NotesSkeleton() {
  return (
    <div>
      <SkeletonBar className="h-3.5 w-24" />
      <SkeletonBar className="mt-4 h-20 w-full rounded-[0.5rem]" />
      <SkeletonBar className="mt-4 w-4/5" />
      <SkeletonBar className="mt-3 w-3/5" />
    </div>
  );
}

/**
 * Customer page → «ملاحظات ومتابعات» (handoff 209): what the team wrote about
 * this customer, and the reminders to get back to them. A note is changed by
 * its author or by someone who manages customers; a follow-up is ticked done
 * by anyone who sees customers.
 *
 * It is the body of one folding section of the page (open in the side column
 * from lg up): the note field first — it is what is written during a call —
 * then the follow-ups, whose three-field form opens on «ضيف متابعة».
 */
export function CustomerNotesPanel({ customerId, state }: { customerId: string; state: CustomerNotesState }) {
  const t = useT(NOTES_STRINGS);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const manager = canManageCustomers(currentWorkspace?.role);
  const teammates = useTeammates();

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<NotesSkeleton />}>
      {state.data && (
        <div className="min-w-0">
          <NotesSection t={t} customerId={customerId} notes={state.data.notes} myId={user?.id} manager={manager} state={state} />
          <FollowupsSection
            t={t}
            customerId={customerId}
            followups={state.data.followups}
            myId={user?.id}
            manager={manager}
            teammates={teammates}
            state={state}
          />
        </div>
      )}
    </DataState>
  );
}

// ------------------------------------------------------------------ notes --

function NotesSection({
  t,
  customerId,
  notes,
  myId,
  manager,
  state,
}: {
  t: NotesStrings;
  customerId: string;
  notes: CustomerNote[];
  myId: string | undefined;
  manager: boolean;
  state: CustomerNotesState;
}) {
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState("");
  const [pinNew, setPinNew] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomerNote | null>(null);
  const [removing, setRemoving] = useState<CustomerNote | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setNotes = (change: (notes: CustomerNote[]) => CustomerNote[]) =>
    state.setData((prev) => ({ followups: prev?.followups ?? [], notes: sortNotes(change(prev?.notes ?? [])) }));
  // A 403 on a note is "not yours", said in those words.
  const refusal = (err: unknown) => (isPermissionError(err) ? t.notYours : errorMessage(err));

  async function add(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || adding) return;
    setAdding(true);
    setFailure(null);
    try {
      const created = await customerNoteAdd(apiClient, workspaceId, customerId, { body, isPinned: pinNew });
      setNotes((list) => [created, ...list]);
      setDraft("");
      setPinNew(false);
      toast.success(t.noteAdded);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function togglePin(note: CustomerNote) {
    setBusyId(note.id);
    try {
      const saved = await customerNoteUpdate(apiClient, workspaceId, note.id, { isPinned: !note.isPinned });
      // The answer to a change names the author by id only: keep the name the list already has.
      setNotes((list) => list.map((n) => (n.id === note.id ? { ...saved, author: n.author } : n)));
    } catch (err) {
      toast.error(refusal(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await customerNoteDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(refusal(err));
    }
    setNotes((list) => list.filter((n) => n.id !== removing.id));
    setRemoving(null);
    toast.success(t.noteDeleted);
  }

  return (
    <Block title={t.notesTitle} hint={t.notesHint} first>
      <form onSubmit={add} className="space-y-2">
        <Field label={t.noteLabel} labelHidden>
          {(props) => (
            <Textarea
              {...props}
              dir="auto"
              rows={3}
              maxLength={CUSTOMER_NOTE_MAX}
              placeholder={t.notePlaceholder}
              value={draft}
              disabled={adding}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={pinNew} disabled={adding} onChange={(e) => setPinNew(e.target.checked)} />
            {t.pinNew}
          </label>
          <Button type="submit" className="min-h-11 rounded-full px-5 pointer-fine:min-h-9" disabled={adding || !draft.trim()}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {adding ? t.adding : t.addNote}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-soft">{t.notesEmpty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {notes.map((note) => {
            const mine = note.author?.id === myId;
            const editable = mine || manager;
            return (
              // The three buttons sit under the note, so its text keeps the full width of a narrow column.
              <li key={note.id} data-pinned={note.isPinned ? "" : undefined} className="zimos-customer-note flex flex-col gap-1 py-3 last:pb-0">
                <div className="min-w-0">
                  <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">
                    {note.body}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
                    {note.isPinned && (
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        <IconPin className="size-3" weight="fill" aria-hidden />
                        {t.pinned}
                      </span>
                    )}
                    <bdi>{note.author?.fullName ?? t.someone}</bdi>
                    <time dateTime={note.createdAt} title={formatDateTime(note.createdAt)}>
                      {formatRelativeTime(note.createdAt)}
                    </time>
                  </p>
                </div>
                {editable && (
                  <div className="-ms-2.5 flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={ICON_BUTTON}
                      aria-label={note.isPinned ? t.unpin : t.pin}
                      aria-pressed={note.isPinned}
                      disabled={busyId === note.id}
                      onClick={() => void togglePin(note)}
                    >
                      {note.isPinned ? <IconUnpin className="size-4" aria-hidden /> : <IconPin className="size-4" aria-hidden />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={ICON_BUTTON} aria-label={t.editNote} onClick={() => setEditing(note)}>
                      <IconEdit className="size-4" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={ICON_BUTTON} aria-label={t.deleteNote} onClick={() => setRemoving(note)}>
                      <IconDelete className="size-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <EditNoteDialog
        t={t}
        note={editing}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          if (!editing) return;
          const saved = await customerNoteUpdate(apiClient, workspaceId, editing.id, { body });
          setNotes((list) => list.map((n) => (n.id === editing.id ? { ...saved, author: n.author } : n)));
        }}
        refusal={refusal}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t.deleteNoteTitle}
        description={t.deleteNoteBody}
        confirmLabel={common.delete}
        cancelLabel={common.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </Block>
  );
}

function EditNoteDialog({
  t,
  note,
  onClose,
  onSave,
  refusal,
}: {
  t: NotesStrings;
  note: CustomerNote | null;
  onClose: () => void;
  onSave: (body: string) => Promise<void>;
  refusal: (err: unknown) => string;
}) {
  const common = useCommon();
  const toast = useToast();
  const formId = useId();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  // Each opening starts from the note as it stands.
  if ((note?.id ?? null) !== openedFor) {
    setOpenedFor(note?.id ?? null);
    if (note) {
      setBody(note.body);
      setFailure(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !body.trim()) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave(body.trim());
      onClose();
      toast.success(t.noteSaved);
    } catch (err) {
      setFailure(refusal(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={note !== null}
      onClose={onClose}
      title={t.editNote}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving || !body.trim()}>
            {saving ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3">
        <Field label={t.editNoteLabel} labelHidden>
          {(props) => (
            <Textarea {...props} dir="auto" rows={5} maxLength={CUSTOMER_NOTE_MAX} value={body} disabled={saving} onChange={(e) => setBody(e.target.value)} />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------- follow-ups --

function FollowupsSection({
  t,
  customerId,
  followups,
  myId,
  manager,
  teammates,
  state,
}: {
  t: NotesStrings;
  customerId: string;
  followups: CustomerFollowup[];
  myId: string | undefined;
  manager: boolean;
  teammates: Teammate[];
  state: CustomerNotesState;
}) {
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  // The three fields open on «ضيف متابعة»; folded, they keep what was typed.
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<FollowupDraft>(emptyFollowupDraft);
  const [errors, setErrors] = useState<FollowupErrors>({});
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomerFollowup | null>(null);
  const [removing, setRemoving] = useState<CustomerFollowup | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The answer to a create or a change names the assignee by id only: the list is read again for the names.
  const reload = () => state.refresh({ silent: true });
  const setFollowups = (change: (list: CustomerFollowup[]) => CustomerFollowup[]) =>
    state.setData((prev) => ({ notes: prev?.notes ?? [], followups: sortFollowups(change(prev?.followups ?? [])) }));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (adding) return;
    const problems = checkFollowupDraft(draft, t);
    setErrors(problems);
    const dueAt = isoOfLocalInput(draft.when);
    if (Object.keys(problems).length > 0 || !dueAt) return;
    setAdding(true);
    setFailure(null);
    try {
      await customerFollowupAdd(apiClient, workspaceId, customerId, {
        title: draft.title.trim(),
        dueAt,
        assigneeUserId: assigneeIdOf(draft.who, myId),
      });
      setDraft(emptyFollowupDraft());
      setFormOpen(false);
      toast.success(t.followupAdded);
      await reload();
    } catch (err) {
      const fields = followupErrorsOf(err, t);
      if (fields) setErrors(fields);
      else setFailure(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(followup: CustomerFollowup) {
    const done = !followup.doneAt;
    setBusyId(followup.id);
    try {
      const saved = await customerFollowupUpdate(apiClient, workspaceId, followup.id, { done });
      setFollowups((list) => list.map((f) => (f.id === followup.id ? { ...saved, assignee: f.assignee } : f)));
      toast.success(done ? t.doneToast : t.reopened);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await customerFollowupDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    setFollowups((list) => list.filter((f) => f.id !== removing.id));
    setRemoving(null);
    toast.success(t.followupDeleted);
  }

  const who = (followup: CustomerFollowup) =>
    followup.assignee === null ? t.wholeTeam : followup.assignee.id === myId ? t.me : (followup.assignee.fullName ?? t.someone);

  return (
    <Block
      title={t.followupsTitle}
      hint={t.followupsHint}
      action={
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 rounded-full px-4 pointer-fine:min-h-9"
          aria-expanded={formOpen}
          aria-controls={formId}
          disabled={adding}
          onClick={() => setFormOpen((open) => !open)}
        >
          {formOpen ? (
            common.cancel
          ) : (
            <>
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.addFollowup}
            </>
          )}
        </Button>
      }
    >
      <form id={formId} hidden={!formOpen} onSubmit={add} noValidate className="mb-3 space-y-3">
        <FollowupFields t={t} draft={draft} errors={errors} teammates={teammates} disabled={adding} onChange={setDraft} />
        {failure && <Alert variant="danger">{failure}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" className="min-h-11 rounded-full px-5 pointer-fine:min-h-9" disabled={adding}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {adding ? t.adding : t.addFollowup}
          </Button>
        </div>
      </form>

      {followups.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">{t.followupsEmpty}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {followups.map((followup) => {
            const done = Boolean(followup.doneAt);
            return (
              <li key={followup.id} className="flex items-start gap-1 py-3 last:pb-0">
                {/* A 44 px target around the tick box. */}
                <label className="-ms-2 -mt-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    checked={done}
                    disabled={busyId === followup.id}
                    aria-label={fmt(t.markDone, { title: followup.title })}
                    onChange={() => void toggleDone(followup)}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className={cn("break-words text-sm leading-6 font-medium text-ink", done && "text-ink-soft line-through")}>
                    {followup.title}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
                    {followup.overdue && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
                    {done && <StatusBadge value="done" tone="success" text={t.doneBadge} />}
                    <time dateTime={followup.dueAt} className={cn(followup.overdue && "font-medium text-danger")}>
                      {formatDateTime(followup.dueAt)}
                    </time>
                    {!done && <span>({formatRelativeTime(followup.dueAt)})</span>}
                    <bdi>{who(followup)}</bdi>
                    {followup.doneAt && <span title={formatDateTime(followup.doneAt)}>{fmt(t.doneWhen, { when: formatRelativeTime(followup.doneAt) })}</span>}
                  </p>
                </div>
                <div className="-my-1 flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={ICON_BUTTON}
                    aria-label={fmt(t.editFollowupLabel, { title: followup.title })}
                    onClick={() => setEditing(followup)}
                  >
                    <IconEdit className="size-4" aria-hidden />
                  </Button>
                  {manager && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={ICON_BUTTON}
                      aria-label={fmt(t.deleteFollowup, { title: followup.title })}
                      onClick={() => setRemoving(followup)}
                    >
                      <IconDelete className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditFollowupDialog
        t={t}
        followup={editing}
        myId={myId}
        teammates={teammates}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          await customerFollowupUpdate(apiClient, workspaceId, editing.id, patch);
          await reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t.deleteFollowupTitle}
        description={t.deleteFollowupBody}
        confirmLabel={common.delete}
        cancelLabel={common.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </Block>
  );
}

function EditFollowupDialog({
  t,
  followup,
  myId,
  teammates,
  onClose,
  onSave,
}: {
  t: NotesStrings;
  followup: CustomerFollowup | null;
  myId: string | undefined;
  teammates: Teammate[];
  onClose: () => void;
  onSave: (patch: CustomerFollowupPatch) => Promise<void>;
}) {
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [draft, setDraft] = useState<FollowupDraft>(emptyFollowupDraft);
  const [errors, setErrors] = useState<FollowupErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [shown, setShown] = useState<CustomerFollowup | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  // Each opening starts from the follow-up as it stands; the dialog keeps it while it closes.
  if ((followup?.id ?? null) !== openedFor) {
    setOpenedFor(followup?.id ?? null);
    if (followup) {
      setShown(followup);
      setDraft(followupDraftOf(followup, myId));
      setErrors({});
      setFailure(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !shown) return;
    const problems = checkFollowupDraft(draft, t);
    setErrors(problems);
    const dueAt = isoOfLocalInput(draft.when);
    if (Object.keys(problems).length > 0 || !dueAt) return;
    // Only what changed goes: a new time or assignee makes the API remind again.
    const before = followupDraftOf(shown, myId);
    const patch: CustomerFollowupPatch = {};
    if (draft.title.trim() !== shown.title) patch.title = draft.title.trim();
    if (draft.when !== before.when) patch.dueAt = dueAt;
    if (draft.who !== before.who) patch.assigneeUserId = assigneeIdOf(draft.who, myId);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave(patch);
      onClose();
      toast.success(t.followupSaved);
    } catch (err) {
      const fields = followupErrorsOf(err, t);
      if (fields) setErrors(fields);
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={followup !== null}
      onClose={onClose}
      title={t.editFollowup}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-3">
        <FollowupFields t={t} draft={draft} errors={errors} teammates={teammates} current={shown ?? undefined} disabled={saving} onChange={setDraft} />
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
