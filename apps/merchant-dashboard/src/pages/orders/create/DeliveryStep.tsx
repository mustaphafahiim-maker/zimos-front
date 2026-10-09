import { useId, type ReactNode } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { ON_ACCOUNT_METHOD, type PaymentMethod } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { formatMoney, humanize } from "@/lib/format";
import { asciiDigits } from "@/lib/wholeNumber";
// Handoff 228 / 229: an approved customer's «دفع آجل» option, what is left of their limit, and a tax-exempt customer's note.
import { ManualOnAccountOption, ManualOrderB2bNote } from "@/pages/b2b/ManualOrderOnAccount";
import { useOrderLabels } from "../orderLabels";
import { CREATE_STRINGS } from "./strings";
import { PAYMENT_METHODS } from "./model";
import type { CreateOrder } from "./useCreateOrder";
import { StaffDiscountControl, SummaryDiscountRows } from "./staffLines";
import { OrderLanguageField } from "../components/OrderLanguage";

/** A titled group of fields; `action` sits at the end of the title's line. */
function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 id={id} className="text-[13px] leading-5 font-semibold text-ink">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// A figure about to be replaced by a new price is dimmed, never its label: 60% of the ink still holds 4.5:1.
const FIGURE = "tabular-nums transition-opacity duration-[var(--dur-fade)] motion-reduce:transition-none";

