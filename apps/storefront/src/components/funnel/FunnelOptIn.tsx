"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiErrorCode, funnelOptInSubmit } from "@store-builder/api-client";
import { btnPrimaryLg, container, input, label as labelClass } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { botGuardAutosaveFields } from "@/lib/botGuard";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { track } from "@/lib/track";

/**
 * The opt-in step's form (SPEC §9.2 "Collect name/email/mobile (Lead)";
 * backend funnels/funnelOptIn.js): the visitor's name and a phone or an
 * email are stored first, and only then does the funnel move on. The ad
 * platforms' Lead fires on a stored sign-up, never on a bare click. The
 * page's own "next" buttons bring the visitor here instead of skipping it.
 */

const TEXT = {
  en: {
    name: "Your name",
    phone: "Mobile number",
    email: "Email",
    optional: "(optional)",
    submit: "Sign up",
    sending: "One moment…",
    consent: (store: string) => `By signing up you agree to get messages from ${store}. Reply STOP any time to stop them.`,
    needName: "Enter your name.",
    needContact: "Enter a mobile number or an email.",
    badPhone: "Check the mobile number.",
    tooMany: "Too many tries. Wait a minute and try again.",
    failed: "That didn't go through. Try again.",
  },
  ar: {
    name: "اسمك",
    phone: "رقم الموبايل",
    email: "الإيميل",
    optional: "(اختياري)",
    submit: "اشترك",
    sending: "لحظة…",
    consent: (store: string) => `باشتراكك بتوافق إن ${store} يبعتلك رسائل. ابعت STOP في أي وقت عشان توقفها.`,
    needName: "اكتب اسمك.",
    needContact: "اكتب رقم موبايل أو إيميل.",
    badPhone: "راجع رقم الموبايل.",
    tooMany: "محاولات كتير. استنى دقيقة وحاول تاني.",
    failed: "محصلش. حاول تاني.",
  },
  fr: {
    name: "Votre nom",
    phone: "Numéro de mobile",
    email: "E-mail",
    optional: "(facultatif)",
    submit: "S'inscrire",
    sending: "Un instant…",
    consent: (store: string) => `En vous inscrivant, vous acceptez de recevoir des messages de ${store}. Répondez STOP à tout moment pour les arrêter.`,
    needName: "Entrez votre nom.",
    needContact: "Entrez un numéro de mobile ou un e-mail.",
    badPhone: "Vérifiez le numéro de mobile.",
    tooMany: "Trop d'essais. Attendez une minute et réessayez.",
    failed: "Cela n'a pas marché. Réessayez.",
  },
};

export const OPT_IN_FORM_ID = "funnel-opt-in";

export function FunnelOptIn({
  anchorId,
  workspaceId,
  funnelId,
  sessionId,
  stepName,
  pending,
  advanceError,
  onSignedUp,
}: {
  /** The step's action anchor (FUNNEL_ACTIONS_ID): the page's CTAs link to it. */
  anchorId: string;
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  stepName: string;
  pending: boolean;
  advanceError: string | null;
  /** Moves the funnel on (clicked_through) once the sign-up is stored. */
  onSignedUp: () => void;
}) {
  const { locale, store } = useStore();
  const t = pickText(TEXT, locale);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once stored, a failed advance retries the advance only, never the sign-up.
  const [stored, setStored] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // The page's own "next" buttons: bring the visitor to this form instead of skipping it.
  useEffect(() => {
    function handle(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest('[data-funnel-action="clicked_through"]') : null;
      if (!target) return;
      event.preventDefault();
      document.getElementById(OPT_IN_FORM_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || pending) return;
    if (stored) return onSignedUp();
    if (fullName.trim().length < 2) return setError(t.needName);
    if (!phone.trim() && !email.trim()) return setError(t.needContact);
    setBusy(true);
    setError(null);
    try {
      const client = createStorefrontApiClient();
      await funnelOptInSubmit(client, workspaceId, funnelId, sessionId, {
        fullName: fullName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(await botGuardAutosaveFields(client, workspaceId)),
        website: honeypot,
      });
      setStored(true);
      // A stored sign-up is the ad platforms' Lead.
      track("Lead", { contentName: stepName });
      onSignedUp();
    } catch (err) {
      const code = apiErrorCode(err);
      setError(code === "INVALID_PHONE" ? t.badPhone : code === "CONTACT_REQUIRED" ? t.needContact : err instanceof ApiError && err.status === 429 ? t.tooMany : t.failed);
    } finally {
      setBusy(false);
    }
  }

  const message = error ?? advanceError;
  return (
    <section id={anchorId} className={`${container} scroll-mt-24 pb-16 pt-6`}>
      <form id={OPT_IN_FORM_ID} onSubmit={submit} noValidate className="mx-auto w-full max-w-md space-y-4">
        <div>
          <label htmlFor="opt-in-name" className={labelClass}>
            {t.name}
          </label>
          <input ref={nameRef} id="opt-in-name" className={input} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="opt-in-phone" className={labelClass}>
            {t.phone}
          </label>
          <input id="opt-in-phone" className={input} type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label htmlFor="opt-in-email" className={labelClass}>
            {t.email} <span className="font-normal text-ink-soft">{t.optional}</span>
          </label>
          <input id="opt-in-email" className={input} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {/* Nobody sees or fills this; a bot does (the bot guard's honeypot). */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        {message && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {message}
          </p>
        )}
        <button type="submit" disabled={busy || pending} aria-busy={busy || pending} className={btnPrimaryLg}>
          {busy || pending ? t.sending : t.submit}
        </button>
        <p className="text-center text-xs text-ink-soft">{t.consent(store?.name ?? "")}</p>
      </form>
    </section>
  );
}
