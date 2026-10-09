"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiErrorCode, checkoutUploadPhoto } from "@store-builder/api-client";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { setPhotoUploading } from "@/lib/checkoutPhoto";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { PHOTO_MAX_BYTES } from "@/lib/photoLimit";
import { btnSecondary, focusRing } from "../ui";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
// Shoppers' photos are refused above 5 MB (handoff 400): a file compression could not bring under it is not sent.
const RAW_LIMIT = PHOTO_MAX_BYTES;
// What the browser aims for before sending; the server re-encodes anyway (as for product photos).
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

type Status = "idle" | "uploading" | "done" | "error";

/**
 * A purchase-form field that asks for a photo (dashboard → Checkout form →
 * "Photo upload"). The photo is shrunk in the browser when that helps,
 * previewed from the device and uploaded at once as this visitor's
 * (X-Visitor-Id); the field's answer is the upload's id, which the checkout
 * sends with the same visitor id. Change / Remove pick again or clear it.
 */
export function CheckoutPhotoField({
  id,
  fieldKey,
  label,
  value,
  onChange,
  required,
  invalid,
  describedBy,
}: {
  id: string;
  fieldKey: string;
  label: string;
  /** The upload id, or "" for none. */
  value: string;
  onChange: (uploadId: string) => void;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t, store } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  // The latest pick; an upload that lands after Remove is ignored.
  const pick = useRef(0);
  // Whether this field is holding the order back (lib/checkoutPhoto).
  const holding = useRef(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  // A photo still uploading when the form goes away no longer holds the order back.
  useEffect(
    () => () => {
      if (holding.current) setPhotoUploading(fieldKey, false);
      holding.current = false;
    },
    [fieldKey]
  );

  function hold(on: boolean) {
    if (holding.current === on) return;
    holding.current = on;
    setPhotoUploading(fieldKey, on);
  }

  function uploadMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 413) return t.custom.tooLarge;
      if (err.status === 415) return t.custom.wrongType;
      if (err.status === 422) return t.custom.unreadable;
      if (err.status === 429) return apiErrorCode(err) === "TOO_MANY_PENDING_UPLOADS" ? t.custom.tooMany : t.custom.rateLimited;
    }
    return t.custom.failed;
  }

  async function onPick(file: File | undefined) {
    if (!file || !store) return;
    const mine = ++pick.current;
    setMessage(null);
    onChange("");
    const typeOk = ACCEPTED.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    setPreview(URL.createObjectURL(file));
    if (!typeOk) {
      setStatus("error");
      setMessage(t.custom.wrongType);
      return;
    }
    setStatus("uploading");
    hold(true);
    try {
      const prepared = await compressImageIfNeeded(file, COMPRESS);
      if (prepared.size > RAW_LIMIT) throw new ApiError("too large", 413, "FILE_TOO_LARGE", null);
      const upload = await checkoutUploadPhoto(client, store.workspaceId, prepared, getVisitorId(store.workspaceId));
      if (mine !== pick.current) return;
      onChange(upload.uploadId);
      setStatus("done");
    } catch (err) {
      if (mine !== pick.current) return;
      setStatus("error");
      setMessage(uploadMessage(err));
    } finally {
      if (mine === pick.current) hold(false);
    }
  }

  function remove() {
    pick.current += 1;
    hold(false);
    onChange("");
    setPreview(null);
    setStatus("idle");
    setMessage(null);
  }

  const hintId = `${id}-photo-hint`;
  const has = Boolean(preview) || Boolean(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {preview && (
          // Previewed from the device; the order keeps the server's re-encoded copy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={t.custom.photoPreview(label)}
            className={`size-20 rounded-xl border border-line object-cover ${status === "uploading" ? "opacity-60" : ""}`}
          />
        )}
        <label className={`${btnSecondary} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
          <input
            id={id}
            name={fieldKey}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={[describedBy, hintId].filter(Boolean).join(" ")}
            disabled={status === "uploading"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onPick(file);
            }}
          />
          {has ? t.checkoutExtras.changePhoto : t.checkoutExtras.uploadPhoto}
        </label>
        {has && status !== "uploading" && (
          <button
            type="button"
            onClick={remove}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm font-medium text-ink-soft hover:text-danger ${focusRing}`}
          >
            {t.checkoutExtras.removePhoto}
          </button>
        )}
      </div>
      <p id={hintId} className="text-xs text-ink-soft">
        {t.custom.photoHint}
      </p>
      <p aria-live="polite" className="text-sm empty:hidden">
        {status === "uploading" && <span className="text-ink-soft">{t.custom.uploading}</span>}
        {/* Not while the form says the photo needs doing again (expired, another visitor's). */}
        {status === "done" && !invalid && <span className="font-medium text-success">{t.custom.uploaded}</span>}
        {status === "error" && message && <span className="font-medium text-danger">{message}</span>}
      </p>
    </div>
  );
}
