"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, shopperEmailCode, shopperEmailVerified, shopperEmailVerify, type ShopperEmailCodeSent, type ShopperMe } from "@store-builder/api-client";
import { btnGhost, btnSecondary, input, label } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { codeCooldownOf, shopperErrorMessage } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useAccount } from "./AccountShell";
import { ShopperGoogleSignIn } from "./ShopperGoogleSignIn";

const CODE_LENGTH = 6;

/** The profile's words about a verified email (frontend-handoff 278); the chips and the two actions are the handoff's own. */
const COPY = {
  en: {
    notVerified: "Not verified",
    verified: "Verified",
    why: "Only a verified email can sign you in — by code or with Google.",
    verify: "Verify email",
    saveFirst: "Save the email first, then verify it.",
    confirm: "Confirm",
    done: "Email verified.",
    linkGoogle: "Link Google",
    linkGoogleHint: "Your Google account's email becomes your verified email here.",
    linked: "Google is linked: you can sign in with it from now on.",
  },
  ar: {
    notVerified: "مش متأكد",
    verified: "متأكد ✓",
    why: "الإيميل المتأكد بس هو اللي تقدر تدخل بيه — بالكود أو بجوجل.",
    verify: "أكّد الإيميل",
    saveFirst: "احفظ الإيميل الأول، وبعدين أكّده.",
    confirm: "أكّد",
    done: "الإيميل اتأكد.",
    linkGoogle: "اربط حساب جوجل",
    linkGoogleHint: "إيميل حساب جوجل هيبقى هو الإيميل المتأكد في حسابك هنا.",
    linked: "حساب جوجل اتربط: تقدر تدخل بيه من دلوقتي.",
  },
  fr: {
    notVerified: "Non vérifié",
    verified: "Vérifié",
    why: "Seul un e-mail vérifié permet de vous connecter — par code ou avec Google.",
    verify: "Vérifier l'e-mail",
    saveFirst: "Enregistrez d'abord l'e-mail, puis vérifiez-le.",
    confirm: "Confirmer",
    done: "E-mail vérifié.",
    linkGoogle: "Associer Google",
    linkGoogleHint: "L'e-mail de votre compte Google devient votre e-mail vérifié ici.",
    linked: "Google est associé : vous pouvez désormais vous connecter avec.",
  },
};

/**
 * Under the profile's email field (frontend-handoff 278): whether the saved
 * email is verified — only a verified one signs in by email code or with
 * Google — and the two ways to make it so: «أكّد الإيميل» sends a 6-digit
 * code to it, «اربط حساب جوجل» takes the email Google vouches for. Changing
 * the email shows it unverified again, as the API has it.
 *
 * `typed` is what the field holds now: an unsaved change is saved first.
 */
export function EmailVerification({ typed }: { typed: string }) {
  const { t, locale } = useStore();
  const a = t.account;
  const c = pickText(COPY, locale);
  const { api, me, setMe } = useAccount();
  const saved = (me.customer.email ?? "").trim();
  const verified = Boolean(saved) && shopperEmailVerified(me.customer);
  const changed = typed.trim().toLowerCase() !== saved.toLowerCase();

  const [sent, setSent] = useState<ShopperEmailCodeSent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  // A code was asked for one address: another one in the field starts over.
  useEffect(() => {
    setSent(null);
    setCode("");
    setError(null);
  }, [saved]);

  async function sendCode() {
    if (busy || !saved) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const answer = await api.call((client, storeId, token) => shopperEmailCode(client, storeId, token, { email: saved, locale }));
      setSent(answer);
      setCode("");
      setSecondsLeft(answer.resendAfterSeconds);
    } catch (err) {
      setError(shopperErrorMessage(err, a, "email"));
      const wait = codeCooldownOf(err);
      if (wait) setSecondsLeft(wait);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (busy) return;
    if (code.length !== CODE_LENGTH) {
      setError(a.errors.codeLength);
      codeRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await api.call((client, storeId, token) => shopperEmailVerify(client, storeId, token, { email: saved, code }));
      setMe(next);
      setSent(null);
      setCode("");
      setNotice(c.done);
    } catch (err) {
      setError(shopperErrorMessage(err, a, "email"));
      // A spent or locked code is useless: the field empties for the next one.
      if (err instanceof ApiError && (err.code === "CODE_EXPIRED" || err.code === "TOO_MANY_ATTEMPTS")) setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function onCode(raw: string) {
    // Arabic-Indic digits typed on an Arabic keyboard count too.
    const digits = raw
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
  }

  const messages = (
    <div aria-live="polite" className="empty:hidden">
      {error && <p className="mt-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      {!error && notice && <p className="mt-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{notice}</p>}
    </div>
  );

  if (verified && !changed) {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">{c.verified}</span>
        {messages}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {saved && !changed && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-dark">{c.notVerified}</span>
          {!sent && (
            <button type="button" onClick={() => void sendCode()} disabled={busy || secondsLeft > 0} className={`${btnGhost} disabled:cursor-default disabled:opacity-60`}>
              {busy ? a.sending : secondsLeft > 0 ? a.resendIn(secondsLeft) : c.verify}
            </button>
          )}
        </div>
      )}
      {changed && typed.trim() !== "" && <p className="text-xs text-ink-soft">{c.saveFirst}</p>}
      {saved && !changed && !sent && <p className="text-xs text-ink-soft">{c.why}</p>}

      {sent && !changed && (
        // Not a <form>: this sits inside the profile's own form.
        <div className="rounded-xl bg-paper p-3">
          <p className="text-sm text-ink-soft">
            {a.codeSentTo}{" "}
            <bdi dir="ltr" className="font-semibold text-ink">
              {sent.target}
            </bdi>
          </p>
          <label htmlFor="profile-email-code" className={`${label} mt-3`}>
            {a.code}
          </label>
          <input
            id="profile-email-code"
            ref={codeRef}
            dir="ltr"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => onCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirm(e);
            }}
            aria-invalid={error ? true : undefined}
            className={`${input} max-w-[14rem] text-center text-xl tracking-[0.4em] tabular-nums`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void confirm()} disabled={busy || code.length !== CODE_LENGTH} className={btnSecondary}>
              {busy ? a.verifying : c.confirm}
            </button>
            <button type="button" onClick={() => void sendCode()} disabled={busy || secondsLeft > 0} className={`${btnGhost} disabled:cursor-default disabled:opacity-60`}>
              {secondsLeft > 0 ? a.resendIn(secondsLeft) : a.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(null);
                setCode("");
                setError(null);
              }}
              className={btnGhost}
            >
              {a.cancel}
            </button>
          </div>
        </div>
      )}
      {messages}

      {!sent && !changed && (
        // Google's own button, drawn only when the store offers Google sign-in.
        <GoogleLink
          title={c.linkGoogle}
          hint={c.linkGoogleHint}
          onLinked={(next) => {
            setMe(next);
            setError(null);
            setNotice(c.linked);
          }}
        />
      )}
    </div>
  );
}

/** «اربط حساب جوجل»: its title and hint show only when Google's button does. */
function GoogleLink({ title, hint, onLinked }: { title: string; hint: string; onLinked: (me: ShopperMe) => void }) {
  return (
    <div className="hidden pt-1 has-[[data-google-sign-in]]:block">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      <div className="max-w-xs">
        <ShopperGoogleSignIn mode="link" divider={false} onSignedIn={(session) => onLinked({ customer: session.customer, addresses: session.addresses })} />
      </div>
    </div>
  );
}
