import { useNavigate, useParams } from "react-router-dom";
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
import { MenuOptionsSection } from "./components/MenuOptionsSection";
import { PreorderSection } from "./components/PreorderSection";
import { PurchaseLimitsSection } from "./components/PurchaseLimitsSection";
import { ProductSizeChartNote } from "@/pages/sizeCharts/ProductSizeChartNote";
import { ProductSpecsSection } from "@/pages/productSpecs/ProductSpecsSection";
import { ProductPriceHistory } from "@/pages/priceHistory/ProductPriceHistory";
import { ProductQuestionsSection } from "@/pages/questions/ProductQuestionsSection";
import {
  PREORDERS_ENABLED,
  PRODUCT_QUESTIONS_ENABLED,
  PRICE_HISTORY_ENABLED,
  PRODUCT_SPECS_ENABLED,
  PURCHASE_LIMITS_ENABLED,
  SIZE_CHARTS_ENABLED,
} from "@/lib/features";
import type { CatalogProduct } from "@store-builder/api-client";
import { ProductPageSettingsSection } from "./components/ProductPageSettingsSection";
import { ProductSeoSection } from "./components/ProductSeoSection";
import { ProductOptionsDisplaySection } from "./components/ProductOptionsDisplaySection";
import { ProductCmsSection } from "./components/ProductCmsSection";
import { VariantBulkEditor } from "./components/VariantBulkEditor";
import { ProductTestSection } from "./components/ProductTestSection";

const STRINGS = {
  en: {
    newTitle: "New product",
    newDescription:
      "Name, description, an image and a price are required. Add more variants, offers and collections after it's created.",
    products: "Products",
    product: "Product",
    noActiveVariant: "Add a variant so customers can buy this product.",
    noActiveVariantArchived:
      "This product has no active variant. Once it's restored, add or reactivate a variant so customers can buy it.",
  },
  ar: {
    newTitle: "منتج جديد",
    newDescription:
      "الاسم والوصف وصورة واحدة والسعر مطلوبة. أضف متغيرات وعروضًا ومجموعات أخرى بعد إنشائه.",
    products: "المنتجات",
    product: "المنتج",
    noActiveVariant: "أضف متغيرًا حتى يتمكن العملاء من شراء هذا المنتج.",
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
            <ProductVideoSection productId={data.id} media={data.media ?? []} onChanged={reload} />
            <VariantsSection
              productId={data.id}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <VariantBulkEditor productId={data.id} variants={data.variants ?? []} onChanged={reload} />
            <OffersSection
              productId={data.id}
              offers={data.offers ?? []}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <ProductCollectionsSection
              productId={data.id}
              memberships={data.collections ?? []}
              onChanged={reload}
            />
            <MenuOptionsSection productId={data.id} />
            <CustomFieldsSection productId={data.id} fields={data.customFields ?? []} onChanged={reload} />
            {/* Store features, each only while its switch is on (lib/features). */}
            {SIZE_CHARTS_ENABLED && <ProductSizeChartNote productId={data.id} collections={data.collections ?? []} />}
            {PREORDERS_ENABLED && <PreorderSection productId={data.id} />}
            {PURCHASE_LIMITS_ENABLED && <PurchaseLimitsSection productId={data.id} />}
            {PRICE_HISTORY_ENABLED && <ProductPriceHistory productName={data.name} variants={data.variants ?? []} />}
            {PRODUCT_SPECS_ENABLED && <ProductSpecsSection productId={data.id} />}
            {PRODUCT_QUESTIONS_ENABLED && <ProductQuestionsSection productId={data.id} />}
            <ProductTestSection productId={data.id} variants={data.variants ?? []} media={data.media ?? []} onProductChanged={reload} />
            {/* The same product, read with the page fields added. */}
            <ProductOptionsDisplaySection
              product={data as unknown as CatalogProduct}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <ProductPageSettingsSection product={data as unknown as CatalogProduct} onChanged={reload} />
            <ProductSeoSection product={data} onChanged={reload} />
            <ProductCmsSection product={data as unknown as CatalogProduct} onChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}
