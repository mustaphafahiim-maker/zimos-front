import { useState } from "react";
import { pushConfig, pushRegister, pushRemove } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
// Real web push (handoff 392): the subscription for the server's current VAPID key, and the 422 for one it can't use.
import { isInvalidPushSubscription, subscribeBrowser } from "@/lib/webPush";

const STRINGS = {
  en: {
    title: "Notifications on this device",
    off: "Get new orders and alerts as phone or computer notifications, even with the dashboard closed. Choose which ones under “Tell me about” below.",
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
    invalid: "Couldn't turn on notifications in this browser",
  },
  ar: {
    title: "إشعارات على الجهاز ده",
    off: "الأوردرات الجديدة والتنبيهات توصلك كإشعار على الموبايل أو الكمبيوتر حتى والداشبورد مقفولة. اختار أنواعها من «بلّغني عن» تحت.",
    on: "الجهاز ده بتوصله الإشعارات.",
    sandbox: "سيرفر تجريبي: الإشعارات بتتسجّل في سجل الإشعارات ومش بتظهر.",
    unsupported: "المتصفح ده مش بيعرض إشعارات. على الآيفون ضيف الداشبورد للشاشة الرئيسية الأول.",
    denied: "الإشعارات مقفولة للموقع ده من إعدادات المتصفح.",
    unavailable: "الإشعارات لسه مش متفعّلة على السيرفر ده.",
    turnOn: "تفعيل",
    turnOff: "إيقاف على هذا الجهاز",
    working: "بننفّذ…",
    enabled: "الإشعارات اشتغلت على الجهاز ده.",
    disabled: "الإشعارات اتقفلت على الجهاز ده.",
    invalid: "تعذّر تفعيل الإشعارات على المتصفح ده",
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
  // Only a sandbox server takes a test token; any other provider needs the browser's real subscription.
  const sandbox = c.available && c.provider === "sandbox";
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  async function turnOn() {
    if (!c) return;
    setBusy(true);
    setNote(null);
    try {
      let token: string;
      if (!sandbox && !c.publicKey) return setNote(t.unavailable);
      if (!sandbox && c.publicKey) {
        if (!supported) return setNote(t.unsupported);
        if ((await Notification.requestPermission()) !== "granted") return setNote(t.denied);
        const registration = await navigator.serviceWorker.ready;
        // A subscription made with a key the owner has since rotated is dropped and made again with this one.
        const subscription = await subscribeBrowser(registration, c.publicKey);
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
      toast.error(isInvalidPushSubscription(err) ? t.invalid : errorMessage(err));
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

  const state = !c.available ? t.unavailable : deviceId ? t.on : t.off;
  return (
    <SettingsGroup
      footer={
        note || sandbox ? (
          <>
            {note && (
              <span role="alert" className="block font-medium text-danger">
                {note}
              </span>
            )}
            {sandbox && <span className="block">{t.sandbox}</span>}
          </>
        ) : undefined
      }
    >
      <SettingsSwitch
        label={t.title}
        hint={state}
        checked={deviceId !== null}
        disabled={!c.available}
        busy={busy}
        onChange={(next) => void (next ? turnOn() : turnOff())}
      />
    </SettingsGroup>
  );
}
