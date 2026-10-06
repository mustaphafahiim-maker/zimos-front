/**
 * "Send Lead instead of Purchase" (backend handoff item 167). An order's
 * conversion can be reported to the ad platforms as a Lead instead of a
 * Purchase — same moment (the purchase timing), same value, same event id
 * (the order id, so browser and server still dedup), sent once.
 *
 *   GET/PUT /workspaces/:ws/tracking-pixels/settings        workspace.manage
 *     { purchaseEventTiming, options, conversionEvent, conversionEvents }
 *     PUT takes any of { purchaseEventTiming?, conversionEvent? }.
 *   PATCH /workspaces/:ws/funnels/:funnelId/settings         funnels.manage
 *     { conversionEvent: "lead" | "purchase" | null }  (null = the store's)
 *
 * Shoppers: GET /store/:ws `conversionEvent`; a funnel's public payload
 * `settings.conversionEvent` overrides it when not null.
 *
 * Event names per platform (browser pixels use the same):
 *   purchase → Meta Purchase, TikTok CompletePayment, Snapchat PURCHASE, GA4 purchase, Pinterest checkout
 *   lead     → Meta Lead, TikTok SubmitForm, Snapchat SIGN_UP, GA4 generate_lead, Pinterest lead
 */
import type { ApiClient } from "../client";
import type { FunnelOwnSettings } from "./funnelExtras";
import type { TrackingSettings } from "./trackingPixels";

export type TrackingConversionEvent = "purchase" | "lead";

export const TRACKING_CONVERSION_EVENTS: TrackingConversionEvent[] = ["purchase", "lead"];

/** The tracking settings with how orders are reported. */
export type TrackingSettingsWithConversion = TrackingSettings & {
  conversionEvent: TrackingConversionEvent;
  conversionEvents: TrackingConversionEvent[];
};

/** "purchase" | "lead" from any value; null for anything else (a funnel's "use the store's"). */
export function conversionEventOf(value: unknown): TrackingConversionEvent | null {
  return value === "lead" || value === "purchase" ? value : null;
}

/** The store's choice in tracking settings that may come from an older backend (Purchase then). */
export function trackingConversionEventOf(settings: TrackingSettings | null | undefined): TrackingConversionEvent {
  return conversionEventOf((settings as Partial<TrackingSettingsWithConversion> | null | undefined)?.conversionEvent) ?? "purchase";
}

const settingsPath = (workspaceId: string) => `/workspaces/${workspaceId}/tracking-pixels/settings`;

export async function trackingPixelsGetConversionSettings(
  client: ApiClient,
  workspaceId: string
): Promise<TrackingSettingsWithConversion> {
  return client.request<TrackingSettingsWithConversion>(settingsPath(workspaceId));
}

/** Changes only how orders are reported; the timing stays as it is. */
export async function trackingPixelsUpdateConversionEvent(
  client: ApiClient,
  workspaceId: string,
  conversionEvent: TrackingConversionEvent
): Promise<TrackingSettingsWithConversion> {
  return client.request<TrackingSettingsWithConversion>(settingsPath(workspaceId), {
    method: "PUT",
    body: { conversionEvent },
  });
}

/** A funnel's own settings with its conversion override (null = the store's). */
export type FunnelSettingsWithConversion = FunnelOwnSettings & { conversionEvent?: TrackingConversionEvent | null };

const funnelSettingsPath = (workspaceId: string, funnelId: string) => `/workspaces/${workspaceId}/funnels/${funnelId}/settings`;

export async function funnelConversionSettingsGet(
  client: ApiClient,
  workspaceId: string,
  funnelId: string
): Promise<FunnelSettingsWithConversion> {
  const { settings } = await client.request<{ settings: FunnelSettingsWithConversion }>(funnelSettingsPath(workspaceId, funnelId));
  return settings;
}

/** Sets the funnel's override; null goes back to the store's choice. */
export async function funnelConversionEventSave(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  conversionEvent: TrackingConversionEvent | null
): Promise<FunnelSettingsWithConversion> {
  const { settings } = await client.request<{ settings: FunnelSettingsWithConversion }>(funnelSettingsPath(workspaceId, funnelId), {
    method: "PATCH",
    body: { conversionEvent },
  });
  return settings;
}
