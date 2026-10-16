import { storefrontStoreApp } from "@store-builder/api-client";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 300;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The store's web app manifest (SPEC §20.2 "a PWA for the store"): what a
 * phone uses for the home-screen icon, name and colour. Answered only while
 * the merchant has the store app on (Settings → Store app); the paths are
 * relative to this file, so the app opens on the store's own home page
 * whether the store is on its subdomain or under /store/<ref>.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId).catch(() => null);
  const app = store ? storefrontStoreApp(store) : null;
  if (!store || !app) return new Response("Not found", { status: 404 });

  const primary = (store.themeSettings as Record<string, unknown> | null | undefined)?.primaryColor;
  const themeColor = app.themeColor ?? (typeof primary === "string" && HEX.test(primary) ? primary : "#111827");
  const arabic = ((store as { defaultLocale?: string }).defaultLocale ?? "ar").toLowerCase().startsWith("ar");
  const icons = app.iconUrl
    ? [
        { src: app.iconUrl, sizes: "192x192", purpose: "any" },
        { src: app.iconUrl, sizes: "512x512", purpose: "any" },
      ]
    : [
        { src: "/brand/zimos-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/brand/zimos-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ];

  const manifest = {
    id: "./",
    name: app.name,
    short_name: app.shortName,
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColor,
    lang: arabic ? "ar" : "en",
    dir: arabic ? "rtl" : "ltr",
    icons,
  };
  return new Response(JSON.stringify(manifest), { headers: { "content-type": "application/manifest+json; charset=utf-8" } });
}
