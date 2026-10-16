// Runs before `next build`. The policy pages (refund policy, terms, privacy,
// contact) take their text from src/content/policies.json, where every value
// that still needs a decision is written between square brackets:
// "[Contact email]", "[number of days]". Publishing a page with one of those
// left in it would put a placeholder in front of a payment provider's
// reviewer, so a production build stops here until every one is filled in;
// any other build only warns.
//
// Production: NODE_ENV=production, CI=true, or a Railway build
// (RAILWAY_ENVIRONMENT / RAILWAY_ENVIRONMENT_NAME), or POLICY_CHECK=strict.

import { readFileSync } from "node:fs";

const file = new URL("../src/content/policies.json", import.meta.url);
const content = JSON.parse(readFileSync(file, "utf8"));

const found = [];
function walk(node, path) {
  if (typeof node === "string") {
    if (node.includes("[")) found.push({ path, placeholders: node.match(/\[[^\]]*\]?/g) ?? [node] });
  } else if (Array.isArray(node)) {
    node.forEach((value, index) => walk(value, `${path}.${index}`));
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
  }
}
walk(content, "");

const strict =
  process.env.POLICY_CHECK === "strict" ||
  process.env.NODE_ENV === "production" ||
  process.env.CI === "true" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME);

if (found.length === 0) {
  console.log("Policy pages: no placeholders left.");
  process.exit(0);
}

const list = found.map((f) => `  - ${f.path}: ${f.placeholders.join(", ")}`).join("\n");
const summary = `${found.length} text(s) in src/content/policies.json still hold placeholders:\n${list}`;

if (strict) {
  console.error(`\nPolicy pages are not ready to publish. ${summary}\n\nFill them in, then build again.\n`);
  process.exit(1);
}
console.warn(`\nWarning: ${summary}\n\nA production build will refuse to run until they are filled in.\n`);
