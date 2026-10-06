"use client";

import { useState, type FormEvent } from "react";
import { shopperSignOutEverywhere, shopperUpdateMe } from "@store-builder/api-client";
import { btnGhost, btnPrimary, btnSecondary, card, input, label } from "@/components/ui";
import { shopperErrorMessage } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { btnDanger, btnGhostDanger, useAccount } from "./AccountShell";

/**
 * «البيانات»: the shopper's name, email and marketing consent (PATCH /me),
 * the phone they sign in with, «خروج» (forget the token on this device)
 * and «الخروج من كل الأجهزة» (the API voids every token).
 */
export function AccountProfile() {
  const { t } = useStore();
  const a = t.account;
  const { api, me, setMe } = useAccount();
  const [fullName, setFullName] = useState(me.customer.fullName ?? "");
  const [email, setEmail] = useState(me.customer.email ?? "");
  const [marketing, setMarketing] = useState(me.customer.marketingConsent);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dirty =
    fullName.trim() !== (me.customer.fullName ?? "") ||
    email.trim().toLowerCase() !== (me.customer.email ?? "") ||
    marketing !== me.customer.marketingConsent;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t.form.errors.email);
      document.getElementById("profile-email")?.focus();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const next = await api.call((client, storeId, token) =>
        shopperUpdateMe(client, storeId, token, {
          fullName: fullName.trim() || null,
          email: email.trim() || null,
          marketingConsent: marketing,
        })
      );
      setMe(next);
      setFullName(next.customer.fullName ?? "");
      setEmail(next.customer.email ?? "");
      setMarketing(next.customer.marketingConsent);
      setMessage({ tone: "ok", text: a.saved });
    } catch (err) {
      setMessage({ tone: "error", text: shopperErrorMessage(err, a, "email") });
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setLeaving(true);
    setMessage(null);
    try {
      await api.call((client, storeId, token) => shopperSignOutEverywhere(client, storeId, token));
      api.signOut();
    } catch (err) {
      setMessage({ tone: "error", text: shopperErrorMessage(err, a) });
      setLeaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <form onSubmit={save} noValidate className={`${card} space-y-4 p-5 sm:p-6`}>
        <div>
          <label htmlFor="profile-name" className={label}>
            {a.fullName}
          </label>
          <input
            id="profile-name"
            type="text"
            autoComplete="name"
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <p className={label}>{a.phone}</p>
          <p className="flex min-h-11 items-center rounded-xl bg-paper px-3.5 text-base text-ink">
            <bdi dir="ltr">{me.customer.phone ?? "—"}</bdi>
          </p>
          <p className="mt-1 text-xs text-ink-soft">{a.phoneNote}</p>
        </div>
        <div>
          <label htmlFor="profile-email" className={label}>
            {a.email}
            <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
          </label>
          <input
            id="profile-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            maxLength={255}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "profile-email-error" : undefined}
            className={`${input} text-start rtl:text-end`}
          />
          {emailError && (
            <p id="profile-email-error" className="mt-1 text-xs font-medium text-danger">
              {emailError}
            </p>
          )}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
          />
          {a.marketing}
        </label>

        <div aria-live="polite" className="empty:hidden">
          {message && (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${message.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
            >
              {message.text}
            </p>
          )}
        </div>

        <button type="submit" disabled={busy || !dirty} className={`${btnPrimary} w-full sm:w-auto`}>
          {busy ? a.saving : a.saveProfile}
        </button>
      </form>

      <div className={`${card} space-y-3 self-start p-5 sm:p-6`}>
        <button type="button" onClick={api.signOut} className={`${btnSecondary} w-full`}>
          {a.signOut}
        </button>
        {confirmAll ? (
          <div className="rounded-xl bg-danger-soft p-3">
            <p className="text-sm text-danger">{a.signOutEverywhereHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={leaving}
                onClick={() => void signOutEverywhere()}
                className={btnDanger}
              >
                {a.signOutEverywhere}
              </button>
              <button type="button" onClick={() => setConfirmAll(false)} className={btnGhost}>
                {a.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setConfirmAll(true)} className={`${btnGhostDanger} w-full`}>
              {a.signOutEverywhere}
            </button>
            <p className="text-xs text-ink-soft">{a.signOutEverywhereHint}</p>
          </>
        )}
      </div>
    </div>
  );
}
