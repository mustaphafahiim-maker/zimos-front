"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  subscribeStockAlert,
  type StockAlertChannel,
  type StockAlertRequest,
  type StorefrontVariant,
} from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { btnPrimary, card, input, label, pill } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import type { Dictionary } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
// «نبّهني على المتصفح»: the same sign-up by browser push, when the store can push (handoff 392).
import { BackInStockPush, BackInStockPushDone, pushSignedUp } from "./BackInStockPush";

/** A bell, drawn like components/Icons.tsx (24px grid, 1.8 stroke). */
function BellIcon({ size = 20, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Variants signed up for on this page: the confirmation stays when the shopper switches sizes and back. */
const signedUp = new Map<string, { channel: StockAlertChannel; to: string }>();
/** Variants the API said are back (409 IN_STOCK) while the shopper was signing up. */
const cameBack = new Set<string>();

/**
 * «بلغني لما يرجع» (frontend-handoff 194). Wraps the product page's cart
 * buttons: while the chosen variant is sold out — no overselling and no
 * pre-order — they give way to the sign-up: the button, then the shopper's
 * mobile number (or email), then «هنبلغك مرة واحدة لما يرجع». Anything
 * else shows the buttons as they are.
 */
export function BackInStock({
  product,
  variant,
  children,
}: {
  product: { id: string; preorder?: unknown };
  variant: StorefrontVariant | undefined;
  children: ReactNode;
}) {
  if (variant && !variant.inStock && !product.preorder) return <SignUp key={variant.id} variantId={variant.id} />;
  // Back while the shopper was signing up, and the refreshed page has it in stock: say so above the buttons.
  return (
    <>
      {variant && cameBack.has(variant.id) && <BackNow />}
      {children}
    </>
  );
}

function BackNow() {
  const { t } = useStore();
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
      <CheckIcon size={18} className="mt-0.5 shrink-0" />
      {t.backInStock.inStockNow}
    </p>
  );
}

function SignUp({ variantId }: { variantId: string }) {
  const { t, locale, store } = useStore();
  const b = t.backInStock;
  const a = t.account;
  const egypt = useStoreCountry() === "EG";
  const router = useRouter();
  const ids = useId();
  // In the page's language, so the API words its refusals for this shopper.
  const [client] = useState(() => createStorefrontApiClient({ locale }));
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<StockAlertChannel>("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => signedUp.get(variantId) ?? null);
  const [backNow, setBackNow] = useState(false);
  const [pushDone, setPushDone] = useState(() => pushSignedUp(variantId));
  const field = useRef<HTMLInputElement>(null);

  // The shopper asked for the form: straight to the field (and the phone's keyboard).
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open, channel]);

  function request(): StockAlertRequest | null {
    if (channel === "sms") {
      const ok = egypt ? isEgyptianMobile(phone) : /^\+?\d{8,15}$/.test(normalizePhone(phone));
      if (!ok) setError(a.errors.invalidPhone);
      return ok ? { variantId, phone: normalizePhone(phone).replace(/^\+/, ""), locale } : null;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) setError(a.errors.invalidEmail);
    return ok ? { variantId, email: email.trim(), locale } : null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !store) return;
    setError(null);
    const body = request();
    if (!body) {
      field.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const answer = await subscribeStockAlert(client, store.id, body);
      const entry = { channel: answer.channel, to: channel === "sms" ? normalizePhone(phone) : email.trim() };
      signedUp.set(variantId, entry);
      setDone(entry);
    } catch (err) {
      if (err instanceof ApiError && err.code === "IN_STOCK") {
        // It came back while the page was open: fresh stock, and the cart buttons return.
        cameBack.add(variantId);
        setBackNow(true);
        router.refresh();
      } else {
        setError(refusalOf(err, t, channel));
      }
    } finally {
      setBusy(false);
    }
  }

  // Until the refreshed page arrives (or when its data still says sold out).
  if (backNow) return <BackNow />;

  if (pushDone) return <BackInStockPushDone />;

  if (done) {
    return (
      <div role="status" className={`${card} flex items-start gap-3 p-4`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <CheckIcon size={20} />
        </span>
        <div className="min-w-0 py-0.5">
          <p className="text-sm font-semibold text-ink">{b.done}</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {b.doneTo} <bdi dir="ltr">{done.to}</bdi>
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} w-full`}>
        <BellIcon size={18} />
        {b.notifyMe}
      </button>
    );
  }

  const fieldId = `${ids}-${channel}`;
  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${ids}-title`} className={`${card} space-y-4 p-4 sm:p-5`}>
      <div>
        <h2 id={`${ids}-title`} className="flex items-center gap-2 text-base font-semibold text-ink">
          <BellIcon size={18} className="shrink-0 text-primary" />
          {b.notifyMe}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{b.intro}</p>
      </div>

      <div role="radiogroup" aria-labelledby={`${ids}-title`} className="grid grid-cols-2 gap-2">
        {(["sms", "email"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={channel === c}
            onClick={() => {
              setChannel(c);
              setError(null);
            }}
            className={pill(channel === c)}
          >
            {c === "sms" ? a.byPhone : a.byEmail}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={fieldId} className={label}>
          {channel === "sms" ? t.form.phone : a.email}
        </label>
        {channel === "sms" ? (
          <input
            id={fieldId}
            ref={field}
            type="tel"
            inputMode="tel"
            autoComplete={egypt ? "tel-national" : "tel"}
            dir="ltr"
            placeholder={egypt ? t.form.phonePlaceholder : undefined}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            className={`${input} text-start rtl:text-end`}
          />
        ) : (
          <input
            id={fieldId}
            ref={field}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            placeholder={a.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            className={`${input} text-start rtl:text-end`}
          />
        )}
      </div>

      <p id={`${ids}-error`} role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>

      <button type="submit" disabled={busy} aria-busy={busy || undefined} className={`${btnPrimary} w-full`}>
        {busy ? b.sending : b.submit}
      </button>

      {store && (
        <BackInStockPush
          workspaceId={store.id}
          variantId={variantId}
          onDone={() => setPushDone(true)}
          onInStock={() => {
            cameBack.add(variantId);
            setBackNow(true);
            router.refresh();
          }}
        />
      )}
    </form>
  );
}

/** A refusal of POST /stock-alerts in the shopper's words. */
function refusalOf(err: unknown, t: Dictionary, channel: StockAlertChannel): string {
  const e = t.account.errors;
  if (!(err instanceof ApiError)) return t.backInStock.failed;
  if (err.status === 429) return t.backInStock.tooMany;
  switch (err.code) {
    case "INVALID_PHONE":
      return e.invalidPhone;
    case "VALIDATION_ERROR":
      return channel === "email" ? e.invalidEmail : e.invalidPhone;
    case "NOT_FOUND":
      return t.wishlist.notForSale;
    default:
      return t.backInStock.failed;
  }
}
