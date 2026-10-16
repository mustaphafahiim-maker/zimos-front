// Adds the store templates under src/pages/website/templates/generated/ to the
// platform console the way its Templates page does by hand
// (apps/platform-admin/src/pages/TemplatesPage.tsx), one template at a time in
// the order of generated/console/INDEX.md:
//
//   New template   POST /admin/templates                the form's body
//   New version    POST /admin/templates/:id/versions   the version file whole,
//                                                       made the gallery's version
//   Publish        POST /admin/templates/:id/publish
//
// Besides those it only reads the list (GET /admin/templates) to find what is
// already there. Nothing is ever changed or removed: no PATCH, no DELETE, no
// unpublish, so a template already in the console (the funnel's included) is
// left exactly as it is.
//
// The command line is import-store-templates.mjs; README.md beside it has the
// commands.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const DATA_DIR = fileURLToPath(new URL("../src/pages/website/templates/generated/", import.meta.url));

// The checks the API's validator makes (Backend
// src/modules/platformAdmin/platformAdminValidation.js), repeated so a dry run
// finds what the server would refuse. They matter more than they look: the
// validator runs with stripUnknown, so a key it does not know is dropped
// without an error, and a version would land with part of it missing.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TEMPLATE_KINDS = ["store", "funnel", "landing"];
const PAGE_TYPES = ["home", "product", "collection", "static", "blog_post", "cart", "custom"];
const PAGE_KEYS = ["path", "title", "pageType", "builderData", "seo"];
const VERSION_KEYS = ["globalStyles", "pages", "sections"];
const MAX_PAGES = 50;
const MAX_SECTIONS = 200;
const MAX_TAGS = 20;
// express.json({ limit: "2mb" }) in the API's app.js.
const BODY_LIMIT = 2 * 1024 * 1024;

// Under this many requests left in the API's window the next one waits for the
// window to reset (the general limiter counts per signed-in user, 100 a minute
// unless RATE_LIMIT_MAX says otherwise, and the console open in a browser
// spends from the same allowance). A wait is cheaper than a 429 half way.
const RATE_LIMIT_RESERVE = 5;
const MAX_RATE_LIMIT_WAIT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 60_000;

export class UsageError extends Error {}

/** A request that failed, with everything the server said about it. */
export class RequestError extends Error {
  constructor({ method, path, status = null, payload = null, text = "", retryAfter = null, cause = null, message }) {
    super(message ?? (status ? `HTTP ${status}` : `No response (${describeCause(cause)})`));
    this.method = method;
    this.path = path;
    this.status = status;
    this.payload = payload;
    this.text = text;
    this.retryAfter = retryAfter;
    this.cause = cause;
  }
}

function describeCause(cause) {
  if (!cause) return "unknown error";
  const inner = cause.cause && (cause.cause.code || cause.cause.message);
  return [cause.name === "TimeoutError" ? "timed out" : cause.message, inner].filter(Boolean).join(": ");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// ------------------------------------------------------------------ the files

/**
 * The rows of INDEX.md's table, in order. A cell that cannot be read is kept
 * as found and reported by the checks, so one bad row does not hide the rest.
 */
export function parseIndex(markdown) {
  const rows = [];
  const problems = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(line);
    if (!match) continue;
    const cells = match[2].split("|").map((cell) => cell.trim());
    if (cells.length !== 7) {
      problems.push(`INDEX.md row ${match[1]} has ${cells.length + 1} columns instead of 8`);
      continue;
    }
    const [key, name, category, tags, rtl, primaryColor, versionFile] = cells;
    rows.push({
      n: Number(match[1]),
      key,
      name,
      category,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      rtl: rtl === "true" ? true : rtl === "false" ? false : rtl,
      primaryColor,
      versionFile,
    });
  }
  if (rows.length === 0 && problems.length === 0) problems.push("INDEX.md has no template rows");
  return { rows, problems };
}

