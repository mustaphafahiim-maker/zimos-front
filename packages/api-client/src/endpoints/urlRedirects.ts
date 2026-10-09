/**
 * URL redirects (backend: frontend-handoff item 232, src/modules/urlRedirects).
 *
 * The store's list of old path → new address. A path is store-relative
 * ("/old-page"; a trailing slash is dropped, a query is kept); a target is a
 * path too, or a full https:// address. 301 is permanent, 302 temporary.
 *
 * Dashboard (permission website.edit), /workspaces/:ws/redirects:
 *   GET    /?q=&source=&limit=&offset=   → { redirects, total } (newest first, limit ≤ 200)
 *   POST   /  UrlRedirectInput           → 201 { redirect }
 *   PUT    /:id UrlRedirectInput         → { redirect }
 *   DELETE /:id                          → 204
 *   POST   /import { csv }               → { created, updated, errors } — "from,to[,301|302]" per
 *          line, ≤ 5000 lines, header optional; a path that already redirects is updated.
 *   422 VALIDATION_ERROR on `fromPath` ("This path already redirects") and on `toPath`
 *   ("A redirect cannot point at itself", "This would send shoppers round in a loop",
 *   an http:// target).
 *
 * Automatic (source "auto"): a product's or collection's slug change adds
 * /products/<old> → /products/<new> (or /products?collection=<old> → …=<new>).
 *
 * Storefront (public): GET /store/:ws/redirects/lookup?path= → { to, statusCode } or 404.
 *   The storefront asks on a page it cannot find; a hit is counted.
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

/** 301 permanent, 302 temporary. */
export type UrlRedirectStatus = 301 | 302;

/** Typed by staff, added by a slug change, or brought in by a CSV. */
export type UrlRedirectSource = "manual" | "auto" | "import";

export interface UrlRedirect {
  id: string;
  /** Store-relative, e.g. "/old-page" or "/products?collection=old". */
  fromPath: string;
  /** A store-relative path, or a full https:// address. */
  toPath: string;
  statusCode: UrlRedirectStatus;
  source: UrlRedirectSource;
  /** How many shoppers it has sent on. */
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
}

export interface UrlRedirectPage {
  redirects: UrlRedirect[];
  total: number;
}

export interface UrlRedirectQuery {
  /** Part of either address. */
  q?: string;
  source?: UrlRedirectSource;
  /** 1–200 (50 by default). */
  limit?: number;
  offset?: number;
}

export interface UrlRedirectInput {
  /** Starts with "/", up to 500 characters, no spaces. */
  fromPath: string;
  /** A path starting with "/", or an https:// address; up to 1000 characters. */
  toPath: string;
  statusCode?: UrlRedirectStatus;
}

export interface UrlRedirectImportProblem {
  /** 1-based line of the pasted text. */
  line: number;
  message: string;
}

export interface UrlRedirectImportResult {
  created: number;
  updated: number;
  /** The lines left out (the first 100). */
  errors: UrlRedirectImportProblem[];
}

/** Most lines one import takes. */
export const URL_REDIRECT_IMPORT_MAX_LINES = 5000;
export const URL_REDIRECT_FROM_MAX = 500;
export const URL_REDIRECT_TO_MAX = 1000;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/redirects`;

export function urlRedirectsList(client: ApiClient, workspaceId: string, query: UrlRedirectQuery = {}): Promise<UrlRedirectPage> {
  const qs = new URLSearchParams();
  if (query.q && query.q.trim()) qs.set("q", query.q.trim());
  if (query.source) qs.set("source", query.source);
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.offset) qs.set("offset", String(query.offset));
  const s = qs.toString();
  return client.request<UrlRedirectPage>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

export async function urlRedirectCreate(client: ApiClient, workspaceId: string, body: UrlRedirectInput): Promise<UrlRedirect> {
  const { redirect } = await client.request<{ redirect: UrlRedirect }>(base(workspaceId), { method: "POST", body });
  return redirect;
}

export async function urlRedirectUpdate(
  client: ApiClient,
  workspaceId: string,
  redirectId: string,
  body: UrlRedirectInput
): Promise<UrlRedirect> {
  const { redirect } = await client.request<{ redirect: UrlRedirect }>(`${base(workspaceId)}/${redirectId}`, { method: "PUT", body });
  return redirect;
}

export function urlRedirectDelete(client: ApiClient, workspaceId: string, redirectId: string): Promise<void> {
  return client.request<void>(`${base(workspaceId)}/${redirectId}`, { method: "DELETE" });
}

/** `csv`: "from,to[,301|302]" per line; a first line starting with "from" is skipped. */
export function urlRedirectsImport(client: ApiClient, workspaceId: string, csv: string): Promise<UrlRedirectImportResult> {
  return client.request<UrlRedirectImportResult>(`${base(workspaceId)}/import`, { method: "POST", body: { csv } });
}

/**
 * Why a save was refused, when the API said so on one of the two fields:
 * "taken" (the path already redirects), "self" (it points at itself), "loop"
 * (it would close a circle), "target" (the target is neither a path nor an
 * https:// address — an http:// one is refused), "path" (the old path is not
 * a path). Null for any other error.
 */
export type UrlRedirectRefusal = "taken" | "self" | "loop" | "target" | "path";

export function urlRedirectRefusalOf(err: unknown): { field: "fromPath" | "toPath"; reason: UrlRedirectRefusal } | null {
  for (const problem of apiFieldProblems(err)) {
    const text = problem.message.toLowerCase();
    if (problem.field === "fromPath") return { field: "fromPath", reason: /already redirects/.test(text) ? "taken" : "path" };
    if (problem.field === "toPath") {
      if (/itself/.test(text)) return { field: "toPath", reason: "self" };
      if (/loop/.test(text)) return { field: "toPath", reason: "loop" };
      return { field: "toPath", reason: "target" };
    }
  }
  return null;
}

// ----------------------------------------------------------- storefront --

export interface StorefrontRedirect {
  /** A store-relative path, or a full https:// address. */
  to: string;
  statusCode: UrlRedirectStatus;
}

/**
 * Where an address the store cannot find was moved to, or null when it was
 * not (404). `path` is store-relative, with its query when it has one: the
 * API tries the whole of it, then the path alone. Any other failure (a locked
 * store, the network) is thrown.
 */
export async function storefrontRedirectLookup(client: ApiClient, workspaceRef: string, path: string): Promise<StorefrontRedirect | null> {
  try {
    return await client.request<StorefrontRedirect>(`/store/${workspaceRef}/redirects/lookup?path=${encodeURIComponent(path)}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
