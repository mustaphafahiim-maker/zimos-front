import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Kept separate from vite.config.ts: the app build has no reason to carry the
 * test runner's configuration, and the dev-server proxy has no reason to be
 * parsed when running tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        // Pure logic tests: fast, no DOM.
        extends: true,
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // Screen-level component tests rendered in jsdom with a mocked API.
        extends: true,
        test: {
          name: "screens",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
