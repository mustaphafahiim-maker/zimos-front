/**
 * The customer's number when it is whole. Most roles are sent it masked
 * (010****665): that is not a number to dial, message or copy, so every
 * action on it is offered only when this returns the number.
 */
export function dialablePhone(phone: string | null | undefined): string | null {
  const value = phone?.trim();
  if (!value) return null;
  if (/[*•×xX]/.test(value)) return null;
  return value.replace(/[^\d٠-٩۰-۹]/g, "").length >= 7 ? value : null;
}

/** `tel:` for a number: Arabic-Indic digits folded, spaces and dashes dropped. */
export function orderTelHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}
