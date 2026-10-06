import {
  ApiError,
  apiFieldProblems,
  isApiErrorCode,
  type ApiClient,
  type CheckoutPayload,
  type CustomizationInput,
  type Order,
} from "@store-builder/api-client";
import { botGuardFields } from "./botGuard";
import { isExpiredPhotoProblem } from "./checkoutPhoto";
import { adMatchFields } from "./adMatch";
import { clearPageTags, pageTagFields } from "./pageTags";
import { withCheckoutOtp } from "./checkoutOtp";
import { saveOrderSnapshot, snapshotFromOrder } from "./commerce";
import type { Dictionary, Locale } from "./i18n";
import type { OrderFormErrors, OrderFormField } from "./orderForm";
import { storeHref } from "./storeHref";

export interface OrderLine {
  variantId: string;
  offerId?: string;
  quantity: number;
  /** Answers to the product's custom fields (photos by upload id). */
  customizations?: CustomizationInput;
}

/**
 * Places a COD order through the real storefront checkout (which attaches a
 * fresh Idempotency-Key per request).
 *
 *  - `cartToken`  → order from the shopper's cart (the /checkout page).
 *  - no token     → Buy Now: `payload.item` is the single line.
 *
 * A ticked order bump rides along as `payload.orderBump` either way: the
 * server adds it to the same order from the merchant's offer.
 */
export async function placeCodOrder({
  client,
  workspaceId,
  payload,
  cartToken,
  visitorId,
}: {
  client: ApiClient;
  workspaceId: string;
  payload: CheckoutPayload;
  cartToken?: string;
  /** The shopper's visitor id — it owns any photo answering a custom field. */
  visitorId?: string;
}): Promise<Order> {
  // The bot guard's token and honeypot ride along with every order (lib/botGuard).
  // The website page buttons / forms this shopper used tag them once the order is in (lib/pageTags).
  const guarded = { ...payload, ...(await botGuardFields(client, workspaceId)), ...adMatchFields(workspaceId), ...pageTagFields(workspaceId) };
  // A store that verifies phones answers OTP_REQUIRED first; the code is asked for and the order sent again.
  const order = await withCheckoutOtp(workspaceId, payload.contact.phone, (otp) =>
    client.checkout(workspaceId, { ...guarded, ...otp }, cartToken, { visitorId })
  );
  clearPageTags(workspaceId);
  return order;
}

/**
 * The ticked order bump was refused: it sold out or was withdrawn a moment
 * ago (ORDER_BUMP_UNAVAILABLE), or the merchant changed it since this page
 * loaded (ORDER_BUMP_INVALID). Either way the form unticks it and says so.
 */
export function isOrderBumpRefused(err: unknown): boolean {
  return isApiErrorCode(err, "ORDER_BUMP_UNAVAILABLE") || isApiErrorCode(err, "ORDER_BUMP_INVALID");
}

/**
 * Remember the order on this device (thank-you + tracking) and return its
 * thank-you URL, resolved against how this store is being served — `basePath`
 * comes from `useStoreBasePath()`, and is empty on the store's own subdomain.
 */
export function afterOrder({
  workspaceId,
  basePath,
  order,
  phone,
}: {
  workspaceId: string;
  basePath: string;
  order: Order;
  phone: string;
}): string {
  saveOrderSnapshot(workspaceId, snapshotFromOrder(order, phone));
  const q = new URLSearchParams({ number: order.orderNumber });
  return storeHref(basePath, `/orders/${order.id}?${q.toString()}`);
}

type OrderErrorCopy = Dictionary["form"]["errors"];

/** The request fields a checkout 422 can name, mapped onto the form's fields. */
const SERVER_FIELDS: Record<string, OrderFormField> = {
  "contact.fullName": "fullName",
  "contact.phone": "phone",
  "contact.alternatePhone": "altPhone",
  "contact.email": "email",
  "shippingAddress.province": "governorate",
  "shippingAddress.city": "city",
  "shippingAddress.addressLine": "address",
  "shippingAddress.postalCode": "postalCode",
  "shippingAddress.notes": "notes",
  "shippingAddress.country": "country",
  // The place picked from the store's own list (lib/useStorePlaces): shown under the pickers.
  "shippingAddress.placeId": "governorate",
  "shippingAddress.area": "city",
  "formFields.sa_national_address": "nationalAddress",
  "formFields.custom_1": "custom1",
  "formFields.custom_2": "custom2",
  "formFields.custom_3": "custom3",
  "formFields.custom_4": "custom4",
  "formFields.custom_5": "custom5",
};

