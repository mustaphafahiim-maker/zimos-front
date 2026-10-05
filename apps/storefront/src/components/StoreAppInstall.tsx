"use client";

import { useEffect, useState } from "react";
import type { StorefrontStoreApp } from "@store-builder/api-client";
import { useStoreBasePath } from "@/components/StoreRoute";
import { storeHref } from "@/lib/storeHref";
import { btnPrimary } from "./ui";

const TEXT = {
  en: { install: "Install the app", close: "Not now", ios: "Tap Share, then “Add to Home Screen”." },
  ar: { install: "ثبّت التطبيق", close: "ليس الآن", ios: "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»." },
} as const;

const DISMISSED = "zimos_store_app_dismissed";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function remembered(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * The store as an app (SPEC §20.2): links the store's manifest, registers the
 * shop's service worker for this store's path, and offers "Install the app"
 * where the browser allows it (on iPhone, the Share-menu hint instead). Once
 * dismissed it stays away in this browser. Nothing at all while the merchant
 * has the store app off.
 */
export function StoreAppInstall({ app, locale }: { app: StorefrontStoreApp | null; locale: "ar" | "en" }) {
  const base = useStoreBasePath();
  const t = TEXT[locale];
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!app || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/store-sw.js", { scope: `${base}/` }).catch(() => undefined);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || remembered()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [app, base]);

  if (!app) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Hidden for this visit only.
    }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    setPrompt(null);
    dismiss();
  }

  return (
    <>
      <link rel="manifest" href={storeHref(base, "/manifest.webmanifest")} />
      <link rel="apple-touch-icon" href={app.iconUrl ?? "/brand/zimos-icon-180.png"} />
      {!hidden && (prompt || ios) && (
        <div className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-lg sm:bottom-6 sm:start-6 sm:mx-0">
          {app.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.iconUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{app.name}</p>
            {ios && !prompt ? <p className="text-xs text-ink-soft">{t.ios}</p> : null}
          </div>
          {prompt ? (
            <button type="button" onClick={() => void install()} className={`${btnPrimary} px-3`}>
              {t.install}
            </button>
          ) : null}
          <button type="button" onClick={dismiss} className="min-h-11 px-2 text-xs text-ink-soft" aria-label={t.close}>
            {t.close}
          </button>
        </div>
      )}
    </>
  );
}
