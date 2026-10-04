"use client";

import { useEffect, useState } from "react";
import { storeFollowOrder, storePushConfig, type StorePushConfig } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStoreBasePath } from "@/components/StoreRoute";
import { useStore } from "@/lib/StoreContext";
import { btnSecondary } from "./ui";

const TEXT = {
  en: {
    title: "Follow your order",
    hint: "Get a notification on this phone when your order is confirmed, shipped and delivered.",
    button: "Notify me",
    working: "One moment…",
    done: "Done — we'll notify you on this phone.",
    denied: "Notifications are blocked for this site in your browser settings.",
    failed: "Couldn't turn on notifications. Try again.",
  },
  ar: {
    title: "تابع طلبك",
    hint: "يوصلك إشعار على الموبايل ده لما طلبك يتأكد ويتشحن ويتوصّل.",
    button: "فعّل الإشعارات",
    working: "لحظة…",
    done: "تمام — هنبعتلك إشعار على الموبايل ده.",
    denied: "الإشعارات محظورة للموقع ده من إعدادات المتصفح.",
    failed: "معرفناش نفعّل الإشعارات. جرّب تاني.",
  },
} as const;

function keyBytes(base64Url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * The thank-you page's "Notify me" (SPEC §20.2, the store's PWA push): this
 * browser follows this order and gets its confirmation, shipping and
 * delivery as notifications. Shown only when the store app is on and the
 * server can push; the order number on the page is the proof it is theirs.
 */
export function OrderUpdatesButton({ workspaceId, orderId, orderNumber }: { workspaceId: string; orderId: string; orderNumber: string | null }) {
  const { locale } = useStore();
  const t = TEXT[locale === "en" ? "en" : "ar"];
  const base = useStoreBasePath();
  const [config, setConfig] = useState<StorePushConfig | null>(null);
  const [state, setState] = useState<"idle" | "working" | "done" | "denied" | "failed">("idle");

  useEffect(() => {
    if (!orderNumber) return;
    storePushConfig(createStorefrontApiClient(), workspaceId)
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [workspaceId, orderNumber]);

  if (!orderNumber || !config?.available) return null;

  async function follow() {
    if (!config || !orderNumber) return;
    setState("working");
    try {
      let token: string;
      if (config.publicKey) {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("failed");
        if ((await Notification.requestPermission()) !== "granted") return setState("denied");
        const registration = await navigator.serviceWorker.register("/store-sw.js", { scope: `${base}/` });
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) as BufferSource });
        token = JSON.stringify(subscription);
      } else {
        // A sandbox server: any token; each push is written to the store's notification log.
        token = `sandbox:${window.crypto.randomUUID()}`;
      }
      await storeFollowOrder(createStorefrontApiClient(), workspaceId, orderId, { number: orderNumber, token });
      setState("done");
    } catch {
      setState("failed");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper-raised px-5 py-4 text-sm" aria-labelledby="order-updates-title">
      <h2 id="order-updates-title" className="font-semibold text-ink">
        {t.title}
      </h2>
      <p className="mt-0.5 text-ink-soft">{state === "done" ? t.done : t.hint}</p>
      {state === "denied" && <p className="mt-1 text-xs font-medium text-danger">{t.denied}</p>}
      {state === "failed" && <p className="mt-1 text-xs font-medium text-danger">{t.failed}</p>}
      {state !== "done" && (
        <button type="button" className={`${btnSecondary} mt-3`} disabled={state === "working"} onClick={() => void follow()}>
          {state === "working" ? t.working : t.button}
        </button>
      )}
    </section>
  );
}
