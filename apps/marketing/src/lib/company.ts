/**
 * Real business details for ZIMOS — fill these in ONCE, here.
 *
 * Every page that needs a legal name, address, contact channel or date reads
 * from this file. Values wrapped in [square brackets] are placeholders and are
 * rendered visibly as such until replaced. Do not invent values: use the
 * details from the company's registration documents.
 */
export const COMPANY = {
  /** Public brand name (already final). */
  brandName: "ZIMOS",
  /** Registered legal entity name, e.g. as on the commercial register. */
  legalName: "[Company legal name]",
  /** Commercial registration / company number. */
  registrationNumber: "[Commercial registration number]",
  /** Registered office address. */
  address: "[Registered office address]",
  /** Governing law and courts for the legal documents. */
  jurisdiction: "[Governing law and jurisdiction]",
  /** Inbox for customer support — the contact form opens a mail to this. */
  supportEmail: "[support email]",
  /** Inbox for privacy and data-protection requests. */
  privacyEmail: "[privacy email]",
  /** Inbox for legal notices. */
  legalEmail: "[legal email]",
  /** Support phone number, shown in the legal documents. */
  phone: "[support phone number]",
  /**
   * WhatsApp number in international format, digits only (e.g. country code +
   * number, no "+" or spaces). Leave EMPTY to hide the WhatsApp link.
   */
  whatsappNumber: "",
  /** "Last updated" date shown on the legal documents. */
  legalLastUpdated: "[Last updated date]",
  /** Refund window stated in the refund policy, e.g. "14 days". */
  refundWindow: "[refund window]",
} as const;

/** True for values still wrapped in [brackets]. */
export function isPlaceholder(value: string): boolean {
  return /^\[.*\]$/.test(value.trim());
}

/** `https://wa.me/<number>` or null when no WhatsApp number is configured. */
export function whatsappUrl(): string | null {
  const digits = COMPANY.whatsappNumber.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
