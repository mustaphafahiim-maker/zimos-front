import { canonicalOrigin } from "@/lib/domains";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 3600;

/**
 * The store's robots.txt: everything public may be crawled; the cart, the
 * checkout, order pages, payment pages and staff previews hold nothing a
 * search engine should index. Points at the store's sitemap.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId).catch(() => null);
  if (!store) return new Response("Not found", { status: 404 });

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /orders/",
    "Disallow: /pay/",
    "Disallow: /offer/",
    "Disallow: /preview",
    "",
    `Sitemap: ${canonicalOrigin(store)}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
