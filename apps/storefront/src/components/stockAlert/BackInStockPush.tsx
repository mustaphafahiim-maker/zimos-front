"use client";

import { useEffect, useState } from "react";
import { ApiError, storePushConfig, subscribeStockAlertPush, type StorePushConfig } from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnSecondary, card } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { browserPushToken } from "@/lib/webPush";

const TEXT = {
  en: {
    button: "Notify me in this browser",
    working: "One moment…",
    done: "We'll notify you here as soon as it's back",
    denied: "Notifications are blocked for this site in your browser settings.",
    invalid: "Couldn't turn on notifications in this browser",
    tooMany: "Too many requests. Try again in a while.",
    failed: "Couldn't turn on notifications. Try again.",
    or: "or",
  },
  ar: {
    button: "نبّهني على المتصفح",
    working: "لحظة…",
    done: "هنبعتلك إشعار أول ما يرجع",
    denied: "الإشعارات محظورة للموقع ده من إعدادات المتصفح.",
    invalid: "تعذّر تفعيل الإشعارات على المتصفح ده",
    tooMany: "طلبات كتير. جرّب تاني بعد شوية.",
    failed: "معرفناش نفعّل الإشعارات. جرّب تاني.",
    or: "أو",
  },
} as const;

/** Variants this browser asked to be told about on this page: the confirmation stays when the shopper switches sizes and back. */
const pushed = new Set<string>();

export function pushSignedUp(variantId: string): boolean {
  return pushed.has(variantId);
}

/** «هنبعتلك إشعار أول ما يرجع»: what stands in place of the sign-up once this browser is on the list. */
export function BackInStockPushDone() {
  const { locale } = useStore();
  const t = pickText(TEXT, locale);
  return (
    <div role="status" className={`${card} flex items-start gap-3 p-4`} data-stock-alert="push">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
        <CheckIcon size={20} />
      </span>
      <p className="min-w-0 py-2.5 text-sm font-semibold text-ink">{t.done}</p>
    </div>
  );
}

/**
 * «نبّهني على المتصفح» on a sold-out variant's sign-up (handoff 392), beside
 * the phone and email choices: one tap, no number to type. Shown only when
 * the store can push (its app is on and the server has a push provider) and
 * this browser can receive one. The tap asks for the notification permission,
 * subscribes through the store's service worker and signs this browser up;
 * the push is sent once, when the variant is back.
 */
export function BackInStockPush({
  workspaceId,
  variantId,
  onDone,
  onInStock,
}: {
  workspaceId: string;
  variantId: string;
  onDone: () => void;
  /** 409 IN_STOCK: it came back while the page was open. */
  onInStock: () => void;
}) {
  const { locale } = useStore();
  const t = pickText(TEXT, locale);
  const base = useStoreBasePath();
  const [config, setConfig] = useState<StorePushConfig | null>(null);
  const [state, setState] = useState<"idle" | "working" | "denied" | "invalid" | "tooMany" | "failed">("idle");

  useEffect(() => {
    let live = true;
    storePushConfig(createStorefrontApiClient(), workspaceId)
      .then((push) => {
        if (live) setConfig(push);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [workspaceId]);

  if (!config?.available) return null;
  // A real provider needs a browser that can subscribe; a sandbox server (no key) takes any token.
  if (config.publicKey && !("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return null;

  async function notify() {
    if (!config || state === "working") return;
    setState("working");
    try {
      let pushToken: string;
      if (config.publicKey) {
        const answer = await browserPushToken(config.publicKey, `${base}/`);
        if (!answer.ok) return setState(answer.reason === "denied" ? "denied" : "invalid");
        pushToken = answer.token;
      } else {
        pushToken = `sandbox:${window.crypto.randomUUID()}`;
      }
      await subscribeStockAlertPush(createStorefrontApiClient({ locale }), workspaceId, { variantId, pushToken, locale });
      pushed.add(variantId);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "IN_STOCK") return onInStock();
      // The store's app was switched off meanwhile: the option goes.
      if (err instanceof ApiError && err.code === "PUSH_UNAVAILABLE") return setConfig({ available: false, publicKey: null });
      if (err instanceof ApiError && err.code === "INVALID_PUSH_SUBSCRIPTION") return setState("invalid");
      setState(err instanceof ApiError && err.status === 429 ? "tooMany" : "failed");
    }
  }

  const problem = state === "denied" ? t.denied : state === "invalid" ? t.invalid : state === "tooMany" ? t.tooMany : state === "failed" ? t.failed : null;

  return (
    <div data-stock-alert-push="">
      <p aria-hidden className="flex items-center gap-3 text-xs text-ink-soft before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t.or}
      </p>
      <button type="button" className={`${btnSecondary} mt-3 w-full`} disabled={state === "working"} aria-busy={state === "working" || undefined} onClick={() => void notify()}>
        {state === "working" ? t.working : t.button}
      </button>
      <p role="alert" className="mt-2 text-sm font-medium text-danger empty:hidden">
        {problem}
      </p>
    </div>
  );
}
