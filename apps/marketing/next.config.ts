import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site imports `@store-builder/ui/social-links` only — the footer's and
  // the contact page's social links, shared with the dashboard. The package
  // ships TypeScript source, so Next compiles it, as apps/storefront does.
  transpilePackages: ["@store-builder/ui"],
};

export default nextConfig;
