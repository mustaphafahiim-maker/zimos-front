"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  apiErrorCode,
  apiFieldProblems,
  RETURN_REASON_CODES,
  SHOPPER_RETURN_DETAIL_MAX,
  SHOPPER_RETURN_MAX_PHOTOS,
  shopperExchangeOptionsOf,
  shopperExchangesOn,
  shopperReturnOrExchange,
  shopperReturnRefusalOf,
  shopperReturnRequest,
  type ReturnResolution,
  type ReturnReasonCode,
  type ShopperReturnEligibility,
  type ShopperReturnOrderRef,
  type ShopperReturnRefusal,
  type ShopperReturnSummary,
} from "@store-builder/api-client";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { QuantityStepper } from "../QuantityStepper";
import { ExchangeLineSelect, ResolutionChoice, useReturnCaseCopy } from "./ShopperReturnCase";
import { btnGhost, btnPrimaryLg, btnSecondary, focusRing, input, label as labelClass } from "../ui";

// The product photo field's rules (components/product/CustomFieldInputs): same types, same size, same shrink.
const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const RAW_LIMIT = 15 * 1024 * 1024;
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

type Photo = { key: string; preview: string; status: "uploading" | "done" | "error"; uploadId?: string; message?: string };

/**
 * Up to four photos of the problem, each shrunk in the browser when that helps,
 * previewed from the device and uploaded at once as this visitor's
 * (POST /store/:ws/uploads with X-Visitor-Id), the way a product's photo
 * field does it. The return names them by upload id, with the same visitor id.
 */
function useReturnPhotos(workspaceId: string) {
  const { t } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const patch = (key: string, next: Partial<Photo>) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));

  function uploadMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 413) return t.custom.tooLarge;
      if (err.status === 415) return t.custom.wrongType;
      if (err.status === 422) return t.custom.unreadable;
      if (err.status === 429) return apiErrorCode(err) === "TOO_MANY_PENDING_UPLOADS" ? t.custom.tooMany : t.custom.rateLimited;
    }
    return t.custom.failed;
  }

  function pick(file: File) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    const typeOk = ACCEPTED.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    setPhotos((list) => [...list, { key, preview, status: typeOk ? "uploading" : "error", message: typeOk ? undefined : t.custom.wrongType }]);
    if (!typeOk) return;
    void (async () => {
      try {
        const prepared = await compressImageIfNeeded(file, COMPRESS);
        if (prepared.size > RAW_LIMIT) throw new ApiError("too large", 413, "FILE_TOO_LARGE", null);
        const upload = await client.uploadCustomerPhoto(workspaceId, prepared, { visitorId: getVisitorId(workspaceId) });
        patch(key, { status: "done", uploadId: upload.uploadId });
      } catch (err) {
        patch(key, { status: "error", message: uploadMessage(err) });
      }
    })();
  }

  return {
    photos,
    pick,
    remove: (key: string) => setPhotos((list) => list.filter((p) => p.key !== key)),
    /** Drops every photo — after the server said one is gone, they are picked again. */
    clear: () => setPhotos([]),
    ids: photos.filter((p) => p.status === "done" && p.uploadId).map((p) => p.uploadId as string),
    uploading: photos.some((p) => p.status === "uploading"),
    full: photos.length >= SHOPPER_RETURN_MAX_PHOTOS,
  };
}

type Errors = { items?: string; lines?: Record<string, string>; reason?: string; photos?: string; form?: string };

export interface ShopperReturnFormProps {
  /** The order: the tracking link's token, or a signed-in shopper's order id and token. */
  orderRef: ShopperReturnOrderRef;
  workspaceId: string;
  /** GET /store/:ws/returns/eligibility for the same order, while it is eligible. */
  eligibility: ShopperReturnEligibility;
  /** The request went through (201). */
  onSent: (created: ShopperReturnSummary) => void;
  /** The store refused the return outright (409 RETURN_NOT_POSSIBLE): the order's state changed. */
  onRefused: (reason: ShopperReturnRefusal) => void;
  /** What can be returned changed under the form (a quantity was refused): ask eligibility again. */
  onStale?: () => void;
  onCancel?: () => void;
}

