import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@store-builder/api-client", "@store-builder/ui", "@store-builder/store-renderer"],
};

export default nextConfig;
