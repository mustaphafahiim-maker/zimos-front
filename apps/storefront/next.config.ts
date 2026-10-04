import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Security headers for every storefront response (SPEC §3.4-7).
 *
 * The policy is written around what a store really loads: ad pixels and tag
 * managers are third-party scripts that inject more scripts and images from
 * hosts of their own choosing, and a merchant's custom code is inline. So
 * scripts are limited to this origin, inline and https — not a host list that
 * would break the next pixel — while the parts no store needs are shut:
 * plugins (`object-src`), `<base>` hijacking, and http scripts.
 *
 * The dashboard shows stores inside an iframe (theme preview, website
 * editor), so framing is allowed for the origins in
 * STOREFRONT_FRAME_ANCESTORS (space-separated, e.g. "https://app.zimos.co");
 * unset allows any parent, which keeps previews working on a new deployment.
 */
const frameAncestors = (process.env.STOREFRONT_FRAME_ANCESTORS || "").trim() || "*";

// The local API and dashboard are plain http on other ports.
const devHosts = isDev ? " http://localhost:* http://127.0.0.1:*" : "";

const csp = [
  `default-src 'self' https: data: blob:${devHosts}`,
  `script-src 'self' 'unsafe-inline' https:${isDev ? " 'unsafe-eval'" : ""}${devHosts}`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src * data: blob:",
  "media-src * data: blob:",
  "font-src 'self' https: data:",
  `connect-src *${isDev ? " ws: wss:" : ""}`,
  `frame-src https:${devHosts}`,
  "object-src 'none'",
  "base-uri 'self'",
  `frame-ancestors ${frameAncestors === "*" ? "*" : `'self' ${frameAncestors}`}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@store-builder/api-client", "@store-builder/ui", "@store-builder/image-tools", "@store-builder/error-reporter"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
