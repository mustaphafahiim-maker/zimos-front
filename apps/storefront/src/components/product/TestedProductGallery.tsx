"use client";

import type { StorefrontProduct } from "@store-builder/api-client";
import { productImages } from "@/lib/product";
import { useProductTest } from "@/lib/productTest";
import { useChosenVariantImage } from "@/lib/variantImage";
import { ProductGallery } from "./ProductGallery";
import { skeleton } from "../ui";

/**
 * The product's photos, or the photos of the A/B test variant this visitor is
 * in (lib/productTest). While a running test has not answered yet the frame
 * stays empty, so nobody sees one variant's photos and then the other's.
 */
export function TestedProductGallery({ workspaceId, product }: { workspaceId: string; product: StorefrontProduct }) {
  const { product: shown, pending } = useProductTest(workspaceId, product);
  // The chosen variant's own picture leads (lib/variantImage); the gallery starts over on it.
  const variantImage = useChosenVariantImage(product.id);
  if (pending) return <div className={`aspect-square w-full rounded-2xl ${skeleton}`} aria-hidden />;
  const images = productImages(shown);
  const shownImages = variantImage ? [variantImage, ...images.filter((url) => url !== variantImage)] : images;
  return <ProductGallery key={variantImage ?? "product"} images={shownImages} name={product.name} />;
}
