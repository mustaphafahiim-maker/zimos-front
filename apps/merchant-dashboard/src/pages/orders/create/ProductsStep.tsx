import { Alert, cn } from "@store-builder/ui";
import { IconDelete } from "@/components/icons";
import { SkeletonBar } from "@/components/DataState";
import { ProductImage } from "@/components/ProductImage";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatMoney, formatOptions, variantLabel } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { CREATE_STRINGS } from "./strings";
import { ProductPicker } from "./ProductPicker";
import { QuantityStepper } from "./QuantityStepper";
import { variantIsNamed, type Line } from "./model";
import type { CreateOrder } from "./useCreateOrder";
import { CustomLineControl, LineStaffPrice } from "./staffLines";

/** "product · variant · offer", from the catalog; from the server's preview while the catalog is still on its way. */
function nameOfLine(ctl: CreateOrder, line: Line, index: number): string {
  // A custom line (handoff 382) is named by what staff typed.
  if (line.custom) return line.custom.title;
  const product = ctl.productById.get(line.productId);
  if (product) {
    const variant = (product.variants ?? []).find((v) => v.id === line.variantId);
    const variantName = variant && variantIsNamed(product, variant) ? variantLabel(variant) : null;
    return [product.name, variantName, line.offerName].filter(Boolean).join(" · ");
  }
  const priced = ctl.pricedLine(index);
  if (priced) return [priced.name, formatOptions(priced.options), priced.offerName].filter(Boolean).join(" · ");
  return "…";
}

/**
 * What is in the order so far, above the picker: each line with its photo,
 * what it is, its total as the server priced it, a stepper to change how many
 * and a button to take it out.
 */
function OrderLines({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  const { lines } = ctl.form;
  if (lines.length === 0) return null;
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section aria-label={t.linesTitle}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-[13px] leading-5 font-semibold text-ink">{t.linesTitle}</h3>
        <span className="text-xs leading-5 text-ink-soft tabular-nums">{countOf("piece", pieces)}</span>
      </div>
      <ul data-slot="order-lines" className="divide-y divide-line overflow-hidden rounded-[1rem] bg-paper-raised ring-1 ring-line">
        {lines.map((line, index) => {
          const name = nameOfLine(ctl, line, index);
          const priced = ctl.pricedLine(index);
          // The figure on screen is for another quantity until the new price arrives.
          const stale = ctl.pricing || (priced !== null && priced.quantity !== line.quantity);
          return (
            <li key={line.key} data-slot="order-line" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 ps-2.5 pe-1">
              <ProductImage media={ctl.productById.get(line.productId)?.media?.[0]} alt={name} className="size-11 rounded-[0.75rem]" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-5 font-medium text-ink">
                  <bdi>{name}</bdi>
                </p>
                {/* Handoff 382: «مخصص» on a custom line; the pencil that changes a catalogue line's price. */}
                <LineStaffPrice ctl={ctl} line={line} index={index} name={name} />
              </div>
              <button
                type="button"
                onClick={() => ctl.removeLine(line.key)}
                aria-label={fmt(t.remove, { name })}
                title={fmt(t.remove, { name })}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:order-last"
              >
                <IconDelete className="size-4" aria-hidden />
              </button>
              {/* On a phone the second line of the card, under the name; from sm, between the name and the remove button. */}
              <div className="flex w-full items-center justify-between gap-3 ps-14 pe-1.5 sm:w-auto sm:justify-end sm:p-0">
                <QuantityStepper
                  value={line.quantity}
                  onChange={(value) => ctl.setLineQuantity(line.key, value)}
                  label={fmt(t.quantityOf, { name })}
                />
                <span className="flex min-w-24 justify-end text-sm leading-5 font-semibold whitespace-nowrap text-ink tabular-nums" aria-busy={stale || undefined}>
                  {priced ? (
                    <bdi className={cn("transition-opacity duration-[var(--dur-fade)] motion-reduce:transition-none", stale && "opacity-60")}>
                      {formatMoney(priced.lineTotalAmount, ctl.currency)}
                    </bdi>
                  ) : ctl.pricing ? (
                    <SkeletonBar className="h-3.5 w-16" />
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Step 2 — «المنتجات»: the lines of the order, then the catalog to pick from.
 * A message from the server about the basket (an offer that ended, stock that
 * ran out) shows between the two, where it can be acted on.
 */
export function ProductsStep({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  return (
    <div className="space-y-4">
      {ctl.pruned > 0 && (
        <p role="status" className="rounded-[0.875rem] bg-accent-soft px-3.5 py-2.5 text-sm leading-6 text-accent-dark">
          {fmt(t.draftPruned, { items: countOf("item", ctl.pruned) })}
        </p>
      )}
      <OrderLines ctl={ctl} />
      <CustomLineControl ctl={ctl} />
      {/* Said, not shown: the line itself is the sign for the eye. */}
      <p role="status" className="sr-only">
        {ctl.lastAdded ? fmt(t.added, { name: ctl.lastAdded }) : ""}
      </p>
      {ctl.previewError && (
        <Alert variant="danger" role="alert">
          {ctl.previewError}
        </Alert>
      )}
      <ProductPicker ctl={ctl} />
    </div>
  );
}