/**
 * The shopper's return request: lines with quantity steppers up
 * to what is still returnable, the reason, optional words (≤ 280), photos
 * (needed for the reasons the store chose) and "Send request". Every refusal
 * is said in the shopper's language, beside the field it is about.
 */
export function ShopperReturnForm({ orderRef, workspaceId, eligibility, onSent, onRefused, onStale, onCancel }: ShopperReturnFormProps) {
  const { t } = useStore();
  const r = t.returns;
  const uid = useId();
  const [client] = useState(() => createStorefrontApiClient());
  const photos = useReturnPhotos(workspaceId);
  const lines = eligibility.items;
  const open = lines.filter((l) => l.returnable > 0);
  // One line to return: start at one of it, so the shopper only picks a reason.
  const [qty, setQty] = useState<Record<string, number>>(() => (open.length === 1 ? { [open[0].orderItemId]: 1 } : {}));
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode | "">("");
  // A refund, or another size or colour of the same product (when the store takes exchanges).
  const caseCopy = useReturnCaseCopy();
  const exchangesOn = shopperExchangesOn(eligibility);
  const [resolution, setResolution] = useState<ReturnResolution>("refund");
  const [swapTo, setSwapTo] = useState<Record<string, string>>({});
  const exchanging = exchangesOn && resolution === "exchange";
  const [detail, setDetail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // A line the server now caps lower (another request landed) is brought down to it.
  useEffect(() => {
    setQty((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const line of lines) {
        if ((next[line.orderItemId] ?? 0) > line.returnable) {
          next[line.orderItemId] = line.returnable;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [lines]);

  const reasons = (eligibility.reasons?.length ? eligibility.reasons : RETURN_REASON_CODES).filter((c) => RETURN_REASON_CODES.includes(c));
  const photoNeeded = reasonCode !== "" && eligibility.photoRequiredFor.includes(reasonCode);
  const reasonText = (code: ReturnReasonCode) => (r as Record<string, unknown>)[`reason_${code}`] as string;
  const ids = {
    reason: `${uid}-reason`,
    reasonError: `${uid}-reason-error`,
    detail: `${uid}-detail`,
    detailCount: `${uid}-detail-count`,
    photos: `${uid}-photos`,
    photosError: `${uid}-photos-error`,
    items: `${uid}-items-error`,
    line: (id: string) => `${uid}-line-${id}`,
  };

  function focusFirst(next: Errors) {
    const target = next.items
      ? document.getElementById(ids.items)
      : next.reason
        ? document.getElementById(ids.reason)
        : next.photos
          ? document.getElementById(ids.photos)
          : null;
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }

  /** A refused submit, said in the shopper's words. */
  function explain(err: unknown, sent: { orderItemId: string; quantity: number }[]): Errors {
    const refusal = shopperReturnRefusalOf(err);
    if (refusal) {
      onRefused(refusal);
      return {};
    }
    const problems = apiFieldProblems(err);
    if (problems.length) {
      const next: Errors = {};
      for (const p of problems) {
        const m = /^items\.(\d+)\.quantity$/.exec(p.field);
        const swap = /^items\.(\d+)\.exchangeVariantId$/.exec(p.field);
        if (swap) {
          // Missing, no longer sold or out of stock: the shopper picks again from fresh options.
          const line = sent[Number(swap[1])];
          if (line) next.lines = { ...next.lines, [line.orderItemId]: caseCopy.optionGone };
          onStale?.();
        } else if (p.field === "resolution") {
          next.form = caseCopy.noExchanges;
          onStale?.();
        } else if (m) {
          const line = sent[Number(m[1])];
          const most = /(\d+)/.exec(p.message);
          if (line) next.lines = { ...next.lines, [line.orderItemId]: most ? r.tooMany(Number(most[1])) : r.quantityGeneric };
          onStale?.();
        } else if (p.field === "photoUploadIds") {
          // "Add a photo of the problem" when none was sent; otherwise one is gone (another visitor's, or past its 48 hours).
          next.photos = /expired|missing/i.test(p.message) ? r.photoExpired : r.needPhoto;
          if (next.photos === r.photoExpired) photos.clear();
        } else if (p.field === "reasonCode") {
          next.reason = r.chooseReason;
        } else if (p.field.startsWith("items")) {
          next.items = r.chooseItems;
          onStale?.();
        } else {
          next.form = r.failed;
        }
      }
      return next;
    }
    if (err instanceof ApiError) {
      if (err.status === 404) return { form: r.notFound };
      if (err.status === 401) return { form: r.signIn };
      if (err.status === 429) return { form: r.rateLimited };
    }
    return { form: r.failed };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const items = lines
      .map((l) => ({ orderItemId: l.orderItemId, quantity: Math.min(qty[l.orderItemId] ?? 0, l.returnable) }))
      .filter((l) => l.quantity > 0);
    const next: Errors = {};
    if (items.length === 0) next.items = r.chooseItems;
    if (exchanging) {
      const missing = items.filter((line) => !swapTo[line.orderItemId]);
      if (missing.length) next.lines = Object.fromEntries(missing.map((line) => [line.orderItemId, caseCopy.chooseExchange]));
    }
    if (!reasonCode) next.reason = r.chooseReason;
    if (photos.uploading) next.photos = r.waitPhotos;
    else if (photoNeeded && photos.ids.length === 0) next.photos = r.needPhoto;
    setErrors(next);
    if (Object.keys(next).length) return focusFirst(next);

    setBusy(true);
    try {
      const common = {
        reasonCode: reasonCode as ReturnReasonCode,
        ...(detail.trim() ? { reasonDetail: detail.trim().slice(0, SHOPPER_RETURN_DETAIL_MAX) } : {}),
        ...(photos.ids.length ? { photoUploadIds: photos.ids } : {}),
      };
      const created = exchanging
        ? await shopperReturnOrExchange(
            client,
            workspaceId,
            orderRef,
            { ...common, resolution: "exchange", items: items.map((line) => ({ ...line, exchangeVariantId: swapTo[line.orderItemId] })) },
            getVisitorId(workspaceId)
          )
        : await shopperReturnRequest(client, workspaceId, orderRef, { ...common, items }, getVisitorId(workspaceId));
      onSent(created);
    } catch (err) {
      const explained = explain(err, items);
      setErrors(explained);
      focusFirst(explained);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-5 rounded-xl border border-line bg-paper p-4" aria-labelledby={`${uid}-title`}>
      <div>
        <h4 id={`${uid}-title`} ref={headingRef} tabIndex={-1} className="text-base font-semibold text-ink outline-none">
          {r.formTitle}
        </h4>
        <p className="mt-0.5 text-sm text-ink-soft">{r.formHint}</p>
      </div>

      {exchangesOn && (
        <ResolutionChoice
          value={resolution}
          disabled={busy}
          onChange={(next) => {
            setResolution(next);
            setErrors((prev) => ({ ...prev, lines: {}, form: undefined }));
          }}
        />
      )}

      <div>
        <ul className="space-y-3">
          {lines.map((line) => {
            const options = line.variantOptions ? Object.entries(line.variantOptions).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
            const lineError = errors.lines?.[line.orderItemId];
            return (
              <li key={line.orderItemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p id={ids.line(line.orderItemId)} className="text-sm font-medium text-ink">
                    <bdi>{line.name}</bdi>
                  </p>
                  {options && (
                    <p className="text-xs text-ink-soft">
                      <bdi>{options}</bdi>
                    </p>
                  )}
                  <p className="text-xs text-ink-soft">{line.returnable > 0 ? r.upTo(line.returnable) : r.nothingLeft}</p>
                  {lineError && (
                    <p role="alert" className="mt-1 text-xs font-medium text-danger">
                      {lineError}
                    </p>
                  )}
                </div>
                {line.returnable > 0 && (
                  <QuantityStepper
                    value={Math.min(qty[line.orderItemId] ?? 0, line.returnable)}
                    min={0}
                    max={line.returnable}
                    size="sm"
                    disabled={busy}
                    labelledBy={ids.line(line.orderItemId)}
                    onChange={(n) => {
                      setQty((prev) => ({ ...prev, [line.orderItemId]: n }));
                      setErrors((prev) => ({ ...prev, items: undefined, lines: { ...prev.lines, [line.orderItemId]: "" } }));
                    }}
                  />
                )}
                {exchanging && line.returnable > 0 && (qty[line.orderItemId] ?? 0) > 0 && (
                  <ExchangeLineSelect
                    line={line}
                    value={swapTo[line.orderItemId] ?? ""}
                    disabled={busy}
                    onChange={(variantId) => {
                      setSwapTo((prev) => ({ ...prev, [line.orderItemId]: variantId }));
                      setErrors((prev) => ({ ...prev, lines: { ...prev.lines, [line.orderItemId]: "" } }));
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {errors.items && (
          <p id={ids.items} role="alert" tabIndex={-1} className="mt-2 text-sm font-medium text-danger outline-none">
            {errors.items}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.reason} className={labelClass}>
          {r.reason}
        </label>
        <select
          id={ids.reason}
          value={reasonCode}
          disabled={busy}
          onChange={(e) => {
            setReasonCode(e.target.value as ReturnReasonCode | "");
            setErrors((prev) => ({ ...prev, reason: undefined, photos: undefined }));
          }}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? ids.reasonError : undefined}
          className={`${input} cursor-pointer`}
        >
          <option value="" disabled>
            {r.reasonPlaceholder}
          </option>
          {reasons.map((code) => (
            <option key={code} value={code}>
              {reasonText(code)}
            </option>
          ))}
        </select>
        {errors.reason && (
          <p id={ids.reasonError} className="mt-1 text-xs font-medium text-danger">
            {errors.reason}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.detail} className={labelClass}>
          {r.details} <span className="font-normal text-ink-soft">({t.common.optional})</span>
        </label>
        <textarea
          id={ids.detail}
          value={detail}
          maxLength={SHOPPER_RETURN_DETAIL_MAX}
          rows={3}
          dir="auto"
          disabled={busy}
          onChange={(e) => setDetail(e.target.value.slice(0, SHOPPER_RETURN_DETAIL_MAX))}
          aria-describedby={ids.detailCount}
          className={`${input} min-h-24 resize-y`}
        />
        <p id={ids.detailCount} className="mt-1 text-end text-xs text-ink-soft tabular-nums">
          {t.custom.counter(detail.length, SHOPPER_RETURN_DETAIL_MAX)}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">
          {r.photos}{" "}
          <span className="font-normal text-ink-soft">({photoNeeded ? t.common.required : t.common.optional})</span>
        </p>
        {photoNeeded && <p className="text-xs text-ink-soft">{r.photoNeeded}</p>}
        {photos.photos.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {photos.photos.map((photo, i) => (
              <li key={photo.key} className="w-20 space-y-1">
                {/* Previewed from the device; the store gets the server's re-encoded copy. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={r.photoAlt(i + 1)}
                  className={`size-20 rounded-xl border border-line object-cover ${photo.status === "uploading" ? "opacity-60" : ""}`}
                />
                {photo.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => photos.remove(photo.key)}
                    aria-label={r.removePhoto(i + 1)}
                    className={`block min-h-11 w-full rounded-lg text-xs font-medium text-ink-soft hover:text-danger ${focusRing}`}
                  >
                    {t.custom.removePhoto}
                  </button>
                )}
                <p aria-live="polite" className="text-xs empty:hidden">
                  {photo.status === "uploading" && <span className="text-ink-soft">{t.custom.uploading}</span>}
                  {photo.status === "error" && <span className="font-medium text-danger">{photo.message}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!photos.full && (
          <label className={`${btnSecondary} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
            <input
              id={ids.photos}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              aria-required={photoNeeded || undefined}
              aria-invalid={errors.photos ? true : undefined}
              aria-describedby={errors.photos ? ids.photosError : undefined}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) {
                  photos.pick(file);
                  setErrors((prev) => ({ ...prev, photos: undefined }));
                }
              }}
            />
            {r.addPhoto}
          </label>
        )}
        <p className="text-xs text-ink-soft">
          {t.custom.photoHint} {r.photoLimit(SHOPPER_RETURN_MAX_PHOTOS)}
        </p>
        {errors.photos && (
          <p id={ids.photosError} role="alert" className="text-sm font-medium text-danger">
            {errors.photos}
          </p>
        )}
      </div>

      {errors.form && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {errors.form}
        </p>
      )}

      <div className="space-y-2">
        <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimaryLg}>
          {busy ? r.sending : exchanging ? caseCopy.requestExchange : r.send}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className={`${btnGhost} w-full`}>
            {r.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
