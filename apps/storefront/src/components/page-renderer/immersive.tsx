import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import { BoxIcon } from "@/components/Icons";
import { OrbitStage } from "@/components/immersive/OrbitStage";
import { Product3D } from "@/components/immersive/Product3D";
import { ScrollStory, type StoryStep } from "@/components/immersive/ScrollStory";
import { ShaderHero } from "@/components/immersive/ShaderHero";
import { ProductCard } from "@/components/ProductCard";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary } from "@/components/ui";
import { getDictionary, type Locale } from "@/lib/i18n";
import { firstImage } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { num, resolveHref, safeUrl, str, type Props } from "./props";

/**
 * The four immersive element types: a hero drawn in the store's colours, a
 * spinnable 3D product, a turning product carousel, and a story that advances
 * as the page scrolls.
 *
 * Like the commerce elements, these are server components that fetch the
 * merchant's real catalogue; the moving parts are small client components they
 * hand data to. Each one has a still, readable version for visitors on reduced
 * motion, a metered connection or a weak device — that decision is made in the
 * browser (useImmersive.ts), never guessed here.
 *
 * A failing catalogue call renders nothing rather than breaking the page.
 */

/** A product's GLB model, if the merchant uploaded one alongside the photos. */
function modelUrlOf(product: Pick<StorefrontProduct, "media">): string | null {
  const media = product.media;
  if (!Array.isArray(media)) return null;
  for (const entry of media) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const mime = typeof o.mimeType === "string" ? o.mimeType : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (mime === "model/gltf-binary" && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

async function loadProduct(workspaceId: string, idOrSlug: string): Promise<StorefrontProduct | null> {
  try {
    const client = await createServerStorefrontApiClient();
    if (idOrSlug) return await client.getStorefrontProduct(workspaceId, idOrSlug);
    const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
    return products[0] ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}

/** `shader_hero` — the opening screen, painted in the store's own two colours. */
export function ShaderHeroElement({ props, locale }: { props: Props; locale: Locale }) {
  const title = str(props, "title");
  const subtitle = str(props, "subtitle");
  const ctaLabel = str(props, "ctaLabel");
  const ctaHref = resolveHref(str(props, "ctaHref", "/products"));
  const height = num(props, "height", 460, 260, 760);

  if (!title && !subtitle && !ctaLabel) return null;

  return (
    <ShaderHero minHeight={height}>
      {title ? (
        <h1 className="max-w-2xl text-balance text-3xl font-bold text-on-primary drop-shadow-sm sm:text-5xl">{title}</h1>
      ) : null}
      {subtitle ? <p className="max-w-xl text-base text-on-primary/90 sm:text-lg">{subtitle}</p> : null}
      {ctaLabel && ctaHref ? (
        <div>
          <StoreLink href={ctaHref} className={btnPrimary} lang={locale}>
            {ctaLabel}
          </StoreLink>
        </div>
      ) : null}
    </ShaderHero>
  );
}

/** `product_3d` — one product the shopper can pick up and turn. */
export async function Product3DElement({
  props,
  workspaceId,
  locale,
}: {
  props: Props;
  workspaceId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const product = await loadProduct(workspaceId, str(props, "productId").trim());
  if (!product) return null;

  // The merchant can point at a model directly, otherwise it comes from the
  // product's own media. No model, no block — never a fake 3D badge.
  const model = safeUrl(str(props, "modelUrl")) ?? modelUrlOf(product);
  if (!model) return null;

  const title = str(props, "title");
  const poster = firstImage(product) ?? undefined;

  return (
    <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
      <Product3D src={model} poster={poster} name={product.name} t={t} />
      <div className="flex flex-col gap-3">
        {title ? <h2 className="text-2xl font-bold text-ink">{title}</h2> : null}
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <BoxIcon size={18} />
          {t.immersive.spinHint}
        </p>
        {product.description ? <p className="text-ink-soft">{product.description}</p> : null}
        <div>
          <StoreLink href={`/products/${product.slug}`} className={btnPrimary} lang={locale}>
            {t.renderer.viewDetails}
          </StoreLink>
        </div>
      </div>
    </div>
  );
}

/** `orbit_gallery` — the collection as a drum that turns, not a flat grid. */
export async function OrbitGalleryElement({
  props,
  workspaceId,
  currency,
  locale,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const limit = num(props, "limit", 8, 3, 16);
  const collectionId = str(props, "collectionId").trim();

  let products: StorefrontProduct[] = [];
  try {
    const client = await createServerStorefrontApiClient();
    const res = await client.listStorefrontProducts(workspaceId, {
      limit,
      ...(collectionId ? { collectionId } : {}),
    });
    products = res.products;
  } catch {
    return null;
  }
  if (products.length === 0) return null;

  const title = str(props, "title");

  return (
    <div>
      {title ? <h2 className="mb-5 text-2xl font-bold text-ink">{title}</h2> : null}
      <OrbitStage label={title || t.immersive.carousel} prevLabel={t.immersive.previous} nextLabel={t.immersive.next}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} locale={locale} />
        ))}
      </OrbitStage>
    </div>
  );
}

/** `scroll_story` — before/after, or how it's made, step by step. */
export function ScrollStoryElement({ props }: { props: Props }) {
  const raw = props.steps;
  const steps: StoryStep[] = Array.isArray(raw)
    ? raw
        .map((item) => {
          const o = (item ?? {}) as Props;
          return { title: str(o, "title"), body: str(o, "body"), image: safeUrl(str(o, "image")) ?? "" };
        })
        .filter((s) => s.title.trim() !== "" || s.body.trim() !== "")
    : [];

  if (steps.length === 0) return null;
  return <ScrollStory steps={steps} title={str(props, "title") || undefined} />;
}
