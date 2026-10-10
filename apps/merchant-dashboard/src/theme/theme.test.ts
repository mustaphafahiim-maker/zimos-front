import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8");

function cssFiles(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? cssFiles(`${dir}/${entry.name}`) : entry.name.endsWith(".css") ? [`${dir}/${entry.name}`] : []
  );
}

describe("the dashboard's theme", () => {
  const tokens = read("theme/tokens.css");

  it("has one brand, and every primary shade comes from it", () => {
    expect(tokens.match(/--brand: #[0-9a-f]{6};/g)).toEqual(["--brand: #165dff;"]);
    expect(tokens).toContain("--color-primary: var(--brand);");
    expect(tokens).not.toContain("data-product");
  });

  it("sets the light and the dark neutrals, and the dark card shadow where index.css set its own", () => {
    expect(tokens).toMatch(/:root \{[^}]*--color-paper: #f5f6f8;/);
    expect(tokens).toMatch(/\.dark \{[^}]*--color-paper: #0e1014;/);
    expect(tokens).toMatch(/html\.dark \{\s*--shadow-card: /);
  });

  it("is loaded after index.css, tokens first", () => {
    const main = read("main.tsx");
    const order = ["./index.css", "./theme/tokens.css", "./theme/liquid-glass.css", "./theme/glass/menu.css"].map((file) => main.indexOf(`'${file}'`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("brings no image, font file or stylesheet of its own: colours and shapes only", () => {
    const files = cssFiles("theme");
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toMatch(/url\(/);
      expect(text, file).not.toMatch(/@import/);
      expect(text, file).not.toMatch(/@font-face/);
    }
  });

  it("keeps our logo in the side menu, on the frame the theme styles", () => {
    const layout = read("components/DashboardLayout.tsx");
    expect(layout).toContain('import { ZimosLogo } from "@/components/ZimosLogo";');
    expect(layout).toContain("<ZimosLogo height={24} />");
    expect(layout).toContain('data-slot="side-menu"');
    expect(layout).toContain('data-slot="toolbar"');
  });
});
