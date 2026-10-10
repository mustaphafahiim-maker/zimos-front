"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ApiError,
  shopperReturnEligibility,
  type ReturnStatus,
  type ShopperReturnEligibility,
  type ShopperReturnOrderRef,
  type ShopperReturnRefusal,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { ShopperReturnForm } from "./ShopperReturnForm";
import { ShopperReturnCase, returnCaseStatusText, useReturnCaseCopy } from "./ShopperReturnCase";
import { btnGhost, btnSecondary, skeleton } from "../ui";

export type ShopperReturnsProps = (
  | { token: string; orderId?: undefined; shopperToken?: undefined }
  | { orderId: string; shopperToken: string; token?: undefined }
) & {
  /** The store's workspace id; defaults to the store this page belongs to. */
  workspaceId?: string;
  /** Classes for the section (default: a top margin and a hairline, as on the tracking card). */
  className?: string;
};

const STATUS_CLASS: Record<ReturnStatus, string> = {
  requested: "border border-line bg-paper-raised text-ink",
  approved: "bg-success-soft text-success",
  received: "bg-success-soft text-success",
  refunded: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
};

/**
 * Returns on one order, for the shopper: "Return items" with
 * the last day it is possible while the order can be returned, why not in
 * the shopper's words when it can't (nothing at all when the store takes
 * returns by contact only), the form, and the returns already asked for with
 * their status.
 *
 * The order is named by the tracking link's token (`token`) or, for a
 * signed-in shopper, by `orderId` + `shopperToken` (X-Shopper-Token).
 */
