import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { storeOrigin } from "@/lib/domains";
import { getStoreBasePath } from "@/lib/storeRoute";
import { brandStyle, getStoreMeta } from "@/lib/storeMeta";
import { StoreRouteProvider } from "@/components/StoreRoute";

/**
 * Names the store for search engines and for anything that unfurls a link.
 *
 * `metadataBase` is the store's own subdomain rather than whatever host served
 * this request, because that subdomain is the store's real address: a page
 * reached through `/store/<workspaceId>` is the same page, and the relative
 * canonical each route sets resolves against this into the one public URL for
 * it either way.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};

  return {
    metadataBase: new URL(storeOrigin(store.slug)),
    title: { default: store.name, template: `%s — ${store.name}` },
    description: store.tagline ?? undefined,
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description: store.tagline ?? undefined,
      images: store.logoUrl ? [store.logoUrl] : undefined,
    },
  };
}

/**
 * Wraps every page of one store. It establishes the merchant's brand colours
 * once, as CSS custom properties, so the whole subtree (header, buttons, links,
 * badges) picks them up through the semantic tokens — see the `.brand-theme`
 * block in globals.css — and it resolves the store's link prefix once for the
 * client components below it.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [store, basePath] = await Promise.all([
    getStoreMeta(workspaceId),
    getStoreBasePath(workspaceId),
  ]);
  if (!store) notFound();

  return (
    <StoreRouteProvider basePath={basePath}>
      <div className="brand-theme flex min-h-full flex-1 flex-col" style={brandStyle(store.themeSettings)}>
        {children}
      </div>
    </StoreRouteProvider>
  );
}
