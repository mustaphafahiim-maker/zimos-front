"use client";

import { useState } from "react";
import type { CustomizationInput } from "@store-builder/api-client";
import { cartErrorMessage, useCart, type LinePreview } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { CartGlyph, CheckIcon } from "./Icons";
import { btnPrimary, btnSecondary } from "./ui";

type Status = "idle" | "loading" | "added" | "error";

export function AddToCartButton({
  variantId,
  offerId,
  defaultQuantity = 1,
  disabled = false,
  variant = "primary",
  className = "",
  customizations,
  beforeAdd,
  onAddError,
  preview,
}: {
  variantId: string | undefined;
  offerId?: string;
  defaultQuantity?: number;
  /** e.g. the product/variant is out of stock. */
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  /** Answers to the product's custom fields, sent with the line. */
  customizations?: CustomizationInput;
  /** Runs first; false stops the add (e.g. a required custom field is empty — it says so itself). */
  beforeAdd?: () => boolean;
  /** Gets a failed add first; true when it showed the problem itself. */
  onAddError?: (err: unknown) => boolean;
  /**
   * The product's name and photo as the page shows them: the line the drawer
   * draws before the server answers. Without it the line is named from the
   * cart's catalogue when the product is in it, else it waits as a placeholder.
   */
  preview?: LinePreview;
}) {
  const { addItem, openDrawer, reportProblem } = useCart();
  const { t } = useStore();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const unavailable = disabled || !variantId;

  async function handleClick() {
    if (!variantId || unavailable || status === "loading") return;
    if (beforeAdd && !beforeAdd()) return;
    setStatus("loading");
    setError(null);
    // The tap answers at once. The drawer is the confirmation — the line, the
    // subtotal and the way to checkout, without leaving the page — so it opens
    // now, with the line already in it, and the server's cart takes over when
    // it answers (lib/CartProvider). The button still says "added" underneath
    // for when the drawer is closed again.
    //
    // One exception: a product whose answers the server may send back to a
    // field on the page (`onAddError`). Its drawer waits for the answer, as it
    // always did, so the shopper is never pulled away from that field.
    const openFirst = !onAddError;
    if (openFirst) openDrawer();
    try {
      await addItem(variantId, offerId, defaultQuantity, customizations, preview);
      setStatus("added");
      if (!openFirst) openDrawer();
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch (err) {
      if (onAddError && onAddError(err)) {
        setStatus("idle");
        return;
      }
      const message = cartErrorMessage(err) ?? t.product.addFailed;
      setStatus("error");
      setError(message);
      // The line is gone from the open drawer again; it says why, in this one line.
      if (openFirst) reportProblem("add", message);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={unavailable || status === "loading"}
        aria-busy={status === "loading"}
        className={`${variant === "primary" ? btnPrimary : btnSecondary} w-full touch-manipulation`}
      >
        {status === "added" ? <CheckIcon /> : <CartGlyph />}
        {unavailable
          ? t.product.unavailable
          : status === "loading"
            ? t.product.adding
            : status === "added"
              ? t.product.added
              : t.product.addToCart}
      </button>
      <p aria-live="polite" className="mt-2 min-h-0 text-sm text-danger empty:hidden">
        {status === "error" && error ? error : ""}
      </p>
    </div>
  );
}
