"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  shopperRequestCode,
  shopperVerifyCode,
  type ShopperChannel,
  type ShopperCodeSent,
  type ShopperSession,
} from "@store-builder/api-client";
import { btnGhost, btnPrimaryLg, card, input, label, pill } from "@/components/ui";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { codeCooldownOf, shopperErrorMessage, takeSignedOutByServer, useShopperApi } from "@/lib/shopperSession";
import { UserIcon } from "./accountIcons";
import { ShopperGoogleSignIn } from "./ShopperGoogleSignIn";

const CODE_LENGTH = 6;

/**
 * Sign in with a code (frontend-handoff 185): the phone — or the email, on
 * its own tab, when the store allows it — then «ابعت الكود», then the
 * 6-digit code (one-time-code autofill, numeric keypad) with a resend
 * countdown. Six digits sign in on their own. The API's answer is the same
 * whether or not the address is known, so this never says "no such account".
 */
export function ShopperSignIn({
  channels,
  onSignedIn,
}: {
  channels: ShopperChannel[];
  onSignedIn: (session: ShopperSession) => void;
}) {
  const { t, locale } = useStore();
  const a = t.account;
  const api = useShopperApi();
  const egypt = useStoreCountry() === "EG";
  const offered: ShopperChannel[] = channels.length ? channels : ["sms"];

  const [channel, setChannel] = useState<ShopperChannel>(offered[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<ShopperCodeSent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => (takeSignedOutByServer() ? a.signedOut : null));
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  // The last code tried, so a shopper's six digits are sent once, not again on every render.
  const tried = useRef("");

  // A channel the store has since switched off is not kept.
  const active: ShopperChannel = offered.includes(channel) ? channel : offered[0];

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const who = (): { phone: string } | { email: string } =>
    active === "sms" ? { phone: normalizePhone(phone).replace(/^\+/, "") } : { email: email.trim() };

  function validTarget(): boolean {
    if (active === "sms") {
      const ok = egypt ? isEgyptianMobile(phone) : /^\+?\d{8,15}$/.test(normalizePhone(phone));
      if (!ok) setError(a.errors.invalidPhone);
      return ok;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) setError(a.errors.invalidEmail);
    return ok;
  }

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!validTarget()) {
      targetRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const answer = await shopperRequestCode(api.client, api.storeId, { ...who(), locale });
      const again = Boolean(sent);
      setSent(answer);
      setCode("");
      tried.current = "";
      setSecondsLeft(answer.resendAfterSeconds);
      if (again) setNotice(a.resent);
    } catch (err) {
      setError(shopperErrorMessage(err, a, active));
      const wait = codeCooldownOf(err);
      if (wait) setSecondsLeft(wait);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (busy || value.length !== CODE_LENGTH || tried.current === value) return;
    tried.current = value;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const session = await shopperVerifyCode(api.client, api.storeId, { ...who(), code: value });
      api.signIn(session.token);
      onSignedIn(session);
    } catch (err) {
      setError(shopperErrorMessage(err, a, active));
      // A spent or locked code is useless: the field empties for the next one.
      if (err instanceof ApiError && (err.code === "CODE_EXPIRED" || err.code === "TOO_MANY_ATTEMPTS")) setCode("");
      codeRef.current?.focus();
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
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  function restart() {
    setSent(null);
    setCode("");
    setError(null);
    setNotice(null);
    tried.current = "";
    window.setTimeout(() => targetRef.current?.focus(), 0);
  }

  const errorBox = (
    <div aria-live="polite" className="empty:hidden">
      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      {!error && notice && <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">{notice}</p>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <UserIcon size={28} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">{a.signIn}</h1>
        <p className="mt-2 text-sm text-ink-soft">{a.signInSubtitle}</p>
      </div>

      <div className={`${card} mt-6 p-5 sm:p-6`}>
        {/* Google's own button above the code form, when the store offers it (handoff 217, 279). */}
        {!sent && <ShopperGoogleSignIn onSignedIn={onSignedIn} />}
        {!sent ? (
          <form onSubmit={requestCode} noValidate className="space-y-4">
            {offered.length > 1 && (
              <div role="radiogroup" aria-label={a.signInWith} className="grid grid-cols-2 gap-2">
                {offered.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active === c}
                    onClick={() => {
                      setChannel(c);
                      setError(null);
                    }}
                    className={pill(active === c)}
                  >
                    {c === "sms" ? a.byPhone : a.byEmail}
                  </button>
                ))}
              </div>
            )}

            {active === "sms" ? (
              <div>
                <label htmlFor="account-phone" className={label}>
                  {t.form.phone}
                </label>
                <input
                  id="account-phone"
                  ref={targetRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete={egypt ? "tel-national" : "tel"}
                  dir="ltr"
                  placeholder={egypt ? t.form.phonePlaceholder : undefined}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  className={`${input} text-start rtl:text-end`}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="account-email" className={label}>
                  {a.email}
                </label>
                <input
                  id="account-email"
                  ref={targetRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  placeholder={a.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="account-email-note"
                  className={`${input} text-start rtl:text-end`}
                />
                <p id="account-email-note" className="mt-1 text-xs text-ink-soft">
                  {a.emailNote}
                </p>
              </div>
            )}

            {errorBox}

            <button type="submit" disabled={busy || secondsLeft > 0} className={btnPrimaryLg}>
              {busy ? a.sending : secondsLeft > 0 ? a.resendIn(secondsLeft) : a.sendCode}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length !== CODE_LENGTH) {
                setError(a.errors.codeLength);
                codeRef.current?.focus();
                return;
              }
              tried.current = "";
              void verify(code);
            }}
            noValidate
            className="space-y-4"
          >
            <p className="text-sm text-ink-soft">
              {a.codeSentTo}{" "}
              <bdi dir="ltr" className="font-semibold text-ink">
                {sent.target}
              </bdi>
            </p>
            <div>
              <label htmlFor="account-code" className={label}>
                {a.code}
              </label>
              <input
                id="account-code"
                ref={codeRef}
                dir="ltr"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => onCode(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`${input} text-center text-2xl tracking-[0.5em] tabular-nums`}
              />
            </div>

            {errorBox}

            <button type="submit" disabled={busy || code.length !== CODE_LENGTH} className={btnPrimaryLg}>
              {busy ? a.verifying : a.verify}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={busy || secondsLeft > 0}
                className={`${btnGhost} disabled:cursor-default disabled:opacity-60`}
              >
                {secondsLeft > 0 ? a.resendIn(secondsLeft) : a.resend}
              </button>
              <button type="button" onClick={restart} className={btnGhost}>
                {active === "sms" ? a.changePhone : a.changeEmail}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
