"use client";

import { useState, type KeyboardEvent } from "react";
import {
  ApiError,
  giftCardCheck,
  giftCardRefusalOf,
  normalizeGiftCardCode,
  parseMoney,
  prettyGiftCardCode,
  type ApiClient,
  type GiftCardBalance,
  type GiftCardCheckoutFields,
  type GiftCardRefusal,
  type Order,
  type StorefrontPaymentMethod,
} from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, input } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import type { Dictionary } from "@/lib/i18n";
import { rememberGiftCardOrder } from "./giftCardOrders";

type Copy = Dictionary["giftCards"];

/** The shopper's words for a refused card. */
export function giftCardRefusalText(refusal: GiftCardRefusal | null, copy: Copy, currency?: string): string {
  switch (refusal) {
    case "not_found":
      return copy.notFound;
    case "expired":
      return copy.expired;
    case "empty":
      return copy.empty;
    case "disabled":
      return copy.disabled;
    case "currency":
      return copy.currency(currency ?? "");
    case "cod_only":
      return copy.codOnly;
    default:
      return copy.failed;
  }
}

/** A balance check's failure in the shopper's words (unknown code, 429, anything else). */
export function giftCardCheckError(err: unknown, copy: Copy): string {
  if (err instanceof ApiError && err.status === 429) return copy.tooMany;
  return giftCardRefusalText(giftCardRefusalOf(err) ?? (err instanceof ApiError && err.status === 404 ? "not_found" : null), copy);
}

/** Why a card that was found cannot pay this order, or null when it can. */
function unusable(card: GiftCardBalance, currency: string, copy: Copy): string | null {
  if (card.state === "expired") return copy.expired;
  if (card.state === "empty") return copy.empty;
  if (card.state === "disabled") return copy.disabled;
  if (card.currency.toUpperCase() !== currency.toUpperCase()) return copy.currency(card.currency);
  return null;
}

/**
 * Cash on delivery or an online payment (handoff 201): every way to pay takes
 * a gift card but a manual bank transfer.
 */
function takesGiftCard(method: StorefrontPaymentMethod | undefined): boolean {
  return Boolean(method) && method?.provider !== "manual";
}

/**
 * The checkout's gift card (handoff 189): the code the shopper applied, what
 * it takes off this order's estimated total, and the `giftCardCode` the order
 * carries — with cash on delivery or an online payment (handoff 201), never a
 * bank transfer. The card is checked when applied (POST /gift-cards/check);
 * the order checks it again and takes at most what is due. With an online
 * payment its part is held and the gateway charges the rest.
 */
