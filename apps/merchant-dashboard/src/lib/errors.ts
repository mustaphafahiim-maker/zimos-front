import { ApiError } from "@store-builder/api-client";
import { getLocale } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";

export { ApiError };

interface FieldDetail {
  field: string;
  message: string;
}

/**
 * A human message for any thrown value, in the dashboard's language. Same
 * sentences as `useErrorMessage` (lib/errorMessages.ts); `fallback` is only
 * used for something that is not an error at all.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
  if (fallback && !(err instanceof Error)) return fallback;
  return errorMessageNow(err);
}

const FIELD_COPY = {
  en: { sku: "That SKU is already used by another variant.", field: "Check this field." },
  ar: { sku: "الكود (SKU) ده مستخدم في نوع تاني.", field: "راجع الخانة دي." },
};
const ARABIC_LETTER = /[\u0600-\u06FF]/;

/**
 * Field-level validation errors from a 422, keyed by field name. The backend
 * envelope is { error: { code, details: [{ field, message }] } } and ApiError
 * stores the whole body in `.details`. A duplicate-SKU 409 is mapped onto `sku`.
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};

  if (err.code === "DUPLICATE_RESOURCE") {
    return { sku: FIELD_COPY[getLocale()].sku };
  }

  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return {};

  const out: Record<string, string> = {};
  for (const d of details as FieldDetail[]) {
    if (d && typeof d.field === "string" && !out[d.field]) {
      // Joi paths like "lines.0.variantId" — key on the leaf and the head.
      // The server words field errors in English; the Arabic dashboard says it plainly instead.
      const message = getLocale() === "ar" && !ARABIC_LETTER.test(d.message) ? FIELD_COPY.ar.field : d.message;
      out[d.field] = message;
      const head = d.field.split(".")[0];
      if (head && !out[head]) out[head] = message;
    }
  }
  return out;
}

export function isPermissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
