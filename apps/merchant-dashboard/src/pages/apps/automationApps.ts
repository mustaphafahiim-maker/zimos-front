/**
 * Zapier and Make (frontend-handoff 193). Both connect to a store with an API
 * key on the public API and subscribe one webhook per trigger themselves
 * (backend publicApi/integrations/README.md); nothing here holds their
 * secrets. Shared by the app cards, the guide page and the webhooks list.
 */

export type AutomationTool = "zapier" | "make";

export const AUTOMATION_TOOLS: readonly AutomationTool[] = ["zapier", "make"];

/** Where an app card's "Open" goes: the guide page instead of Settings. */
export function automationGuidePath(appKey: string): string | null {
  return (AUTOMATION_TOOLS as readonly string[]).includes(appKey) ? `/apps/${appKey}` : null;
}

/** Which tool a webhook endpoint belongs to, from its URL: hooks.zapier.com or hook.<region>.make.com. */
export function automationOf(url: string): AutomationTool | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "hooks.zapier.com") return "zapier";
  if (/^hook\.[a-z0-9-]+\.make\.com$/.test(host)) return "make";
  return null;
}

/** The scopes the guide's key starts with: triggers, and order fields for them. */
export const AUTOMATION_SCOPES = ["webhooks:write", "orders:read"] as const;

/** A store's webhook subscriptions, every trigger being one (backend webhooks, raised from 10). */
export const WEBHOOK_LIMIT = 25;

/** The triggers the README suggests, in its order (only those the server lists are shown). */
export const SUGGESTED_TRIGGERS = [
  "order.created",
  "order.paid",
  "order.confirmed",
  "shipment.status_changed",
  "order.fulfilled",
  "lead.created",
  "customer.created",
  "contact.updated",
  "checkout.abandoned",
  "review.created",
] as const;

export type SuggestedTrigger = (typeof SUGGESTED_TRIGGERS)[number];

export const TOOL_NAME: Record<AutomationTool, { en: string; ar: string }> = {
  zapier: { en: "Zapier", ar: "زابير" },
  make: { en: "Make", ar: "ميك" },
};

export const TOOL_SITE: Record<AutomationTool, string> = {
  zapier: "https://zapier.com/app/zaps",
  make: "https://www.make.com/en/login",
};