export function useGiftCard({
  client,
  workspaceId,
  method,
  total,
  currency,
}: {
  client: ApiClient;
  workspaceId: string;
  method: StorefrontPaymentMethod | undefined;
  total: number;
  currency: string;
}) {
  const { t, money } = useStore();
  const copy = t.giftCards;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [card, setCard] = useState<(GiftCardBalance & { code: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const usable = takesGiftCard(method);
  // What the card takes off: its balance, at most the order's estimated total.
  const off = card && usable ? Math.max(0, Math.min(parseMoney(card.balanceAmount), total)) : 0;
  const payload: GiftCardCheckoutFields = card && usable ? { giftCardCode: card.code } : {};

  async function apply() {
    if (checking) return;
    const code = normalizeGiftCardCode(draft);
    if (!code) {
      setError(copy.codeRequired);
      return;
    }
    // A code is 16 characters; anything shorter is not one (and spends no balance check).
    if (code.length !== 16) {
      setError(copy.notFound);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const found = await giftCardCheck(client, workspaceId, code);
      const problem = unusable(found, currency, copy);
      if (problem) setError(problem);
      else setCard({ ...found, code });
    } catch (err) {
      setError(giftCardCheckError(err, copy));
    } finally {
      setChecking(false);
    }
  }

  function remove() {
    setCard(null);
    setError(null);
  }

  /** After a placed COD order: what the card paid, for the thank-you page. */
  function remember(order: Order) {
    if (!card || !usable) return;
    rememberGiftCardOrder(workspaceId, {
      orderId: order.id,
      last4: card.last4,
      amount: parseMoney(order.amountPaid),
      total: parseMoney(order.totalAmount),
      currency: order.currency,
    });
  }

  /**
   * A refused order: when the card was the reason (spent or switched off since
   * it was applied), it comes off with the reason beside it, and the same
   * words are returned for the form's own error line. Null otherwise.
   */
  function onError(err: unknown): string | null {
    const refusal = giftCardRefusalOf(err);
    if (!refusal || !card) return null;
    const text = `${giftCardRefusalText(refusal, copy, card.currency)} ${copy.removedAtCheckout}`;
    setCard(null);
    setOpen(true);
    setDraft(prettyGiftCardCode(card.code));
    setError(text);
    return text;
  }

  // The phone bar (CheckoutStickyBar) says what the courier collects once a card pays part.
  const stickyBar = off > 0 ? { totalLabel: copy.payOnDelivery, total: money(Math.max(0, total - off), currency) } : {};

  return {
    open,
    setOpen,
    draft,
    setDraft: (value: string) => {
      setDraft(value);
      if (error) setError(null);
    },
    card,
    error,
    checking,
    usable,
    off,
    total,
    currency,
    apply,
    remove,
    payload,
    remember,
    onError,
    stickyBar,
  };
}

export type GiftCardState = ReturnType<typeof useGiftCard>;

/**
 * Under the checkout's totals: «معاك كارت هدية؟» opens the code field;
 * applied, it shows «كارت هدية ••••X9UK: −250» and «تدفع عند الاستلام: …».
 * Another way to pay keeps the card but says it goes with cash on delivery.
 */
export function GiftCardField({
  state,
  remainder = true,
}: {
  state: GiftCardState;
  /** False when what is left to pay is said below it, with points and store credit (tenders/CheckoutTenders). */
  remainder?: boolean;
}) {
  const { t, money } = useStore();
  const copy = t.giftCards;
  const inputId = "checkout-gift-card";
  const errorId = `${inputId}-error`;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter applies the card instead of placing the order.
    if (e.key === "Enter") {
      e.preventDefault();
      void state.apply();
    }
  }

  if (!state.open && !state.card) {
    return (
      <div className="mt-4 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => state.setOpen(true)}
          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary hover:underline"
        >
          {copy.have}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      {state.card ? (
        <>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-success-soft px-3 py-1">
            <p className="min-w-0 text-sm font-medium text-success" aria-live="polite">
              {state.usable ? copy.applied(state.card.last4, money(state.off, state.currency)) : `${copy.title} ••••${state.card.last4}`}
            </p>
            <button
              type="button"
              onClick={state.remove}
              className="min-h-11 shrink-0 cursor-pointer px-2 text-xs font-medium text-ink-soft hover:text-danger"
            >
              {copy.remove}
            </button>
          </div>
          {state.usable ? (
            <dl className="space-y-1 text-sm">
              {remainder && (
              <div className="flex justify-between gap-3 font-bold text-ink">
                <dt>{copy.payOnDelivery}</dt>
                <dd>{money(Math.max(0, state.total - state.off), state.currency)}</dd>
              </div>
              )}
              <div className="flex justify-between gap-3 text-xs text-ink-soft">
                <dt className="sr-only">{copy.balance}</dt>
                <dd>{copy.balanceAfter(money(Math.max(0, parseMoney(state.card.balanceAmount) - state.off), state.currency))}</dd>
              </div>
            </dl>
          ) : (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent-dark">{copy.codRequired}</p>
          )}
        </>
      ) : (
        <GiftCardCodeInput
          id={inputId}
          errorId={errorId}
          label={copy.code}
          value={state.draft}
          onChange={state.setDraft}
          onKeyDown={onKeyDown}
          error={state.error}
          busy={state.checking}
          onApply={() => void state.apply()}
          applyLabel={state.checking ? copy.checking : copy.apply}
        />
      )}
      {!state.card && !state.usable && <p className="text-xs text-ink-soft">{copy.codOnly}</p>}
      <StoreLink href="/gift-card" className="inline-flex min-h-11 items-center text-xs font-medium text-ink-soft hover:text-primary">
        {copy.checkBalance}
      </StoreLink>
    </div>
  );
}

/** The code field with its Apply button, shared by the checkout and the balance page. */
export function GiftCardCodeInput({
  id,
  errorId,
  label,
  value,
  onChange,
  onKeyDown,
  error,
  busy,
  onApply,
  applyLabel,
  submit,
}: {
  id: string;
  errorId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  error: string | null;
  busy: boolean;
  onApply?: () => void;
  applyLabel: string;
  /** True inside its own <form>: the button submits it. */
  submit?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {/* A full code is 19 characters: on a phone the button goes under the field (and its error) so none of it is cut off. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 sm:flex-1">
          <input
            id={id}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            maxLength={40}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            onKeyDown={onKeyDown}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${input} min-w-0 font-mono uppercase tracking-wider`}
          />
          {error && (
            <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        <button type={submit ? "submit" : "button"} onClick={submit ? undefined : onApply} disabled={busy} className={`${btnSecondary} sm:shrink-0`}>
          {applyLabel}
        </button>
      </div>
    </div>
  );
}

