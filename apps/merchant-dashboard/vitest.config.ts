import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

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
        // Screen-level component tests rendered in jsdom with mocked API/auth.
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
