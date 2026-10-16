"use client";

import { Fragment } from "react";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "@/components/StoreRoute";

/**
 * The store's legal policies in a funnel's footer (SPEC §8.3: written once,
 * shown in the store footer, every funnel and the checkout). Funnels hide the
 * store's own footer, so this is the one place a funnel shopper — and an ad
 * platform's reviewer — finds them. Each opens in a new tab so the path to
 * the order stays where it is. Nothing for a store with no policies.
 */
export function FunnelPolicies() {
  const { t, store } = useStore();
  const keys = store?.legal ?? [];
  if (keys.length === 0) return null;
  return (
    <nav aria-label={t.policies.title} className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-ink-soft">
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span aria-hidden>·</span>}
          <StoreLink href={`/policies/${key.replace(/_/g, "-")}`} target="_blank" className="hover:text-primary hover:underline">
            {t.policies[key]}
          </StoreLink>
        </Fragment>
      ))}
    </nav>
  );
}
