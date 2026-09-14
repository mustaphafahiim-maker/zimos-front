import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { PAGE_PATHS } from "@/lib/routes";
import { SITE_URL } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: PAGE_PATHS.flatMap((path) => locales.map((locale) => `/${locale}${path}`)),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
