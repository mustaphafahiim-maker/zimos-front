import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No workspace packages are consumed yet (the marketing site is standalone
  // and has no dynamic data). If a follow-up wires in `@store-builder/ui`,
  // add it to `transpilePackages` here — mirroring apps/storefront.
  experimental: {
    // The root layout lives under `[locale]`, so URLs that match no route are
    // served by src/app/global-not-found.tsx (it brings its own <html>).
    globalNotFound: true,
  },
};

export default nextConfig;
