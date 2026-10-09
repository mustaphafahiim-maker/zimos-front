"use client";

import { useState, type SVGProps } from "react";
import type { PickupPlace, PickupStatus } from "@store-builder/api-client";
import { useFulfilmentCopy, type FulfilmentCopy } from "@/lib/fulfilmentCopy";
import { arOrEn } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { CheckIcon, CopyIcon } from "../Icons";
import { card } from "../ui";

/** A shop front: where an order is picked up. Drawn like the set in components/Icons.tsx. */
export function PickupPlaceIcon({ size = 20, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M4 10v9.5h16V10M3 10l1.6-5.5h14.8L21 10M3 10h18M9.5 19.5v-5h5v5" />
    </svg>
  );
}

/** What the card shows: the checkout's answer at first, the API's own reading once it is asked. */
export interface PickupCardData {
  status: PickupStatus;
  /** The six digits; null once collected or cancelled. */
  code: string | null;
  location: PickupPlace;
}

const STEPS: ReadonlyArray<{ status: PickupStatus; label: keyof Pick<FulfilmentCopy, "pickupPreparing" | "pickupReady" | "pickupCollected"> }> = [
  { status: "pending", label: "pickupPreparing" },
  { status: "ready", label: "pickupReady" },
  { status: "collected", label: "pickupCollected" },
];

/**
 * A click-and-collect order for the shopper (handoff 225), on the thank-you
 * page and the tracking page: «كود الاستلام: 713997» in large digits, how far
 * the pickup is — «بنجهّز طلبك» → «جاهز للاستلام» → «اتسلّم» — and the place
 * with its hours and how to collect. The code is gone once the order was
 * collected or cancelled. `frame="plain"` drops the card, inside another one.
 */
export function PickupCard({ pickup, frame = "card", className = "" }: { pickup: PickupCardData; frame?: "card" | "plain"; className?: string }) {
  const { locale } = useStore();
  const copy = useFulfilmentCopy();
  const [copied, setCopied] = useState(false);
  const lang = arOrEn(locale);
  const text = (value: { ar?: string; en?: string } | null | undefined) => (value?.[lang] || value?.[lang === "ar" ? "en" : "ar"] || "").trim();
  const { status, code, location } = pickup;
  const hours = text(location.hours);
  const how = text(location.instructions);
  const cancelled = status === "cancelled";
  const reached = STEPS.findIndex((s) => s.status === status);
  const note =
    status === "ready" ? copy.pickupReadyNote : status === "collected" ? copy.pickupCollectedNote : cancelled ? copy.pickupCancelledNote : copy.pickupPreparingNote;

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the digits are on the page */
    }
  }

  return (
    <section className={`${frame === "card" ? `${card} p-5 sm:p-6` : ""} ${className}`} aria-labelledby="pickup-card-title">
      <h2 id="pickup-card-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
        <PickupPlaceIcon className="shrink-0 text-primary" />
        {copy.pickup}
      </h2>

      {code && (
        <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-4 text-center">
          <p className="text-sm font-medium text-ink-soft">{copy.pickupCodeLabel}</p>
          <p className="mt-1">
            <bdi dir="ltr" className="font-mono text-4xl font-bold tracking-[0.25em] text-ink tabular-nums sm:text-5xl">
              {code}
            </bdi>
          </p>
          <p className="mt-2 text-xs text-ink-soft">{copy.pickupShowCode}</p>
          <button
            type="button"
            onClick={copyCode}
            className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-primary hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            <span aria-live="polite">{copied ? copy.copied : copy.copy}</span>
          </button>
        </div>
      )}

      {/* How far the pickup is: three steps, the reached ones marked. A cancelled pickup has no steps. */}
      {cancelled ? (
        <p className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger" role="status">
          {copy.pickupCancelled}
        </p>
      ) : (
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={copy.pickupStatus}>
          {STEPS.map((step, i) => {
            const done = i <= reached;
            const current = i === reached;
            return (
              <li key={step.status} aria-current={current ? "step" : undefined} className="min-w-0 text-center">
                <span
                  className={`mx-auto flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                    done ? "bg-primary text-on-primary" : "border border-line-strong bg-paper-raised text-ink-soft"
                  }`}
                  aria-hidden
                >
                  {done ? <CheckIcon size={14} /> : i + 1}
                </span>
                <span className={`mt-1.5 block text-xs leading-snug ${current ? "font-semibold text-ink" : "text-ink-soft"}`}>{copy[step.label]}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-sm text-ink-soft" role="status">
        {note}
      </p>

      <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-ink-soft">{copy.pickupFrom}</dt>
          <dd className="mt-0.5 font-semibold text-ink">{location.name}</dd>
          {location.address && <dd className="text-ink-soft">{location.address}</dd>}
        </div>
        {hours && (
          <div>
            <dt className="text-xs font-medium text-ink-soft">{copy.pickupHours}</dt>
            <dd className="mt-0.5 text-ink">{hours}</dd>
          </div>
        )}
        {how && (
          <div>
            <dt className="text-xs font-medium text-ink-soft">{copy.pickupHow}</dt>
            <dd className="mt-0.5 text-ink">{how}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
