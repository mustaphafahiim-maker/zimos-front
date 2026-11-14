"use client";

import type { StorefrontProduct } from "@store-builder/api-client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StoreLink } from "@/components/StoreRoute";
import { XsPicture } from "@/components/xs/XsPicture";
import { formatPrice, type Locale } from "@/lib/i18n";
import { compareAtOf, discountPercent, priceOf, productImages } from "@/lib/product";

/**
 * A product in a panel over the page it was found on: its pictures, name,
 * price and description, and a button to its own page — which is where a
 * shopper picks options and adds to the cart, so this never guesses a variant.
 *
 * A modal dialog: it takes the focus, Escape or a click outside closes it, the
 * page behind does not scroll, and the focus goes back where it was. Drawn
 * straight under <body>: a section of the page may be a containing block for
 * fixed boxes (a transform, a filter), which would pin the panel inside it.
 * The store's own wrapper is what carries the reading direction, so that is
 * read off the page and set here.
 */
export function XsQuickView({
  look,
  product,
  currency,
  locale,
  showDiscount,
  labels,
  onClose,
}: {
  look: string;
  product: StorefrontProduct;
  currency: string;
  locale: Locale;
  showDiscount: boolean;
  labels: { close: string; open: string };
  onClose: () => void;
}) {
  const pictures = productImages(product).slice(0, 5);
  const [shown, setShown] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);

  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const percent = price !== undefined ? discountPercent(price, compareAt) : null;
  // The description may hold markup from the catalogue's editor; here it is read as plain words.
  const description = String(product.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dir = typeof document === "undefined" ? undefined : (document.querySelector(".brand-theme")?.getAttribute("dir") ?? undefined);

  return createPortal(
    <div className="xs-quick" data-xs-look={look} dir={dir} onClick={onClose}>
      <div ref={panel} className="xs-quick__panel" role="dialog" aria-modal="true" aria-label={product.name} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="xs-quick__close" aria-label={labels.close} onClick={onClose}>
          <span aria-hidden>×</span>
        </button>
        <div className="xs-quick__media">
          {pictures[shown] ? <XsPicture key={pictures[shown]} src={pictures[shown]} alt={product.name} className="xs-quick__img" eager /> : null}
          {pictures.length > 1 ? (
            <div className="xs-quick__thumbs">
              {pictures.map((src, index) => (
                <button key={src} type="button" data-active={index === shown ? "" : undefined} aria-label={`${index + 1}`} onClick={() => setShown(index)}>
                  <XsPicture src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="xs-quick__body">
          <h2 className="xs-quick__name">{product.name}</h2>
          <p className="xs-quick__price">
            {compareAt ? <s>{formatPrice(compareAt, currency, locale)}</s> : null}
            <span>{price !== undefined ? formatPrice(price, currency, locale) : "—"}</span>
            {showDiscount && percent ? <em>-{percent}%</em> : null}
          </p>
          {description ? <p className="xs-quick__text">{description.slice(0, 420)}</p> : null}
          <StoreLink href={`/products/${product.slug}`} className="xs-quick__go">
            {labels.open}
          </StoreLink>
        </div>
      </div>
    </div>,
    document.body
  );
}
