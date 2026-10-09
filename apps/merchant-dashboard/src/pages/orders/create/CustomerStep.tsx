import { Input, cn } from "@store-builder/ui";
import { IconCheck, IconSpinner } from "@/components/icons";
import { Field, TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { asciiDigits } from "@/lib/wholeNumber";
import { CREATE_STRINGS } from "./strings";
import { checkEgyptianMobile } from "./model";
import type { CreateOrder } from "./useCreateOrder";

/**
 * Step 1 — «العميل». The phone comes first: it is checked as it is typed (an
 * Egyptian mobile, however it is written), and once it is whole the store's
 * own record of that number answers — the name is filled in and their history
 * shows as a chip. Then the name, and an email if there is one.
 */
export function CustomerStep({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  const { form, fieldErrors } = ctl;
  const check = checkEgyptianMobile(form.phone);
  // Said while typing only once the number can no longer become a mobile; the button says the rest.
  const phoneError = fieldErrors.phone ?? (check === "invalid" ? fmt(t.phoneInvalid, { digits: 11, prefix: "01" }) : undefined);

  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label={t.phone} required error={phoneError}>
          {({ id, ...aria }) => (
            // The number reads left to right in either language, so its tick sits at its right-hand end.
            <div dir="ltr" className="relative">
              <Input
                id={id}
                {...aria}
                name="phone"
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
                autoComplete="off"
                dir="ltr"
                placeholder={t.phoneSample}
                value={form.phone}
                onChange={(e) => ctl.edit("phone", asciiDigits(e.target.value))}
                onBlur={ctl.lookupNow}
                className={cn(
                  "h-12 pe-11 text-lg font-medium tracking-wide tabular-nums placeholder:font-normal placeholder:tracking-normal md:text-lg",
                  phoneError && "border-danger focus-visible:ring-danger/30"
                )}
              />
              {check === "valid" && !fieldErrors.phone && (
                <span
                  role="img"
                  aria-label={t.phoneOk}
                  data-slot="order-phone-ok"
                  className="pointer-events-none absolute inset-y-0 end-3 my-auto flex size-6 items-center justify-center rounded-full bg-success-soft text-success motion-safe:animate-[order-create-pop_var(--dur-pop)_var(--ease-pop)_both]"
                >
                  <IconCheck className="size-3.5" weight="bold" aria-hidden />
                </span>
              )}
            </div>
          )}
        </Field>

        {/* One line is always kept for this, so the name does not jump when the answer arrives. */}
        <div aria-live="polite" data-slot="order-customer" className="mt-2 flex min-h-7 flex-wrap items-center gap-2 text-xs leading-5">
          {ctl.lookingUp ? (
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <IconSpinner className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              {t.lookingUp}
            </span>
          ) : ctl.customer === undefined || (ctl.customer === null && check !== "valid") ? (
            // Nothing known yet — or an answer for a number that is not whole, which says nothing about the customer.
            !phoneError && <span className="text-ink-soft">{t.phoneHint}</span>
          ) : ctl.customer === null ? (
            <StatusBadge value="new" tone="neutral" text={t.newCustomer} />
          ) : ctl.customer.isBlacklisted ? (
            <StatusBadge value="blocked" tone="danger" text={t.knownBlocked} />
          ) : (
            <>
              <StatusBadge
                value="known"
                tone="info"
                text={
                  ctl.customer.totalOrders > 0
                    ? fmt(t.knownCustomer, { orders: countOf("order", ctl.customer.totalOrders) })
                    : t.knownNoOrders
                }
              />
              {ctl.customer.totalRejectedOrders > 0 && (
                <StatusBadge value="rejected" tone="warning" text={fmt(t.rejectedCount, { n: ctl.customer.totalRejectedOrders })} />
              )}
            </>
          )}
        </div>
      </div>

      <TextField
        label={t.name}
        required
        name="fullName"
        autoComplete="off"
        enterKeyHint="next"
        value={form.fullName}
        error={fieldErrors.fullName}
        onChange={(e) => ctl.edit("fullName", e.target.value)}
      />
      <TextField
        label={t.email}
        name="email"
        type="email"
        inputMode="email"
        dir="ltr"
        autoComplete="off"
        enterKeyHint="next"
        value={form.email}
        onChange={(e) => ctl.edit("email", e.target.value)}
      />
    </div>
  );
}
