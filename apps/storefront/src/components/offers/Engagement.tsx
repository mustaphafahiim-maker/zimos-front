"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  storefrontNewsletter,
  storefrontSocialProof,
  storefrontSubscribe,
  type StorefrontNewsletter,
  type StorefrontSocialProof,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { track } from "@/lib/track";
import { StoreLink } from "../StoreRoute";
import { CheckIcon, CrossIcon } from "../Icons";
import { btnPrimary, btnSecondary, card, container, focusRing, input, label as labelClass } from "../ui";
import { pickText } from "@/lib/i18n";
// The bot guard's token rides the sign-up, and its per-address limit has its own sentence (handoff 363).
import { signupGuardFields, signupTooMany } from "@/lib/signupGuard";

/*
 * Sales notifications and the newsletter sign-up (SPEC §10.7, §10.9).
 *
 * The notifications are real purchases the server hands over — a first name,
 * a governorate, the product and when. Nothing is generated here: when the
 * server has too few real orders it sends nothing and nothing is shown.
 *
 * Neither is needed to see a page or to buy from it, so neither is asked for
 * while the page is still loading: see "When the page is idle" below.
 */

const TEXT = {
  en: {
    bought: (who: string | null, city: string | null) =>
      who && city ? `${who} from ${city} bought` : who ? `${who} bought` : city ? `Someone from ${city} bought` : "Someone bought",
    ago: (minutes: number) =>
      minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`,
    dismiss: "Hide",
    nlTitle: "Be the first to know",
    name: "Name",
    phone: "Mobile number",
    email: "Email",
    subscribe: "Subscribe",
    sending: "Sending…",
    thanks: "You're subscribed. Thank you!",
    yourCode: "Your coupon",
    phoneRequired: "Enter your mobile number.",
    failed: "Couldn't subscribe — try again.",
    close: "Close",
    consent: "We'll message you about new products and offers. You can stop any time.",
  },
  ar: {
    bought: (who: string | null, city: string | null) =>
      who && city ? `${who} من ${city} اشترى` : who ? `${who} اشترى` : city ? `عميل من ${city} اشترى` : "عميل اشترى",
    ago: (minutes: number) =>
      minutes < 1 ? "الآن" : minutes < 60 ? `منذ ${minutes} دقيقة` : minutes < 1440 ? `منذ ${Math.floor(minutes / 60)} ساعة` : `منذ ${Math.floor(minutes / 1440)} يوم`,
    dismiss: "إخفاء",
    nlTitle: "كن أول من يعرف",
    name: "الاسم",
    phone: "رقم الموبايل",
    email: "الإيميل",
    subscribe: "اشترك",
    sending: "جارٍ الإرسال…",
    thanks: "تم اشتراكك. شكرًا لك!",
    yourCode: "كوبونك",
    phoneRequired: "اكتب رقم موبايلك.",
    failed: "تعذّر الاشتراك — حاول مرة أخرى.",
    close: "إغلاق",
    consent: "سنراسلك بالمنتجات الجديدة والعروض. يمكنك الإيقاف في أي وقت.",
  },
};

/** The pages that already ask something of the shopper: nothing pops up over them. */
const quietPath = (pathname: string) => /\/(checkout|orders|pay|offer|track|f)(\/|$)/.test(pathname);

// ------------------------------------------------- when the page is idle --

/*
 * The store's extras — the exit popup, the wheel, the sales notifications, the
 * newsletter form — each start with a request for their settings. None of them
 * is needed to paint a page or to place an order, so those requests wait until
 * the page has loaded and the browser has a quiet moment, instead of competing
 * with the product's photo on a phone's connection. And a page where an extra
 * never shows (the checkout, the thank-you page…) does not ask for it at all.
 */

/** How long the browser may look for a quiet moment once the page has loaded. */
const IDLE_TIMEOUT_MS = 2500;
/** Where there is no requestIdleCallback (Safari): this long after the page has loaded. */
const IDLE_FALLBACK_MS = 1200;
/** A page whose last photo or script never finishes still gets its extras after this long. */
const IDLE_MAX_WAIT_MS = 8000;

let idle: Promise<void> | null = null;

/** Settles once per page load; every later caller gets the same, already settled, answer. */
function pageIdle(): Promise<void> {
  if (idle) return idle;
  idle = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const whenLoaded = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(finish, { timeout: IDLE_TIMEOUT_MS });
      else window.setTimeout(finish, IDLE_FALLBACK_MS);
    };
    if (document.readyState === "complete") whenLoaded();
    else window.addEventListener("load", whenLoaded, { once: true });
    window.setTimeout(finish, IDLE_MAX_WAIT_MS);
  });
  return idle;
}

/**
 * False until the page has loaded and gone quiet, then true for good — it
 * never goes back, so what it switches on stays on as the shopper moves from
 * page to page. `allowed` false holds it back: a component passes whether the
 * current page is one it may show on, and so asks for nothing from a page
 * where it has nothing to show.
 */
export function useAfterIdle(allowed = true): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !allowed) return;
    let live = true;
    void pageIdle().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [ready, allowed]);
  return ready;
}

/**
 * Mounts what is inside it once the page is idle, on a page where the store's
 * popups may show (the layout wraps the exit popup in it: that component asks
 * for its settings the moment it mounts).
 */
export function AfterIdle({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const ready = useAfterIdle(!quietPath(pathname));
  return ready ? <>{children}</> : null;
}

// ------------------------------------------------------------ social proof --

const SHOWN_KEY = (workspaceId: string) => `zimos.social-proof.${workspaceId}`;

/** "Ahmed from Mansoura bought X · 12 min ago", one real order at a time, in a corner. */
export function SocialProofPopup({ workspaceId }: { workspaceId: string }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const pathname = usePathname() ?? "";
  // Asked for once the page is idle, and never from a page where no notification would show.
  const ready = useAfterIdle(!quietPath(pathname));
  const [config, setConfig] = useState<StorefrontSocialProof | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const next = useRef(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    storefrontSocialProof(createStorefrontApiClient(), workspaceId)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        /* no notifications */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId]);

  const allowed =
    config !== null &&
    config.items.length > 0 &&
    !dismissed &&
    !quietPath(pathname) &&
    (config.pages === "all" || /\/products\/[^/]+/.test(pathname));

  useEffect(() => {
    if (!allowed || !config) {
      setIndex(null);
      return;
    }
    const shownSoFar = () => {
      try {
        return Number(sessionStorage.getItem(SHOWN_KEY(workspaceId)) || 0);
      } catch {
        return 0;
      }
    };
    let hideTimer = 0;
    const show = () => {
      if (shownSoFar() >= config.maxPerSession) return;
      setIndex(next.current % config.items.length);
      next.current += 1;
      try {
        sessionStorage.setItem(SHOWN_KEY(workspaceId), String(shownSoFar() + 1));
      } catch {
        /* counted for this page only */
      }
      hideTimer = window.setTimeout(() => setIndex(null), 6000);
    };
    const first = window.setTimeout(show, config.delaySeconds * 1000);
    const every = window.setInterval(show, (config.intervalSeconds + 6) * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearTimeout(hideTimer);
    };
  }, [allowed, config, workspaceId]);

  const item = config && index !== null ? config.items[index] : null;
  if (!item || !config) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(item.at).getTime()) / 60000));

  return (
    // A lane along the bottom that stops short of the end corner, where the
    // WhatsApp button and the way back up live, and starts above whatever bar
    // is pinned to a phone's bottom edge (globals.css, `--sf-toast-bottom`).
    // The lane itself lets taps through; only the card takes them.
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed start-4 end-[5.25rem] bottom-[var(--sf-toast-bottom,5rem)] z-30 flex ${
        config.position === "bottom_end" ? "justify-end" : "justify-start"
      }`}
    >
      <div className={`${card} pointer-events-auto flex w-80 max-w-full items-center gap-3 p-3 shadow-lg`}>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-ink-soft">{text.bought(item.firstName, item.city)}</p>
          <StoreLink href={`/products/${item.productSlug}`} className="block truncate font-semibold text-ink hover:text-primary">
            {item.productName}
          </StoreLink>
          <p className="text-xs text-ink-soft">{text.ago(minutes)}</p>
        </div>
        <button
          type="button"
          aria-label={text.dismiss}
          onClick={() => setDismissed(true)}
          className={`-me-1 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-paper hover:text-ink ${focusRing}`}
        >
          <CrossIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- newsletter --

const NL_KEY = (workspaceId: string) => `zimos.newsletter.${workspaceId}`;

function NewsletterFields({
  workspaceId,
  config,
  idPrefix,
  onDone,
}: {
  workspaceId: string;
  config: StorefrontNewsletter;
  idPrefix: string;
  onDone: () => void;
}) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ couponCode: string | null } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (phone.trim().length < 6) {
      setError(text.phoneRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = createStorefrontApiClient();
      const answer = await storefrontSubscribe(client, workspaceId, {
        ...(await signupGuardFields(client, workspaceId)),
        phone: phone.trim(),
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(website ? { website } : {}),
      });
      setResult({ couponCode: answer.couponCode });
      // A sign-up is the ad platforms' Lead (SPEC §13.2), like a funnel opt-in; never a bot's.
      if (!website) track("Lead", { contentName: "newsletter" });
      onDone();
    } catch (err) {
      // What was typed stays in the fields.
      setError(signupTooMany(err, locale) ?? text.failed);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div role="status" className="text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
          <CheckIcon size={18} />
          {text.thanks}
        </p>
        {result.couponCode && (
          <p className="mt-3 text-sm text-ink-soft">
            {text.yourCode}:{" "}
            <bdi dir="ltr" className="rounded-lg border-2 border-dashed border-primary/40 bg-primary-soft px-3 py-1 font-bold tracking-widest text-primary">
              {result.couponCode}
            </bdi>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className={`grid gap-3 ${config.askName || config.askEmail ? "sm:grid-cols-2" : ""}`}>
        {config.askName && (
          <div>
            <label htmlFor={`${idPrefix}-name`} className={labelClass}>
              {text.name}
            </label>
            <input id={`${idPrefix}-name`} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
          </div>
        )}
        <div>
          <label htmlFor={`${idPrefix}-phone`} className={labelClass}>
            {text.phone}
          </label>
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
          />
        </div>
        {config.askEmail && (
          <div>
            <label htmlFor={`${idPrefix}-email`} className={labelClass}>
              {text.email}
            </label>
            <input
              id={`${idPrefix}-email`}
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </div>
        )}
      </div>
      {/* Not for people: hidden from sight and from assistive tech; a bot that fills it is ignored. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -start-[9999px] h-0 w-0 opacity-0"
      />
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full sm:w-auto`}>
        {busy ? text.sending : text.subscribe}
      </button>
      <p className="text-xs text-ink-soft">{text.consent}</p>
    </form>
  );
}

/**
 * The store's sign-up form where the merchant put it: a band above the
 * footer, or a popup after a delay (once per visitor, never on checkout).
 *
 * Its settings arrive after the page does, so the band cannot be in the
 * server's HTML. It is drawn in only while its place is off screen — below
 * the fold, which is where the end of a page almost always is — so nothing the
 * shopper is looking at moves. On a page short enough that the footer is
 * already in view, it waits for that place to scroll away or for the
 * shopper's next tap or key press, after which a change on screen is expected.
 */
export function NewsletterSignup({ workspaceId }: { workspaceId: string }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const pathname = usePathname() ?? "";
  const quiet = quietPath(pathname);
  // Asked for once the page is idle, and never from a page where the form would not show.
  const ready = useAfterIdle(!quiet);
  const [config, setConfig] = useState<StorefrontNewsletter | null>(null);
  const [open, setOpen] = useState(false);
  // The band's place above the footer, and whether the band has been drawn into it yet.
  const slot = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    storefrontNewsletter(createStorefrontApiClient(), workspaceId)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        /* no form */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId]);

  const remember = () => {
    try {
      localStorage.setItem(NL_KEY(workspaceId), "1");
    } catch {
      /* asked again next visit */
    }
  };

  const popup = config?.placement === "popup";
  const band = config !== null && !popup;

  useEffect(() => {
    if (!popup || !config || quietPath(pathname)) return;
    try {
      if (localStorage.getItem(NL_KEY(workspaceId))) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      remember();
      setOpen(true);
    }, config.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, config, pathname, workspaceId]);

  useEffect(() => {
    if (!band || placed || quiet) return;
    const el = slot.current;
    if (!el) return;
    const place = () => setPlaced(true);
    if (typeof IntersectionObserver === "undefined") {
      const soon = window.setTimeout(place, 0);
      return () => window.clearTimeout(soon);
    }
    // The observer reports once straight away: off screen means the band can go in now.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) place();
    });
    observer.observe(el);
    // On screen: after the shopper's own tap or key press the page may change under them.
    window.addEventListener("click", place, { once: true });
    window.addEventListener("keydown", place, { once: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("click", place);
      window.removeEventListener("keydown", place);
    };
  }, [band, placed, quiet, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!config) return null;
  const heading = config.title || text.nlTitle;

  if (!popup) {
    if (quiet) return null;
    return (
      <>
        {/* Marks the band's place; takes no room of its own. */}
        <div ref={slot} aria-hidden className="-mb-px h-px" />
        {placed && (
          <section aria-labelledby="newsletter-title" className="border-t border-line bg-paper-raised">
            <div className={`${container} grid gap-6 py-10 md:grid-cols-2 md:items-center`}>
              <div>
                <h2 id="newsletter-title" className="text-xl font-semibold text-ink">
                  {heading}
                </h2>
                {config.text && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{config.text}</p>}
              </div>
              <NewsletterFields workspaceId={workspaceId} config={config} idPrefix="nl-footer" onDone={remember} />
            </div>
          </section>
        )}
      </>
    );
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-popup-title"
        className={`${card} w-full max-w-md p-6 shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="newsletter-popup-title" className="text-xl font-bold text-ink">
          {heading}
        </h2>
        {config.text && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{config.text}</p>}
        <div className="mt-4">
          <NewsletterFields workspaceId={workspaceId} config={config} idPrefix="nl-popup" onDone={remember} />
        </div>
        <button type="button" className={`${btnSecondary} mt-3 w-full`} onClick={() => setOpen(false)}>
          {text.close}
        </button>
      </div>
    </div>
  );
}
