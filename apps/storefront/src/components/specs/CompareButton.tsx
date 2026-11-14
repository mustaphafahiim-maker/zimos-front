"use client";

import { useState } from "react";
import { CheckIcon, CrossIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, focusRing } from "@/components/ui";
import { COMPARE_MAX, useCompareList, type ComparedProduct } from "@/lib/compareList";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { SPEC_TEXT } from "./specText";

/**
 * «قارن» on the product page: adds the product to the
 * shopper's compare list — kept in this browser, four at most — and shows the
 * tray under it: what is being compared, each with a way out, and the link to
 * the compare page once there are two.
 */
export function CompareButton({ product }: { product: ComparedProduct }) {
  const { locale, intlLocale, store } = useStore();
  const text = pickText(SPEC_TEXT, locale);
  const list = useCompareList(store?.id);
  const [full, setFull] = useState(false);
  const inList = list.has(product.id);
  const count = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  function toggle() {
    if (inList) {
      list.remove(product.id);
      setFull(false);
    } else {
      setFull(!list.add(product));
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <button type="button" aria-pressed={inList} onClick={toggle} className={`${btnSecondary} w-full sm:w-auto ${inList ? "border-primary text-primary" : ""}`}>
        {inList && <CheckIcon size={18} />}
        {inList ? text.added : text.compare}
      </button>

      <p role="alert" className="mt-2 text-sm text-danger empty:hidden">
        {full ? text.full(count(COMPARE_MAX)) : ""}
      </p>

      {list.items.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-paper-raised p-3 sm:min-w-72" aria-live="polite">
          <p className="text-xs font-semibold text-ink-soft">{text.trayTitle}</p>
          <ul className="mt-2 space-y-1">
            {list.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <StoreLink href={`/products/${item.slug}`} className="min-w-0 truncate text-sm font-medium text-ink hover:text-primary">
                  <bdi>{item.name}</bdi>
                </StoreLink>
                <button
                  type="button"
                  onClick={() => {
                    list.remove(item.id);
                    setFull(false);
                  }}
                  aria-label={text.removeName(item.name)}
                  className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:text-danger ${focusRing}`}
                >
                  <CrossIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
          {list.items.length >= 2 ? (
            <StoreLink href="/compare" className={`${btnPrimary} mt-2 w-full`}>
              {text.openCompare(count(list.items.length))}
            </StoreLink>
          ) : (
            <p className="mt-2 text-xs text-ink-soft">{text.needTwo}</p>
          )}
        </div>
      )}
    </div>
  );
}