/** Every file the import reads, as text: INDEX.md, generated/*.json and generated/console/*.json. */
export function readTemplateFiles(dir = DATA_DIR) {
  const consoleDir = join(dir, "console");
  const indexPath = join(consoleDir, "INDEX.md");
  const files = { index: existsSync(indexPath) ? readFileSync(indexPath, "utf8") : null, generated: {}, console: {} };
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".json")) files.generated[name] = readFileSync(join(dir, name), "utf8");
    }
  }
  if (existsSync(consoleDir)) {
    for (const name of readdirSync(consoleDir)) {
      if (name.endsWith(".json")) files.console[name] = readFileSync(join(consoleDir, name), "utf8");
    }
  }
  return files;
}

function parseJson(text, label, problems) {
  if (text === undefined || text === null) {
    problems.push(`${label} is missing`);
    return null;
  }
  try {
    return JSON.parse(stripBom(text));
  } catch (err) {
    problems.push(`${label} is not valid JSON (${err.message})`);
    return null;
  }
}

/**
 * The templates to import, in INDEX.md's order, each with what the console
 * would be sent and the problems that stop it from being sent. Three sources
 * say the same thing and must agree: INDEX.md (what a person pasting by hand
 * reads), generated/<key>.json (the whole template) and console/<key>.json
 * (the version alone, the file that gets pasted).
 */
export function collectTemplates(files) {
  const problems = [];
  if (files.index === null) return { entries: [], problems: ["generated/console/INDEX.md is missing"] };

  const { rows, problems: indexProblems } = parseIndex(files.index);
  problems.push(...indexProblems);

  rows.forEach((row, i) => {
    if (row.n !== i + 1) problems.push(`INDEX.md row ${i + 1} is numbered ${row.n}`);
  });
  const seen = { key: new Set(), name: new Set() };
  for (const row of rows) {
    if (seen.key.has(row.key)) problems.push(`INDEX.md lists the key ${row.key} twice`);
    if (seen.name.has(row.name)) problems.push(`INDEX.md lists the name "${row.name}" twice`);
    seen.key.add(row.key);
    seen.name.add(row.name);
  }
  const listed = new Set(rows.map((row) => row.versionFile));
  for (const name of Object.keys(files.console)) {
    if (!listed.has(name)) problems.push(`console/${name} is not in INDEX.md`);
  }

  const entries = rows.map((row) => {
    const entryProblems = [];
    if (row.versionFile !== `${row.key}.json`) {
      entryProblems.push(`its version file is ${row.versionFile}, expected ${row.key}.json`);
    }
    const whole = parseJson(files.generated[`${row.key}.json`], `generated/${row.key}.json`, entryProblems);
    const version = parseJson(files.console[row.versionFile], `console/${row.versionFile}`, entryProblems);

    const meta = {
      key: row.key,
      name: row.name,
      category: row.category,
      kind: isPlainObject(whole) && typeof whole.kind === "string" ? whole.kind : "store",
      tags: row.tags,
      rtl: row.rtl,
      primaryColor: row.primaryColor,
    };

    if (isPlainObject(whole)) {
      for (const field of ["key", "name", "category", "tags", "rtl", "primaryColor"]) {
        if (!isDeepStrictEqual(whole[field], meta[field])) {
          entryProblems.push(
            `INDEX.md says ${field} ${JSON.stringify(meta[field])}, generated/${row.key}.json says ${JSON.stringify(whole[field])}`
          );
        }
      }
      if (version !== null && !isDeepStrictEqual(whole.version, version)) {
        entryProblems.push(
          `console/${row.versionFile} is not the version in generated/${row.key}.json (run npm run templates:build)`
        );
      }
    } else if (whole !== null) {
      entryProblems.push(`generated/${row.key}.json is not a JSON object`);
    }

    if (entryProblems.length === 0) entryProblems.push(...checkTemplate(meta, version));
    return { n: row.n, key: row.key, meta, version, stats: versionStats(version), problems: entryProblems };
  });

  return { entries, problems };
}

// ------------------------------------------------------------------ the bodies

/**
 * The body the console's "New template" form sends (TemplateModal.submit),
 * field for field: no thumbnail (an empty URL, which the server stores as
 * NULL), free, price 0.
 */
export function templateBody(meta) {
  return {
    name: meta.name.trim(),
    category: meta.category.trim(),
    thumbnailUrl: "",
    kind: meta.kind,
    priceAmount: 0,
    isFree: true,
    primaryColor: meta.primaryColor.trim(),
    tags: meta.tags.map((tag) => tag.trim()).filter(Boolean),
    rtl: meta.rtl,
  };
}

