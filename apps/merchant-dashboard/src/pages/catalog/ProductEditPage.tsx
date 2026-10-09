import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { CatalogProduct, Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { UnsavedGuardProvider } from "@/lib/useUnsavedGuard";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { ProductDetailsForm } from "./components/ProductDetailsForm";
import { ProductImagesSection } from "./components/ProductImagesSection";
import { ProductVideoSection, isVideoMedia } from "./components/ProductVideoSection";
import { VariantsSection } from "./components/VariantsSection";
import { OffersSection } from "./components/OffersSection";
import { ProductCollectionsSection } from "./components/ProductCollectionsSection";
import { CustomFieldsSection } from "./components/CustomFieldsSection";
import { ProductPageSettingsSection } from "./components/ProductPageSettingsSection";
import { ProductSeoSection } from "./components/ProductSeoSection";
import { ProductOptionsDisplaySection } from "./components/ProductOptionsDisplaySection";
import { ProductCmsSection } from "./components/ProductCmsSection";
import { ProductTestSection } from "./components/ProductTestSection";
import { PreorderSection } from "./components/PreorderSection";
import { PurchaseLimitsSection } from "./components/PurchaseLimitsSection";
import { ProductCardFrameProvider } from "./components/ProductPageCard";
import { isFromStoreProvider } from "@/pages/apps/dropshipStores";
import { StoreSkuWarning } from "@/pages/apps/StoreSkuWarning";
import { VariantLocationStock } from "@/pages/inventory/VariantLocationStock";
import { ProductStockHistoryLink } from "@/pages/inventory/movements/StockHistoryDrawer";
import { ProductForecastCard } from "@/pages/inventory/forecast/ProductForecastCard";
import { ProductLotsCard } from "@/pages/inventory/lots/ProductLotsCard";
import { ProductSizeChartNote } from "@/pages/sizeCharts/ProductSizeChartNote";
import { ProductQuestionsSection } from "@/pages/questions/ProductQuestionsSection";
import { DigitalTabLink } from "@/pages/digital/CodeAlerts";
import { ProductSaleNote } from "@/pages/priceSchedules/ProductSaleNote";
import { ProductPriceHistory } from "@/pages/priceHistory/ProductPriceHistory";
import { ProductSpecsSection } from "@/pages/productSpecs/ProductSpecsSection";
import { ProductBoughtWith } from "@/pages/boughtTogether/ProductBoughtWith";
import { DESKTOP_QUERY } from "./product/groups";
import { LeaveGuard } from "./product/LeaveGuard";
import { ProductGroup } from "./product/ProductGroup";
import { ProductHeader } from "./product/ProductHeader";
import { ProductSectionIndex } from "./product/ProductSectionIndex";
import { ProductStatusSwitch, useProductStatus } from "./product/productStatus";
import { isTracked, useGroupSummaries } from "./product/productSummary";
import { SaveQueueProvider, SaveSlot } from "./product/saveQueue";

const STRINGS = {
  en: {
    newTitle: "New product",
    newDescription:
      "A name, a price, a quantity and one photo are enough. Variants, offers and collections can come after it's created.",
    products: "Products",
    product: "Product",
    noActiveVariant: "Add a variant so customers can buy this product.",
    noActiveVariantArchived:
      "This product has no active variant. Once it's restored, add or reactivate a variant so customers can buy it.",
  },
  ar: {
    newTitle: "منتج جديد",
    newDescription: "اسم وسعر وكمية وصورة واحدة كفاية. الأنواع والعروض والمجموعات ممكن تضيفها بعد ما يتعمل.",
    products: "المنتجات",
    product: "المنتج",
    noActiveVariant: "ضيف نوع عشان العملاء يقدروا يشتروا المنتج ده.",
    noActiveVariantArchived: "المنتج ده مفيهوش نوع شغّال. بعد ما ترجّعه، ضيف نوع أو شغّل نوع عشان العملاء يقدروا يشتروه.",
  },
} satisfies Messages;

/**
 * The product page (/catalog/:productId) and the new-product page
 * (/catalog/new).
 *
 * An existing product is eight groups (product/groups.ts). From lg up they
 * are all open beside a sticky index; on a phone each folds to one row with a
 * line of what is inside. Every section keeps its own data and its own save —
 * nothing is merged; what is shared is the look of saving: one bar at a time
 * (product/saveQueue.tsx), and a question before unsaved edits are left.
 */
export function ProductEditPage() {
  const t = useT(STRINGS);
  const { productId } = useParams<{ productId: string }>();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();

  const product = useAsync(
    () => (productId ? apiClient.getProduct(workspaceId, productId) : Promise.resolve(null)),
    [workspaceId, productId]
  );

  if (!productId) {
    return (
      <UnsavedGuardProvider>
        <LeaveGuard className="zimos-product-page mx-auto w-full max-w-3xl">
          <PageHeader title={t.newTitle} back={{ to: "/catalog", label: t.products }} description={t.newDescription} />
          <ProductDetailsForm mode="create" onCreated={(created) => navigate(`/catalog/${created.id}`)} />
        </LeaveGuard>
      </UnsavedGuardProvider>
    );
  }

  const data = product.data;
  return (
    <UnsavedGuardProvider>
      <SaveQueueProvider>
        <LeaveGuard className="zimos-product-page mx-auto w-full max-w-[72rem]">
          {data ? (
            // Keyed by the product: going from one product to another starts every section afresh.
            <ProductWorkspace key={data.id} product={data} reload={() => product.refresh({ silent: true })} />
          ) : (
            <>
              <PageHeader title={t.product} back={{ to: "/catalog", label: t.products }} />
              <DataState loading={product.loading} error={product.error} onRetry={() => void product.refresh()}>
                {null}
              </DataState>
            </>
          )}
        </LeaveGuard>
      </SaveQueueProvider>
    </UnsavedGuardProvider>
  );
}

function ProductWorkspace({ product, reload }: { product: Product; reload: () => Promise<void> }) {
  const t = useT(STRINGS);
  const [params] = useSearchParams();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const status = useProductStatus(product, reload);
  const summaries = useGroupSummaries(product);

  const variants = product.variants ?? [];
  const media = product.media ?? [];
  const hasActiveVariant = variants.some((v) => v.status === "active");
  // The same product, read with the page fields lane 3 added.
  const catalogProduct = product as unknown as CatalogProduct;
  // Imported from the merchant's Shopify / WooCommerce store: its SKUs link the lines there (handoff 181).
  const skuNote = isFromStoreProvider(catalogProduct) ? <StoreSkuWarning /> : undefined;
  const onChanged = () => void reload();

  return (
    <>
      <ProductHeader product={product} status={status.status} />
      {/* ?tab=digital (the licence codes alert's link) goes to the product's delivery on Digital products (handoff 213). */}
      <DigitalTabLink productId={product.id} />

      <div className="lg:flex lg:items-start lg:gap-6">
        {/* The index is a desktop thing: on a phone the folded groups are the index. */}
        {desktop && <ProductSectionIndex />}

        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-5">
          {!hasActiveVariant && (
            <p role="status" className="zimos-product-warning rounded-[var(--radius)] border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-dark">
              {status.status === "archived" ? t.noActiveVariantArchived : t.noActiveVariant}
            </p>
          )}

          {/* 1. الأساسيات */}
          <ProductGroup group="basics" summary={summaries.basics} defaultOpen solo actions={<ProductStatusSwitch control={status} />}>
            <ProductDetailsForm mode="edit" product={product} onSaved={onChanged} statusControl={status} />
          </ProductGroup>

          {/* 2. الصور والفيديو */}
          <ProductGroup group="media" summary={summaries.media} defaultOpen>
            <ProductImagesSection mode="edit" productId={product.id} media={media.filter((m) => !isVideoMedia(m))} keep={media.filter(isVideoMedia)} onChanged={onChanged} />
            <ProductVideoSection productId={product.id} media={media} onChanged={onChanged} />
          </ProductGroup>

          {/* 3. السعر والمخزون: the variants grid (the bulk table opens from its head), then the read-only notes as slim rows. */}
          <ProductGroup group="pricing" summary={summaries.pricing}>
            <VariantsSection productId={product.id} variants={variants} tracked={isTracked(product)} skuNote={skuNote} onChanged={onChanged} />
            <ProductCardFrameProvider frame="fold">
              {/* Each row draws itself only when it has something, exactly as before; with none, the box is not there. */}
              <div className="zimos-product-folds mt-5 overflow-hidden rounded-[var(--radius)] bg-paper-raised ring-1 ring-line empty:hidden">
                {/* «في تخفيض لحد …» (handoff 227) · «تاريخ السعر», read when opened (handoff 234) */}
                <ProductSaleNote variants={variants} />
                <ProductPriceHistory productName={product.name} variants={variants} />
                <VariantLocationStock variants={variants} />
                {/* «سجل حركة المخزون»: one variant's stock movements in a drawer (handoff 389). */}
                <ProductStockHistoryLink productId={product.id} productName={product.name} variants={variants} />
                {/* How long the stock lasts (handoff 224); the lots, first to go first (handoff 230). */}
                <ProductForecastCard productId={product.id} variants={variants} />
                <ProductLotsCard variants={variants} />
              </div>
            </ProductCardFrameProvider>
          </ProductGroup>

          {/* 4. الخيارات */}
          <ProductGroup group="options" summary={summaries.options}>
            <ProductOptionsDisplaySection product={catalogProduct} variants={variants} onChanged={onChanged} />
            <CustomFieldsSection productId={product.id} fields={product.customFields ?? []} onChanged={onChanged} />
            {/* Which size chart the shopper gets on this product, and through what (handoff 210). */}
            <ProductSizeChartNote productId={product.id} collections={product.collections ?? []} />
          </ProductGroup>

          {/* 5. العروض */}
          <ProductGroup group="offers" summary={summaries.offers}>
            <OffersSection productId={product.id} offers={product.offers ?? []} variants={variants} onChanged={onChanged} />
            <PreorderSection productId={product.id} />
            <PurchaseLimitsSection productId={product.id} />
            {/* «بيتشري مع»: what it is bought with (handoff 223). */}
            <ProductBoughtWith productId={product.id} />
          </ProductGroup>

          {/* 6. صفحة المنتج — ?tab=questions (the "new question" notification) opens this group (handoff 212). */}
          <ProductGroup group="page" summary={summaries.page} openWhen={params.get("tab") === "questions"}>
            <ProductCmsSection product={catalogProduct} onChanged={onChanged} />
            <ProductPageSettingsSection product={catalogProduct} onChanged={onChanged} />
            {/* «المواصفات»: a value per specification the store defined (handoff 231). */}
            <ProductSpecsSection productId={product.id} />
            <ProductQuestionsSection productId={product.id} />
            <ProductTestSection productId={product.id} variants={variants} media={media} onProductChanged={onChanged} />
          </ProductGroup>

          {/* 7. محركات البحث */}
          <ProductGroup group="seo" summary={summaries.seo} solo>
            <ProductSeoSection product={product} onChanged={onChanged} />
          </ProductGroup>

          {/* 8. المجموعات */}
          <ProductGroup group="collections" summary={summaries.collections} solo>
            <ProductCollectionsSection productId={product.id} memberships={product.collections ?? []} onChanged={onChanged} />
          </ProductGroup>

          {/* Where the one save bar is drawn: last in the column, so it sticks to the column's bottom edge. */}
          <SaveSlot />
        </div>
      </div>
    </>
  );
}
