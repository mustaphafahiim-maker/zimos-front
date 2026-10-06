import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatProductCode } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useCatalogLabels } from "./catalogLabels";
import { ProductDetailsForm } from "./components/ProductDetailsForm";
import { ProductImagesSection } from "./components/ProductImagesSection";
import { ProductVideoSection, isVideoMedia } from "./components/ProductVideoSection";
import { VariantsSection } from "./components/VariantsSection";
import { OffersSection } from "./components/OffersSection";
import { ProductCollectionsSection } from "./components/ProductCollectionsSection";
import { CustomFieldsSection } from "./components/CustomFieldsSection";
import type { CatalogProduct } from "@store-builder/api-client";
import { ProductPageSettingsSection } from "./components/ProductPageSettingsSection";
import { ProductSeoSection } from "./components/ProductSeoSection";
import { ProductOptionsDisplaySection } from "./components/ProductOptionsDisplaySection";
import { ProductCmsSection } from "./components/ProductCmsSection";
import { VariantBulkEditor } from "./components/VariantBulkEditor";
import { ProductTestSection } from "./components/ProductTestSection";
import { isFromStoreProvider } from "@/pages/apps/dropshipStores";
import { StoreSkuWarning } from "@/pages/apps/StoreSkuWarning";
import { PreorderSection } from "./components/PreorderSection";
import { PurchaseLimitsSection } from "./components/PurchaseLimitsSection";

const STRINGS = {
  en: {
    newTitle: "New product",
    newDescription: "A name, a price and one photo are enough. Variants, offers and collections can come after it's created.",
    more: "More settings",
    moreHint: "Video, collections, custom fields, purchase limits, page layout, SEO and the product page's content.",
    products: "Products",
    product: "Product",
    noActiveVariant: "Add a variant so customers can buy this product.",
    noActiveVariantArchived:
      "This product has no active variant. Once it's restored, add or reactivate a variant so customers can buy it.",
  },
  ar: {
    newTitle: "منتج جديد",
    newDescription: "اسم وسعر وصورة واحدة كفاية. الأنواع والعروض والمجموعات ممكن تضيفها بعد ما يتعمل.",
    more: "إعدادات تانية",
    moreHint: "الفيديو، المجموعات، الخانات الإضافية، حدود الشراء، شكل الصفحة، الـ SEO ومحتوى صفحة المنتج.",
    products: "المنتجات",
    product: "المنتج",
    noActiveVariant: "ضيف نوع عشان العملاء يقدروا يشتروا المنتج ده.",
    noActiveVariantArchived:
      "لا يوجد متغير نشط لهذا المنتج. بعد استعادته، أضف متغيرًا أو فعّل متغيرًا حتى يتمكن العملاء من شرائه.",
  },
} satisfies Messages;

export function ProductEditPage() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const { productId } = useParams<{ productId: string }>();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const isNew = !productId;

  const product = useAsync(
    () => (productId ? apiClient.getProduct(workspaceId, productId) : Promise.resolve(null)),
    [workspaceId, productId]
  );

  if (isNew) {
    return (
      <div className="max-w-3xl">
        <PageHeader
          title={t.newTitle}
          back={{ to: "/catalog", label: t.products }}
          description={t.newDescription}
        />
        <ProductDetailsForm
          mode="create"
          onCreated={(created) => navigate(`/catalog/${created.id}`)}
        />
      </div>
    );
  }

  const data = product.data;
  const reload = () => product.refresh({ silent: true });
  const hasActiveVariant = (data?.variants ?? []).some((v) => v.status === "active");
  // Imported from the merchant's Shopify / WooCommerce store: its SKUs link the lines there (handoff 181).
  const skuNote = isFromStoreProvider(data as unknown as CatalogProduct | null) ? <StoreSkuWarning /> : undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={data?.name ?? t.product}
        titleMeta={formatProductCode(data?.productCode) ?? undefined}
        back={{ to: "/catalog", label: t.products }}
        actions={data && <StatusBadge value={data.status} text={labels.status(data.status)} />}
      />

      <DataState loading={product.loading} error={product.error} onRetry={() => product.refresh()}>
        {data && (
          <div className="space-y-6">
            {!hasActiveVariant && (
              <p
                role="status"
                className="rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-dark"
              >
                {data.status === "archived" ? t.noActiveVariantArchived : t.noActiveVariant}
              </p>
            )}
            <ProductDetailsForm mode="edit" product={data} onSaved={reload} />
            <ProductImagesSection
              mode="edit"
              productId={data.id}
              media={(data.media ?? []).filter((m) => !isVideoMedia(m))}
              keep={(data.media ?? []).filter(isVideoMedia)}
              onChanged={reload}
            />
            <VariantsSection
              productId={data.id}
              variants={data.variants ?? []}
              tracked={data.productType !== "physical" || (data as { trackInventory?: boolean }).trackInventory !== false}
              skuNote={skuNote}
              onChanged={reload}
            />
            <PreorderSection productId={data.id} />
            <OffersSection
              productId={data.id}
              offers={data.offers ?? []}
              variants={data.variants ?? []}
              onChanged={reload}
            />

            {/* Everything a first sale doesn't need, folded (still mounted, so nothing is lost while closed). */}
            <details className="group rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{t.more}</span>
                  <span className="block text-xs text-ink-soft">{t.moreHint}</span>
                </span>
                <ChevronDown className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-6 border-t border-line p-3 sm:p-4">
            <ProductVideoSection productId={data.id} media={data.media ?? []} onChanged={reload} />
            <VariantBulkEditor productId={data.id} variants={data.variants ?? []} skuNote={skuNote} onChanged={reload} />
            <ProductCollectionsSection
              productId={data.id}
              memberships={data.collections ?? []}
              onChanged={reload}
            />
            <CustomFieldsSection productId={data.id} fields={data.customFields ?? []} onChanged={reload} />
            <PurchaseLimitsSection productId={data.id} />
            <ProductTestSection productId={data.id} variants={data.variants ?? []} media={data.media ?? []} onProductChanged={reload} />
            {/* The same product, read with the page fields lane 3 added. */}
            <ProductOptionsDisplaySection
              product={data as unknown as CatalogProduct}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <ProductPageSettingsSection product={data as unknown as CatalogProduct} onChanged={reload} />
            <ProductSeoSection product={data} onChanged={reload} />
            <ProductCmsSection product={data as unknown as CatalogProduct} onChanged={reload} />
              </div>
            </details>
          </div>
        )}
      </DataState>
    </div>
  );
}
