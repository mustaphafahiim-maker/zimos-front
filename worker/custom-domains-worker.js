/**
 * Cloudflare Worker in front of merchant custom domains (Cloudflare for SaaS).
 *
 * A shopper opens https://www.merchant-shop.com/products/x. That hostname is a
 * custom hostname on our zone, so Cloudflare terminates TLS with its own
 * certificate and runs this Worker. Railway only answers hosts registered on
 * the storefront service, so the Worker calls the storefront's own Railway
 * host (ORIGIN_HOST) and says which host the shopper asked for:
 *
 *   X-Forwarded-Host   the shopper's host (www.merchant-shop.com)
 *   X-Forwarded-Proto  https
 *   X-Zimos-Edge       EDGE_SECRET, the proof that this Worker sent it; the
 *                      storefront (apps/storefront/src/lib/edgeHost.ts)
 *                      ignores X-Forwarded-Host without it
 *   X-Zimos-Client-IP  the shopper's IP (CF-Connecting-IP)
 *
 * Secrets (wrangler secret put / dashboard > Settings > Variables):
 *   ORIGIN_HOST  e.g. storefront-production.up.railway.app (no scheme)
 *   EDGE_SECRET  the same value as the storefront's CUSTOM_DOMAIN_EDGE_SECRET
 *
 * Setup steps: docs/custom-domains/README.md. Nothing here is deployed by the
 * repository.
 */

const HOP_HEADERS = ["x-forwarded-host", "x-zimos-edge", "x-zimos-client-ip"];

export default {
  async fetch(request, env) {
    if (!env.ORIGIN_HOST || !env.EDGE_SECRET) {
      return new Response("Custom domains are not configured", { status: 503 });
    }

    const incoming = new URL(request.url);
    const target = new URL(request.url);
    target.protocol = "https:";
    target.host = env.ORIGIN_HOST;

    const headers = new Headers(request.headers);
    // Whatever the shopper sent under these names is dropped first.
    for (const name of HOP_HEADERS) headers.delete(name);
    headers.set("X-Forwarded-Host", incoming.host);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Zimos-Edge", env.EDGE_SECRET);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) headers.set("X-Zimos-Client-IP", ip);

    const method = request.method.toUpperCase();
    return fetch(target.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      // The storefront's redirects already name the shopper's host: pass them on as they are.
      redirect: "manual",
    });
  },
};
