"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ON_ACCOUNT_METHOD,
  onAccountRefusalOf,
  shopperBusiness,
  shopperMe,
  shopperOnAccount,
  shopperOnAccountStatement,
  type CheckoutPayload,
  type OnAccountStatement,
  type StorefrontPaymentMethod,
} from "@store-builder/api-client";
import { ReceiptIcon } from "@/components/account/accountIcons";
import { useShopperApi, useShopperConfig } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useBusinessCopy } from "./businessCopy";

/**
 * The checkout's part of buying as a company (handoff 228, 229), for a
 * signed-in shopper:
 *
 *   useBusinessCheckout()   reads what the store set for the account and returns the page's
 *                           payment methods with «ادفع آجل» added for an approved shopper, the
 *                           order's `paymentMethod`, the three refusals in the shopper's words,
 *                           and whether the order goes without added tax;
 *   <OnAccountMethodRow>    that method's row in the payment list: «ادفع آجل (خلال 30 يوم)»,
 *                           «المتاح: …» and why the last order was refused;
 *   <OnAccountWholeOrderNote>  in place of the gift card, points and store credit while it is chosen;
 *   <TaxExemptRow>          the summary's «الضريبة — معفى» line.
 *
 * An on-account order is placed like cash on delivery — one request, no
 * gateway and no payment page — with `paymentMethod: "on_account"` and the
 * shopper's token (X-Shopper-Token), under the account's own phone. Both the
 * method and the exemption belong to that phone: with another number in the
 * form the row says so, and the tax line steps aside.
 */

/** The method's id in the page's list (and its radio's value). */
export const ON_ACCOUNT_METHOD_ID = "on_account";

/** What the row says, carried on the method itself so the payment list needs nothing else. */
export interface OnAccountMethodInfo {
  /** The store's terms for this account, in days. */
  termsDays: number;
  /** What is left of the limit, as text: «٣٥٠ ج.م», or «من غير حد». */
  availableText: string;
  /** The form's number is not the account's: said before the server refuses it. */
  note: string | null;
  /** Why the last order was refused, while the form is as it was. */
  refusal: string | null;
}

export type OnAccountMethod = StorefrontPaymentMethod & { onAccount: OnAccountMethodInfo };

export function isOnAccountMethod(method: StorefrontPaymentMethod | null | undefined): method is OnAccountMethod {
  return Boolean(method) && (method as { method?: string }).method === ON_ACCOUNT_METHOD && "onAccount" in (method as object);
}

/** The last nine digits of a number however it was typed (٠١٠…, +20 10…, 010…): enough to tell two numbers apart. */
function phoneTail(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "")
    .slice(-9);
}

interface Loaded {
  token: string;
  /** The statement of a shopper the store approved; null for everyone else. */
  statement: OnAccountStatement | null;
  taxExempt: boolean;
  /** The account's own phone, read only when one of the two applies. */
  phone: string | null;
}

