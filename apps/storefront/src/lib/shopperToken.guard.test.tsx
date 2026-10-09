// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The shopper's token is read only where the store calls the API for the
 * shopper, never where it renders HTML it did not write: nothing under
 * components/page-renderer, and no file that uses dangerouslySetInnerHTML,
 * may import lib/shopperToken.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const IMPORTS_TOKEN = /from\s+["'](?:@\/lib\/shopperToken|(?:\.\.?\/)+(?:lib\/)?shopperToken)["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("where the shopper token may be read", () => {
  const files = sourceFiles(SRC).map((path) => ({
    name: relative(SRC, path).split(sep).join("/"),
    text: readFileSync(path, "utf8"),
  }));

  it("sees the page renderer, so the check below is not empty", () => {
    expect(files.some((file) => file.name.startsWith("components/page-renderer/"))).toBe(true);
    expect(files.some((file) => file.text.includes("dangerouslySetInnerHTML"))).toBe(true);
  });

  it("is never imported by code that renders HTML we did not write", () => {
    const offenders = files
      .filter((file) => IMPORTS_TOKEN.test(file.text))
      .filter((file) => file.name.startsWith("components/page-renderer/") || file.text.includes("dangerouslySetInnerHTML"))
      .map((file) => file.name);
    expect(offenders).toEqual([]);
  });
});
