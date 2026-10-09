"use client";

import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "./StoreRoute";
import { focusRing } from "./ui";

/**
 * "By placing your order you agree to our refund policy, privacy policy…" —
 * one link per legal policy the store has written, shown where the shopper
 * commits to an order. Nothing at all for a store with no policies.
 *
 * The links sit beside the order button, so each is a target a thumb can hit
 * on purpose: 44px tall, with room between them, rather than words inside a
 * 12px sentence.
 */
export function PolicyLinks({ className = "" }: { className?: string }) {
  const { t, store } = useStore();
  const keys = store?.legal ?? [];
  if (keys.length === 0) return null;
  return (
    <div className={`text-xs text-ink-soft ${className}`.trimEnd()}>
      <p>{t.policies.agree}</p>
      <ul className="flex flex-wrap gap-x-4">
        {keys.map((key) => (
          <li key={key}>
            <StoreLink
              href={`/policies/${key.replace(/_/g, "-")}`}
              target="_blank"
              className={`inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
            >
              {t.policies[key]}
            </StoreLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