/** What its "New version" form sends (VersionForm.submit), "Make it the version the gallery offers" left on. */
export function versionBody(version) {
  return {
    globalStyles: version.globalStyles ?? {},
    pages: version.pages,
    sections: version.sections ?? [],
    activate: true,
  };
}

function byteSize(body) {
  return Buffer.byteLength(JSON.stringify(body), "utf8");
}

/** Pages, elements and the size of the version body, for the dry run's table. */
export function versionStats(version) {
  if (!isPlainObject(version) || !Array.isArray(version.pages)) return { pages: 0, elements: 0, bytes: 0 };
  let elements = 0;
  for (const page of version.pages) {
    for (const section of page?.builderData?.sections ?? []) {
      for (const row of section?.rows ?? []) {
        for (const column of row?.columns ?? []) {
          elements += Array.isArray(column?.elements) ? column.elements.length : 0;
        }
      }
    }
  }
  return { pages: version.pages.length, elements, bytes: byteSize(versionBody(version)) };
}

// The path a website keys its pages by (templateService.validateVersionPages).
function normalizePath(path) {
  return (
    String(path || "/")
      .trim()
      .toLowerCase()
      .replace(/\/{2,}/g, "/")
      .replace(/(.)\/+$/, "$1") || "/"
  );
}

/** What the server's validator would refuse, or silently drop, in this template and its version. */
export function checkTemplate(meta, version) {
  const problems = [];

  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name.length < 1 || name.length > 200) problems.push("name must be 1 to 200 characters");
  if (typeof meta.category !== "string" || meta.category.trim().length > 100) {
    problems.push("category must be text of at most 100 characters");
  }
  if (!TEMPLATE_KINDS.includes(meta.kind)) problems.push(`kind "${meta.kind}" is not one the API knows`);
  else if (meta.kind !== "store") problems.push(`kind is "${meta.kind}"; this import adds store templates only`);
  if (!Array.isArray(meta.tags) || meta.tags.length > MAX_TAGS) problems.push(`at most ${MAX_TAGS} tags`);
  else if (meta.tags.some((tag) => typeof tag !== "string" || tag.trim().length < 1 || tag.trim().length > 60)) {
    problems.push("every tag must be 1 to 60 characters");
  }
  if (typeof meta.primaryColor !== "string" || !HEX_COLOR.test(meta.primaryColor.trim())) {
    problems.push(`primaryColor ${JSON.stringify(meta.primaryColor)} is not a hex colour`);
  }
  if (typeof meta.rtl !== "boolean") problems.push(`rtl ${JSON.stringify(meta.rtl)} is neither true nor false`);
  // The Arabic copies are the right-to-left ones, and only they are.
  else if (meta.rtl !== meta.key.endsWith("-ar")) {
    problems.push(`rtl is ${meta.rtl} but the key ${meta.key} ${meta.key.endsWith("-ar") ? "is" : "is not"} an Arabic copy`);
  }

  if (!isPlainObject(version)) {
    problems.push("the version file is not a JSON object");
    return problems;
  }
  for (const key of Object.keys(version)) {
    if (!VERSION_KEYS.includes(key)) problems.push(`the version has a key "${key}" the API would drop`);
  }
  if (version.globalStyles !== undefined && !isPlainObject(version.globalStyles)) {
    problems.push("globalStyles must be an object");
  }
  if (version.sections !== undefined) {
    if (!Array.isArray(version.sections) || version.sections.length > MAX_SECTIONS) {
      problems.push(`sections must be a list of at most ${MAX_SECTIONS}`);
    } else if (!version.sections.every(isPlainObject)) {
      problems.push("every entry of sections must be an object");
    }
  }
  if (!Array.isArray(version.pages) || version.pages.length < 1 || version.pages.length > MAX_PAGES) {
    problems.push(`pages must be a list of 1 to ${MAX_PAGES}`);
    return problems;
  }

  const paths = new Set();
  version.pages.forEach((page, i) => {
    const at = `pages[${i}]`;
    if (!isPlainObject(page)) {
      problems.push(`${at} is not an object`);
      return;
    }
    for (const key of Object.keys(page)) {
      if (!PAGE_KEYS.includes(key)) problems.push(`${at} has a key "${key}" the API would drop`);
    }
    const path = typeof page.path === "string" ? page.path.trim() : "";
    if (path.length < 1 || path.length > 200) problems.push(`${at}.path must be 1 to 200 characters`);
    if (page.title !== undefined && (typeof page.title !== "string" || page.title.trim().length > 200)) {
      problems.push(`${at}.title must be text of at most 200 characters`);
    }
    if (page.pageType !== undefined && !PAGE_TYPES.includes(page.pageType)) {
      problems.push(`${at}.pageType "${page.pageType}" is not one the API knows`);
    }
    if (page.builderData !== undefined && !isPlainObject(page.builderData)) problems.push(`${at}.builderData must be an object`);
    if (page.seo !== undefined && !isPlainObject(page.seo)) problems.push(`${at}.seo must be an object`);
    const normalized = normalizePath(page.path);
    if (paths.has(normalized)) problems.push(`two pages use the path "${normalized}"`);
    paths.add(normalized);
  });

  const bytes = byteSize(versionBody(version));
  if (bytes > BODY_LIMIT) problems.push(`the version is ${bytes} bytes, over the API's 2 MB body limit`);
  return problems;
}

