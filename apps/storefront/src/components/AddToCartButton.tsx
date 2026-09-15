"use client";

import { useState } from "react";
import { useCart } from "@/lib/CartProvider";
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
}: {
  variantId: string | undefined;
  offerId?: string;
  defaultQuantity?: number;
  /** e.g. the product/variant is out of stock. */
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { addItem } = useCart();
  const { t } = useStore();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const unavailable = disabled || !variantId;

  async function handleClick() {
    if (!variantId || unavailable || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      await addItem(variantId, offerId, defaultQuantity);
      setStatus("added");
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error && err.message ? err.message : t.product.addFailed);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={unavailable || status === "loading"}
        className={`${variant === "primary" ? btnPrimary : btnSecondary} w-full`}
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