/**
 * Field errors the server reported (e.g. a field the merchant made required
 * after this page loaded), in the shopper's language rather than Joi's.
 */
export function serverFieldErrors(err: unknown, copy: OrderErrorCopy): OrderFormErrors {
  const out: OrderFormErrors = {};
  if (isApiErrorCode(err, "INVALID_PHONE")) out.phone = copy.phone;
  // A place the store hid after this page loaded (a governorate, or a region / city / area of its own list).
  if (isApiErrorCode(err, "SHIPPING_PLACE_UNAVAILABLE")) out.governorate = copy.placeUnavailable;
  for (const problem of apiFieldProblems(err)) {
    const field = SERVER_FIELDS[problem.field];
    if (!field || out[field]) continue;
    out[field] =
      field === "email" && /required/i.test(problem.message)
        ? copy.emailRequired
        : problem.field.startsWith("formFields.custom_") && isExpiredPhotoProblem(problem.message)
          ? copy.photoExpired
          : problem.field === "shippingAddress.placeId"
            ? copy.placeUnknown
            : ((copy as Record<string, unknown>)[field] as string | undefined) ?? copy.required;
  }
  return out;
}

/**
 * The picked place was refused: hidden since the list was read
 * (SHIPPING_PLACE_UNAVAILABLE) or no longer on it — the list is read again.
 */
export function isPlaceRefused(err: unknown): boolean {
  return (
    isApiErrorCode(err, "SHIPPING_PLACE_UNAVAILABLE") ||
    apiFieldProblems(err).some((p) => p.field === "shippingAddress.placeId")
  );
}

/** The codes the shopper's own words cover, by the sentence they get (U-03). */
const ORDER_ERROR_COPY: Array<[keyof OrderErrorCopy, readonly string[]]> = [
  ["placeUnavailable", ["SHIPPING_PLACE_UNAVAILABLE"]],
  ["stock", ["INSUFFICIENT_STOCK", "OUT_OF_STOCK", "PRODUCT_NOT_FOUND", "VARIANT_NOT_FOUND", "PRODUCT_UNAVAILABLE"]],
  ["tooMany", ["RATE_LIMITED", "TOO_MANY_ATTEMPTS", "TOO_MANY_REQUESTS"]],
  ["minOrder", ["MIN_ORDER_NOT_MET"]],
  ["storeClosed", ["STORE_UNAVAILABLE"]],
  ["paymentMethod", ["PAYMENT_METHOD_UNAVAILABLE"]],
];

/** Whether a failed order was about its discount code (INVALID_DISCOUNT_CODE, DISCOUNT_*): the checkout says so beside the code too. */
export function isDiscountRefused(err: unknown): boolean {
  const code = err instanceof ApiError ? err.code : undefined;
  return Boolean(code && (code === "INVALID_DISCOUNT_CODE" || code.startsWith("DISCOUNT_")));
}

/**
 * The banner for a failed order. A refused order (ORDER_REJECTED) always gets
 * the same polite, generic copy: the reason is the merchant's business, and
 * naming it would tell a fraudster which rule to dodge.
 *
 * Known codes get the store's own sentence. Anything else shows the server's
 * message, which the API words in the shopper's language for the codes it
 * knows (X-Store-Locale; the English original then rides along as
 * `messageEn`) — but an untranslated (English) message is never shown on an
 * Arabic or French page: the generic sentence is, in their language.
 */
export function orderErrorMessage(err: unknown, copy: OrderErrorCopy, locale?: Locale): string {
  if (isApiErrorCode(err, "ORDER_REJECTED")) return copy.rejected;
  // A custom-field answer that no longer holds (a photo past its 48 hours, a field the merchant changed).
  if (isApiErrorCode(err, "CUSTOM_FIELDS_INVALID")) return copy.customFields;
  if (isOrderBumpRefused(err)) return copy.bumpUnavailable;
  if (isDiscountRefused(err)) return copy.discount;
  const code = err instanceof ApiError ? err.code : undefined;
  const known = code ? ORDER_ERROR_COPY.find(([, codes]) => codes.includes(code)) : undefined;
  if (known) return copy[known[0]] as string;
  if (err instanceof ApiError && err.message) {
    const translated = typeof (err.details as { error?: { messageEn?: unknown } } | null)?.error?.messageEn === "string";
    return !locale || locale === "en" || translated ? err.message : copy.generic;
  }
  // Our own errors carry the shopper's words already (a cancelled phone check, lib/checkoutOtp).
  if (err instanceof Error && err.message && !/fetch/i.test(err.message)) return err.message;
  return copy.generic;
}