// ------------------------------------------------------------------ choosing

/** The templates --only / --from ask for, in INDEX.md's order. */
export function selectEntries(entries, { only = null, from = null } = {}) {
  if (only && from) throw new UsageError("--only and --from cannot be used together");
  const key = only ?? from;
  if (!key) return entries;
  const at = entries.findIndex((entry) => entry.key === key);
  if (at === -1) throw new UsageError(`${only ? "--only" : "--from"} ${key}: no template with that key in INDEX.md`);
  return only ? [entries[at]] : entries.slice(at);
}

export function parseArgs(argv) {
  const args = { apply: false, only: null, from: null, resumeIncomplete: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    switch (flag) {
      case "--apply":
        args.apply = true;
        break;
      case "--resume-incomplete":
        args.resumeIncomplete = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--only":
      case "--from": {
        const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
        if (!value || value.startsWith("-")) throw new UsageError(`${flag} needs a template key, e.g. ${flag} xs-01`);
        args[flag.slice(2)] = value.trim();
        break;
      }
      default:
        throw new UsageError(`Unknown option: ${arg}`);
    }
  }
  if (args.only && args.from) throw new UsageError("--only and --from cannot be used together");
  return args;
}

// ------------------------------------------------------------------ settings

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return isPlainObject(payload) ? payload : null;
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The API base and the access token, from ZIMOS_API_URL and ZIMOS_ADMIN_TOKEN
 * only. There is no default URL, so a run never reaches a server nobody named.
 * Messages never contain the token.
 */
export function readConfig(env, now = Date.now()) {
  const problems = [];

  let baseUrl = null;
  const rawUrl = String(env.ZIMOS_API_URL ?? "").trim();
  if (!rawUrl) {
    problems.push(
      "ZIMOS_API_URL is not set. Set it to the API base the console calls (its VITE_API_BASE_URL), ending in /api/v1. There is no default on purpose."
    );
  } else {
    let url = null;
    try {
      url = new URL(rawUrl);
    } catch {
      problems.push(`ZIMOS_API_URL "${rawUrl}" is not a URL`);
    }
    if (url) {
      const path = url.pathname.replace(/\/+$/, "");
      if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
        problems.push("ZIMOS_API_URL must be https:// (plain http:// only for localhost), so the token does not travel in clear");
      } else if (url.username || url.password || url.search || url.hash) {
        problems.push("ZIMOS_API_URL must not carry a user name, a password, a query or a #fragment");
      } else if (!/\/api\/v\d+$/.test(path)) {
        problems.push(`ZIMOS_API_URL must end in /api/v1 (it ends in "${path || "/"}")`);
      } else {
        baseUrl = `${url.origin}${path}`;
      }
    }
  }

  let token = String(env.ZIMOS_ADMIN_TOKEN ?? "").trim();
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();
  if (token.length >= 2 && (token[0] === '"' || token[0] === "'") && token.at(-1) === token[0]) token = token.slice(1, -1);
  let tokenExpiresAt = null;
  if (!token) {
    problems.push("ZIMOS_ADMIN_TOKEN is not set (the console's access token, see README.md)");
    token = null;
  } else {
    const payload = decodeJwtPayload(token);
    if (!payload) {
      problems.push(
        "ZIMOS_ADMIN_TOKEN does not look like an access token (three dot-separated parts). The refresh token will not do: copy sb.accessToken"
      );
      token = null;
    } else if (typeof payload.exp === "number") {
      tokenExpiresAt = payload.exp * 1000;
      if (tokenExpiresAt <= now) {
        problems.push("ZIMOS_ADMIN_TOKEN has expired: copy a fresh one from the console (README.md)");
        token = null;
      }
    }
  }

  return { baseUrl, token, tokenExpiresAt, problems };
}

