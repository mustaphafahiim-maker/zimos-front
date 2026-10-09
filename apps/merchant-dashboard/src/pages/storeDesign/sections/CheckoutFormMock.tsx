import { IconCaretDown, IconCash, IconCourier, IconImageAdd, IconReturns } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { CheckoutFormFieldWithFile, CheckoutFormWithBilling } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "A picture of your order form",
    caption: "How the form looks with these settings",
    inline: "On the product page",
    oneStep: "On the checkout page",
    heading: "Order now",
    required: "required",
    choose: "Choose…",
    upload: "Add a photo",
    discount: "Discount code",
    apply: "Apply",
    billing: "The invoice goes to the same address",
    cod: "Cash on delivery",
    delivery: "Fast delivery",
    returns: "Easy returns",
    submit: "Confirm the order",
    empty: "No field is shown yet.",
    count: "{n} fields to fill in",
  },
  ar: {
    label: "صورة لفورم الطلب بتاعك",
    caption: "شكل الفورم بالإعدادات دي",
    inline: "في صفحة المنتج",
    oneStep: "في صفحة الدفع",
    heading: "اطلب دلوقتي",
    required: "مطلوب",
    choose: "اختار…",
    upload: "ضيف صورة",
    discount: "كود الخصم",
    apply: "طبّق",
    billing: "الفاتورة على نفس العنوان",
    cod: "الدفع عند الاستلام",
    delivery: "توصيل سريع",
    returns: "استرجاع سهل",
    submit: "أكّد الأوردر",
    empty: "لسه مفيش حقل ظاهر.",
    count: "{n} حقول هتتملي",
  },
} satisfies Messages;

/** How a field is drawn: a line, a box of lines, a list to pick from, or a photo. */
type Shape = "line" | "area" | "pick" | "photo";

function shapeOf(field: CheckoutFormFieldWithFile): Shape {
  if (field.custom) return field.type === "choice" ? "pick" : field.type === "file" ? "photo" : "line";
  if (field.key === "address" || field.key === "note" || field.key === "sa_national_address") return "area";
  if (field.key === "country" || field.key === "government" || field.key === "city") return "pick";
  return "line";
}

/** A choice field without choices is not shown in the store (the form says so): the picture leaves it out too. */
function isShown(field: CheckoutFormFieldWithFile): boolean {
  if (!field.enabled) return false;
  if (field.custom && field.type === "choice") return (field.options ?? []).some((option) => option.trim() !== "");
  return true;
}

/**
 * A small still picture of the order form, built from the settings as they
 * stand in the editor (saved or not): the fields that are on, in their order,
 * with their names, the star on what is required, and the parts the options
 * add — the discount box, the invoice line, the trust badges. Not the store
 * itself and nothing in it can be pressed: it is there so a change to the list
 * is seen at once.
 */
export function CheckoutFormMock({
  form,
  nameOf,
  className,
}: {
  form: CheckoutFormWithBilling;
  /** The field's name as the shopper reads it (the merchant's label, or the store's built-in one). */
  nameOf: (field: CheckoutFormFieldWithFile) => string;
  className?: string;
}) {
  const t = useT(STRINGS);
  const fields = form.fields.filter(isShown);

  return (
    <figure aria-label={t.label} className={cn("min-w-0", className)}>
      <figcaption className="mb-2 px-1 text-[13px] leading-5 text-ink-soft">
        <span className="block font-semibold">{t.caption}</span>
        <span className="block">
          {form.layout === "inline_on_product" ? t.inline : t.oneStep} · {fmt(t.count, { n: fields.length })}
        </span>
      </figcaption>
      {/* Everything inside is a drawing: hidden from assistive tech, never focusable. */}
      <div
        aria-hidden
        className="pointer-events-none rounded-[1.25rem] bg-paper-raised p-3 shadow-[var(--shadow-card)] ring-1 ring-line select-none"
      >
        <p className="mb-2.5 text-center text-sm font-semibold text-ink">{t.heading}</p>
        {fields.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-soft">{t.empty}</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => {
              const shape = shapeOf(field);
              return (
                <div key={field.key}>
                  <p className="mb-1 flex items-center gap-1 text-[11px] leading-4 font-medium text-ink">
                    <span className="truncate" dir="auto">
                      {nameOf(field)}
                    </span>
                    {field.required && <span className="text-danger">*</span>}
                  </p>
                  {shape === "photo" ? (
                    <div className="flex h-12 items-center justify-center gap-1.5 rounded-[0.625rem] border border-dashed border-line-strong text-[11px] text-ink-soft">
                      <IconImageAdd className="size-4" />
                      {t.upload}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-[0.625rem] border border-line-strong bg-paper px-2 text-[11px] text-ink-soft",
                        shape === "area" ? "h-12 items-start pt-1.5" : "h-8"
                      )}
                    >
                      <span>{shape === "pick" ? t.choose : ""}</span>
                      {shape === "pick" && <IconCaretDown className="size-3" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {form.billing_address === "on" && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] leading-4 text-ink">
            <span className="inline-block size-3.5 shrink-0 rounded-[4px] border-2 border-primary bg-primary" />
            {t.billing}
          </p>
        )}

        {form.allow_discount_codes && (
          <div className="mt-2.5 flex gap-1.5">
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-[0.625rem] border border-line-strong bg-paper px-2 text-[11px] text-ink-soft">
              {t.discount}
            </div>
            <span className="inline-flex h-8 shrink-0 items-center rounded-[0.625rem] px-2.5 text-[11px] font-semibold text-primary ring-1 ring-primary/40">
              {t.apply}
            </span>
          </div>
        )}

        <div className="mt-3 flex h-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {t.submit}
        </div>

        {form.show_trust_badges && (
          <div className="mt-2.5 grid grid-cols-3 gap-1 text-center text-[10px] leading-3.5 text-ink-soft">
            <span className="flex flex-col items-center gap-1">
              <IconCash className="size-4 text-primary" />
              {t.cod}
            </span>
            <span className="flex flex-col items-center gap-1">
              <IconCourier className="size-4 text-primary" />
              {t.delivery}
            </span>
            <span className="flex flex-col items-center gap-1">
              <IconReturns className="size-4 text-primary" />
              {t.returns}
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}
