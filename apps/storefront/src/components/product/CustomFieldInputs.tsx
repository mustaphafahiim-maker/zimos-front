"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorCode, apiErrorDetails, type CustomField, type CustomizationInput } from "@store-builder/api-client";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { focusField } from "@/lib/focusField";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import {
  answersToInput,
  charCount,
  fieldLabel,
  fieldLimit,
  fieldPlaceholder,
  serverFieldProblems,
  validateAnswers,
  type FieldProblem,
} from "@/lib/customFields";
import { btnSecondary, focusRing, input as inputClass, label as labelClass } from "../ui";

/**
 * The product's custom fields on its page: what the shopper types or the photo
 * they attach, answered before "Order now" or "Add to cart". Photos are shrunk
 * in the browser when that helps (the shared image-tools), previewed from the
 * device, and uploaded at once; the answer is the upload's id. The form checks
 * the obvious here, and the server checks everything again.
 */

const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const RAW_LIMIT = 15 * 1024 * 1024;
// What the browser aims for before sending; the server re-encodes to ≤ 5 MB anyway.
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

type PhotoState = { status: "uploading" | "done" | "error"; preview: string; message?: string };

export interface CustomFieldAnswers {
  fields: CustomField[];
  answers: Record<string, string>;
  photos: Record<string, PhotoState>;
  problems: Record<string, FieldProblem>;
  setText: (fieldId: string, value: string) => void;
  pickPhoto: (field: CustomField, file: File) => void;
  removePhoto: (fieldId: string) => void;
  /** Checks the answers, shows what is wrong and focuses it; true when fine. */
  check: () => boolean;
  /** Shows the problems a 422 CUSTOM_FIELDS_INVALID named; true when it named any. */
  showServerProblems: (err: unknown) => boolean;
  /** The answers to send, or undefined when none. */
  toInput: () => CustomizationInput | undefined;
  idFor: (fieldId: string) => string;
}

