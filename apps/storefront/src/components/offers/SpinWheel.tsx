"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { spinRefusalOf, storefrontSpin, storefrontSpinWheel, type SpinResult, type StoreSpinWheel } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { normalizePhone } from "@/lib/egypt";
import { pickText } from "@/lib/i18n";
// The bot guard's token rides the spin, and its per-address limit has its own sentence (handoff 363).
import { signupGuardFields, signupTooMany } from "@/lib/signupGuard";
import { useStore } from "@/lib/StoreContext";
import { prefersReducedMotion, useDialog } from "@/lib/useDialog";
import { CheckIcon, CopyIcon, CrossIcon } from "../Icons";
import { backdrop, btnPrimary, btnSecondary, iconBtn, input, label as labelClass, modalLayer } from "../ui";
import { useAfterIdle } from "./Engagement";
import { SpinWheelArt, wheelStopAngle } from "./SpinWheelArt";

/*
 * Spin to win (handoff 258): the store's wheel as a popup, once per visitor,
 * after the delay the merchant set. The shopper gives a mobile number, ticks
 * that they want the store's offers, and spins once; the server draws and
 * the wheel only turns to its answer. Every slice's real chance is written
 * beside the wheel. Nothing here decides a prize.
 */

const en = {
  title: "Try your luck",
  chances: "Chances:",
  phone: "Mobile number",
  name: "Name (optional)",
  consent: "I agree to receive offers from the store",
  spin: "Spin",
  sending: "One moment…",
  spinning: "The wheel is spinning…",
  once: "One spin per mobile number.",
  phoneRequired: "Enter your mobile number.",
  phoneInvalid: "Enter a valid mobile number.",
  consentRequired: "Tick the box to spin: the wheel is for shoppers who want the store's offers.",
  alreadySpun: "This number has already spun",
  wheelOff: "The wheel isn't available right now.",
  failed: "Something went wrong — try again.",
  won: "Congratulations!",
  wonLabel: "You won:",
  code: "Your discount code:",
  codeHint: "Enter it at checkout.",
  copy: "Copy code",
  copied: "Copied",
  lost: "Better luck next time",
};

const ar: typeof en = {
  title: "جرّب حظك",
  chances: "فرص الفوز:",
  phone: "رقم الموبايل",
  name: "الاسم (اختياري)",
  consent: "موافق أستقبل عروض من المتجر",
  spin: "لف العجلة",
  sending: "ثانية واحدة…",
  spinning: "العجلة بتلف…",
  once: "لفّة واحدة لكل رقم موبايل.",
  phoneRequired: "اكتب رقم موبايلك.",
  phoneInvalid: "اكتب رقم موبايل صحيح.",
  consentRequired: "علّم على الموافقة عشان تلف: العجلة للي عايز يستقبل عروض المتجر.",
  alreadySpun: "الرقم ده لف العجلة قبل كده",
  wheelOff: "العجلة مش متاحة دلوقتي.",
  failed: "حصلت مشكلة — جرّب تاني.",
  won: "مبروك!",
  wonLabel: "كسبت:",
  code: "كود الخصم:",
  codeHint: "اكتبه وانت بتكمّل طلبك.",
  copy: "انسخ الكود",
  copied: "اتنسخ",
  lost: "حظ أوفر المرة الجاية",
};

const fr: typeof en = {
  title: "Tentez votre chance",
  chances: "Chances :",
  phone: "Numéro de mobile",
  name: "Nom (facultatif)",
  consent: "J'accepte de recevoir les offres de la boutique",
  spin: "Tourner la roue",
  sending: "Un instant…",
  spinning: "La roue tourne…",
  once: "Un seul tour par numéro de mobile.",
  phoneRequired: "Saisissez votre numéro de mobile.",
  phoneInvalid: "Saisissez un numéro de mobile valide.",
  consentRequired: "Cochez la case pour tourner : la roue est réservée à ceux qui veulent recevoir les offres de la boutique.",
  alreadySpun: "Ce numéro a déjà tourné la roue",
  wheelOff: "La roue n'est pas disponible pour le moment.",
  failed: "Un problème est survenu — réessayez.",
  won: "Félicitations !",
  wonLabel: "Vous avez gagné :",
  code: "Votre code de réduction :",
  codeHint: "Saisissez-le au moment de commander.",
  copy: "Copier le code",
  copied: "Copié",
  lost: "Plus de chance la prochaine fois",
};

