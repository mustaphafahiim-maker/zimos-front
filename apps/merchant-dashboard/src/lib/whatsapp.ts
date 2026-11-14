import { formatMoney } from "@/lib/format";

/**
 * A click-to-chat link for confirming an order over WhatsApp: the customer's
 * number in international form and a ready message, opened in WhatsApp by the
 * agent. Nothing is sent by us — no WhatsApp Business API, no provider — the
 * agent reads the reply and records the outcome as usual.
 */

/** Placeholders a store's message may use; the dashboard fills them in. */
export const WHATSAPP_PLACEHOLDERS = ["store", "orderNumber", "items", "total", "customerName"] as const;
export type WhatsAppPlaceholder = (typeof WHATSAPP_PLACEHOLDERS)[number];

/** Longest message the store settings accept (the backend refuses more). */
export const WHATSAPP_TEMPLATE_MAX = 1000;

/**
 * The message a store gets until it writes its own. Written to the shopper, so
 * in the storefront's everyday Egyptian register rather than the dashboard's.
 */
export const DEFAULT_WHATSAPP_TEMPLATE =
  "أهلاً {customerName}، معاك فريق {store}.\n" +
  "بنأكد معاك طلبك رقم {orderNumber}:\n" +
  "{items}\n" +
  "الإجمالي: {total} (الدفع عند الاستلام).\n" +
  "ممكن تأكد لنا الطلب عشان نشحنه لك؟";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_DIGITS.indexOf(d);
    return String(i >= 0 ? i : PERSIAN_DIGITS.indexOf(d));
  });
}

/**
 * The number as wa.me wants it: digits only, country code first, no "+".
 * Egyptian numbers are the norm here — "01012345678", "010 1234 5678",
 * "+20 10 1234 5678", "0020101…" and "20101…" all become "201012345678".
 * Anything else already in international form (7–15 digits) passes as is;
 * null when there is nothing usable to dial.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = asciiDigits(phone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;

  // Egyptian mobile: 01X + 8 digits locally, 20 1X + 8 digits internationally.
  if (/^01[0125]\d{8}$/.test(digits)) return `20${digits.slice(1)}`;
  if (/^1[0125]\d{8}$/.test(digits)) return `20${digits}`;
  if (/^2001[0125]\d{8}$/.test(digits)) return `20${digits.slice(3)}`;
  if (/^201[0125]\d{8}$/.test(digits)) return digits;

  // A local number from elsewhere (leading 0) cannot be placed in a country.
  if (digits.startsWith("0")) return null;
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Fills {placeholders}; unknown ones are left as written so a typo shows. */
export function fillWhatsAppTemplate(template: string, values: Record<WhatsAppPlaceholder, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    (WHATSAPP_PLACEHOLDERS as readonly string[]).includes(key) ? values[key as WhatsAppPlaceholder] : whole
  );
}

export interface WhatsAppOrder {
  orderNumber: string;
  totalAmount: string | number;
  currency: string;
  contactSnapshot: { fullName?: string | null; phone?: string | null };
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    variantOptionsSnapshot?: Record<string, string> | null;
    offerNameSnapshot?: string | null;
  }>;
}

/** One line per item: "2 × Mug (Red, L)". */
export function whatsAppItemsText(items: WhatsAppOrder["items"]): string {
  return items
    .map((item) => {
      const options = item.variantOptionsSnapshot ? Object.values(item.variantOptionsSnapshot).filter(Boolean) : [];
      const name = item.offerNameSnapshot || item.productNameSnapshot;
      return `${item.quantity} × ${name}${options.length > 0 ? ` (${options.join("، ")})` : ""}`;
    })
    .join("\n");
}

/**
 * The wa.me link for one order, or null when the customer has no usable
 * number. `template` is the store's own message (settings), or the default.
 */
export function whatsAppConfirmUrl(order: WhatsAppOrder, storeName: string, template?: string | null): string | null {
  const number = toWhatsAppNumber(order.contactSnapshot.phone);
  if (!number) return null;
  const text = fillWhatsAppTemplate(template?.trim() ? template : DEFAULT_WHATSAPP_TEMPLATE, {
    store: storeName,
    orderNumber: order.orderNumber,
    items: whatsAppItemsText(order.items),
    // Always in Arabic numerals-and-currency form: the message is Arabic.
    total: formatMoney(order.totalAmount, order.currency, "ar-EG"),
    customerName: order.contactSnapshot.fullName?.trim() || "",
  });
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
