/**
 * PUT relay for the storefront API.
 *
 * The API's CORS policy for /api/v1/store lists GET, POST, PATCH and DELETE,
 * not PUT, so a browser on a store's address cannot send a PUT to the API
 * itself: the preflight refuses it. A page that needs one sends it here, to
 * the store's own origin, and this forwards it:
 *
 *   PUT <store>/api-put/<path>   →   PUT <API>/store/<workspaceId>/<path>
 *
 * with the body and the query unchanged, and the API's status and body
 * handed back as they came (so the caller reads the same error envelope).
 * Use it through lib/relayedPut.ts.
 *
 * It is not a general proxy:
 *  - only the path shapes in ALLOWED are relayed; anything else is a 404;
 *  - only the headers the API reads are passed on — never the cookies;
 *  - the workspace is the one in this route's own address.
 *
 * Once the API allows PUT from the storefront, callers can go back to the
 * API client directly and this route can be removed.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The PUT calls the storefront makes, as paths under /store/:workspaceId/. Add a shape here to relay another one. */
const ALLOWED: readonly RegExp[] = [
  // The post-purchase survey's answers (handoff 236).
  new RegExp(`^survey/orders/${UUID}$`, "i"),
  // A business customer's company details (handoff 228).
  /^account\/business$/,
];

/** What the browser sends that the API reads on a store call. */
const FORWARDED = ["content-type", "x-shopper-token", "x-payment-token", "x-store-locale", "x-store-gate", "x-store-preview"] as const;

/** Only something shaped like an IP is passed on; the API validates it again (as lib/serverApiClient). */
const IP_LIKE = /^[0-9a-f:.]{2,45}$/i;

/** A relayed body is a small JSON document. */
const MAX_BODY = 64 * 1024;

const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function PUT(request: Request, { params }: { params: Promise<{ workspaceId: string; path: string[] }> }) {
  const { workspaceId, path } = await params;
  const rest = (path ?? []).join("/");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(workspaceId) || !ALLOWED.some((shape) => shape.test(rest))) return json(404, "NOT_FOUND", "Not found");

  const body = await request.text();
  if (body.length > MAX_BODY) return json(413, "PAYLOAD_TOO_LARGE", "The request is too large");

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // This server's own word for who is asking, so the API limits shoppers one by one (lib/serverApiClient).
  const secret = process.env.STOREFRONT_PROXY_SECRET?.trim();
  if (secret) {
    headers.set("X-Storefront-Secret", secret);
    const ip = request.headers.get("x-real-ip")?.trim();
    if (ip && IP_LIKE.test(ip)) headers.set("X-Storefront-Client-IP", ip);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/store/${workspaceId}/${rest}${new URL(request.url).search}`, { method: "PUT", headers, body, cache: "no-store" });
  } catch {
    return json(502, "UPSTREAM_UNREACHABLE", "The store could not be reached");
  }

  const answer = upstream.status === 204 ? null : await upstream.text();
  const out = new Headers({ "Cache-Control": "private, no-store" });
  const type = upstream.headers.get("content-type");
  if (type && answer !== null) out.set("Content-Type", type);
  const retry = upstream.headers.get("retry-after");
  if (retry) out.set("Retry-After", retry);
  return new Response(answer, { status: upstream.status, headers: out });
}