const TEXT = { en, ar, fr };

/** What this browser remembers about the wheel: it is not shown again after either. */
type Remembered = "spun" | "dismissed";
const KEY = (workspaceId: string) => `zimos.spin-wheel.${workspaceId}`;

/** The saved answer; null for none, and "unknown" when the browser keeps nothing (then the wheel stays away). */
function remembered(workspaceId: string): Remembered | "unknown" | null {
  try {
    const value = localStorage.getItem(KEY(workspaceId));
    return value === "spun" || value === "dismissed" ? value : value ? "dismissed" : null;
  } catch {
    return "unknown";
  }
}

function remember(workspaceId: string, value: Remembered) {
  try {
    localStorage.setItem(KEY(workspaceId), value);
  } catch {
    /* kept for this page only */
  }
}

// Pages that already ask something of the shopper — the cart, the order form, payment, the
// thank-you and tracking pages, their account — and the ones that are not the shop itself.
const QUIET = new Set(["cart", "checkout", "orders", "pay", "offer", "track", "f", "r", "preview", "account", "downloads", "subscriptions", "unsubscribe"]);

/** The wheel turns for this long before it stops on the slice the server drew. */
const SPIN_MS = 4600;
const TURNS = 5;

type Phase = "form" | "sending" | "spinning" | "result";

