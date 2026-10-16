/**
 * The opt-in step's sign-up (backend: src/modules/funnels/funnelOptIn.js).
 * All exported names in this file are prefixed with `funnelOptIn`.
 *
 * The session cannot move past an opt-in step until this succeeds (advance
 * answers 422 OPT_IN_REQUIRED). Codes: 422 INVALID_PHONE / CONTACT_REQUIRED,
 * 409 NOT_AN_OPT_IN_STEP (the session is elsewhere), 429.
 */
import type { ApiClient } from "../client";

export interface FunnelOptInPayload {
  fullName: string;
  phone?: string;
  email?: string;
  /** The bot guard's honeypot and time token (GET /store/:ws/checkout/guard). */
  website?: string;
  botToken?: string;
}

/** POST /store/:ws/funnels/:funnelId/sessions/:sessionId/opt-in — no auth. */
export function funnelOptInSubmit(client: ApiClient, workspaceId: string, funnelId: string, sessionId: string, payload: FunnelOptInPayload) {
  return client.request<{ ok: true }>(`/store/${workspaceId}/funnels/${funnelId}/sessions/${sessionId}/opt-in`, {
    method: "POST",
    body: payload,
    auth: false,
  });
}
