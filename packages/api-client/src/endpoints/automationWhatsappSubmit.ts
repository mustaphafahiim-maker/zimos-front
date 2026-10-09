/**
 * "Create on WhatsApp" for a ready-made automation (backend: frontend-handoff
 * item 391, whatsapp/templateSubmission.js). ZIMOS submits the automation's
 * message templates to the store's own WhatsApp Business account, keeps the
 * automation off while Meta reviews them and switches it on once approved.
 *
 * /workspaces/:ws/automations/templates/:key/whatsapp (automations.manage):
 *   GET  → AutomationWhatsappStatus (`status` null before any submit)
 *   POST AutomationWhatsappSubmitBody → the same plus `ruleCreated` and each
 *        template's `outcome`; 201 when something was submitted or the rule
 *        was created, 200 when nothing new.
 *
 * Errors: 422 WHATSAPP_NOT_CONNECTED, 422 WHATSAPP_NO_BUSINESS_ACCOUNT,
 * 429 WHATSAPP_RATE_LIMITED, 422 WHATSAPP_TEMPLATE_REJECTED (message = Meta's
 * words), 409 WHATSAPP_TEMPLATE_NAME_TAKEN, 422 WHATSAPP_AUTH_FAILED,
 * 403 APP_NOT_INSTALLED, 404 unknown key. Nothing is kept after an error.
 */
import type { ApiClient } from "../client";

/** Over the templates the rule's steps send; `incomplete` when only some exist in the account. */
export type AutomationWhatsappOverall = "pending" | "approved" | "rejected" | "incomplete";

/** submitted = sent to Meta now · existing = the store already had it · reused = the name was taken, the account's own template was linked. */
export type AutomationWhatsappOutcome = "submitted" | "existing" | "reused";

export interface AutomationWhatsappTemplate {
  id: string;
  name: string;
  language: string;
  category: string | null;
  /** Meta's own word: PENDING | APPROVED | REJECTED | PAUSED | DISABLED | … */
  status: string;
  rejectedReason: string | null;
  bodyText: string | null;
  submittedAt: string | null;
  /** Only on the answer of a submit. */
  outcome?: AutomationWhatsappOutcome;
}

export interface AutomationWhatsappStatus {
  templateKey: string;
  status: AutomationWhatsappOverall | (string & {}) | null;
  rule: { id: string; name: string; isActive: boolean; templateKey: string | null; activateWhenApproved: boolean } | null;
  /** Only on the answer of a submit. */
  ruleCreated?: boolean;
  templates: AutomationWhatsappTemplate[];
}

export interface AutomationWhatsappSubmitBody {
  /** Switch the rule on by itself once WhatsApp approves its templates (default true). */
  activateWhenApproved?: boolean;
  /** For a rule made by this call: the language of its name. */
  locale?: "ar" | "en";
  couponCode?: string;
  /** Overrides the default extra languages; [] = only each step's own language. */
  languages?: string[];
}

const path = (workspaceId: string, key: string) => `/workspaces/${workspaceId}/automations/templates/${encodeURIComponent(key)}/whatsapp`;

export function automationWhatsappStatus(client: ApiClient, workspaceId: string, key: string): Promise<AutomationWhatsappStatus> {
  return client.request<AutomationWhatsappStatus>(path(workspaceId, key));
}

export function automationWhatsappSubmit(client: ApiClient, workspaceId: string, key: string, body: AutomationWhatsappSubmitBody = {}): Promise<AutomationWhatsappStatus> {
  return client.request<AutomationWhatsappStatus>(path(workspaceId, key), { method: "POST", body });
}
