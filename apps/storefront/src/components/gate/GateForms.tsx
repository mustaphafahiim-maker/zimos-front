"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ApiError, storefrontGateSignup, storefrontGateUnlock } from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { btnPrimaryLg, btnSecondary, input, label } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import type { Dictionary } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { saveStoreGateToken } from "@/lib/storeGate";
import { EyeGlyph, EyeOffGlyph } from "./gateIcons";

type GateTexts = Dictionary["storeGate"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unlockRefusal(err: unknown, g: GateTexts): string {
  if (err instanceof ApiError && err.code === "WRONG_PASSWORD") return g.wrongPassword;
  if (err instanceof ApiError && err.status === 429) return g.tooMany;
  return g.failed;
}

/**
 * The password page's form (frontend-handoff 197): POST /gate/unlock, then the
 * token goes in a cookie and the page loads again, so the server renders the
 * store and every browser client — the cart's included — sends the token.
 */
export function PasswordForm() {
  const { t, locale, store } = useStore();
  const g = t.storeGate;
  const ids = useId();
  // In the page's language, so the API words anything unexpected for this shopper.
  const [client] = useState(() => createStorefrontApiClient({ locale }));
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !store) return;
    if (!password) {
      setError(g.emptyPassword);
      field.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, expiresInSeconds } = await storefrontGateUnlock(client, store.id, password);
      saveStoreGateToken(token, expiresInSeconds);
      setOpening(true);
      window.location.reload();
    } catch (err) {
      setError(unlockRefusal(err, g));
      setBusy(false);
      field.current?.select();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-3 text-start">
      <div>
        <label htmlFor={`${ids}-password`} className={label}>
          {g.passwordLabel}
        </label>
        {/* Left to right like the password itself, so the eye sits at the end of the typed text in every language. */}
        <div className="relative" dir="ltr">
          <input
            ref={field}
            id={`${ids}-password`}
            type={show ? "text" : "password"}
            dir="ltr"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            className={`${input} pe-12 text-start`}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? g.hidePassword : g.showPassword}
            aria-pressed={show}
            className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-xl text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {show ? <EyeOffGlyph size={18} /> : <EyeGlyph size={18} />}
          </button>
        </div>
        {error && (
          <p id={`${ids}-error`} role="alert" className="mt-1.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className={btnPrimaryLg} disabled={busy}>
        {opening ? g.opening : busy ? g.checking : g.enter}
      </button>
    </form>
  );
}

/**
 * «بلغني لما تفتحوا»: an email for the merchant's sign-up list (POST
 * /gate/signup, both gate modes; the same email twice is fine). `secondary`
 * on the password page, where the password is the main way in.
 */
export function SignupForm({ secondary = false }: { secondary?: boolean }) {
  const { t, locale, store } = useStore();
  const g = t.storeGate;
  const ids = useId();
  const [client] = useState(() => createStorefrontApiClient({ locale }));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !store) return;
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError(g.invalidEmail);
      field.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await storefrontGateSignup(client, store.id, { email: value, locale });
      setDone(true);
    } catch (err) {
      // The merchant opened the store meanwhile: show it.
      if (err instanceof ApiError && err.code === "STORE_OPEN") {
        window.location.reload();
        return;
      }
      setError(
        err instanceof ApiError && err.status === 429
          ? g.tooMany
          : err instanceof ApiError && err.status === 422
            ? g.invalidEmail
            : g.failed
      );
      field.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-start text-sm font-medium text-success">
        <CheckIcon size={18} className="mt-0.5 shrink-0" />
        {g.notified}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-3 text-start">
      <div>
        <label htmlFor={`${ids}-email`} className={label}>
          {g.emailLabel}
        </label>
        <input
          ref={field}
          id={`${ids}-email`}
          type="email"
          inputMode="email"
          dir="ltr"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={255}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids}-error` : undefined}
          className={`${input} text-start`}
          disabled={busy}
        />
        {error && (
          <p id={`${ids}-error`} role="alert" className="mt-1.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className={secondary ? `${btnSecondary} w-full` : btnPrimaryLg} disabled={busy}>
        {busy ? g.sending : g.notify}
      </button>
    </form>
  );
}
