import type { NextConfig } from "next";
import { frameAncestorsPolicy } from "./src/lib/frameAncestors";
import { parseImageOrigins } from "./src/lib/imageOrigins";

// Who may frame the store's pages (src/lib/frameAncestors.ts): nothing is sent
// while STOREFRONT_FRAME_ANCESTORS is unset, so any site may, as before.
const frameAncestors = frameAncestorsPolicy(process.env.STOREFRONT_FRAME_ANCESTORS);

const nextConfig: NextConfig = {
  transpilePackages: ["@store-builder/api-client", "@store-builder/ui", "@store-builder/image-tools"],
  async headers() {
    return frameAncestors
      ? [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: frameAncestors }] }]
      : [];
  },
  images: {
    // Resized merchant photos only from the origins listed in
    // NEXT_PUBLIC_STORE_IMAGE_ORIGINS (src/lib/imageOrigins.ts); none when it
    // is unset, and then components/StoreImage draws plain <img> as before.
    remotePatterns: parseImageOrigins(process.env.NEXT_PUBLIC_STORE_IMAGE_ORIGINS).map((url) => ({
      protocol: url.protocol === "http:" ? ("http" as const) : ("https" as const),
      hostname: url.hostname,
      port: url.port,
      pathname: "/**",
    })),
    // One quality, so the optimizer can't be asked for any other (Next 16 requires the list).
    qualities: [75],
    // The dashboard lets through uploads of up to 5 MB untouched.
    maximumResponseBody: 10_000_000,
  },
};

export default nextConfig;
