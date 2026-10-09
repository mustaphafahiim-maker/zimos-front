import type { ReactNode } from "react";
import { buttonVariants, cn } from "@store-builder/ui";
import {
  IconArchive,
  IconCopy,
  IconDelete,
  IconExternal,
  IconLink,
  IconSpinner,
  IconUndo,
  type IconComponent,
} from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { QuickLook } from "@/components/QuickLook";
import { Segmented } from "@/components/Segmented";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useCatalogLabels } from "../catalogLabels";
import { VariantsEditor } from "./ProductCells";
import { ProductFlags, ProductStatusChip, useProductRowText, type ProductRowView } from "./productRow";
import type { ProductActions } from "./useProductActions";
import type { ProductEdits } from "./useProductEdits";

const STRINGS = {
  en: {
    openProduct: "Open the product",
    seeInStore: "See it in the store",
    photos_one: "1 photo",
    photos_other: "{n} photos",
    photoOf: "Photo {n} of {total}",
    status: "Status",
    statusHint: "Active shows in your store. A draft is hidden until you are ready.",
    active: "Active",
    draft: "Draft",
    figures: "Price and stock",
    prices: "Price",
    about: "About it",
    type: "Type",
    code: "Code",
    link: "Link",
    variants: "Variants",
    added: "Added",
    more: "More",
    duplicate: "Duplicate as a draft",
    copyLink: "Copy its link in the store",
    archive: "Archive or delete…",
    restore: "Restore as a draft",
    deletePermanently: "Delete permanently…",
    archivedNote: "Archived: shoppers can't see it or order it. Restore it to sell it again.",
  },
  ar: {
    openProduct: "افتح المنتج",
    seeInStore: "شوفه في المتجر",
    photos_one: "صورة واحدة",
    photos_two: "صورتين",
    photos_few: "{n} صور",
    photos_other: "{n} صورة",
    photoOf: "صورة {n} من {total}",
    status: "الحالة",
    statusHint: "الشغّال بيظهر في متجرك. المسودة مستخبية لحد ما تجهز.",
    active: "شغّال",
    draft: "مسودة",
    figures: "السعر والمخزون",
    prices: "السعر",
    about: "عن المنتج",
    type: "النوع",
    code: "الكود",
    link: "اللينك",
    variants: "الأنواع",
    added: "اتضاف",
    more: "كمان",
    duplicate: "اعمل نسخة كمسودة",
    copyLink: "انسخ لينكه في المتجر",
    archive: "أرشفة أو حذف…",
    restore: "رجّعه كمسودة",
    deletePermanently: "حذف نهائي…",
    archivedNote: "مؤرشف: العملاء مش شايفينه ومش هيقدروا يطلبوه. رجّعه عشان تبيعه تاني.",
  },
} satisfies Messages;

function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

/** One line of the «كمان» group: a 44px row with its glyph, like a line of a settings pane. */
function ActionRow({
  icon: RowIcon,
  label,
  onPress,
  busy = false,
  destructive = false,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  busy?: boolean;
  destructive?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPress}
        disabled={busy}
        aria-busy={busy || undefined}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 px-3.5 text-start text-sm leading-5 transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none",
          destructive ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-paper-sunken"
        )}
      >
        {busy ? (
          <IconSpinner className="size-[18px] shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <RowIcon className={cn("size-[18px] shrink-0", !destructive && "text-ink-soft")} aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    </li>
  );
}

/**
 * Quick Look of a product, without leaving the list: its photos (swipe), the
 * status as a switch between شغّال and مسودة, every variant's price and stock —
 * each editable in place —, a few facts, and what can be done to it: see it
 * in the store, copy its link, duplicate, archive (or restore). «افتح المنتج»
 * goes to its page.
 *
 * `row` stays the last product looked at while the panel closes, so it does
 * not empty on its way out.
 */
