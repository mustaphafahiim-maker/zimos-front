import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/urls";

/** Everything may be crawled; the sitemap lists every page in both languages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
