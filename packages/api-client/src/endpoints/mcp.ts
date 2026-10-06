/**
 * The store's MCP server for AI assistants (backend: src/modules/mcp/mcpServer.js,
 * handoff item 179). Claude, ChatGPT or any MCP client connects with a store
 * API key:
 *
 *   POST /api/public/v1/mcp     Authorization: Bearer <store API key>
 *   JSON-RPC 2.0 over the MCP "Streamable HTTP" transport, answered as plain
 *   JSON (GET → 405). Protocol versions 2025-06-18 / 2025-03-26 / 2024-11-05.
 *
 * The dashboard does not call the MCP server itself: it shows the URL and the
 * setup, and creates the key through the staff API (api_keys.manage):
 *
 *   POST /workspaces/:workspaceId/api-keys   { name, scopes }  → { apiKey, secret }
 *
 * Two scopes were added for the funnel tools: `funnels:read` and
 * `funnels:write` (listed by GET …/api-keys → `scopes`). Every tool also needs
 * the key creator's role to allow it, like the public REST API; a refusal is
 * a tool result with `isError: true`, a bad key is HTTP 401.
 */
import type { ApiClient } from "../client";
import type { ApiKeyCreated, ApiKeyDto, ApiKeyScope } from "./developers";

export type FunnelApiKeyScope = "funnels:read" | "funnels:write";

/** Every scope a key can carry, including the funnel ones added for MCP. */
export type McpApiKeyScope = ApiKeyScope | FunnelApiKeyScope;

/** The scopes the "key for AI" starts with; the merchant may untick any. */
export const MCP_DEFAULT_SCOPES: readonly McpApiKeyScope[] = ["products:read", "orders:read", "funnels:read", "funnels:write"];

export type McpToolName = "list_products" | "list_orders" | "get_order" | "check_pages" | "create_draft_funnel";

/** The tools the server offers, and the scope that opens each (the first is the one to grant). */
export const MCP_TOOLS: ReadonlyArray<{ name: McpToolName; scopes: readonly McpApiKeyScope[] }> = [
  { name: "list_products", scopes: ["products:read", "products:update"] },
  { name: "list_orders", scopes: ["orders:read", "orders:write", "orders:update"] },
  { name: "get_order", scopes: ["orders:read", "orders:write", "orders:update"] },
  { name: "check_pages", scopes: ["funnels:read", "funnels:write"] },
  { name: "create_draft_funnel", scopes: ["funnels:write"] },
];

/**
 * The MCP server's absolute URL, from the dashboard's API base (`/api/v1` or
 * `https://api.example.com/api/v1`) and the page's origin for a relative base.
 */
export function mcpServerUrl(apiBaseUrl: string, origin: string): string {
  const url = new URL(apiBaseUrl, origin);
  url.pathname = `${url.pathname.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "")}/api/public/v1/mcp`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Creates an API key that may carry the funnel scopes. The full key is in this answer only. */
export async function mcpCreateApiKey(
  client: ApiClient,
  workspaceId: string,
  payload: { name: string; scopes: McpApiKeyScope[] }
): Promise<Omit<ApiKeyCreated, "apiKey"> & { apiKey: Omit<ApiKeyDto, "scopes"> & { scopes: McpApiKeyScope[] } }> {
  return client.request(`/workspaces/${workspaceId}/api-keys`, { method: "POST", body: payload });
}
