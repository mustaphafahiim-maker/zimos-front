"use client";

import { Fragment } from "react";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "./StoreRoute";

/**
 * "By placing your order you agree to our refund policy, privacy policy…" —
 * one link per legal policy the store has written, shown where the shopper
 * commits to an order. Nothing at all for a store with no policies.
 */
export function PolicyLinks({ className = "" }: { className?: string }) {
  const { t, store } = useStore();
  const keys = store?.legal ?? [];
  if (keys.length === 0) return null;
  return (
    <p className={`text-xs text-ink-soft ${className}`.trimEnd()}>
      {t.policies.agree}{" "}
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && "، "}
          <StoreLink
            href={`/policies/${key.replace(/_/g, "-")}`}
            target="_blank"
            className="font-medium text-primary hover:underline"
          >
            {t.policies[key]}
          </StoreLink>
        </Fragment>
      ))}
    </p>
  );
}