export function useBusinessCheckout({
  methods,
  phone,
  blocked = false,
}: {
  /** The methods the store offers at this checkout (after the plan filter). */
  methods: StorefrontPaymentMethod[];
  /** The order form's mobile number, as typed. */
  phone: string;
  /** A product on a plan is in the cart: it is paid by a card that can be saved, never on account. */
  blocked?: boolean;
}) {
  const { money } = useStore();
  const copy = useBusinessCopy();
  const config = useShopperConfig();
  const api = useShopperApi();
  const accounts = config.status === "ready" && config.config.enabled;
  const token = accounts ? api.token : null;

  // What the store set for the signed-in shopper, once per token (and again after a refused order).
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // Either may fail on its own: the checkout goes on without it.
    void Promise.all([
      api.call((client, storeId, tk) => shopperOnAccount(client, storeId, tk)).catch(() => null),
      api.call((client, storeId, tk) => shopperBusiness(client, storeId, tk)).catch(() => null),
    ]).then(async ([answer, business]) => {
      const statement = shopperOnAccountStatement(answer);
      const approved = statement?.enabled ? statement : null;
      const taxExempt = Boolean(business?.taxExempt);
      const me = approved || taxExempt ? await api.call((client, storeId, tk) => shopperMe(client, storeId, tk)).catch(() => null) : null;
      if (!cancelled) setLoaded({ token, statement: approved, taxExempt, phone: me?.customer.phone ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [token, api, nonce]);
  const current = loaded && token && loaded.token === token ? loaded : null;
  const statement = current?.statement ?? null;

  const typed = phoneTail(phone);
  const own = phoneTail(current?.phone);
  const otherPhone = typed.length === 9 && own.length === 9 && typed !== own;

  // The refusal stays beside the method until the number changes or the order is sent again.
  const [refused, setRefused] = useState<{ text: string; phone: string } | null>(null);
  const refusal = refused && refused.phone === phone ? refused.text : null;

  const termsDays = statement?.paymentTermsDays ?? 0;
  const availableText = statement ? (statement.available === null ? copy.noLimit : money(statement.available)) : "";
  const note = otherPhone && current?.phone ? copy.otherPhone(current.phone) : null;
  const offered = statement !== null && !blocked;

  const method = useMemo<OnAccountMethod | null>(
    () =>
      offered
        ? {
            id: ON_ACCOUNT_METHOD_ID,
            provider: null,
            // `StorefrontPaymentMethod.method` predates on_account.
            method: ON_ACCOUNT_METHOD as StorefrontPaymentMethod["method"],
            mode: "live",
            onAccount: { termsDays, availableText, note, refusal },
          }
        : null,
    [offered, termsDays, availableText, note, refusal]
  );
  const all = useMemo(() => (method ? [...methods, method] : methods), [methods, method]);

  /** The order's payment method when «ادفع آجل» is the chosen one; nothing otherwise. */
  function payload(chosen: StorefrontPaymentMethod | undefined): Partial<Pick<CheckoutPayload, "paymentMethod">> {
    return isOnAccountMethod(chosen) ? { paymentMethod: ON_ACCOUNT_METHOD as CheckoutPayload["paymentMethod"] } : {};
  }

  /**
   * A refused order (call it with every failed order, and the method it was
   * sent with): when it went on account and paying later was the reason, the
   * words for the form's error line (they also show beside the method), and
   * the account is read again — the limit moved, or the store closed it. Null
   * when the refusal was about something else; an earlier refusal then leaves
   * the row.
   */
  function onError(err: unknown, sent: StorefrontPaymentMethod | undefined): string | null {
    const why = isOnAccountMethod(sent) ? onAccountRefusalOf(err) : null;
    if (!why) {
      setRefused(null);
      return null;
    }
    let text: string;
    if (why.kind === "signed_out") {
      // The token stopped working: forget it. The method leaves the list with it; signing in again brings it back.
      api.signOut();
      text = copy.refusedSignedOut;
    } else if (why.kind === "limit") {
      text = why.available !== null ? copy.refusedLimit(money(why.available)) : copy.refusedLimitPlain;
    } else {
      text = copy.refusedNotOpen;
    }
    setRefused({ text, phone });
    setNonce((n) => n + 1);
    return text;
  }

  return {
    /** The page's methods, with «ادفع آجل» last for a shopper the store approved. */
    methods: all,
    /** Whether a method is «ادفع آجل»: such an order is placed like cash on delivery, never through a gateway. */
    chosen: (candidate: StorefrontPaymentMethod | undefined) => isOnAccountMethod(candidate),
    payload,
    onError,
    /**
     * The method the gift card, points and store credit are worked out for: none while «ادفع آجل» is
     * chosen, so they stand down — the whole order goes on the account (<OnAccountWholeOrderNote> says so).
     */
    tenderMethod: (candidate: StorefrontPaymentMethod | undefined) => (isOnAccountMethod(candidate) ? undefined : candidate),
    /** The signed-in shopper is tax exempt and orders under their own number: no tax is added. */
    taxExempt: Boolean(current?.taxExempt) && !otherPhone,
  };
}

export type BusinessCheckoutState = ReturnType<typeof useBusinessCheckout>;

/**
 * «ادفع آجل (خلال 30 يوم)» in the checkout's payment list: the same row as
 * the other methods (PaymentMethodPicker), with «المتاح: …», the note about
 * the account's number and, after a refused order, why.
 */
export function OnAccountMethodRow({
  method,
  checked,
  onChange,
  idPrefix,
}: {
  method: OnAccountMethod;
  checked: boolean;
  onChange: (id: string) => void;
  idPrefix: string;
}) {
  const copy = useBusinessCopy();
  const info = method.onAccount;
  const id = `${idPrefix}-pay-${method.id}`;
  return (
    <label
      htmlFor={id}
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        checked ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary/50"
      }`}
    >
      <input
        id={id}
        type="radio"
        name={`${idPrefix}-payment`}
        value={method.id}
        checked={checked}
        onChange={() => onChange(method.id)}
        className="size-4 shrink-0 accent-primary"
      />
      <ReceiptIcon className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{copy.method(info.termsDays)}</span>
        <span className="block text-xs text-ink-soft">{copy.methodHint}</span>
        <span className="mt-0.5 block text-xs font-semibold text-ink">{copy.availableLine(info.availableText)}</span>
        {info.note && <span className="mt-1 block text-xs font-medium text-accent-dark">{info.note}</span>}
        <span aria-live="polite" className="block empty:hidden">
          {info.refusal && <span className="mt-1 block text-xs font-medium text-danger">{info.refusal}</span>}
        </span>
      </span>
    </label>
  );
}

/**
 * Where the gift card, points and store credit stand in the summary, while
 * «ادفع آجل» is the chosen method: the whole order goes on the account, and
 * another way to pay brings them back.
 */
export function OnAccountWholeOrderNote({ method }: { method: StorefrontPaymentMethod | undefined }) {
  const copy = useBusinessCopy();
  if (!isOnAccountMethod(method)) return null;
  return <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-xs font-medium text-ink">{copy.wholeOrder}</p>;
}

/** The order summary's tax line for a signed-in exempt shopper: «الضريبة — معفى». Nothing for anyone else. */
export function TaxExemptRow({ state }: { state: Pick<BusinessCheckoutState, "taxExempt"> }) {
  const copy = useBusinessCopy();
  if (!state.taxExempt) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{copy.tax}</dt>
      <dd className="font-medium text-success">{copy.exempt}</dd>
    </div>
  );
}