// ------------------------------------------------------------------ the API

// How long to wait before the next request, from the limiter's headers:
// RateLimit-Remaining / RateLimit-Reset (what the API sends today), or the
// combined RateLimit header of the later drafts ("remaining=7, reset=42" or
// "r=7; t=42").
function rateLimitWait(headers) {
  let remaining = headers.get("ratelimit-remaining");
  let reset = headers.get("ratelimit-reset");
  const combined = headers.get("ratelimit");
  if (remaining === null && combined) {
    remaining = /(?:^|[;,\s])(?:remaining|r)=(\d+)/.exec(combined)?.[1] ?? null;
    reset = /(?:^|[;,\s])(?:reset|t)=(\d+)/.exec(combined)?.[1] ?? null;
  }
  if (remaining === null) return 0;
  const left = Number(remaining);
  if (!Number.isFinite(left) || left > RATE_LIMIT_RESERVE) return 0;
  const seconds = Number(reset);
  return Math.min((Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000, MAX_RATE_LIMIT_WAIT_MS);
}

/**
 * The four calls, through `fetchImpl`. Only GET /admin/templates and the three
 * POSTs exist here; there is no way to send anything else.
 */
export function createApi({ baseUrl, token, fetchImpl = globalThis.fetch, log = () => {}, sleep = defaultSleep }) {
  let waitMs = 0;

  async function request(method, path, body) {
    if (waitMs > 0) {
      log(`  (waiting ${Math.ceil(waitMs / 1000)} s for the API's rate limit window)`);
      await sleep(waitMs);
      waitMs = 0;
    }
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        // A redirect is a wrong URL, not something to follow with the token.
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new RequestError({ method, path, cause });
    }
    waitMs = rateLimitWait(res.headers);
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!res.ok) {
      throw new RequestError({ method, path, status: res.status, payload, text, retryAfter: res.headers.get("retry-after") });
    }
    return { status: res.status, payload, text };
  }

  function unexpected(method, path, reply, expected) {
    return new RequestError({
      method,
      path,
      status: reply.status,
      payload: reply.payload,
      text: reply.text,
      message: `HTTP ${reply.status}, but the reply is not ${expected}`,
    });
  }

  return {
    async listTemplates() {
      const path = "/admin/templates";
      const reply = await request("GET", path);
      if (!Array.isArray(reply.payload?.templates)) throw unexpected("GET", path, reply, "{ templates: [...] }");
      return reply.payload.templates;
    },
    async createTemplate(body) {
      const path = "/admin/templates";
      const reply = await request("POST", path, body);
      const template = reply.payload?.template;
      if (!isPlainObject(template) || typeof template.id !== "string") throw unexpected("POST", path, reply, "{ template: { id } }");
      return template;
    },
    async addVersion(templateId, body) {
      const path = `/admin/templates/${encodeURIComponent(templateId)}/versions`;
      const reply = await request("POST", path, body);
      const version = reply.payload?.version;
      if (!isPlainObject(version) || typeof version.version !== "number") throw unexpected("POST", path, reply, "{ version: { version } }");
      return version;
    },
    async publish(templateId) {
      const path = `/admin/templates/${encodeURIComponent(templateId)}/publish`;
      const reply = await request("POST", path);
      const template = reply.payload?.template;
      if (!isPlainObject(template) || template.isPublished !== true) throw unexpected("POST", path, reply, "a published template");
      return template;
    },
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------ dry run

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** The table of what would be sent, and every problem found. True when nothing stops the import. */
export function printPlan(entries, globalProblems, { log }) {
  const columns = [
    ["#", 3, (e) => e.n],
    ["key", 10, (e) => e.key],
    ["name", 14, (e) => e.meta.name],
    ["kind", 6, (e) => e.meta.kind],
    ["category", 15, (e) => e.meta.category],
    ["rtl", 6, (e) => e.meta.rtl],
    ["tags", 7, (e) => e.meta.tags.join(",")],
    ["colour", 8, (e) => e.meta.primaryColor],
    ["pages", 6, (e) => e.stats.pages],
    ["elements", 9, (e) => e.stats.elements],
    ["version", 0, (e) => kb(e.stats.bytes)],
  ];
  const line = (cells) => cells.map((cell, i) => (columns[i][1] ? pad(cell, columns[i][1]) : cell)).join(" ").trimEnd();
  log(line(columns.map(([title]) => title)));
  for (const entry of entries) log(line(columns.map(([, , cell]) => cell(entry))));

  const failing = entries.filter((entry) => entry.problems.length > 0);
  if (globalProblems.length > 0 || failing.length > 0) {
    log("");
    log("Problems:");
    for (const problem of globalProblems) log(`  - ${problem}`);
    for (const entry of failing) for (const problem of entry.problems) log(`  - #${entry.n} ${entry.key}: ${problem}`);
    return false;
  }
  const total = entries.reduce((sum, entry) => sum + entry.stats.bytes, 0);
  log("");
  log(`${entries.length === 1 ? "1 template checks" : `${entries.length} templates check`} out (${kb(total)} of versions).`);
  return true;
}

// ------------------------------------------------------------------ applying

// Fields compared with a template already in the console. Only reported: a
// template that is there is never changed.
const COMPARED = ["category", "tags", "rtl", "primaryColor"];

function differences(row, body) {
  const out = [];
  for (const field of COMPARED) {
    // The server keeps "" as NULL, and a colour typed by hand may be lower case.
    const theirs = field === "tags" ? row.tags ?? [] : field === "rtl" ? row.rtl : row[field] ?? "";
    const same =
      field === "primaryColor"
        ? String(theirs).toLowerCase() === body.primaryColor.toLowerCase()
        : isDeepStrictEqual(theirs, body[field]);
    if (!same) {
      out.push(`${field} is ${JSON.stringify(theirs)} in the console, ${JSON.stringify(body[field])} in the file`);
    }
  }
  return out;
}

const STEP_TEXT = {
  list: "while reading the templates already in the console",
  create: "while creating the template",
  version: "while adding its version",
  publish: "while publishing it",
};

function hintFor(err) {
  const code = err.payload?.error?.code;
  const message = String(err.payload?.error?.message ?? "");
  const details = JSON.stringify(err.payload?.error?.details ?? "");
  switch (err.status) {
    case null:
      return "The API did not answer. Check ZIMOS_API_URL and the connection, then run again: what was finished is skipped.";
    case 401:
      return "The token was refused (expired, signed out, or a different server). Copy a fresh one (README.md) and run again: what was finished is skipped.";
    case 403:
      return "This account may not manage templates (platform permission templates.manage).";
    case 404:
      return "Not found: check that ZIMOS_API_URL is the API base ending in /api/v1.";
    case 409:
      return `The server refused it as a conflict (${code ?? "no code"}).`;
    case 413:
      return "The body is over the API's size limit.";
    case 422:
      return /Unknown element type/.test(message + details)
        ? 'The server does not know an element type in this version: the backend that allows the xs_* types (feat/xs-element-types) is not live on this server.'
        : "The server's validator refused it; the details above name the field.";
    case 429:
      return `Rate limited${err.retryAfter ? `; the server asks to wait ${err.retryAfter} s` : ""}. Wait, then run again: what was finished is skipped.`;
    default:
      return err.status >= 500 ? "A server error: the requestId above finds it in the API's logs." : null;
  }
}

function printFailure(err, { log, entry, step, total, done, state }) {
  log("");
  log(entry ? `STOPPED at #${entry.n} ${entry.key} ("${entry.meta.name}"), ${STEP_TEXT[step]}.` : `STOPPED ${STEP_TEXT[step]}.`);
  log(`  ${err.method} ${err.path}`);
  log(`  ${err.status ? `HTTP ${err.status}` : `No response: ${describeCause(err.cause)}`}`);
  if (err.status && err.message !== `HTTP ${err.status}`) log(`  ${err.message}`);
  if (err.payload !== null) {
    log("  Response:");
    for (const text of JSON.stringify(err.payload, null, 2).split("\n")) log(`    ${text}`);
  } else if (err.text) {
    log("  Response (not JSON):");
    log(`    ${err.text}`);
  }
  if (err.retryAfter) log(`  Retry-After: ${err.retryAfter}`);
  const hint = hintFor(err);
  if (hint) log(`  ${hint}`);

  if (entry) {
    log("");
    log(`What happened to ${entry.key}:`);
    if (step === "create") {
      log("  nothing on the server (or, if the reply was lost on the way, a template with this name and no version:");
      log("  the next run lists it, and --resume-incomplete finishes it).");
    } else {
      log(`  the template exists (id ${state.templateId})${state.version ? `, version ${state.version} added and active` : ", with no version"}, not published.`);
      log("  It is not in the gallery. After fixing the cause run again with");
      log(`  --from ${entry.key} --resume-incomplete to finish it, or delete it in the console.`);
    }
  }
  log("");
  log(`Before it (${done.length} of ${total}):`);
  printDone(done, log);
}

function printDone(done, log) {
  const groups = [
    ["created", "created and published"],
    ["resumed", "finished from an earlier run"],
    ["present", "already there, left alone"],
    ["attention", "left alone, look at these"],
  ];
  let any = false;
  for (const [outcome, title] of groups) {
    const keys = done.filter((d) => d.outcome === outcome).map((d) => d.key);
    if (keys.length === 0) continue;
    any = true;
    log(`  ${title} (${keys.length}): ${keys.join(", ")}`);
  }
  if (!any) log("  nothing");
}

/**
 * Creates, versions and publishes each entry in order. A template whose name a
 * store template in the console already has is skipped, never duplicated. The
 * first failed request stops the run. Returns the exit code.
 */
export async function applyTemplates(entries, { api, log, resumeIncomplete = false }) {
  const done = [];
  const attention = [];

  let existing;
  try {
    existing = await api.listTemplates();
  } catch (err) {
    if (!(err instanceof RequestError)) throw err;
    printFailure(err, { log, entry: null, step: "list", total: entries.length, done, state: {} });
    return 1;
  }
  const byName = new Map();
  for (const row of existing) {
    if (row.kind !== "store" || typeof row.name !== "string") continue;
    const name = row.name.trim();
    byName.set(name, [...(byName.get(name) ?? []), row]);
  }
  log(`The console has ${existing.length} template${existing.length === 1 ? "" : "s"} (${[...byName.values()].flat().length} of them store).`);
  log("");

  for (const [i, entry] of entries.entries()) {
    const label = `[${i + 1}/${entries.length}] #${entry.n} ${pad(entry.key, 10)} ${entry.meta.name}`;
    const body = templateBody(entry.meta);
    const matches = byName.get(body.name) ?? [];
    const note = (outcome, text) => {
      done.push({ key: entry.key, outcome });
      if (outcome === "attention") attention.push(`#${entry.n} ${entry.key} ("${entry.meta.name}"): ${text}`);
      log(`${label}: ${text}`);
    };

    if (matches.length > 1) {
      note("attention", `${matches.length} store templates already have this name (${matches.map((m) => m.id).join(", ")}); none touched`);
      continue;
    }

    const state = { templateId: null, version: null };
    let step = "create";
    try {
      if (matches.length === 1) {
        const row = matches[0];
        const diffs = differences(row, body);
        const where = `id ${row.id}, ${row.versionCount} version${row.versionCount === 1 ? "" : "s"}`;
        if (row.isPublished && row.activeVersion !== null) {
          if (diffs.length) note("attention", `already in the gallery (${where}) but ${diffs.join("; ")}`);
          else note("present", `already in the gallery (${where}, v${row.activeVersion} offered), skipped`);
          continue;
        }
        if (row.versionCount !== 0) {
          note("attention", `already there unpublished (${where}); not touched. Publish it in the console if it is ready`);
          continue;
        }
        // No version at all: what a run that stopped after "create" leaves.
        if (!resumeIncomplete) {
          note("attention", `already there with no version (${where}). Run with --resume-incomplete to add its version and publish it, or delete it in the console`);
          continue;
        }
        if (diffs.length) {
          note("attention", `already there with no version, but ${diffs.join("; ")}; not finished. Fix it in the console or delete it, then run again`);
          continue;
        }
        state.templateId = row.id;
      } else {
        const created = await api.createTemplate(body);
        state.templateId = created.id;
      }

      step = "version";
      const version = await api.addVersion(state.templateId, versionBody(entry.version));
      state.version = version.version;

      step = "publish";
      const published = await api.publish(state.templateId);
      const resumed = matches.length === 1;
      done.push({ key: entry.key, outcome: resumed ? "resumed" : "created" });
      log(
        `${label}: ${resumed ? "finished" : "created"} (id ${state.templateId}), version ${state.version} added, published${published.inGallery ? ", in the gallery" : ""}`
      );
    } catch (err) {
      if (!(err instanceof RequestError)) throw err;
      printFailure(err, { log, entry, step, total: entries.length, done, state });
      return 1;
    }
  }

  log("");
  log(`Done (${entries.length} of ${entries.length}):`);
  printDone(done, log);
  if (attention.length) {
    log("");
    log("Look at these in the console:");
    for (const text of attention) log(`  - ${text}`);
  }
  return 0;
}

// ------------------------------------------------------------------ main

export const USAGE = `Usage (from apps/merchant-dashboard):
  node scripts/import-store-templates.mjs                     dry run: checks every file, sends nothing
  node scripts/import-store-templates.mjs --only xs-01        dry run of one template
  node scripts/import-store-templates.mjs --apply --only xs-01
  node scripts/import-store-templates.mjs --apply --from xs-01-ar
  node scripts/import-store-templates.mjs --apply             all of them, in INDEX.md's order

  --apply              send to ZIMOS_API_URL with ZIMOS_ADMIN_TOKEN (nothing is sent without it)
  --only <key>         just this template
  --from <key>         this template and the ones after it
  --resume-incomplete  also finish a template that a stopped run left with no version

Settings come from the environment only: ZIMOS_API_URL (the API base ending in
/api/v1, no default) and ZIMOS_ADMIN_TOKEN (the console's access token).
See scripts/README.md.`;

export async function main(argv, { env = process.env, log = console.log, fetchImpl = globalThis.fetch, dir = DATA_DIR, now = Date.now(), sleep } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    log(err.message);
    log("");
    log(USAGE);
    return 2;
  }
  if (args.help) {
    log(USAGE);
    return 0;
  }

  const { entries, problems } = collectTemplates(readTemplateFiles(dir));
  let selected;
  try {
    selected = selectEntries(entries, args);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    log(err.message);
    return 2;
  }

  log(args.apply ? "Import: the templates below go to the console, in this order." : "Dry run: nothing is sent.");
  log(`Files: ${dir}`);
  log("");
  const ok = printPlan(selected, problems, { log });

  const config = readConfig(env, now);
  if (!args.apply) {
    log("");
    log(config.baseUrl ? `With --apply they would go to ${config.baseUrl}.` : "ZIMOS_API_URL is not set; --apply needs it.");
    return ok ? 0 : 1;
  }
  if (!ok) {
    log("");
    log("Nothing was sent: fix the problems above first.");
    return 1;
  }
  if (config.problems.length > 0) {
    log("");
    for (const problem of config.problems) log(problem);
    log("Nothing was sent.");
    return 2;
  }

  log("");
  const minutes = config.tokenExpiresAt === null ? null : Math.floor((config.tokenExpiresAt - now) / 60000);
  log(`Sending to ${config.baseUrl}${minutes === null ? "" : ` (the token is good for about ${minutes} more minute${minutes === 1 ? "" : "s"})`}.`);
  const api = createApi({ baseUrl: config.baseUrl, token: config.token, fetchImpl, log, ...(sleep ? { sleep } : {}) });
  return applyTemplates(selected, { api, log, resumeIncomplete: args.resumeIncomplete });
}
