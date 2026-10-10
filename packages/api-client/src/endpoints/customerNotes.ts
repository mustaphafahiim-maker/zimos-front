/**
 * Notes and follow-ups on customers (backend: frontend-handoff item 209, src/modules/customerNotes).
 *
 * Dashboard, /workspaces/:ws/customer-notes (customers.view unless noted):
 *   GET    /customers/:customerId            → { notes, followups } — pinned notes first, open follow-ups first
 *   POST   /customers/:customerId/notes      { body (1–5000), isPinned? } → 201 CustomerNote
 *   PATCH  /notes/:id { body?, isPinned? }   → CustomerNote — the author only, or customers.manage (else 403)
 *   DELETE /notes/:id                        → 204, same rule
 *   POST   /customers/:customerId/followups  { title (1–200), dueAt, assigneeUserId? } → 201 CustomerFollowup
 *          Left out, the assignee is the caller; null is the whole team. 422 on `assigneeUserId`
 *          when that teammate can't see customers.
 *   PATCH  /followups/:id { title?, dueAt?, assigneeUserId?, done? } → CustomerFollowup
 *          A new time or assignee is reminded again.
 *   DELETE /followups/:id                    (customers.manage) → 204
 *   GET    /followups?all=&dueBefore=        → { followups, overdue } — open ones, the caller's by default, soonest first
 *
 * When a follow-up falls due its assignee gets the merchant notification `customer.followup` once
 * (data: { followupId, customerId, customerName, title }, link /customers/:id).
 */
import type { ApiClient } from "../client";

/** Longest note the API takes. */
export const CUSTOMER_NOTE_MAX = 5000;
/** Longest follow-up title the API takes. */
export const CUSTOMER_FOLLOWUP_TITLE_MAX = 200;

/** A teammate as a note or follow-up names them. The answer to a create or a change carries the id only. */
export interface CustomerNotePerson {
  id: string;
  fullName?: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  body: string;
  isPinned: boolean;
  author: CustomerNotePerson | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerFollowup {
  id: string;
  customerId: string;
  /** Only in the open follow-ups list (GET /followups). */
  customer?: { id: string; fullName: string | null; phone: string | null };
  title: string;
  dueAt: string;
  doneAt: string | null;
  /** Open and past its time. */
  overdue: boolean;
  /** null: the whole team. */
  assignee: CustomerNotePerson | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomerNotesAndFollowups {
  notes: CustomerNote[];
  followups: CustomerFollowup[];
}

export interface CustomerFollowupPayload {
  title: string;
  /** ISO time. */
  dueAt: string;
  /** Left out: the caller. null: the whole team. */
  assigneeUserId?: string | null;
}

export interface CustomerFollowupPatch {
  title?: string;
  dueAt?: string;
  assigneeUserId?: string | null;
  done?: boolean;
}

export interface CustomerOpenFollowups {
  followups: CustomerFollowup[];
  /** How many of them are past their time. */
  overdue: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/customer-notes`;

export function customerNotesGet(client: ApiClient, workspaceId: string, customerId: string): Promise<CustomerNotesAndFollowups> {
  return client.request<CustomerNotesAndFollowups>(`${base(workspaceId)}/customers/${customerId}`);
}

export function customerNoteAdd(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: { body: string; isPinned?: boolean }
): Promise<CustomerNote> {
  return client.request<CustomerNote>(`${base(workspaceId)}/customers/${customerId}/notes`, { method: "POST", body });
}

export function customerNoteUpdate(
  client: ApiClient,
  workspaceId: string,
  noteId: string,
  body: { body?: string; isPinned?: boolean }
): Promise<CustomerNote> {
  return client.request<CustomerNote>(`${base(workspaceId)}/notes/${noteId}`, { method: "PATCH", body });
}

export async function customerNoteDelete(client: ApiClient, workspaceId: string, noteId: string): Promise<void> {
  await client.request<void>(`${base(workspaceId)}/notes/${noteId}`, { method: "DELETE" });
}

export function customerFollowupAdd(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: CustomerFollowupPayload
): Promise<CustomerFollowup> {
  return client.request<CustomerFollowup>(`${base(workspaceId)}/customers/${customerId}/followups`, { method: "POST", body });
}

export function customerFollowupUpdate(
  client: ApiClient,
  workspaceId: string,
  followupId: string,
  body: CustomerFollowupPatch
): Promise<CustomerFollowup> {
  return client.request<CustomerFollowup>(`${base(workspaceId)}/followups/${followupId}`, { method: "PATCH", body });
}

export async function customerFollowupDelete(client: ApiClient, workspaceId: string, followupId: string): Promise<void> {
  await client.request<void>(`${base(workspaceId)}/followups/${followupId}`, { method: "DELETE" });
}

/** Open follow-ups: the caller's by default, everyone's (and the whole team's) with `all`. */
export function customerFollowupsOpen(
  client: ApiClient,
  workspaceId: string,
  query: { all?: boolean; dueBefore?: string } = {}
): Promise<CustomerOpenFollowups> {
  const qs = new URLSearchParams();
  if (query.all) qs.set("all", "true");
  if (query.dueBefore) qs.set("dueBefore", query.dueBefore);
  const s = qs.toString();
  return client.request<CustomerOpenFollowups>(`${base(workspaceId)}/followups${s ? `?${s}` : ""}`);
}
