"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ApiError,
  QUOTE_LIMITS,
  apiFieldProblems,
  shopperMe,
  shopperQuoteRequest,
  type Cart,
  type ShopperQuoteCreated,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { backdrop, btnPrimary, btnSecondary, focusRing, iconBtn, input, label as labelClass, modalLayer, sheet } from "@/components/ui";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { pickText } from "@/lib/i18n";
import { variantLabel } from "@/lib/product";
import { saveQuoteToken } from "@/lib/quoteTokens";
import { useShopperApi } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { QUOTE_TEXT } from "./quoteText";

/**
 * «اطلب عرض سعر» (frontend-handoff 219): a shopper who buys in quantity asks
 * the store for its price. The link opens a sheet with a quantity per item,
 * the shopper's name and phone, an optional email and company, and a message.
 * Sending answers with a private token that opens the quote later; the browser
 * keeps it (lib/quoteTokens), and the sheet then says «وصلنا طلبك، هنرد عليك
 * بعرض سعر» with the way to the quote's page.
 *
 * No price is shown or worked out here: the store answers with its own.
 */

/** One thing the shopper can ask a price for: a variant, and how many the form starts with. */
export interface QuoteItem {
  variantId: string;
  /** The product's name. */
  name: string;
  /** What tells this variant from its siblings ("أسود / L"); "" for a product's only variant. */
  detail: string;
  quantity: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A typed quantity as a whole number: 0 for an empty field, NaN for anything that is not one. */
function toQuantity(raw: string): number {
  const text = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
  if (text === "") return 0;
  return /^\d{1,7}$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * The product page's entry: every variant of the product with a quantity, the
 * chosen one starting at the quantity picked on the page. Only for a physical
 * product — an accepted quote becomes a cash-on-delivery order.
 */
export function ProductQuoteRequest({
  product,
  variantId,
  quantity,
}: {
  product: StorefrontProduct;
  /** The variant chosen on the page, when one is. */
  variantId?: string;
  quantity: number;
}) {
  const several = product.variants.length > 1;
  const items = useMemo<QuoteItem[]>(() => {
    const chosen = product.variants.some((v) => v.id === variantId) ? variantId : product.variants[0]?.id;
    return product.variants.map((v) => ({
      variantId: v.id,
      // With several variants the product is named once above the list, and each row by its options.
      name: several ? variantLabel(v) || v.sku || product.name : product.name,
      detail: "",
      quantity: v.id === chosen ? Math.max(1, quantity) : 0,
    }));
  }, [product, several, variantId, quantity]);

  if (product.productType !== "physical" || items.length === 0) return null;
  return <QuoteRequestEntry items={items} heading={several ? product.name : undefined} className="-my-2" />;
}

/**
 * The cart's entry: what is in the cart, with its quantities. Two lines of the
 * same variant are asked for as one (the API takes a variant once); a line
 * bought through an offer counts the pieces that offer holds.
 */
export function CartQuoteRequest({
  cart,
  products,
  className,
}: {
  cart: Cart | null | undefined;
  /** The catalogue by variant id, as the cart page already has it (lib/useCatalog). */
  products: ReadonlyMap<string, StorefrontProduct>;
  className?: string;
}) {
  const items = useMemo<QuoteItem[]>(() => {
    const byVariant = new Map<string, QuoteItem>();
    for (const line of cart?.items ?? []) {
      const product = products.get(line.variantId);
      if (product && product.productType !== "physical") continue;
      const offer = line.offerId ? product?.offers.find((o) => o.id === line.offerId) : undefined;
      const perOffer = offer?.lines.filter((l) => l.variantId === line.variantId).reduce((sum, l) => sum + l.quantity, 0) || 1;
      const known = byVariant.get(line.variantId);
      if (known) {
        known.quantity += line.quantity * perOffer;
        continue;
      }
      const detail = variantLabel(line.variant);
      byVariant.set(line.variantId, {
        variantId: line.variantId,
        name: product?.name ?? detail,
        detail: product ? detail : "",
        quantity: line.quantity * perOffer,
      });
    }
    return [...byVariant.values()].filter((item) => item.name);
  }, [cart, products]);

  if (items.length === 0) return null;
  return <QuoteRequestEntry items={items} className={className} />;
}

/** The line that opens the form, and the form's sheet. */
function QuoteRequestEntry({ items, heading, className }: { items: QuoteItem[]; /** The one product every item is a variant of. */ heading?: string; className?: string }) {
  const { locale } = useStore();
  const text = pickText(QUOTE_TEXT, locale);
  const [open, setOpen] = useState(false);
  const { present, shown } = useSheetPresence(open);

  return (
    <div className={`text-sm text-ink-soft ${className ?? ""}`}>
      {text.lead}{" "}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}
      >
        {text.link}
      </button>
      {/* Mounted with the sheet, so every opening starts from the quantities on the page. */}
      {present && <QuoteRequestSheet items={items} heading={heading} open={open} shown={shown} onClose={() => setOpen(false)} />}
    </div>
  );
}

type Problem = { field: "lines" | "name" | "phone" | "email" | null; message: string };

function QuoteRequestSheet({
  items,
  heading,
  open,
  shown,
  onClose,
}: {
  items: QuoteItem[];
  heading?: string;
  open: boolean;
  shown: boolean;
  onClose: () => void;
}) {
  const { locale, t, store } = useStore();
  const text = pickText(QUOTE_TEXT, locale);
  const ids = useId();
  const shopper = useShopperApi();
  const egypt = useStoreCountry() === "EG";
  const scroller = useRef<HTMLDivElement>(null);
  const sentBox = useRef<HTMLDivElement>(null);

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.variantId, item.quantity > 0 ? String(item.quantity) : ""]))
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<{ quote: ShopperQuoteCreated; emailed: boolean } | null>(null);
  // Escape and the backdrop wait while the request is on its way.
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose: busy ? () => {} : onClose });

  // The form is gone once sent: focus moves to what took its place.
  useEffect(() => {
    if (sent) sentBox.current?.focus();
  }, [sent]);

  // A signed-in shopper is not asked for what their account already holds.
  const { token, call } = shopper;
  useEffect(() => {
    if (!token) return;
    let alive = true;
    call((client, storeId, current) => shopperMe(client, storeId, current))
      .then(({ customer }) => {
        if (!alive) return;
        setFullName((v) => v || customer.fullName || "");
        setPhone((v) => v || customer.phone || "");
        setEmail((v) => v || customer.email || "");
      })
      .catch(() => {
        /* the form is simply left empty */
      });
    return () => {
      alive = false;
    };
  }, [token, call]);

  function fail(next: Problem) {
    setProblem(next);
    const target = next.field ? document.getElementById(`${ids}-${next.field}`) : null;
    if (target) target.focus();
    else scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const asked = items.map((item) => ({ variantId: item.variantId, quantity: toQuantity(quantities[item.variantId] ?? "") }));
    if (asked.some((l) => Number.isNaN(l.quantity) || l.quantity > QUOTE_LIMITS.quantity)) return fail({ field: "lines", message: text.quantityMax });
    const lines = asked.filter((l) => l.quantity > 0);
    if (lines.length === 0) return fail({ field: "lines", message: text.noQuantity });
    if (lines.length > QUOTE_LIMITS.lines) return fail({ field: "lines", message: text.tooManyLines });
    const name = fullName.trim();
    if ([...name].length < QUOTE_LIMITS.fullNameMin) return fail({ field: "name", message: text.nameError });
    const number = normalizePhone(phone);
    const phoneOk = egypt ? isEgyptianMobile(phone) : /^\+?\d{8,15}$/.test(number);
    if (!phoneOk) return fail({ field: "phone", message: egypt ? t.form.errors.phone : t.form.errors.phoneIntl });
    const mail = email.trim();
    if (mail && !EMAIL.test(mail)) return fail({ field: "email", message: text.emailError });

    setBusy(true);
    setProblem(null);
    try {
      const quote = await shopperQuoteRequest(
        shopper.client,
        store?.workspaceId ?? shopper.storeId,
        {
          contact: { fullName: name, phone: number, ...(mail ? { email: mail } : {}), ...(company.trim() ? { company: company.trim() } : {}) },
          lines,
          ...(message.trim() ? { message: message.trim() } : {}),
        },
        shopper.token
      );
      saveQuoteToken(shopper.storeId, quote.quoteId, quote.token, quote.number);
      setSent({ quote, emailed: Boolean(mail) });
    } catch (err) {
      const fields = apiFieldProblems(err).map((p) => p.field);
      if (err instanceof ApiError && err.status === 429) fail({ field: null, message: text.tooMany });
      else if (fields.some((f) => f.startsWith("lines"))) fail({ field: "lines", message: text.unavailable });
      else if (fields.some((f) => f.endsWith("phone"))) fail({ field: "phone", message: egypt ? t.form.errors.phone : t.form.errors.phoneIntl });
      else if (fields.some((f) => f.endsWith("email"))) fail({ field: "email", message: text.emailError });
      else if (fields.some((f) => f.endsWith("fullName"))) fail({ field: "name", message: text.nameError });
      else fail({ field: null, message: text.failed });
    } finally {
      setBusy(false);
    }
  }

  const optional = <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>;
  const required = (
    <span className="text-danger" aria-hidden>
      {" "}*
    </span>
  );
  const errorOf = (field: Problem["field"]) =>
    problem?.field === field ? (
      <p id={`${ids}-${field}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">
        {problem.message}
      </p>
    ) : null;
  const invalid = (field: Problem["field"]) =>
    problem?.field === field ? { "aria-invalid": true as const, "aria-describedby": `${ids}-${field}-error` } : {};
  const firstLine = items[0]?.variantId;

  return createPortal(
    <div className={modalLayer}>
      <div className={backdrop(shown)} aria-hidden onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} aria-hidden={!open} inert={!open} className={sheet(shown)}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <h2 id={`${ids}-title`} className="font-display text-lg font-bold text-ink">
            {text.title}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t.common.close} className={iconBtn}>
            <CrossIcon />
          </button>
        </div>

        {sent ? (
          <div ref={sentBox} tabIndex={-1} role="status" className="flex-1 overflow-y-auto overscroll-contain px-4 py-8 text-center outline-none sm:px-5">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
              <CheckIcon size={28} />
            </span>
            <p className="mt-4 text-lg font-semibold text-ink">{text.sentTitle}</p>
            <p className="mt-1 text-sm font-medium text-ink">
              <bdi>{text.sentNumber(sent.quote.number)}</bdi>
            </p>
            <p className="mt-1 text-sm text-ink-soft">{sent.emailed ? text.sentEmail : text.sentNoEmail}</p>
            <div className="mt-6 grid gap-2">
              <StoreLink href={`/quotes/${sent.quote.quoteId}`} className={btnPrimary}>
                {text.follow}
              </StoreLink>
              <button type="button" onClick={onClose} className={btnSecondary}>
                {text.done}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div ref={scroller} className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <p className="text-sm text-ink-soft">{text.intro}</p>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">{text.quantities}</legend>
                {heading && (
                  <p className="mb-2 text-sm text-ink-soft">
                    <bdi>{heading}</bdi>
                  </p>
                )}
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {items.map((item) => {
                    const fieldId = item.variantId === firstLine ? `${ids}-lines` : `${ids}-q-${item.variantId}`;
                    const named = [heading, item.name, item.detail].filter(Boolean).join(" — ");
                    return (
                      <li key={item.variantId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <label htmlFor={fieldId} className="min-w-0 flex-1 text-sm text-ink">
                          <span className="sr-only">{text.quantityOf(named)}</span>
                          <span aria-hidden className="block">
                            <bdi className="block font-medium">{item.name}</bdi>
                            {item.detail && <bdi className="block text-xs text-ink-soft">{item.detail}</bdi>}
                          </span>
                        </label>
                        {/* The width sits on a wrapper: the input recipe is full-width by itself. */}
                        <div className="w-24 shrink-0">
                          <input
                            id={fieldId}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            dir="ltr"
                            maxLength={6}
                            placeholder="0"
                            value={quantities[item.variantId] ?? ""}
                            disabled={busy}
                            {...(item.variantId === firstLine ? invalid("lines") : {})}
                            onChange={(e) => {
                              setQuantities((prev) => ({ ...prev, [item.variantId]: e.target.value }));
                              if (problem?.field === "lines") setProblem(null);
                            }}
                            className={`${input} text-center tabular-nums`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {errorOf("lines")}
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-2 text-sm font-semibold text-ink">{text.yourDetails}</legend>
                <div>
                  <label htmlFor={`${ids}-name`} className={labelClass}>
                    {text.name}
                    {required}
                  </label>
                  <input
                    id={`${ids}-name`}
                    type="text"
                    autoComplete="name"
                    maxLength={QUOTE_LIMITS.fullName}
                    value={fullName}
                    disabled={busy}
                    {...invalid("name")}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (problem?.field === "name") setProblem(null);
                    }}
                    className={input}
                  />
                  {errorOf("name")}
                </div>
                <div>
                  <label htmlFor={`${ids}-phone`} className={labelClass}>
                    {text.phone}
                    {required}
                  </label>
                  <input
                    id={`${ids}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete={egypt ? "tel-national" : "tel"}
                    dir="ltr"
                    placeholder={egypt ? t.form.phonePlaceholder : undefined}
                    maxLength={QUOTE_LIMITS.phone}
                    value={phone}
                    disabled={busy}
                    {...invalid("phone")}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (problem?.field === "phone") setProblem(null);
                    }}
                    className={`${input} text-start rtl:text-end`}
                  />
                  {errorOf("phone")}
                </div>
                <div>
                  <label htmlFor={`${ids}-email`} className={labelClass}>
                    {text.email}
                    {optional}
                  </label>
                  <input
                    id={`${ids}-email`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    maxLength={QUOTE_LIMITS.email}
                    value={email}
                    disabled={busy}
                    {...(problem?.field === "email" ? invalid("email") : { "aria-describedby": `${ids}-email-hint` })}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (problem?.field === "email") setProblem(null);
                    }}
                    className={`${input} text-start rtl:text-end`}
                  />
                  {errorOf("email") ?? (
                    <p id={`${ids}-email-hint`} className="mt-1.5 text-xs text-ink-soft">
                      {text.emailHint}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${ids}-company`} className={labelClass}>
                    {text.company}
                    {optional}
                  </label>
                  <input
                    id={`${ids}-company`}
                    type="text"
                    autoComplete="organization"
                    maxLength={QUOTE_LIMITS.company}
                    value={company}
                    disabled={busy}
                    onChange={(e) => setCompany(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label htmlFor={`${ids}-message`} className={labelClass}>
                    {text.message}
                    {optional}
                  </label>
                  <textarea
                    id={`${ids}-message`}
                    rows={3}
                    dir="auto"
                    maxLength={QUOTE_LIMITS.message}
                    placeholder={text.messagePlaceholder}
                    value={message}
                    disabled={busy}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${input} min-h-24 resize-y`}
                  />
                </div>
              </fieldset>

              <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger empty:hidden">
                {problem && problem.field === null ? problem.message : null}
              </p>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5">
              <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
                {text.cancel}
              </button>
              <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimary}>
                {busy ? text.sending : text.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.querySelector<HTMLElement>(".brand-theme") ?? document.body
  );
}
