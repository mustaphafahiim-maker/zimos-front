/**
 * Error reporting for the front ends (SPEC §3.5: Sentry for the backend, the
 * frontend and the worker). Same shape as the backend's
 * core/errors/errorReporter.js:
 *
 *   console  (default) nothing leaves the browser; the error is in the console
 *   sentry   a DSN is configured: unexpected errors are sent to Sentry too
 *
 * No SDK: an event is one small JSON envelope POSTed to the project's
 * envelope endpoint (https://develop.sentry.dev/sdk/envelopes/), so an app
 * without a DSN carries nothing extra. Works in the browser and in Node 18+
 * (fetch). See README.md for the settings each app reads.
 *
 * What is sent, on purpose little: the error's type, message and stack, the
 * app, the environment and release, the page's path (no query string, no
 * hash — they can hold tokens), and the tags the caller adds. No user, no
 * cookies, no request body. At most MAX_PER_PAGE reports per page load, and
 * the same error once. Reporting never throws.
 */

export interface ErrorReporterOptions {
  /** The Sentry DSN; empty or missing = the console adapter. */
  dsn?: string | null;
  /** Which front end: "dashboard", "platform-admin", "storefront", … */
  app: string;
  environment?: string | null;
  release?: string | null;
  /**
   * Report only errors whose stack matches — e.g. the storefront's own
   * bundles, so a merchant's script or an ad pixel failing is not ours.
   */
  onlyStacksMatching?: RegExp;
}

export type ReportContext = Record<string, string | number | boolean | null | undefined>;

export interface ErrorReporter {
  readonly provider: "console" | "sentry";
  /** Sends an unexpected error with where it happened; resolves once sent (or dropped). Never rejects. */
  report(error: unknown, context?: ReportContext): Promise<void>;
}

const MAX_PER_PAGE = 20;

interface Dsn {
  url: string;
  publicKey: string;
  raw: string;
}

/** https://<key>@<host>[/<path>]/<project> → the envelope endpoint, or null. */
export function parseDsn(dsn: string | null | undefined): Dsn | null {
  if (!dsn || !dsn.trim()) return null;
  try {
    const u = new URL(dsn.trim());
    const project = u.pathname.split("/").filter(Boolean).pop();
    if (!u.username || !project || !/^\d+$/.test(project)) return null;
    const base = u.pathname.slice(0, u.pathname.lastIndexOf(project)).replace(/\/$/, "");
    return {
      url: `${u.protocol}//${u.host}${base}/api/${project}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(u.username)}&sentry_client=zimos-reporter%2F1`,
      publicKey: u.username,
      raw: dsn.trim(),
    };
  } catch {
    return null;
  }
}

interface Frame {
  function?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

// V8: "    at fn (url:1:2)" / "    at url:1:2"; Firefox / Safari: "fn@url:1:2".
const V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

/** The stack as Sentry's frames, oldest call first. */
export function stackFrames(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split("\n").slice(0, 50)) {
    const m = V8.exec(line) ?? GECKO.exec(line);
    if (!m) continue;
    const filename = stripQuery(m[2]);
    frames.push({
      function: m[1] || "?",
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/node_modules|^node:|^internal\//.test(filename),
    });
  }
  return frames.reverse();
}

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function eventId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  let id = "";
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

function asError(value: unknown): { type: string; message: string; stack?: string } {
  if (value instanceof Error) return { type: value.name || "Error", message: value.message, stack: value.stack };
  if (typeof value === "string") return { type: "Error", message: value };
  try {
    return { type: "Error", message: JSON.stringify(value)?.slice(0, 500) ?? String(value) };
  } catch {
    return { type: "Error", message: String(value) };
  }
}

function currentPath(): string | undefined {
  const loc = (globalThis as { location?: Location }).location;
  return loc ? `${loc.origin}${loc.pathname}` : undefined;
}

export function createErrorReporter(options: ErrorReporterOptions): ErrorReporter {
  const dsn = parseDsn(options.dsn);
  if (!dsn) {
    return { provider: "console", report: async () => {} };
  }
  const seen = new Set<string>();
  let sent = 0;
  const isBrowser = typeof window !== "undefined";

  return {
    provider: "sentry",
    async report(error, context = {}) {
      try {
        const err = asError(error);
        if (options.onlyStacksMatching && !options.onlyStacksMatching.test(err.stack ?? "")) return;
        const key = `${err.type}:${err.message}:${(err.stack ?? "").split("\n")[1] ?? ""}`;
        if (seen.has(key) || sent >= MAX_PER_PAGE) return;
        seen.add(key);
        sent++;
        const tags: Record<string, string> = { app: options.app };
        for (const [k, v] of Object.entries(context)) if (k !== "url" && v !== undefined && v !== null) tags[k] = String(v).slice(0, 200);
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string") tags.digest = digest.slice(0, 100);
        const id = eventId();
        const url = typeof context.url === "string" ? stripQuery(context.url) : currentPath();
        const event = {
          event_id: id,
          timestamp: Date.now() / 1000,
          platform: isBrowser ? "javascript" : "node",
          level: "error",
          logger: options.app,
          environment: options.environment || undefined,
          release: options.release || undefined,
          tags,
          ...(url ? { request: { url } } : {}),
          exception: {
            values: [{ type: err.type, value: err.message.slice(0, 2000), stacktrace: { frames: stackFrames(err.stack) } }],
          },
        };
        const body = [
          JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn: dsn.raw }),
          JSON.stringify({ type: "event" }),
          JSON.stringify(event),
        ].join("\n");
        await fetch(dsn.url, {
          method: "POST",
          body,
          // text/plain keeps a browser request "simple": no CORS preflight.
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          keepalive: isBrowser,
        }).catch(() => undefined);
      } catch {
        /* reporting never breaks the page */
      }
    },
  };
}

/**
 * Sends the page's uncaught errors and unhandled promise rejections (browser
 * only). Returns the reporter for the app's own error boundaries.
 */
export function installErrorReporting(options: ErrorReporterOptions): ErrorReporter {
  const reporter = createErrorReporter(options);
  if (reporter.provider === "console" || typeof window === "undefined") return reporter;
  window.addEventListener("error", (e) => {
    // A failed <img>/<script> load is an event without an error; not a crash.
    if (e.error) void reporter.report(e.error, { handled: false });
  });
  window.addEventListener("unhandledrejection", (e) => void reporter.report(e.reason, { handled: false, mechanism: "unhandledrejection" }));
  return reporter;
}
