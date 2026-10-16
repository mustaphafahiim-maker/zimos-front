/**
 * A product's custom fields on the product page: the rules the form checks
 * before anything is sent, mirroring the backend (catalog/customFields.js),
 * which checks them again and is the one that counts. Pure, so it is tested
 * on its own (customFields.test.mjs).
 */
import type { CustomField, CustomizationInput } from "@store-builder/api-client";

export type FieldProblem = "required" | "tooLong" | "uploading" | "expired" | "invalid";

const LIMITS = { text: { default: 100, max: 200 }, textarea: { default: 500, max: 2000 } } as const;

/** The label in the store's language, falling back to the other one. */
export function fieldLabel(field: CustomField, locale: "ar" | "en"): string {
  const ar = field.label?.ar?.trim() ?? "";
  const en = field.label?.en?.trim() ?? "";
  return locale === "ar" ? ar || en : en || ar;
}

export function fieldPlaceholder(field: CustomField, locale: "ar" | "en"): string | undefined {
  const ar = field.placeholder?.ar?.trim() ?? "";
  const en = field.placeholder?.en?.trim() ?? "";
  return (locale === "ar" ? ar || en : en || ar) || undefined;
}

/** The longest answer a text field takes. */
export function fieldLimit(field: CustomField): number {
  if (field.type === "image") return 0;
  const limits = LIMITS[field.type];
  return Math.min(field.maxLength || limits.default, limits.max);
}

/** Characters as the shopper sees them (an emoji is one). */
export function charCount(value: string): number {
  return [...value].length;
}

/**
 * What is wrong with the answers, per field id. `uploading` lists photo fields
 * whose upload is still on its way.
 */
export function validateAnswers(
  fields: CustomField[],
  answers: Record<string, string>,
  uploading: ReadonlySet<string> = new Set()
): Record<string, FieldProblem> {
  const out: Record<string, FieldProblem> = {};
  for (const field of fields) {
    if (field.type === "image" && uploading.has(field.id)) {
      out[field.id] = "uploading";
      continue;
    }
    const value = (answers[field.id] ?? "").trim();
    if (!value) {
      if (field.required) out[field.id] = "required";
      continue;
    }
    if (field.type !== "image" && charCount(value) > fieldLimit(field)) out[field.id] = "tooLong";
  }
  return out;
}

/** The answers as the API takes them: trimmed, empty ones left out. */
export function answersToInput(fields: CustomField[], answers: Record<string, string>): CustomizationInput | undefined {
  const out: CustomizationInput = {};
  for (const field of fields) {
    const value = (answers[field.id] ?? "").trim();
    if (value) out[field.id] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A 422 CUSTOM_FIELDS_INVALID's details, per field id. */
export function serverFieldProblems(details: unknown): Record<string, FieldProblem> {
  const out: Record<string, FieldProblem> = {};
  if (!Array.isArray(details)) return out;
  for (const d of details as Array<{ field?: string; code?: string }>) {
    const match = /^customizations\.(.+)$/.exec(d?.field ?? "");
    if (!match) continue;
    out[match[1]] =
      d.code === "REQUIRED" ? "required" : d.code === "TOO_LONG" ? "tooLong" : d.code === "UPLOAD_INVALID" ? "expired" : "invalid";
  }
  return out;
}
