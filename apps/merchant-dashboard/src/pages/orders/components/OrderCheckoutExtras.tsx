import { IconImageMissing } from "@/components/icons";
import {
  checkoutBillingAddressModeOf,
  checkoutFieldLabel,
  isCheckoutPhotoField,
  orderBillingAddressOf,
  orderCheckoutFieldsOf,
  type Order,
} from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    billingAddress: "Billing address",
    sameAsShipping: "Same as shipping",
    openPhoto: "Open the photo for “{label}” full size (new tab)",
    photoOf: "Photo for “{label}”",
    missing: "The photo is no longer available.",
    listSep: ", ",
  },
  ar: {
    billingAddress: "عنوان الفاتورة",
    sameAsShipping: "نفس عنوان الشحن",
    openPhoto: "افتح صورة «{label}» بالحجم الكامل (تاب جديدة)",
    photoOf: "صورة «{label}»",
    missing: "الصورة مبقتش متاحة.",
    listSep: "، ",
  },
} satisfies Messages;

/**
 * Under the shipping address on the order page: the billing address the
 * customer gave at checkout (handoff 165). An order without one was billed to
 * the shipping address; that is said only while the store asks for billing
 * addresses, so stores that never do see nothing new.
 */
export function OrderBillingAddress({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const billing = orderBillingAddressOf(order);
  const asked = checkoutBillingAddressModeOf(currentWorkspace?.settings?.checkout_settings) === "on";
  if (!billing && !asked) return null;

  const lines = billing
    ? [billing.addressLine, billing.area, billing.city, billing.province, billing.postalCode, billing.country]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(t.listSep)
    : "";

  return (
    <div>
      <h3 className="mb-1 font-medium text-ink">{t.billingAddress}</h3>
      {billing ? (
        <>
          {billing.fullName && <p className="text-ink-soft">{billing.fullName}</p>}
          {lines && <p className="text-ink-soft">{lines}</p>}
        </>
      ) : (
        <p className="text-ink-soft">{t.sameAsShipping}</p>
      )}
    </div>
  );
}

/**
 * The photos the customer attached to the store's own checkout fields: each
 * under its field's label, as a thumbnail that opens full size. The links are
 * signed by the API and work for a few minutes; reloading the page makes new
 * ones. Text answers stay in the order note, where they always were.
 */
export function OrderCheckoutPhotos({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const photos = orderCheckoutFieldsOf(order).filter((f) => isCheckoutPhotoField({ type: f.type }));
  if (photos.length === 0) return null;

  return (
    <>
      {photos.map((photo) => {
        const label = checkoutFieldLabel(photo.label, locale === "ar" ? "ar" : "en") || photo.key;
        return (
          <div key={photo.key}>
            <h3 className="mb-1 font-medium text-ink">{label}</h3>
            {photo.url ? (
              <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={fmt(t.openPhoto, { label })}
                className="inline-flex min-h-11 items-center gap-2 rounded-[0.375rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <img
                  src={photo.url}
                  alt={fmt(t.photoOf, { label })}
                  className="size-28 rounded-[0.375rem] border border-line object-cover"
                  loading="lazy"
                />
              </a>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                <IconImageMissing className="size-4" aria-hidden />
                {t.missing}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