export function SpinWheel({ workspaceId }: { workspaceId: string }) {
  const { locale, intlLocale, t } = useStore();
  const text = pickText(TEXT, locale);
  // The page under the store layout: "cart", "checkout", "products"… (null on the home page).
  const segment = useSelectedLayoutSegment();
  const quiet = segment !== null && QUIET.has(segment.split("/")[0]);

  const [wheel, setWheel] = useState<StoreSpinWheel | null>(null);
  const [due, setDue] = useState(false);
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [rotation, setRotation] = useState(0);

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{ field: "phone" | "consent" | null; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const id = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const stopTimer = useRef(0);
  const busy = phase === "sending" || phase === "spinning";
  const showing = open && !quiet && wheel !== null;

  // The store's wheel, unless this browser has already spun or closed it. Asked for once the
  // page has loaded and gone quiet (./Engagement), and never from a page where the wheel stays away.
  const ready = useAfterIdle(!quiet);
  useEffect(() => {
    if (!ready) return;
    if (remembered(workspaceId) !== null) return;
    let cancelled = false;
    storefrontSpinWheel(createStorefrontApiClient(), workspaceId)
      .then((answer) => {
        if (!cancelled) setWheel(answer);
      })
      .catch(() => {
        /* no wheel */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId]);

  // The merchant's delay, counted once from the moment the wheel is known — moving between pages does not restart it.
  const delaySeconds = wheel?.delaySeconds ?? null;
  useEffect(() => {
    if (delaySeconds === null) return;
    const timer = window.setTimeout(() => setDue(true), Math.max(0, delaySeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [delaySeconds]);

  // Opens when the delay has passed, on a page where it may, and never over another dialog
  // (the cart drawer, the menu, another popup): it waits for that one to close.
  useEffect(() => {
    if (!due || quiet || open || finished) return;
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false;
      if (remembered(workspaceId) !== null) setFinished(true);
      else setOpen(true);
      return true;
    };
    if (tryOpen()) return;
    const timer = window.setInterval(() => {
      if (tryOpen()) window.clearInterval(timer);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [due, quiet, open, finished, workspaceId]);

  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  function dismiss() {
    // The answer is on its way or the wheel is turning: the result must not be lost to a stray tap.
    if (busy) return;
    remember(workspaceId, result ? "spun" : "dismissed");
    setOpen(false);
    setFinished(true);
  }

  const dialogRef = useDialog<HTMLDivElement>({ open: showing, onClose: dismiss });

  // The result takes focus when it appears, so it is read out and the keyboard is on its buttons.
  useEffect(() => {
    if (phase === "result") resultRef.current?.focus({ preventScroll: true });
  }, [phase]);

  function showResult() {
    window.clearTimeout(stopTimer.current);
    setPhase("result");
  }

  /** Turns the wheel to the slice the server drew — after its answer, never before. */
  function land(answer: SpinResult, slices: StoreSpinWheel["slices"]) {
    const index = answer.sliceId ? slices.findIndex((s) => s.id === answer.sliceId) : -1;
    if (index < 0) {
      // The wheel changed since it was drawn here (or the spin was not counted): the answer alone.
      setPhase("result");
      return;
    }
    if (prefersReducedMotion()) {
      // No spin: the wheel is simply shown on the slice, with the result.
      setRotation(wheelStopAngle(index, slices.length, 0));
      setPhase("result");
      return;
    }
    setRotation(wheelStopAngle(index, slices.length, TURNS, Math.random() * 2 - 1));
    setPhase("spinning");
    // The transition's end shows the result; this is for a browser that never reports one.
    stopTimer.current = window.setTimeout(showResult, SPIN_MS + 400);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !wheel) return;
    const number = normalizePhone(phone.trim());
    if (number.replace(/\D/g, "").length === 0) {
      setError({ field: "phone", message: text.phoneRequired });
      return;
    }
    if (number.replace(/\D/g, "").length < 8) {
      setError({ field: "phone", message: text.phoneInvalid });
      return;
    }
    if (!consent) {
      setError({ field: "consent", message: text.consentRequired });
      return;
    }
    setError(null);
    setPhase("sending");
    try {
      const client = createStorefrontApiClient();
      const answer = await storefrontSpin(client, workspaceId, {
        ...(await signupGuardFields(client, workspaceId)),
        phone: number,
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
        marketingConsent: true,
        website,
      });
      // This number has had its spin, whatever happens to the page now.
      remember(workspaceId, "spun");
      setResult(answer);
      land(answer, wheel.slices);
    } catch (err) {
      const refusal = spinRefusalOf(err);
      setPhase("form");
      setError(
        refusal === "already_spun"
          ? { field: "phone", message: text.alreadySpun }
          : refusal === "phone"
            ? { field: "phone", message: text.phoneInvalid }
            : refusal === "consent"
              ? { field: "consent", message: text.consentRequired }
              : { field: null, message: refusal === "wheel_off" ? text.wheelOff : (signupTooMany(err, locale) ?? text.failed) }
      );
    }
  }

  async function copy() {
    if (!result?.couponCode) return;
    try {
      await navigator.clipboard.writeText(result.couponCode);
      setCopied(true);
    } catch {
      /* the code is on screen to type */
    }
  }

  if (!showing || !wheel) return null;

  const percent = (chance: number) => new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 1 }).format(chance / 100);
  const won = Boolean(result?.prize && result.couponCode);

  return (
    <div className={modalLayer}>
      <div className={backdrop(true)} aria-hidden onClick={dismiss} />
      {/* A sheet from the bottom on a phone, a centred card from sm up; taps beside it fall through to the backdrop. */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={wheel.text ? `${id}-text` : undefined}
          className="zt-card pointer-events-auto relative max-h-dvh w-full overflow-y-auto rounded-t-2xl border border-line bg-paper-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-2xl sm:p-6"
        >
          <div className="absolute end-3 top-3">
            <button type="button" onClick={dismiss} disabled={busy} aria-label={t.common.close} data-autofocus="" className={`${iconBtn} disabled:opacity-50`}>
              <CrossIcon />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-x-6">
            <div className="pe-12 sm:col-start-2">
              <h2 id={`${id}-title`} className="font-display text-xl font-bold text-ink">
                {wheel.title || text.title}
              </h2>
              {wheel.text && (
                <p id={`${id}-text`} className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {wheel.text}
                </p>
              )}
            </div>

            <div className="relative mx-auto w-full max-w-56 sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:max-w-none sm:self-center">
              <div
                style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_MS}ms` }}
                className="transition-transform ease-[cubic-bezier(0.16,0.84,0.24,1)] motion-reduce:transition-none"
                onTransitionEnd={(e) => {
                  if (e.target === e.currentTarget && phase === "spinning") showResult();
                }}
              >
                <SpinWheelArt slices={wheel.slices} />
              </div>
              {/* The pointer: it stays put, and the slice under it is the one the wheel stops on. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="absolute inset-x-0 -top-1.5 mx-auto size-7 drop-shadow-sm">
                <path d="M4 3h16l-8 17z" className="fill-accent stroke-paper-raised" strokeWidth={1.5} strokeLinejoin="round" />
              </svg>
            </div>

            <div className="min-w-0 sm:col-start-2">
              {phase === "result" && result ? (
                <div ref={resultRef} tabIndex={-1} role="status" className="rounded-xl outline-none">
                  {won ? (
                    <>
                      <p className="flex items-center gap-2 text-lg font-bold text-success">
                        <CheckIcon size={20} />
                        {text.won}
                      </p>
                      {result.label && (
                        <p className="mt-1 text-sm text-ink">
                          {/* The label in its own direction, so the merchant's "10%" is not turned into "%10" inside Arabic. */}
                          {text.wonLabel} <bdi className="font-semibold">{result.label}</bdi>
                        </p>
                      )}
                      <p className="mt-4 text-xs font-medium text-ink-soft">{text.code}</p>
                      <p dir="ltr" className="mt-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft px-4 py-3 text-center text-lg font-bold tracking-widest text-primary">
                        {result.couponCode}
                      </p>
                      <p className="mt-2 text-xs text-ink-soft">{text.codeHint}</p>
                      <div className="mt-4 grid gap-2">
                        <button type="button" className={btnPrimary} onClick={() => void copy()}>
                          {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                          <span aria-live="polite">{copied ? text.copied : text.copy}</span>
                        </button>
                        <button type="button" className={btnSecondary} onClick={dismiss}>
                          {t.common.continueShopping}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-ink">{text.lost}</p>
                      <button type="button" className={`${btnPrimary} mt-4 w-full`} onClick={dismiss}>
                        {t.common.continueShopping}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-xs text-ink-soft">
                    <p className="font-semibold text-ink">{text.chances}</p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {wheel.slices.map((slice) => (
                        <li key={slice.id}>
                          <bdi className="font-medium text-ink">{slice.label}</bdi> — {percent(slice.chance)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <form onSubmit={submit} noValidate className="mt-4 space-y-3">
                    <div>
                      <label htmlFor={`${id}-phone`} className={labelClass}>
                        {text.phone}
                      </label>
                      <input
                        id={`${id}-phone`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        required
                        maxLength={32}
                        value={phone}
                        disabled={busy}
                        aria-invalid={error?.field === "phone" ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                        onChange={(e) => setPhone(e.target.value)}
                        className={input}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-name`} className={labelClass}>
                        {text.name}
                      </label>
                      <input
                        id={`${id}-name`}
                        autoComplete="name"
                        maxLength={200}
                        value={fullName}
                        disabled={busy}
                        onChange={(e) => setFullName(e.target.value)}
                        className={input}
                      />
                    </div>
                    {/* Not for people: hidden from sight and from assistive tech; a spin that fills it is not counted. */}
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
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm text-ink">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        disabled={busy}
                        aria-invalid={error?.field === "consent" ? true : undefined}
                        aria-describedby={error?.field === "consent" ? `${id}-error` : undefined}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                      />
                      <span>{text.consent}</span>
                    </label>
                    <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger empty:hidden">
                      {error?.message}
                    </p>
                    <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                      {phase === "sending" ? text.sending : phase === "spinning" ? text.spinning : text.spin}
                    </button>
                    <p className="text-center text-xs text-ink-soft">{text.once}</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
