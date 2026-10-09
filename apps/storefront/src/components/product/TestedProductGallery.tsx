"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { productImages } from "@/lib/product";
import { useProductTest } from "@/lib/productTest";
import { useChosenVariantImage } from "@/lib/variantImage";
import { ProductGallery } from "./ProductGallery";

/**
 * The product's photos, or the photos of the A/B test variant this visitor is
 * in (lib/productTest).
 *
 * The order of the photos is settled once, on the server, and kept for the
 * life of the page: the picture of the variant the page opens on (`leadImage`,
 * worked out by the page the same way the buy box picks its first variant),
 * then the product's photos. When the shopper chooses a variant with its own
 * picture the gallery glides to that slide — it is not rebuilt, so the frame
 * never empties and the first photo is never swapped after the page arrived.
 * A variant's picture the product's photos do not hold is added as the last
 * slide while that variant is chosen.
 *
 * While a running test has not answered, its photos are not known and may
 * differ from the product's own, so they are not shown (nobody sees one
 * variant's photos and then the other's). A variant's own picture is not part
 * of a test: when the page opens on one it shows at once, and the test's
 * photos join it after. Either way the frame — and the thumbnails' row — hold
 * their place while the answer is on its way.
 */
export function TestedProductGallery({
  workspaceId,
  product,
  leadImage = null,
}: {
  workspaceId: string;
  product: StorefrontProduct;
  /** The picture of the variant the page opens on, when it has its own (null otherwise). */
  leadImage?: string | null;
}) {
  const { product: shown, pending } = useProductTest(workspaceId, product);
  const variantImage = useChosenVariantImage(product.id);
  // Until the buy box has said which variant is chosen, the page is on the one it opened with.
  const [said, setSaid] = useState(false);
  useEffect(() => {
    if (variantImage) setSaid(true);
  }, [variantImage]);

  const photos = useMemo(() => (pending ? [] : productImages(shown)), [pending, shown]);
  const base = useMemo(
    () => (leadImage ? [leadImage, ...photos.filter((url) => url !== leadImage)] : photos),
    [leadImage, photos]
  );
  const slides = useMemo(
    () => (variantImage && !base.includes(variantImage) ? [...base, variantImage] : base),
    [base, variantImage]
  );
  // What the chosen variant shows: its own picture, else the product's first photo.
  const focus = variantImage ?? (said ? (photos[0] ?? null) : (leadImage ?? photos[0] ?? null));
  // The product's own count stands in for the test's while it is not known.
  const expected = pending ? Math.max(1, productImages(product).length) : 0;

  return <ProductGallery images={slides} name={product.name} focusSrc={focus} expected={expected} />;
}
