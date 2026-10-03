import { fileURLToPath } from "node:url";

/**
 * Component tests (`src/**\/*.test.tsx`, rendered in jsdom). The storefront
 * doesn't install vitest itself: its @types/node 20 can't sit beside vitest's
 * peer range, so the tests run on the merchant dashboard's copy —
 * `npm run test:components` here. That is also why this file imports nothing
 * from "vitest/config", and why tsconfig.json leaves the test files out (no
 * "vitest" types to resolve from this workspace); vitest resolves its own
 * imports when it runs them.
 *
 * The pure-logic tests stay on `node --test` (`npm test`, `*.test.mjs`).
 */
const config = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
  },
};

export default config;
