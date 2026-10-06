import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Install Zimos on your phone",
    body: "Open your orders from the home screen, full screen, like an app.",
    install: "Install",
    iosBody: "Tap the Share button, then “Add to Home Screen”.",
    dismiss: "Not now",
  },
  ar: {
    title: "ثبّت زيموس على موبايلك",
    body: "افتح طلباتك من الشاشة الرئيسية، بملء الشاشة، مثل أي تطبيق.",
    install: "تثبيت",
    iosBody: "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».",
    dismiss: "ليس الآن",
  },
} satisfies Messages;

/** Chrome/Edge/Android's install event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "zimos.pwa.installDismissedAt";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Registers the service worker once. Safe to call on every load. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

/**
 * The install prompt (SPEC §20.1): a small card at the bottom of the screen
 * when the browser says the dashboard can be installed — or, on iPhone, where
 * there is no such event, the two taps that do it. Dismissing it hides it for
 * two weeks; an installed app never shows it.
 */
export function InstallAppPrompt() {
  const t = useT(STRINGS);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIosSafari()) {
      setIos(true);
      setHidden(false);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!event && !ios)) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* private mode — hidden for this visit */
    }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    setEvent(null);
    if (choice?.outcome === "accepted") setHidden(true);
    else dismiss();
  }

  return (
    <div
      role="dialog"
      aria-label={t.title}
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 md:bottom-3 mx-auto flex max-w-md items-start gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 shadow-xl"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {ios ? <Share className="size-5" aria-hidden /> : <Download className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{t.title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{ios && !event ? t.iosBody : t.body}</p>
        {event && (
          <Button size="sm" className="mt-3 min-h-9" onClick={() => void install()}>
            {t.install}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismiss}
        title={t.dismiss}
        className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
