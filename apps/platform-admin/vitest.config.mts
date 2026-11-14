import { fileURLToPath } from "node:url";

/**
 * Screen tests (`src/**\/*.test.tsx` and `*.test.ts`, rendered in jsdom). The
 * console doesn't install vitest itself: the tests run on the merchant
 * dashboard's copy, like the storefront's — `npm run test:components` here.
 * That is why this file imports nothing from "vitest/config", and why
 * tsconfig.app.json leaves the test files out.
 *
 * The source-reading and pure-logic tests stay on `node --test` (`npm test`, `*.test.mjs`).
 */
const config = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
};

export default config;
