import type { StorefrontProduct } from "@store-builder/api-client";

/** The product's videos (media entries of type video/*, http(s) only), in order. */
export function productVideos(product: Pick<StorefrontProduct, "media">): Array<{ url: string; type: string }> {
  const list = Array.isArray(product.media) ? (product.media as unknown[]) : [];
  const out: Array<{ url: string; type: string }> = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const type = typeof o.mimeType === "string" ? o.mimeType : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (type.startsWith("video/") && /^https?:\/\//i.test(url)) out.push({ url, type });
  }
  return out;
}

/** The merchant's product video(s), under the gallery: inline, muted until played, never autoplaying. */
export function ProductVideos({ product, label }: { product: Pick<StorefrontProduct, "media">; label: string }) {
  const videos = productVideos(product);
  if (videos.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {videos.map((v) => (
        <video key={v.url} controls playsInline preload="metadata" aria-label={label} className="aspect-video w-full rounded-2xl border border-line bg-black">
          <source src={v.url} type={v.type} />
        </video>
      ))}
    </div>
  );
}
