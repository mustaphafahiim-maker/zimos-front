import { storefrontSitemap } from "@store-builder/api-client";
import { canonicalOrigin } from "@/lib/domains";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 3600;

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);

/**
 * The store's sitemap, generated from what is actually public: home, the
 * product listing, every active product, the published pages and the written
 * policies (GET /store/:workspaceId/sitemap). Addresses are on the store's
 * canonical origin (its primary domain, else its subdomain), whichever host asked.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId).catch(() => null);
  if (!store) return new Response("Not found", { status: 404 });

  const client = await createServerStorefrontApiClient();
  const entries = await storefrontSitemap(client, workspaceId).catch(() => []);
  const origin = canonicalOrigin(store);
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(`${origin}${entry.path === "/" ? "" : encodeURI(entry.path)}`);
      const lastmod = entry.updatedAt ? `<lastmod>${escapeXml(entry.updatedAt)}</lastmod>` : "";
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
