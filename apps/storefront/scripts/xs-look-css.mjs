/**
 * One small stylesheet per imported template ("xs" look), instead of every
 * look in every page of every store:
 *
 *   node scripts/xs-look-css.mjs          write them once
 *   node scripts/xs-look-css.mjs --watch  and again whenever a source changes
 *
 * next.config.ts runs this when the app starts (`next dev`, `next build`,
 * `next start`), watching in development, so nobody has to remember to.
 *
 * For each look NN it takes src/app/xs-look-NN.css (look 01 has none: its
 * rules are the shared defaults in xs-sections.css), puts before it the
 * @font-face rules of src/app/xs-fonts.css whose family that file names,
 * minifies the lot with lightningcss and writes
 * public/xs/NN/look.<content hash>.css. The phone header (src/app/xs-phone.css)
 * becomes public/xs/phone.<hash>.css the same way. src/lib/xsLookCss.json maps
 * each look (and "phone") to its file; components/xs/XsLookStyles reads it.
 * The hash changes with the content, so the files are served as never
 * changing (next.config.ts headers) and an old one is deleted when replaced.
 *
 * What stays in every page is the shared base xs.css imports (bands, pages,
 * home bands, header and footer): a store that wears no look and uses none of
 * its bands loads none of these files.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, unlinkSync, watch, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transform } from "lightningcss";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "src", "app");
const PUBLIC = join(ROOT, "public");
const MANIFEST = join(ROOT, "src", "lib", "xsLookCss.json");

// The browsers the storefront is built for (Tailwind 4's floor): logical
// properties, nesting and :is() pass through as written.
const TARGETS = { chrome: 111 << 16, safari: (16 << 16) | (4 << 8), firefox: 128 << 16 };

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Every look: 01, and each NN with an xs-look-NN.css. */
function looks() {
  const found = readdirSync(APP)
    .map((name) => /^xs-look-(\d\d)\.css$/.exec(name)?.[1])
    .filter(Boolean);
  return ["01", ...found.filter((look) => look !== "01")].sort();
}

/** The @font-face rules of xs-fonts.css, each with its family. */
function faces() {
  const css = read(join(APP, "xs-fonts.css"));
  return [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((match) => ({
    family: /font-family:\s*"([^"]+)"/.exec(match[0])?.[1] ?? "",
    rule: match[0],
  }));
}

/** The families a look's file names; the shared defaults' for a look that sets no type of its own. */
function familiesOf(source) {
  const named = new Set([...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  if (!/--xs-sans\s*:/.test(source)) named.add("XS01 Sans");
  if (!/--xs-display\s*:/.test(source)) named.add("XS01 Display");
  return named;
}

function minify(name, css) {
  const { code } = transform({ filename: name, code: Buffer.from(css), minify: true, targets: TARGETS });
  return code.toString();
}

/** Writes `<dir>/<stem>.<hash>.css` (removing any older one) and returns its public path. */
function emit(dir, stem, css) {
  const hash = hashOf(css);
  const folder = join(PUBLIC, ...dir);
  mkdirSync(folder, { recursive: true });
  const file = `${stem}.${hash}.css`;
  for (const name of readdirSync(folder)) {
    if (name !== file && new RegExp(`^${stem}\\.[0-9a-f]{10}\\.css$`).test(name)) unlinkSync(join(folder, name));
  }
  if (!existsSync(join(folder, file))) writeFileSync(join(folder, file), css);
  return `/${[...dir, file].join("/")}`;
}

/** The part of a file's name that names its content. */
export const hashOf = (css) => createHash("sha256").update(css).digest("hex").slice(0, 10);

/** What each file holds, minified: every look's, and the phone header's. */
export function xsLookBundles() {
  const allFaces = faces();
  const bundles = { looks: {}, phone: minify("xs-phone.css", read(join(APP, "xs-phone.css"))) };
  for (const look of looks()) {
    const path = join(APP, `xs-look-${look}.css`);
    const source = existsSync(path) ? read(path) : "";
    const families = familiesOf(source);
    const fonts = allFaces.filter((face) => families.has(face.family)).map((face) => face.rule);
    bundles.looks[look] = minify(`xs-look-${look}.css`, `${fonts.join("\n")}\n${source}`);
  }
  return bundles;
}

export function buildXsLookCss() {
  const bundles = xsLookBundles();
  const manifest = { looks: {}, phone: emit(["xs"], "phone", bundles.phone) };
  for (const [look, css] of Object.entries(bundles.looks)) manifest.looks[look] = emit(["xs", look], "look", css);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  // Rewritten only when it changes, so a dev server is not sent round a reload for nothing.
  if (!existsSync(MANIFEST) || readFileSync(MANIFEST, "utf8") !== json) writeFileSync(MANIFEST, json);
  return manifest;
}

/** Builds now, then again (debounced) whenever a look's file, the faces or the phone header change. */
export function watchXsLookCss() {
  buildXsLookCss();
  let timer = null;
  watch(APP, (_event, name) => {
    if (!name || !/^xs-(look-\d\d|fonts|phone)\.css$/.test(name)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        buildXsLookCss();
      } catch (error) {
        console.error(`[xs-look-css] ${error.message}`);
      }
    }, 120);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv.includes("--watch")) watchXsLookCss();
  else {
    const manifest = buildXsLookCss();
    console.log(`${Object.keys(manifest.looks).length} looks + phone → src/lib/xsLookCss.json`);
  }
}
