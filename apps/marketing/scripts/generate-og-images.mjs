/**
 * Renders the link-preview images (Open Graph / Twitter cards) into
 * public/og/: one 1200x630 PNG per locale, the dark logo over the dark page
 * background with the locale's page title from the dictionaries.
 *
 * Run by hand when the logo or a title changes, from apps/marketing:
 *   node scripts/generate-og-images.mjs
 *
 * It uses the workspace's Playwright Chromium (a root devDependency), which
 * shapes Arabic properly, and loads the site's own fonts from Google Fonts —
 * Tajawal for Arabic, Fraunces for English — so it needs network access.
 * The PNGs are committed; nothing runs at build time.
 */
import { readFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 300 * 1024;

// The `meta.title` of src/i18n/dictionaries/{en,ar}.ts. Kept in step by hand:
// the dictionaries are TypeScript, which this script does not compile.
const cards = [
  {
    file: "zimos-og-en.png",
    lang: "en",
    dir: "ltr",
    title: "ZIMOS — Commerce Without Limits",
    font: "Fraunces:wght@600",
    family: "'Fraunces', serif",
  },
  {
    file: "zimos-og-ar.png",
    lang: "ar",
    dir: "rtl",
    title: "ZIMOS — تجارة بلا حدود",
    font: "Tajawal:wght@700",
    family: "'Tajawal', sans-serif",
  },
];

function html(card, logo) {
  return `<!doctype html>
<html lang="${card.lang}" dir="${card.dir}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${card.font}&display=block">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; background: #0b1220; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 56px; color: #ffffff; font-family: ${card.family};
  }
  img { height: 150px; width: auto; }
  h1 { margin: 0; padding: 0 60px; font-size: 60px; font-weight: inherit; line-height: 1.25; text-align: center; }
</style>
</head>
<body>
  <img src="data:image/png;base64,${logo}" alt="">
  <h1>${card.title}</h1>
</body>
</html>`;
}

const logo = (await readFile(resolve(root, "public/brand/zimos-logo-dark.png"))).toString("base64");
await mkdir(resolve(root, "public/og"), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const card of cards) {
    await page.setContent(html(card, logo), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const name = card.font.split(":")[0];
    const loaded = await page.evaluate(
      (n) => [...document.fonts].some((f) => f.family.replace(/["']/g, "") === n && f.status === "loaded"),
      name,
    );
    if (!loaded) throw new Error(`${card.file}: the font did not load`);
    const out = resolve(root, "public/og", card.file);
    await page.screenshot({ path: out, type: "png" });
    const { size } = await stat(out);
    if (size > MAX_BYTES) throw new Error(`${card.file}: ${size} bytes, over ${MAX_BYTES}`);
    console.log(`${card.file}: ${size} bytes`);
  }
} finally {
  await browser.close();
}
