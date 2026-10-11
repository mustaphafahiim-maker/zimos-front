// Writes the store templates' generated files from their definitions
// (src/pages/website/templates/storeTemplates.ts): one JSON file per template
// under src/pages/website/templates/generated/, and the stand-in pictures under
// the storefront's public/template-art/.
//
// The definitions import the editor's own blocks, which need the app's module
// aliases, so the work is done by their test file run in its writing mode.
// Run with `npm run templates:build`; a plain test run only compares.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");

const result = spawnSync(process.execPath, [vitest, "run", "src/pages/website/templates/storeTemplates.test.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, UPDATE_STORE_TEMPLATES: "1" },
});
process.exit(result.status ?? 1);
