"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ApiError,
  storeBoxGet,
  storefrontShippingQuoteFor,
  type StoreBoxBundle,
  type StoreBoxProduct,
} from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { getVisitorId } from "@/lib/visitorId";
import { StoreLink } from "@/components/StoreRoute";
import { BoxIcon, CheckIcon } from "../Icons";
import { btnPrimaryLg, btnSecondary, card, container, focusRing, pill, skeleton } from "../ui";

type Variant = StoreBoxProduct["variants"][number];

/** "Red / L", or "" for a product without options. */
function optionsText(variant: Variant): string {
  return Object.values(variant.optionValues ?? {}).filter(Boolean).join(" / ");
}

/**
 * The "Build your box" page of a mix-and-match bundle (handoff 215): the
 * products that can go in the box, slots to fill ("Pick 3") and one button
 * that adds the chosen pieces to the cart as ordinary lines. The cart and the
 * order price them together; the box's price shown here is the server's
 * quote for the pieces picked so far (POST /shipping-quote, bundle-priced),
 * so nothing on this page is computed in the browser.
 */
export function BoxBuilder({ bundleId }: { bundleId: string }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t, money, locale } = useStore();
  const copy = t.giftBox;
  const client = useMemo(() => createStorefrontApiClient({ locale }), [locale]);
  const { addItem, openDrawer, refreshCart } = useCart();
  const country = useStoreCountry();
  const [data, setData] = useState<{ bundle: StoreBoxBundle; products: StoreBoxProduct[] } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState(0);
  /** The chosen pieces' variants, in the order they were picked. */
  const [picks, setPicks] = useState<string[]>([]);
  /** Each product's variant in its picker. */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{ key: string; total: number; saving: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    storeBoxGet(client, workspaceId, bundleId)
      .then((box) => {
        if (cancelled) return;
        setData(box);
        const sizes = boxSizes(box.bundle);
        const preferred = box.bundle.tiers.find((tier) => tier.isDefault && sizes.includes(tier.quantity));
        // The tier marked default when it is a box, else the biggest box: the headline offer ("any 3 for …").
        setSize(preferred ? preferred.quantity : sizes[sizes.length - 1] ?? 1);
        setState("ready");
      })
      .catch((err) => {
        if (!cancelled) setState(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, bundleId, attempt]);

  const variants = useMemo(() => {
    const index = new Map<string, { product: StoreBoxProduct; variant: Variant }>();
    for (const product of data?.products ?? []) for (const variant of product.variants) index.set(variant.id, { product, variant });
    return index;
  }, [data]);

  // The pieces picked so far, priced by the server as the cart will price them.
  const lines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of picks) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  }, [picks]);
  const key = JSON.stringify(lines);
  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      storefrontShippingQuoteFor(client, workspaceId, { country, governorate: null, items: JSON.parse(key) }, { visitorId: getVisitorId(workspaceId) })
        .then((q) => {
          if (cancelled) return;
          const saving = (q as { bundleDiscountAmount?: number }).bundleDiscountAmount ?? 0;
          setQuote({ key, total: q.subtotal, saving });
        })
        .catch(() => {
          /* the price line waits; the box can still be added */
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, lines.length, client, workspaceId, country]);

  if (state === "loading") {
    return (
      <main className={`${container} flex-1 py-8 sm:py-10`} aria-busy="true" aria-label={copy.loading}>
        <span className={`${skeleton} block h-8 w-56`} />
        <span className={`${skeleton} mt-3 block h-4 w-40`} />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`${skeleton} block aspect-[3/4]`} />
          ))}
        </div>
      </main>
    );
  }

  if (state !== "ready" || !data || data.products.length === 0) {
    const title = state === "error" ? copy.failed : state === "missing" ? copy.notFound : copy.empty;
    return (
      <main className={`${container} flex-1 py-8 sm:py-10`}>
        <div className={`${card} flex flex-col items-center px-6 py-16 text-center`} role={state === "error" ? "alert" : undefined}>
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <BoxIcon size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{title}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {state === "error" && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={btnSecondary}>
                {copy.retry}
              </button>
            )}
            <StoreLink href="/" className={btnSecondary}>
              {t.common.continueShopping}
            </StoreLink>
          </div>
        </div>
      </main>
    );
  }

  const { bundle, products } = data;
  const sizes = boxSizes(bundle);
  const full = picks.length >= size;
  const left = Math.max(0, size - picks.length);
  const priced = quote && quote.key === key && lines.length > 0 ? quote : null;
  const variantOf = (product: StoreBoxProduct) => product.variants.find((v) => v.id === chosen[product.id]) ?? product.variants.find((v) => v.available) ?? product.variants[0];
  const countOf = (product: StoreBoxProduct) => picks.filter((id) => variants.get(id)?.product.id === product.id).length;

  function pick(variantId: string) {
    setAdded(false);
    setError(null);
    setPicks((current) => (current.length >= size ? current : [...current, variantId]));
  }
  function unpick(product: StoreBoxProduct) {
    setAdded(false);
    setPicks((current) => {
      const at = current.map((id) => variants.get(id)?.product.id).lastIndexOf(product.id);
      return at < 0 ? current : [...current.slice(0, at), ...current.slice(at + 1)];
    });
  }

  async function addBox() {
    if (busy || !full) return;
    setBusy(true);
    setError(null);
    try {
      for (const line of lines) await addItem(line.variantId, undefined, line.quantity);
      setPicks([]);
      setAdded(true);
      openDrawer();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.addFailed);
      // Some pieces may be in already: show the cart as it is.
      void refreshCart().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{copy.boxTotal}</span>
        <span className="text-end" aria-live="polite">
          {priced ? (
            <>
              <span className="block text-lg font-bold text-ink">{money(priced.total)}</span>
              {priced.saving > 0 && <span className="block text-xs font-semibold text-success">{copy.save(money(priced.saving))}</span>}
            </>
          ) : (
            <span className="text-sm text-ink-soft">{copy.pick(size)}</span>
          )}
        </span>
      </div>
      <button type="button" onClick={() => void addBox()} disabled={!full || busy} className={btnPrimaryLg}>
        {busy ? copy.adding : full ? copy.addBox : copy.pickMore(left)}
      </button>
      <div aria-live="polite" className="empty:hidden">
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {added && !error && (
          <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success">
            <CheckIcon size={16} />
            {copy.added}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <main className={`${container} flex-1 pb-44 pt-8 sm:pt-10 lg:pb-10`}>
      <p className="text-sm font-medium text-primary">{copy.entryTitle}</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{bundle.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{copy.intro(size)}</p>

      {sizes.length > 1 && (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-semibold text-ink">{copy.size}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((n) => {
              const tier = bundle.tiers.find((x) => x.quantity === n);
              const badge = tier?.label || tier?.stickerText;
              return (
                <label key={n} className={`${pill(size === n)} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary`}>
                  <input
                    type="radio"
                    name="box-size"
                    className="sr-only"
                    checked={size === n}
                    onChange={() => {
                      setSize(n);
                      setPicks((current) => current.slice(0, n));
                    }}
                  />
                  {tier?.title || copy.pieces(n)}
                  {badge && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-dark">{badge}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="box-products">
          <h2 id="box-products" className="sr-only">
            {copy.pick(size)}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const variant = variantOf(product);
              const count = countOf(product);
              const soldOut = !product.variants.some((v) => v.available);
              const choices = product.variants.filter((v) => optionsText(v));
              return (
                <li key={product.id} className={`${card} flex flex-col overflow-hidden ${count > 0 ? "ring-2 ring-primary" : ""}`}>
                  <div className="relative aspect-square bg-paper">
                    {product.imageUrl ? (
                      // Merchant media are arbitrary remote URLs (no next/image allowlist).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-primary/40">
                        <BoxIcon size={36} />
                      </span>
                    )}
                    {count > 0 && (
                      <span className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                        {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale).format(count)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <StoreLink href={`/products/${product.slug}`} className={`line-clamp-2 rounded text-sm font-semibold text-ink hover:text-primary ${focusRing}`}>
                      {product.name}
                    </StoreLink>
                    {choices.length > 1 && (
                      <select
                        aria-label={`${copy.variant} — ${product.name}`}
                        value={variant.id}
                        onChange={(e) => setChosen((current) => ({ ...current, [product.id]: e.target.value }))}
                        className="min-h-11 w-full cursor-pointer rounded-xl border border-line-strong bg-paper-raised px-2 text-sm text-ink"
                      >
                        {product.variants.map((v) => (
                          <option key={v.id} value={v.id} disabled={!v.available}>
                            {optionsText(v)}
                            {v.available ? "" : ` — ${copy.soldOut}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="text-sm text-ink-soft">{money(variant.priceAmount, variant.currency)}</span>
                    <div className="mt-auto">
                      {soldOut ? (
                        <span className="flex min-h-11 items-center justify-center rounded-xl bg-paper text-sm font-medium text-ink-soft">{copy.soldOut}</span>
                      ) : count === 0 ? (
                        <button type="button" onClick={() => pick(variant.id)} disabled={full || !variant.available} className={`${btnSecondary} w-full px-3`} aria-label={`${copy.add} — ${product.name}`}>
                          {copy.add}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-1 rounded-xl border border-primary">
                          <button type="button" onClick={() => unpick(product)} aria-label={`${copy.remove} — ${product.name}`} className={`flex size-11 cursor-pointer items-center justify-center rounded-xl text-lg font-bold text-primary ${focusRing}`}>
                            −
                          </button>
                          <span className="text-sm font-semibold text-ink">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale).format(count)}</span>
                          <button
                            type="button"
                            onClick={() => pick(variant.id)}
                            disabled={full || !variant.available}
                            aria-label={`${copy.add} — ${product.name}`}
                            className={`flex size-11 cursor-pointer items-center justify-center rounded-xl text-lg font-bold text-primary disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The box: one slot per piece, then its price and the button. Wide screens keep it beside the products. */}
        <aside className="hidden lg:block">
          <div className={`${card} sticky top-24 space-y-4 p-5`}>
            <Slots picks={picks} size={size} variants={variants} label={copy.picked(picks.length, size)} />
            {summary}
          </div>
        </aside>
      </div>

      {/* Phones: the box stays in reach at the bottom while the shopper picks. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper-raised px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] lg:hidden">
        <Slots picks={picks} size={size} variants={variants} label={copy.picked(picks.length, size)} compact />
        <div className="mt-3">{summary}</div>
      </div>
    </main>
  );
}

/** The box sizes a shopper can choose: the tiers of two pieces or more, else every tier. */
function boxSizes(bundle: StoreBoxBundle): number[] {
  const all = [...new Set(bundle.tiers.map((tier) => tier.quantity))].sort((a, b) => a - b);
  const boxes = all.filter((n) => n >= 2);
  return boxes.length ? boxes : all.length ? all : [1];
}

function Slots({
  picks,
  size,
  variants,
  label,
  compact = false,
}: {
  picks: string[];
  size: number;
  variants: Map<string, { product: StoreBoxProduct; variant: Variant }>;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center justify-between gap-3" : "space-y-3"}>
      <p className="text-sm font-semibold text-ink" aria-live="polite">
        {label}
      </p>
      <ol className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: size }, (_, i) => {
          const hit = picks[i] ? variants.get(picks[i]) : undefined;
          const cls = compact ? "size-9" : "size-12";
          return (
            <li key={i} className={`${cls} overflow-hidden rounded-xl ${hit ? "border-2 border-primary bg-primary-soft" : "border-2 border-dashed border-line-strong"}`}>
              {hit?.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hit.product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : hit ? (
                <span className="flex h-full w-full items-center justify-center text-primary">
                  <CheckIcon size={compact ? 16 : 20} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
