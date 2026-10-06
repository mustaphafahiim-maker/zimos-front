import { ImageOff } from "lucide-react";
import { cn } from "@store-builder/ui";
import { customizationPrice, type Customization } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    heading: "Customer's details",
    openPhoto: "Open the photo for “{label}” full size (new tab)",
    photoOf: "Photo for “{label}”",
    missing: "The photo is no longer available.",
    size: "{w}×{h}",
  },
  ar: {
    heading: "بيانات العميل",
    openPhoto: "فتح صورة «{label}» بالحجم الكامل (علامة تبويب جديدة)",
    photoOf: "صورة «{label}»",
    missing: "لم تعد الصورة متاحة.",
    size: "{w}×{h}",
  },
} satisfies Messages;

/**
 * What the customer filled in for a line's custom fields, as the order holds
 * it: each field's label as it was when they ordered (in the dashboard's
 * language when the merchant wrote one), the text as typed, and the photo as
 * a thumbnail that opens full size. Photo links are signed by the API and only
 * work for a few minutes; reloading the page makes fresh ones.
 */
export function CustomizationList({
  customizations,
  compact = false,
  className,
  currency,
}: {
  customizations: Customization[] | null | undefined;
  /** A tighter layout for the confirmation queue's cards. */
  compact?: boolean;
  /** The order's currency: a priced field shows what it added (+20.00). */
  currency?: string;
  className?: string;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  if (!customizations || customizations.length === 0) return null;
  const labelOf = (c: Customization) => (locale === "ar" ? c.label.ar || c.label.en : c.label.en || c.label.ar);

  return (
    <dl className={cn("space-y-2 rounded-[0.5rem] border border-line bg-paper px-3 py-2 text-sm", className)} aria-label={t.heading}>
      {customizations.map((c) => {
        const label = labelOf(c);
        return (
          <div key={c.fieldId} className={compact ? "flex flex-wrap items-start gap-x-2" : "space-y-1"}>
            <dt className="text-xs font-medium text-ink-soft">
              {label}
              {currency && customizationPrice(c) > 0 && <span className="ms-1 text-primary">+{formatMoney(customizationPrice(c), currency)}</span>}
            </dt>
            <dd className="min-w-0 text-ink">
              {c.type === "image" ? (
                c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={fmt(t.openPhoto, { label })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[0.375rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <img
                      src={c.url}
                      alt={fmt(t.photoOf, { label })}
                      className={cn("rounded-[0.375rem] border border-line object-cover", compact ? "size-16" : "size-28")}
                      loading="lazy"
                    />
                    {c.width && c.height ? (
                      <span className="text-xs text-ink-soft" dir="ltr">
                        {fmt(t.size, { w: c.width, h: c.height })}
                      </span>
                    ) : null}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                    <ImageOff className="size-4" aria-hidden />
                    {t.missing}
                  </span>
                )
              ) : (
                <span dir="auto" className="whitespace-pre-line break-words">
                  {c.value}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
