import { useEffect, useState } from "react";
import { Button } from "@store-builder/ui";
import {
  shipmentTrackingOf,
  trackedShipmentSync,
  trackingProviderGet,
  type Shipment,
  type TrackingProviderSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { TERMINAL_SHIPMENT_STATUSES } from "@/pages/shipping/carriers";

const STRINGS = {
  en: {
    refresh: "Refresh status",
    refreshing: "Refreshing…",
    lastChecked: "Last checked with {provider}: {date}",
    failed: "We couldn't read this number — check the waybill",
    noNews: "No new updates",
    news_one: "1 new update",
    news_other: "{n} new updates",
    test: "Test",
  },
  ar: {
    refresh: "تحديث الحالة",
    refreshing: "جارٍ التحديث…",
    lastChecked: "آخر تحديث من {provider}: {date}",
    failed: "تعذّرت قراءة هذا الرقم. راجع رقم البوليصة",
    noNews: "لا جديد",
    news_one: "أُضيف تحديث واحد",
    news_two: "أُضيف تحديثان",
    news_few: "أُضيفت {n} تحديثات",
    news_other: "أُضيف {n} تحديثًا",
    test: "تجريبي",
  },
} satisfies Messages;

// One read per store and page visit: every shipment card of an order asks the same question.
const settingsCache = new Map<string, Promise<TrackingProviderSettings | null>>();

/** Drops the remembered answer (the settings card calls it after a save). */
export function forgetTrackingProvider(workspaceId: string) {
  settingsCache.delete(workspaceId);
}

function loadSettings(workspaceId: string): Promise<TrackingProviderSettings | null> {
  let pending = settingsCache.get(workspaceId);
  if (!pending) {
    // No permission (shipping.manage) or an older server: the card simply has nothing to add.
    pending = trackingProviderGet(apiClient, workspaceId).catch(() => null);
    settingsCache.set(workspaceId, pending);
    window.setTimeout(() => settingsCache.delete(workspaceId), 60_000);
  }
  return pending;
}

/** The import's placeholder (`IMP-<order number>`) is not a waybill a provider can read. */
function hasRealWaybill(shipment: Shipment): boolean {
  const waybill = shipment.waybillNumber?.trim();
  return Boolean(waybill) && !/^IMP-/i.test(waybill as string);
}

/**
 * A manual shipment that updates itself: when the store switched
 * a tracking provider on, its card gets "Refresh status", when the waybill was
 * last read and — after failed reads — a nudge to check the number.
 * Courier-booked shipments keep their own Sync button; this draws nothing for them.
 */
export function ManualShipmentTracking({
  orderId,
  shipment,
  canManage,
  disabled,
  onChanged,
}: {
  orderId: string;
  shipment: Shipment;
  canManage: boolean;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [settings, setSettings] = useState<TrackingProviderSettings | null>(null);
  const [busy, setBusy] = useState(false);

  const { state, failures } = shipmentTrackingOf(shipment);
  const relevant = hasRealWaybill(shipment);

  useEffect(() => {
    if (!relevant || !canManage) return;
    let alive = true;
    void loadSettings(workspaceId).then((next) => {
      if (alive) setSettings(next);
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, relevant, canManage]);

  if (!relevant) return null;
  const on = settings?.trackingProvider.enabled === true;
  // What was read before stays readable after tracking is switched off, or for a role that can't see the setting.
  if (!on && !state) return null;

  const providerCode = state?.provider ?? settings?.trackingProvider.provider ?? "";
  const provider = settings?.providers.find((p) => p.code === providerCode);
  const providerName = provider ? (provider.sandbox ? `${provider.name.replace(/\s*\(test\)\s*$/i, "")} (${t.test})` : provider.name) : providerCode;

  async function refresh() {
    setBusy(true);
    try {
      const result = await trackedShipmentSync(apiClient, workspaceId, orderId, shipment.id);
      const added = Math.max(result.tracking?.newCheckpoints ?? 0, result.changed ? 1 : 0);
      toast.success(added > 0 ? pluralOf(t, "news", added) : t.noNews);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
      // A failed read is counted on the shipment: show the nudge.
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
      {on && canManage && !TERMINAL_SHIPMENT_STATUSES.has(shipment.status) && (
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || busy} onClick={() => void refresh()}>
          {busy ? t.refreshing : t.refresh}
        </Button>
      )}
      {state?.lastCheckedAt && <span>{fmt(t.lastChecked, { provider: providerName, date: formatDateTime(state.lastCheckedAt) })}</span>}
      {failures > 0 && <span className="font-medium text-danger">{t.failed}</span>}
    </div>
  );
}
