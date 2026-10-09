"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * The card is one of several things that want the bottom of a phone screen;
 * where it rests, and what makes room for it, is in globals.css ("The bottom
 * of the screen on a store page").
 */
export function StoreAppInstall({ app, locale }: { app: StorefrontStoreApp | null; locale: "ar" | "en" }) {
  const base = useStoreBasePath();
  const t = TEXT[locale];
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const card = useRef<HTMLDivElement>(null);
  const showing = Boolean(app) && !hidden && (prompt !== null || ios);

  // While the card shows, the store wrapper knows how tall it is (globals.css,
  // `--sf-prompt-h`). On a phone the card spans the screen, so the WhatsApp
  // button, the way back up and a sales notification wait above it instead of
  // sitting on it; the card itself rests above any bar pinned to the bottom.
  useEffect(() => {
    const el = card.current;
    const wrapper = showing && el ? el.closest<HTMLElement>(".brand-theme") : null;
    if (!el || !wrapper) return;
    const apply = () => wrapper.style.setProperty("--sf-prompt-h", `${el.offsetHeight + 12}px`);
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      wrapper.style.removeProperty("--sf-prompt-h");
    };
  }, [showing]);

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
      {showing && (
        <div
          ref={card}
          className="fixed inset-x-3 bottom-[var(--sf-prompt-bottom,5rem)] z-30 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3 shadow-lg sm:start-6 sm:mx-0"
        >
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
          <button type="button" onClick={dismiss} className="min-h-11 min-w-11 cursor-pointer px-2 text-xs text-ink-soft" aria-label={t.close}>
            {t.close}
          </button>
        </div>
      )}
    </>
  );
}
