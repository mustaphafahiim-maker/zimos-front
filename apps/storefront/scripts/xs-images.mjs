/**
 * Smaller copies of the imported templates' pictures (public/xs/**), for
 * phones and for browsers that read modern formats:
 *
 *   node scripts/xs-images.mjs            only what is missing or older than its original
 *   node scripts/xs-images.mjs --force    everything again
 *
 * Beside each .jpg/.jpeg/.png it writes `<name>.<width>.avif` and
 * `<name>.<width>.webp` for each of 480, 768, 1200 and 1600 — never wider
 * than the original, so for a small picture the larger names hold the
 * original's size. Every template picture having all eight names is what
 * lets a client component write its sources from the address alone
 * (lib/xsPicture.ts). Each picture's own width and height go to
 * src/lib/xsImages.json, for the server components to give the browser the
 * box before the picture arrives. A picture outside public/xs (a merchant's
 * upload) is drawn as a plain <img>, as before.
 *
 * Quality is set so a full-width slide stays near 180 KB at 1600 wide and
 * anything else near 120 KB; the run ends with the copies over that, if any.
 */
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const MANIFEST = join(ROOT, "src", "lib", "xsImages.json");
const WIDTHS = [480, 768, 1200, 1600];
const force = process.argv.includes("--force");

/** Originals only: not the copies this script wrote (`name.768.webp`). */
function originals(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) originals(path, found);
    else if (/\.(jpe?g|png)$/i.test(name)) found.push(path);
  }
  return found;
}

const fresh = (copy, source) => !force && existsSync(copy) && statSync(copy).mtimeMs >= statSync(source).mtimeMs;

const manifest = {};
const over = [];
let written = 0;
const files = originals(join(PUBLIC, "xs")).sort();
for (const file of files) {
  const meta = await sharp(file).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) continue;
  const stem = join(dirname(file), basename(file, extname(file)));
  for (const w of WIDTHS) {
    for (const [format, options] of [
      ["avif", { quality: 52, effort: 4 }],
      ["webp", { quality: 74, effort: 5 }],
    ]) {
      const copy = `${stem}.${w}.${format}`;
      if (!fresh(copy, file)) {
        await sharp(file).resize({ width: w, withoutEnlargement: true })[format](options).toFile(copy);
        written += 1;
      }
      const kb = statSync(copy).size / 1024;
      const budget = w >= 1600 ? 180 : 120;
      if (kb > budget) over.push(`${relative(PUBLIC, copy)} ${Math.round(kb)} KB`);
    }
  }
  manifest[`/${relative(PUBLIC, file).split("\\").join("/")}`] = [width, height];
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest)}\n`);
console.log(`${files.length} pictures, ${written} copies written, manifest ${Object.keys(manifest).length} entries`);
if (over.length) console.log(`Over budget:\n  ${over.join("\n  ")}`);
