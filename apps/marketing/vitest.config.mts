import { fileURLToPath } from "node:url";

/**
 * Tests of the site's server code (`src/**\/*.test.ts` and `*.test.tsx`, in
 * jsdom). The site doesn't install vitest itself: the tests run on the
 * merchant dashboard's copy, like the storefront's — `npm test` here. That is
 * why this file imports nothing from "vitest/config", and why tsconfig.json
 * leaves the test files out (next build checks the rest).
 */
const config = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
};

export default config;
