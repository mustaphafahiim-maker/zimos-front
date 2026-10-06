/**
 * "Call me back at…" for a confirmation call (backend:
 * src/modules/cod/confirmationService.js, frontend-handoff "postponed with a
 * callback time").
 *
 *   POST /workspaces/:ws/confirmation-tasks/:taskId/outcome   orders.confirm
 *     { outcome: "postponed" | "unreachable", callbackAt?: ISO, channel, notes? }
 *
 * `callbackAt` must be in the future and within 60 days; it is only allowed
 * with postponed / unreachable. The task is due again exactly then
 * (`nextRetryAt = callbackAt`); without it the defaults stay (+24 h / +4 h).
 * Task objects carry `callbackAt` (null when none).
 */
import type { ApiClient } from "../client";
import type { ConfirmationTask, RecordConfirmationOutcomePayload } from "../types";

/** The outcome payload with the optional callback time. */
export type ConfirmationOutcomeWithCallback = RecordConfirmationOutcomePayload & { callbackAt?: string };

/** A task as the API now returns it, with its callback time. */
export type ConfirmationTaskWithCallback = ConfirmationTask & { callbackAt?: string | null };

/** Outcomes that may carry a callback time. */
export const CALLBACK_OUTCOMES = ["postponed", "unreachable"] as const;

export function confirmationRecordOutcome(
  client: ApiClient,
  workspaceId: string,
  taskId: string,
  payload: ConfirmationOutcomeWithCallback
): Promise<ConfirmationTask> {
  return client.recordConfirmationOutcome(workspaceId, taskId, payload);
}
