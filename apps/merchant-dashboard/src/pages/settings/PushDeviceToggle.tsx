import { useState } from "react";
import { Button } from "@store-builder/ui";
import { pushConfig, pushRegister, pushRemove } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Notifications on this device",
    off: "Get new orders and alerts as phone or computer notifications, even with the dashboard closed. Choose which ones in the Push column below.",
    on: "This device gets push notifications.",
    sandbox: "Test server: pushes are recorded in the notification log, not shown.",
    unsupported: "This browser can't show push notifications. On iPhone, add the dashboard to the home screen first.",
    denied: "Notifications are blocked for this site in the browser settings.",
    unavailable: "Push notifications are not set up on this server yet.",
    turnOn: "Turn on",
    turnOff: "Turn off on this device",
    working: "Working…",
    enabled: "Push notifications are on for this device.",
    disabled: "Push notifications are off for this device.",
  },
  ar: {
    title: "إشعارات على هذا الجهاز",
    off: "توصلك الطلبات الجديدة والتنبيهات كإشعارات على الموبايل أو الكمبيوتر حتى ولوحة التحكم مقفولة. اختار أنواعها من عمود الإشعارات بالأسفل.",
    on: "هذا الجهاز تصله الإشعارات.",
    sandbox: "سيرفر تجريبي: الإشعارات تُسجّل في سجل الإشعارات ولا تظهر.",
    unsupported: "هذا المتصفح لا يعرض الإشعارات. على الآيفون أضف لوحة التحكم للشاشة الرئيسية أولًا.",
    denied: "الإشعارات محظورة لهذا الموقع من إعدادات المتصفح.",
    unavailable: "الإشعارات غير مفعلة على هذا السيرفر بعد.",
    turnOn: "تفعيل",
    turnOff: "إيقاف على هذا الجهاز",
    working: "جارٍ التنفيذ…",
    enabled: "تم تفعيل الإشعارات على هذا الجهاز.",
    disabled: "تم إيقاف الإشعارات على هذا الجهاز.",
  },
} satisfies Messages;

const DEVICE_KEY = "zimos_push_device";

function storedDevice(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function keyBytes(base64Url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Turns push notifications on for this browser (SPEC §20 "a PWA of the
 * dashboard (manifest + web push)"). With a real provider the browser
 * subscribes with the server's VAPID key; on a sandbox server the device is
 * registered with a test token so the flow can be tried end to end.
 */
export function PushDeviceToggle() {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const config = useAsync(() => pushConfig(apiClient).catch(() => null), []);
  const [deviceId, setDeviceId] = useState<string | null>(() => storedDevice());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const c = config.data;
  if (!c) return null;
  const sandbox = c.available && !c.publicKey;
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  async function turnOn() {
    if (!c) return;
    setBusy(true);
    setNote(null);
    try {
      let token: string;
      if (c.publicKey) {
        if (!supported) return setNote(t.unsupported);
        if ((await Notification.requestPermission()) !== "granted") return setNote(t.denied);
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(c.publicKey) as BufferSource });
        token = JSON.stringify(subscription);
      } else {
        token = `sandbox:${window.crypto.randomUUID()}`;
      }
      const device = await pushRegister(apiClient, { platform: "web", token });
      try {
        window.localStorage.setItem(DEVICE_KEY, device.id);
      } catch {
        // Remembered for this page only.
      }
      setDeviceId(device.id);
      toast.success(t.enabled);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!deviceId) return;
    setBusy(true);
    try {
      await pushRemove(apiClient, deviceId).catch(() => undefined);
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration();
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
      }
      try {
        window.localStorage.removeItem(DEVICE_KEY);
      } catch {
        // Nothing stored.
      }
      setDeviceId(null);
      toast.success(t.disabled);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-sm font-medium text-ink">{t.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{!c.available ? t.unavailable : deviceId ? t.on : t.off}</p>
      {sandbox && <p className="mt-1 text-xs text-ink-soft">{t.sandbox}</p>}
      {note && <p className="mt-1 text-xs font-medium text-danger">{note}</p>}
      {c.available && (
        <div className="mt-3">
          {deviceId ? (
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void turnOff()}>
              {busy ? t.working : t.turnOff}
            </Button>
          ) : (
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void turnOn()}>
              {busy ? t.working : t.turnOn}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
