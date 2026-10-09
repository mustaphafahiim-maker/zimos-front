/**
 * Transfer a store to another owner (backend: frontend-handoff item 252, src/modules/storeTransfer).
 *
 * /workspaces/:ws/ownership-transfer — the store's owner only; anyone else gets 403 NOT_STORE_OWNER.
 *   GET  /candidates → { candidates: TransferCandidate[] } — the active team members with an
 *        active account (the owner left out). Someone not on the team is invited first.
 *   POST / StoreTransferPayload → StoreTransferResult. The new person becomes the owner (role
 *        Owner); the old owner becomes store manager, stays an owner, or leaves the team. The
 *        plan and subscription stay with the store; both people get an email.
 *        422 VALIDATION_ERROR on `password` (wrong, or the account has none — one made through
 *        Google) and on `newOwnerUserId` (yourself); 404 when the person is no longer an active
 *        member; 409 PLAN_LIMIT_REACHED (details.max, details.used) when the new owner's plan
 *        has no room for another store.
 *
 * After `leave` the caller has no access to the store; after `workspace_manager` their
 * permissions changed — the workspace list is read again either way.
 */
import type { ApiClient } from "../client";

/** What the owner becomes once the store is someone else's. */
export type StoreTransferKeepAs = "workspace_manager" | "owner" | "leave";

export interface StoreTransferCandidate {
  userId: string;
  fullName: string | null;
  email: string;
  role: { key: string; name: string } | null;
}

export interface StoreTransferPayload {
  newOwnerUserId: string;
  /** The owner's own password. */
  password: string;
  /** Default "workspace_manager". */
  keepAs?: StoreTransferKeepAs;
}

export interface StoreTransferResult {
  workspace: { id: string; name: string; ownerUserId: string };
  newOwner: { userId: string; fullName: string | null; email: string };
  previousOwner: { userId: string; keptAs: StoreTransferKeepAs };
  billing: { plan: string | null; external: boolean };
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/ownership-transfer`;

export async function storeTransferCandidates(client: ApiClient, workspaceId: string): Promise<StoreTransferCandidate[]> {
  const { candidates } = await client.request<{ candidates: StoreTransferCandidate[] }>(`${base(workspaceId)}/candidates`);
  return candidates;
}

/** There is no undo: only the new owner can hand the store back. */
export async function storeTransfer(client: ApiClient, workspaceId: string, payload: StoreTransferPayload): Promise<StoreTransferResult> {
  return client.request<StoreTransferResult>(base(workspaceId), { method: "POST", body: payload });
}