export function useCustomFieldAnswers(workspaceId: string, productId: string, fields: CustomField[] | undefined): CustomFieldAnswers {
  const { t } = useStore();
  const list = useMemo(() => fields ?? [], [fields]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [problems, setProblems] = useState<Record<string, FieldProblem>>({});
  const previews = useRef<string[]>([]);
  const [client] = useState(() => createStorefrontApiClient());

  useEffect(
    () => () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
    },
    []
  );

  const idFor = useCallback((fieldId: string) => `cf-${productId}-${fieldId}`, [productId]);

  const clearProblem = (fieldId: string) =>
    setProblems((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });

  const setText = (fieldId: string, value: string) => {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    clearProblem(fieldId);
  };

  function uploadMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 413) return t.custom.tooLarge;
      if (err.status === 415) return t.custom.wrongType;
      if (err.status === 422) return t.custom.unreadable;
      if (err.status === 429) return apiErrorCode(err) === "TOO_MANY_PENDING_UPLOADS" ? t.custom.tooMany : t.custom.rateLimited;
    }
    return t.custom.failed;
  }

  const pickPhoto = (field: CustomField, file: File) => {
    const fieldId = field.id;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    setAnswers((current) => ({ ...current, [fieldId]: "" }));
    clearProblem(fieldId);
    const typeOk = ACCEPTED.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!typeOk) {
      setPhotos((current) => ({ ...current, [fieldId]: { status: "error", preview, message: t.custom.wrongType } }));
      return;
    }
    setPhotos((current) => ({ ...current, [fieldId]: { status: "uploading", preview } }));
    void (async () => {
      try {
        const prepared = await compressImageIfNeeded(file, COMPRESS);
        if (prepared.size > RAW_LIMIT) throw new ApiError("too large", 413, "FILE_TOO_LARGE", null);
        const upload = await client.uploadCustomerPhoto(workspaceId, prepared, {
          visitorId: getVisitorId(workspaceId),
          productId,
        });
        setAnswers((current) => ({ ...current, [fieldId]: upload.uploadId }));
        setPhotos((current) =>
          current[fieldId]?.preview === preview ? { ...current, [fieldId]: { status: "done", preview } } : current
        );
      } catch (err) {
        setPhotos((current) =>
          current[fieldId]?.preview === preview
            ? { ...current, [fieldId]: { status: "error", preview, message: uploadMessage(err) } }
            : current
        );
      }
    })();
  };

  const removePhoto = (fieldId: string) => {
    setAnswers((current) => ({ ...current, [fieldId]: "" }));
    setPhotos((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const check = () => {
    const uploading = new Set(Object.entries(photos).filter(([, p]) => p.status === "uploading").map(([id]) => id));
    const found = validateAnswers(list, answers, uploading);
    setProblems(found);
    const first = list.find((f) => found[f.id]);
    if (first) {
      focusField(idFor(first.id));
      return false;
    }
    return true;
  };

  const showServerProblems = (err: unknown) => {
    if (apiErrorCode(err) !== "CUSTOM_FIELDS_INVALID") return false;
    const found = serverFieldProblems(apiErrorDetails(err));
    // An expired photo has to be picked again.
    for (const [fieldId, problem] of Object.entries(found)) if (problem === "expired") removePhoto(fieldId);
    setProblems(found);
    const first = list.find((f) => found[f.id]);
    if (first) focusField(idFor(first.id));
    return Object.keys(found).length > 0;
  };

  return {
    fields: list,
    answers,
    photos,
    problems,
    setText,
    pickPhoto,
    removePhoto,
    check,
    showServerProblems,
    toInput: () => answersToInput(list, answers),
    idFor,
  };
}

export function CustomFieldInputs({ state }: { state: CustomFieldAnswers }) {
  const { t, locale } = useStore();
  if (state.fields.length === 0) return null;

  const problemText = (field: CustomField, problem: FieldProblem | undefined) => {
    if (!problem) return null;
    if (problem === "required") return t.custom.required;
    if (problem === "tooLong") return t.custom.tooLong(fieldLimit(field));
    if (problem === "uploading") return t.custom.waitUpload;
    if (problem === "expired") return t.custom.expired;
    return t.custom.failed;
  };

  return (
    <div className="space-y-4">
      {state.fields.map((field) => {
        const id = state.idFor(field.id);
        const label = fieldLabel(field, locale);
        const problem = problemText(field, state.problems[field.id]);
        const errorId = `${id}-error`;
        const hintId = `${id}-hint`;
        const heading = (
          <>
            {label}
            {field.required ? (
              <span className="text-danger" aria-hidden>
                {" "}
                *
              </span>
            ) : (
              <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
            )}
          </>
        );

        if (field.type === "image") {
          const photo = state.photos[field.id];
          return (
            <div key={field.id} className="space-y-2">
              <p id={`${id}-label`} className={labelClass}>
                {heading}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {photo && (
                  // Previewed from the device; the upload is the server's re-encoded copy.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.preview}
                    alt={t.custom.photoPreview(label)}
                    className={`size-20 rounded-xl border border-line object-cover ${photo.status === "uploading" ? "opacity-60" : ""}`}
                  />
                )}
                <label className={`${btnSecondary} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
                  <input
                    id={id}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    aria-labelledby={`${id}-label`}
                    aria-describedby={`${hintId}${problem ? ` ${errorId}` : ""}`}
                    aria-invalid={problem ? true : undefined}
                    aria-required={field.required || undefined}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) state.pickPhoto(field, file);
                    }}
                  />
                  {photo ? t.custom.replacePhoto : t.custom.choosePhoto}
                </label>
                {photo && photo.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => state.removePhoto(field.id)}
                    className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-soft hover:text-danger ${focusRing}`}
                  >
                    {t.custom.removePhoto}
                  </button>
                )}
              </div>
              <p id={hintId} className="text-xs text-ink-soft">
                {t.custom.photoHint}
              </p>
              <p aria-live="polite" className="text-sm empty:hidden">
                {photo?.status === "uploading" && <span className="text-ink-soft">{t.custom.uploading}</span>}
                {photo?.status === "done" && <span className="font-medium text-success">{t.custom.uploaded}</span>}
                {photo?.status === "error" && <span className="font-medium text-danger">{photo.message}</span>}
              </p>
              {problem && (
                <p id={errorId} className="text-sm font-medium text-danger">
                  {problem}
                </p>
              )}
            </div>
          );
        }

        const value = state.answers[field.id] ?? "";
        const limit = fieldLimit(field);
        const common = {
          id,
          value,
          dir: "auto" as const,
          placeholder: fieldPlaceholder(field, locale),
          "aria-invalid": problem ? true : undefined,
          "aria-required": field.required || undefined,
          "aria-describedby": `${hintId}${problem ? ` ${errorId}` : ""}`,
          className: inputClass,
        };
        return (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={id} className={labelClass}>
              {heading}
            </label>
            {field.type === "textarea" ? (
              <textarea {...common} rows={3} onChange={(e) => state.setText(field.id, e.target.value)} />
            ) : (
              <input {...common} type="text" onChange={(e) => state.setText(field.id, e.target.value)} />
            )}
            <p id={hintId} className={`text-end text-xs ${charCount(value) > limit ? "font-medium text-danger" : "text-ink-soft"}`}>
              {t.custom.counter(charCount(value), limit)}
            </p>
            {problem && (
              <p id={errorId} className="text-sm font-medium text-danger">
                {problem}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
