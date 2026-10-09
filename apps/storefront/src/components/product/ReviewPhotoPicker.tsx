"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiErrorCode } from "@store-builder/api-client";
import { PHOTO_MAX_BYTES } from "@/lib/photoLimit";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { btnSecondary, focusRing, label as labelClass } from "../ui";

/**
 * Up to three photos on the review form (reviews/shopperReviews.js). Each is
 * shrunk in the browser when that helps, previewed from the device and
 * uploaded at once, as a custom-field photo is; the review names them by
 * upload id and the server publishes them with it.
 */

const MAX = 3;
const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
// Shoppers' photos are refused above 5 MB (handoff 400).
const RAW_LIMIT = PHOTO_MAX_BYTES;
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

type Photo = { key: string; preview: string; status: "uploading" | "done" | "error"; uploadId?: string; message?: string };

export function useReviewPhotos(workspaceId: string) {
  const { t } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const patch = (key: string, next: Partial<Photo>) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));

  function message(err: unknown): string {
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
        patch(key, { status: "error", message: message(err) });
      }
    })();
  }

  return {
    photos,
    pick,
    remove: (key: string) => setPhotos((list) => list.filter((p) => p.key !== key)),
    reset: () => setPhotos([]),
    ids: photos.filter((p) => p.status === "done" && p.uploadId).map((p) => p.uploadId as string),
    uploading: photos.some((p) => p.status === "uploading"),
    full: photos.length >= MAX,
  };
}

export function ReviewPhotoPicker({
  state,
  text,
}: {
  state: ReturnType<typeof useReviewPhotos>;
  text: { photos: string; addPhoto: string; removePhoto: (n: number) => string; photoAlt: string };
}) {
  const { t } = useStore();
  return (
    <div className="space-y-2">
      <p className={labelClass}>{text.photos}</p>
      {state.photos.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {state.photos.map((photo, i) => (
            <li key={photo.key} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.preview}
                alt={text.photoAlt}
                className={`size-20 rounded-xl border border-line object-cover ${photo.status === "uploading" ? "opacity-60" : ""}`}
              />
              {photo.status !== "uploading" && (
                <button
                  type="button"
                  onClick={() => state.remove(photo.key)}
                  className={`block min-h-11 text-xs font-medium text-ink-soft hover:text-danger ${focusRing}`}
                >
                  {text.removePhoto(i + 1)}
                </button>
              )}
              <p aria-live="polite" className="max-w-20 text-xs empty:hidden">
                {photo.status === "uploading" && <span className="text-ink-soft">{t.custom.uploading}</span>}
                {photo.status === "error" && <span className="font-medium text-danger">{photo.message}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!state.full && (
        <label className={`${btnSecondary} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) state.pick(file);
            }}
          />
          {text.addPhoto}
        </label>
      )}
      <p className="text-xs text-ink-soft">{t.custom.photoHint}</p>
    </div>
  );
}
