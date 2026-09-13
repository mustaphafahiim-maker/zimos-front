/**
 * Extra confirmation-queue helpers (backend: src/modules/cod). Owned by the call-center wiring task.
 * ApiClient already has listConfirmationQueue / claim / outcome methods — only add what is missing.
 * All exported names in this file are prefixed with `confirmation`.
 *
 * Backend facts (src/modules/cod/confirmationService.js):
 * - Routes: GET / (?status=queued|in_progress|done, limit<=200), POST /:taskId/claim, POST /:taskId/outcome.
 *   There is NO release/unclaim route and NO attempt-history route.
 * - claim sets status=in_progress + lockedByUserId; a second claimer gets 409 TASK_ALREADY_LOCKED.
 * - outcome requires the caller to hold the lock (403 TASK_NOT_LOCKED_BY_YOU); confirmed/rejected -> done,
 *   unreachable -> queued with nextRetryAt +4h, postponed -> queued with nextRetryAt +24h (fixed).
 */
import type { ApiClient } from "../client";
import { ApiError } from "../client";
import type { ConfirmationTask } from "../types";

/** Task rows as serialised by Sequelize (timestamps are present but not in the shared type). */
export type ConfirmationTaskRow = ConfirmationTask & { createdAt?: string; updatedAt?: string };

/**
 * Every task an agent can still act on: `queued` plus `in_progress` (claimed, possibly by me).
 * The backend lists one status at a time, so this issues both requests in parallel.
 */
export async function confirmationListOpenTasks(client: ApiClient, workspaceId: string, limit = 200): Promise<ConfirmationTaskRow[]> {
  const [queued, inProgress] = await Promise.all([
    client.listConfirmationQueue(workspaceId, { status: "queued", limit }),
    client.listConfirmationQueue(workspaceId, { status: "in_progress", limit }),
  ]);
  return [...inProgress, ...queued] as ConfirmationTaskRow[];
}

/** Tasks closed (confirmed/rejected). Used for "confirmed today" stats. */
export async function confirmationListDoneTasks(client: ApiClient, workspaceId: string, limit = 200): Promise<ConfirmationTaskRow[]> {
  return (await client.listConfirmationQueue(workspaceId, { status: "done", limit })) as ConfirmationTaskRow[];
}

/** 409 TASK_ALREADY_LOCKED — another agent claimed the task first. */
export function confirmationIsLockedError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "TASK_ALREADY_LOCKED" || err.status === 409);
}

/** 403 TASK_NOT_LOCKED_BY_YOU — outcome recorded without holding the lock. */
export function confirmationIsNotLockedByYouError(err: unknown): boolean {
  return err instanceof ApiError && err.code === "TASK_NOT_LOCKED_BY_YOU";
}
