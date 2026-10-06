import { currentTouches } from "./touches";
import { getVisitorId } from "./visitor";
import { trackingConsentField } from "./cookieConsent";

/**
 * The ad platforms' browser ids, sent with the checkout (SPEC §13.2) so the
 * server-side Purchase — which can go out days later, on confirmation or
 * delivery — matches the order to the ad click: Meta's _fbp / _fbc, TikTok's
 * _ttp and ttclid, Snapchat's click id and _scid, the GA4 client id from _ga,
 * and this store's visitor id. The click ids fall back to the 30-day touch
 * cookie (lib/touches) when the platform's own cookie is missing. All are ids
 * the platforms' scripts or the landing URL set; nothing personal.
 */

function cookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]).slice(0, 400) || undefined;
  } catch {
    return undefined;
  }
}

/** _ga is "GA1.<n>.<random>.<timestamp>"; GA4's client id is the last two parts. */
function gaClientId(): string | undefined {
  const parts = cookie("_ga")?.split(".") ?? [];
  if (parts.length < 4) return undefined;
  const id = parts.slice(-2).join(".");
  return /^\d+\.\d+$/.test(id) ? id : undefined;
}

/** The `adIds` field of a checkout body: spread it in. Empty on the server. */
export function adMatchFields(workspaceId: string): Record<string, unknown> {
  if (typeof document === "undefined") return {};
  try {
    const touch = currentTouches()?.last ?? currentTouches()?.first;
    const at = touch?.at ? Date.parse(touch.at) : NaN;
    const ids: Record<string, string | undefined> = {
      fbp: cookie("_fbp"),
      fbc: cookie("_fbc") ?? (touch?.fbclid ? `fb.1.${Number.isFinite(at) ? at : Date.now()}.${touch.fbclid}` : undefined),
      ttp: cookie("_ttp"),
      ttclid: touch?.ttclid,
      scCid: touch?.scCid,
      scid: cookie("_scid"),
      gaClientId: gaClientId(),
      visitorId: getVisitorId(workspaceId),
    };
    for (const key of Object.keys(ids)) if (!ids[key]) delete ids[key];
    return { ...trackingConsentField(), ...(Object.keys(ids).length ? { adIds: ids } : {}) };
  } catch {
    return {};
  }
}