function Row({ label, value, stale }: { label: string; value: string; stale: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={cn("text-ink", FIGURE, stale && "opacity-60")}>
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

/**
 * Step 3 — «التوصيل والدفع»: governorate, then city and address (the customer's
 * last address is one press away when the store has one); how they pay; a
 * discount code and a shipping amount of the merchant's own, for the orders
 * that need them; a note; and the server's breakdown of the total, to read
 * before creating.
 */
export function DeliveryStep({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  const { locale } = useLocale();
  const labels = useOrderLabels();
  const { form, fieldErrors, preview, currency } = ctl;
  const governorates = ctl.options.data?.governorates ?? [];
  // A string, not the union: «دفع آجل» is not one of the methods every store has.
  const method: string = form.paymentMethod;
  const onAccountListed = Boolean(ctl.b2b?.statement?.enabled);
  const shippingError = fieldErrors.shipping ?? (ctl.shippingOk ? undefined : t.shippingInvalid);

  return (
    <div className="space-y-6">
      <Group
        title={t.address}
        action={
          ctl.customer?.lastAddress ? (
            <Button type="button" variant="outline" size="sm" className="rounded-full px-3.5" onClick={ctl.applyLastAddress}>
              {t.useLastAddress}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label={t.governorate}>
              {({ id }) => (
                <Select id={id} name="province" value={form.province} onChange={(e) => ctl.edit("province", e.target.value)} className="h-11">
                  <option value="">{t.chooseGovernorate}</option>
                  {form.province && !governorates.some((g) => `${g.ar} (${g.en})` === form.province) && (
                    <option value={form.province}>{form.province}</option>
                  )}
                  {governorates.map((g) => (
                    <option key={g.code} value={`${g.ar} (${g.en})`}>
                      {locale === "ar" ? g.ar : g.en}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {Boolean(ctl.options.error) && !ctl.options.loading && (
              <p role="status" className="mt-1 flex flex-wrap items-center gap-x-2 text-xs leading-4 text-ink-soft">
                {t.governoratesFailed}
                <button
                  type="button"
                  onClick={() => void ctl.options.refresh()}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {t.retry}
                </button>
              </p>
            )}
          </div>
          <TextField
            label={t.city}
            required
            name="city"
            autoComplete="off"
            enterKeyHint="next"
            value={form.city}
            error={fieldErrors.city}
            onChange={(e) => ctl.edit("city", e.target.value)}
          />
        </div>
        <TextField
          className="mt-4"
          label={t.addressLine}
          required
          name="addressLine"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t.addressPlaceholder}
          value={form.addressLine}
          error={fieldErrors.addressLine}
          onChange={(e) => ctl.edit("addressLine", e.target.value)}
        />
      </Group>

      <Group title={t.payment}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.paymentMethod}>
            {({ id }) => (
              <Select
                id={id}
                name="paymentMethod"
                value={method}
                onChange={(e) => ctl.setPaymentMethod(e.target.value as PaymentMethod)}
                className="h-11"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {labels.paymentMethod(m)}
                  </option>
                ))}
                <ManualOnAccountOption state={ctl.b2b} />
                {/* A restored draft on «دفع آجل», while the customer's terms are still loading: the choice stays readable. */}
                {method === ON_ACCOUNT_METHOD && !onAccountListed && <option value={ON_ACCOUNT_METHOD}>{humanize(ON_ACCOUNT_METHOD)}</option>}
              </Select>
            )}
          </Field>
        </div>
        {ctl.b2bReady && (
          <ManualOrderB2bNote state={ctl.b2b} paymentMethod={method} onMethodChange={ctl.resetPaymentMethod} currency={currency} />
        )}
      </Group>

      <Group title={t.extras}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.coupon}
            name="coupon"
            dir="ltr"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={100}
            value={form.coupon}
            hint={t.couponHint}
            onChange={(e) => ctl.edit("coupon", e.target.value)}
            onBlur={ctl.applyCoupon}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              // Enter applies the code; it is never the step's button.
              e.preventDefault();
              e.stopPropagation();
              ctl.applyCoupon();
            }}
          />
          <MoneyInput
            label={t.shipping}
            value={form.shipping}
            onChange={(value) => ctl.edit("shipping", asciiDigits(value).replace(/٫/g, "."))}
            currency={currency}
            placeholder={t.shippingPlaceholder}
            hint={t.shippingAuto}
            error={shippingError}
          />
        </div>
        {/* Handoff 382: a discount off the whole order, with its reason (orders.price_override). */}
        <StaffDiscountControl ctl={ctl} />
      </Group>

      <Field label={t.notes}>
        {({ id }) => (
          <Textarea
            id={id}
            name="notes"
            rows={2}
            maxLength={2000}
            placeholder={t.notesPlaceholder}
            value={form.notes}
            onChange={(e) => ctl.edit("notes", e.target.value)}
          />
        )}
      </Field>

      {/* A store with more than one language: which one the customer's messages go out in (handoff 383). */}
      <OrderLanguageField value={form.locale ?? ""} onChange={(locale) => ctl.edit("locale", locale)} />

      {ctl.previewError && (
        <Alert variant="danger" role="alert">
          {ctl.previewError}
        </Alert>
      )}

      {preview && (
        <Group title={t.summary}>
          <dl
            data-slot="order-summary"
            aria-busy={ctl.pricing || undefined}
            className="space-y-2 rounded-[1rem] bg-paper-raised p-3.5 text-sm leading-5 ring-1 ring-line"
          >
            <Row label={t.subtotal} value={formatMoney(preview.subtotalAmount, currency)} stale={ctl.pricing} />
            {/* One row, or «كود الخصم» and «خصم يدوي (السبب)» as two (handoff 382). */}
            <SummaryDiscountRows ctl={ctl} label={t.discount} />
            <Row label={t.shipping} value={formatMoney(preview.shippingAmount, currency)} stale={ctl.pricing} />
            {Number(preview.taxAmount) > 0 && <Row label={t.tax} value={formatMoney(preview.taxAmount, currency)} stale={ctl.pricing} />}
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-semibold text-ink">
              <dt>{t.total}</dt>
              <dd className={cn(FIGURE, ctl.pricing && "opacity-60")}>
                <bdi>{formatMoney(preview.totalAmount, currency)}</bdi>
              </dd>
            </div>
          </dl>
        </Group>
      )}
    </div>
  );
}