export function ShopperReturns(props: ShopperReturnsProps) {
  const { t, store, intlLocale } = useStore();
  const r = t.returns;
  // Exchanges and the decision of the store.
  const caseCopy = useReturnCaseCopy();
  const uid = useId();
  const workspaceId = props.workspaceId ?? store?.workspaceId ?? "";
  const orderRef: ShopperReturnOrderRef | null = props.token
    ? { token: props.token }
    : props.orderId && props.shopperToken
      ? { orderId: props.orderId, shopperToken: props.shopperToken }
      : null;
  const refKey = orderRef ? ("token" in orderRef ? orderRef.token : `${orderRef.orderId}:${orderRef.shopperToken}`) : "";

  const [client] = useState(() => createStorefrontApiClient());
  const [data, setData] = useState<ShopperReturnEligibility | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "gone">("loading");
  const [failure, setFailure] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sent, setSent] = useState(false);
  /** A refusal the server gave on submit; shown until eligibility says otherwise. */
  const [refused, setRefused] = useState<ShopperReturnRefusal | null>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const call = useRef(0);
  // The words for a failed load, read when it fails (the dictionary is not a stable dependency).
  const words = useRef(r);
  words.current = r;

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!orderRef || !workspaceId) return;
      const id = ++call.current;
      if (!opts.silent) setState("loading");
      try {
        const next = await shopperReturnEligibility(client, workspaceId, orderRef);
        if (id !== call.current) return;
        setData(next);
        setState("ready");
      } catch (err) {
        if (id !== call.current) return;
        // An unknown order has no returns to show; the page around it says so already.
        if (err instanceof ApiError && err.status === 404) return setState("gone");
        setFailure(err instanceof ApiError && err.status === 401 ? words.current.signIn : words.current.loadFailed);
        setState("error");
      }
    },
    // refKey stands for orderRef: a new object with the same order is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, workspaceId, refKey]
  );

  useEffect(() => {
    setFormOpen(false);
    setSent(false);
    setRefused(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  if (!orderRef || !workspaceId || state === "gone") return null;

  const wrapper = props.className ?? "mt-6 border-t border-line pt-5";
  const titleId = `${uid}-title`;

  if (state === "loading") {
    return (
      <section className={wrapper} aria-labelledby={titleId} aria-busy="true">
        <h3 id={titleId} className="text-sm font-semibold text-ink">
          {r.title}
        </h3>
        <div className={`${skeleton} mt-3 h-11 w-full sm:w-48`} />
        <span className="sr-only" role="status">
          {t.common.loading}
        </span>
      </section>
    );
  }

  if (state === "error" || !data) {
    return (
      <section className={wrapper} aria-labelledby={titleId}>
        <h3 id={titleId} className="text-sm font-semibold text-ink">
          {r.title}
        </h3>
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-ink-soft">{failure ?? r.loadFailed}</p>
          <button type="button" onClick={() => void load()} className={btnGhost}>
            {r.retry}
          </button>
        </div>
      </section>
    );
  }

  const reason = refused ?? data.reason;
  const eligible = data.eligible && !refused;
  const why: Record<ShopperReturnRefusal, string> = {
    off: r.off,
    cancelled: r.cancelled,
    not_delivered: r.notDelivered,
    window_closed: r.windowClosed,
    already_requested: r.alreadyRequested,
  };
  // "off" says nothing on its own — unless the shopper just tried and the store refused.
  // Right after a request took the last of the order, "the store will contact you" is already said above.
  const reasonText =
    !eligible && reason && (reason !== "off" || refused) && !(sent && reason === "already_requested") ? why[reason] : null;
  const past = data.returns ?? [];

  // A store that takes returns by contact only, and nothing asked for yet: no section at all.
  if (!eligible && !reasonText && past.length === 0 && !sent) return null;

  const date = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "";
  const num = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const nameOf = (orderItemId: string) => data.items.find((i) => i.orderItemId === orderItemId)?.name ?? "";
  const reasonLabel = (stored: string) => {
    const code = stored.split(":")[0].trim();
    const label = (r as Record<string, unknown>)[`reason_${code}`];
    return typeof label === "string" ? label : null;
  };

  return (
    <section className={wrapper} aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-semibold text-ink">
        {r.title}
      </h3>

      {sent && (
        <p
          ref={sentRef}
          tabIndex={-1}
          role="status"
          className="mt-3 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success outline-none"
        >
          {r.sent}
        </p>
      )}

      {eligible && !formOpen && (
        <div className="mt-3 space-y-1.5">
          <button
            ref={startRef}
            type="button"
            onClick={() => {
              setSent(false);
              setFormOpen(true);
            }}
            className={`${btnSecondary} w-full sm:w-auto`}
          >
            {r.start}
          </button>
          {data.deadline && <p className="text-xs text-ink-soft">{r.until(date(data.deadline))}</p>}
        </div>
      )}

      {eligible && formOpen && (
        <>
          {data.deadline && <p className="mt-1 text-xs text-ink-soft">{r.until(date(data.deadline))}</p>}
          <ShopperReturnForm
            orderRef={orderRef}
            workspaceId={workspaceId}
            eligibility={data}
            onSent={() => {
              setFormOpen(false);
              setSent(true);
              void load({ silent: true });
            }}
            onRefused={(why) => {
              setFormOpen(false);
              setRefused(why);
              void load({ silent: true });
            }}
            onStale={() => void load({ silent: true })}
            onCancel={() => {
              setFormOpen(false);
              requestAnimationFrame(() => startRef.current?.focus());
            }}
          />
        </>
      )}

      {reasonText && <p className="mt-2 text-sm text-ink-soft">{reasonText}</p>}

      {past.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-ink-soft">{r.yours}</h4>
          <ul className="mt-2 space-y-2">
            {past.map((ret) => {
              const label = reasonLabel(ret.reason);
              const statusText = (r as Record<string, unknown>)[`status_${ret.status}`];
              return (
                <li key={ret.id} className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-ink-soft">{r.requestedOn(date(ret.createdAt))}</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[ret.status] ?? STATUS_CLASS.requested}`}>
                      {returnCaseStatusText(caseCopy, ret.status) ?? (typeof statusText === "string" ? statusText : ret.status)}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-ink">
                    {ret.items.map((line) => (
                      <li key={line.orderItemId} className="flex gap-1.5">
                        <span className="shrink-0 tabular-nums text-ink-soft">{num(line.quantity)} ×</span>
                        <bdi className="min-w-0">{nameOf(line.orderItemId)}</bdi>
                      </li>
                    ))}
                  </ul>
                  {label && <p className="mt-1 text-xs text-ink-soft">{label}</p>}
                  <ShopperReturnCase ret={ret} lines={data.items} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
