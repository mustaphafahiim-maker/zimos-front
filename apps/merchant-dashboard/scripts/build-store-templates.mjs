// Writes the store templates' generated files from their definitions
// (src/pages/website/templates/xs/xsTemplates.ts): one JSON file per template
// under src/pages/website/templates/generated/, the same template's version
// alone under generated/console/ (what the platform console's "add version"
// takes) with INDEX.md beside them, and the one-product funnel page's
// stand-in pictures under the storefront's public/template-art/
// (src/pages/website/templates/singleProduct.ts).
//
// The definitions import the editor's own blocks, which need the app's module
// aliases, so the work is done by their test files run in their writing mode.
// Run with `npm run templates:build`; a plain test run only compares.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");

const result = spawnSync(
  process.execPath,
  [vitest, "run", "src/pages/website/templates/xs/xsTemplates.test.ts", "src/pages/website/templates/singleProduct.test.ts"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, UPDATE_STORE_TEMPLATES: "1" },
  }
);
process.exit(result.status ?? 1);