export function ProductQuickLook({
  row,
  open,
  onOpenChange,
  edits,
  actions,
}: {
  row: ProductRowView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edits: ProductEdits;
  actions: ProductActions;
}) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const text = useProductRowText();

  if (!row) return null;

  const { product, code, variants } = row;
  const archived = product.status === "archived";
  const busy = actions.isBusy(product.id);
  const photos = (product.media ?? []).filter((media) => (media.mimeType ?? "").startsWith("image/"));
  const status: "active" | "draft" = product.status === "active" ? "active" : "draft";

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{product.name}</bdi>}
      status={<ProductStatusChip product={product} />}
      to={row.to}
      openLabel={t.openProduct}
      actions={
        row.storeUrl ? (
          <a
            href={row.storeUrl}
            target="_blank"
            rel="noreferrer"
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 gap-2 rounded-full px-5 sm:min-h-10")}
          >
            <IconExternal className="size-4" weight="bold" aria-hidden />
            <span className="min-w-0 truncate">{t.seeInStore}</span>
          </a>
        ) : undefined
      }
    >
      <div data-slot="product-peek" className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
          <ProductFlags row={row} />
        </div>
        {archived && <p className="text-[13px] leading-5 text-ink-soft">{t.archivedNote}</p>}

        {photos.length > 0 && (
          <section>
            <BlockLabel>{pluralOf(t, "photos", photos.length)}</BlockLabel>
            {/* One row that snaps photo by photo; each keeps its square whether or not it has loaded. */}
            <ul className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {photos.map((media, index) => (
                <li key={media.id ?? `${media.url}:${index}`} className={cn("shrink-0 snap-start", photos.length > 1 ? "w-[70%]" : "w-full")}>
                  <ProductImage
                    media={media}
                    alt={fmt(t.photoOf, { n: index + 1, total: photos.length })}
                    className={cn("zimos-catalog-photo w-full rounded-[1.25rem]", photos.length > 1 ? "aspect-square" : "aspect-[4/3]")}
                    iconClassName="size-8"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {!archived && edits.canEdit && (
          <section>
            <BlockLabel>{t.status}</BlockLabel>
            <Segmented
              value={status}
              onChange={(next) => void actions.setStatus(product, next)}
              options={[
                { value: "active", label: t.active },
                { value: "draft", label: t.draft },
              ]}
              label={t.status}
              className="w-full"
            />
            <p className="mt-2 text-xs leading-5 text-ink-soft">{t.statusHint}</p>
          </section>
        )}

        <section>
          <BlockLabel>{row.tracked ? t.figures : t.prices}</BlockLabel>
          <VariantsEditor row={row} edits={edits} />
        </section>

        <div role="separator" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.about}</BlockLabel>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px] leading-5">
            <dt className="text-ink-soft">{t.type}</dt>
            <dd className="text-ink">{labels.type(product.productType)}</dd>
            {code && (
              <>
                <dt className="text-ink-soft">{t.code}</dt>
                <dd className="text-ink tabular-nums">
                  <bdi dir="ltr">{code}</bdi>
                </dd>
              </>
            )}
            <dt className="text-ink-soft">{t.link}</dt>
            <dd className="min-w-0 truncate text-ink">
              <bdi dir="ltr">{product.slug}</bdi>
            </dd>
            <dt className="text-ink-soft">{t.variants}</dt>
            <dd className="text-ink">{variants.length > 0 ? text.variantCount(variants.length) : text.noVariants}</dd>
            <dt className="text-ink-soft">{t.added}</dt>
            <dd className="text-ink">
              <time dateTime={product.createdAt}>{formatDate(product.createdAt)}</time>
            </dd>
          </dl>
        </section>

        <section>
          <BlockLabel>{t.more}</BlockLabel>
          <ul className="zimos-catalog-actions divide-y divide-line overflow-hidden rounded-[1rem] bg-paper-raised ring-1 ring-line">
            <ActionRow icon={IconCopy} label={t.duplicate} busy={busy} onPress={() => void actions.duplicate(product)} />
            {row.storeUrl && <ActionRow icon={IconLink} label={t.copyLink} onPress={() => void actions.copyLink(row)} />}
            {archived ? (
              <>
                <ActionRow icon={IconUndo} label={t.restore} busy={busy} onPress={() => void actions.restore(product)} />
                <ActionRow icon={IconDelete} label={t.deletePermanently} destructive onPress={() => actions.askRemove(product)} />
              </>
            ) : (
              <ActionRow icon={IconArchive} label={t.archive} destructive onPress={() => actions.askRemove(product)} />
            )}
          </ul>
        </section>
      </div>
    </QuickLook>
  );
}
