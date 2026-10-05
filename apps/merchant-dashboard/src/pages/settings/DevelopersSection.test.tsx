import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DevelopersSection } from "./DevelopersSection";

/**
 * The endpoint functions (api-client/src/endpoints/developers.ts) all go
 * through apiClient.request, so one fake request routed by method and path
 * stands in for the backend here.
 */
type Call = { path: string; method: string; body?: unknown };

function fakeBackend(routes: Record<string, (call: Call) => unknown>) {
  const calls: Call[] = [];
  api.request.mockImplementation(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    calls.push(call);
    const handler = routes[`${call.method} ${path}`];
    if (!handler) throw new Error(`Unexpected request ${call.method} ${path}`);
    return handler(call);
  });
  return calls;
}

const KEY = {
  id: "key_1",
  name: "Sharks fulfilment",
  keyPrefix: "zk_7Hq2mP9xa",
  scopes: ["orders:read", "orders:write"],
  rateLimitPerMinute: 60,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2026-09-29T10:00:00.000Z",
  createdBy: { id: "user_1", fullName: "Amr Hassan" },
};

const ENDPOINT = {
  id: "wh_1",
  url: "https://hooks.example.com/zimos",
  events: ["*"],
  isActive: true,
  secretHint: "whsec_…Ab12",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

const EVENTS = [
  { name: "order.created", description: "A new order was placed." },
  { name: "order.status_changed", description: "An order's status changed." },
];

function asOwner() {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
}

describe("DevelopersSection", () => {
  it("only offers the controls to an owner or workspace manager", () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "order_operator" });
    renderWithProviders(<DevelopersSection />);
    expect(screen.getByText("Only the store owner or a workspace manager can manage API keys and webhooks.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New API key" })).not.toBeInTheDocument();
  });

  it("creates a read-and-write key and shows the full key once", async () => {
    asOwner();
    const calls = fakeBackend({
      "GET /workspaces/ws_1/api-keys": () => ({ apiKeys: [], scopes: ["orders:read", "orders:write"] }),
      "GET /workspaces/ws_1/webhooks": () => ({ endpoints: [], events: EVENTS, wildcard: "*" }),
      "POST /workspaces/ws_1/api-keys": () => ({ apiKey: KEY, secret: "zk_7Hq2mP9xa_SECRETSECRETSECRETSECRETSECRETSECRE" }),
    });
    const { user } = renderWithProviders(<DevelopersSection />);

    expect(await screen.findByText("No API keys yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New API key" }));
    const dialog = screen.getByRole("dialog", { name: "New API key" });
    await user.type(within(dialog).getByLabelText(/Name/), "Sharks fulfilment");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      name: "Sharks fulfilment",
      scopes: ["orders:read", "orders:write"],
    });
    const shown = await screen.findByRole("dialog", { name: "Copy your API key" });
    expect(within(shown).getByTestId("secret-value")).toHaveTextContent("zk_7Hq2mP9xa_SECRETSECRETSECRETSECRETSECRETSECRE");
  });

  it("lists keys without their secret and revokes one after confirmation", async () => {
    asOwner();
    const calls = fakeBackend({
      "GET /workspaces/ws_1/api-keys": () => ({ apiKeys: [KEY], scopes: ["orders:read", "orders:write"] }),
      "GET /workspaces/ws_1/webhooks": () => ({ endpoints: [], events: EVENTS, wildcard: "*" }),
      "DELETE /workspaces/ws_1/api-keys/key_1": () => ({ apiKey: { ...KEY, revokedAt: "2026-09-29T11:00:00.000Z" } }),
    });
    const { user } = renderWithProviders(<DevelopersSection />);

    expect(await screen.findByText("Sharks fulfilment")).toBeInTheDocument();
    expect(screen.getByText("zk_7Hq2mP9xa…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    const confirm = screen.getByRole("dialog", { name: "Revoke this key?" });
    await user.click(within(confirm).getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(await screen.findByText("API key revoked.")).toBeInTheDocument();
  });

  it("adds an endpoint for chosen events and shows the signing secret once", async () => {
    asOwner();
    const calls = fakeBackend({
      "GET /workspaces/ws_1/api-keys": () => ({ apiKeys: [], scopes: [] }),
      "GET /workspaces/ws_1/webhooks": () => ({ endpoints: [], events: EVENTS, wildcard: "*" }),
      "POST /workspaces/ws_1/webhooks": () => ({ endpoint: ENDPOINT, signingSecret: "whsec_the_secret_Ab12" }),
    });
    const { user } = renderWithProviders(<DevelopersSection />);

    await user.click(await screen.findByRole("button", { name: "Add endpoint" }));
    const dialog = screen.getByRole("dialog", { name: "Add endpoint" });
    await user.type(within(dialog).getByLabelText(/Endpoint URL/), "https://hooks.example.com/zimos");
    await user.click(within(dialog).getByLabelText("Choose events"));
    await user.click(within(dialog).getByLabelText(/order\.status_changed/));
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      url: "https://hooks.example.com/zimos",
      events: ["order.status_changed"],
    });
    const shown = await screen.findByRole("dialog", { name: "Copy your signing secret" });
    expect(within(shown).getByTestId("secret-value")).toHaveTextContent("whsec_the_secret_Ab12");
  });

  it("sends a test event and says how the receiver answered", async () => {
    asOwner();
    fakeBackend({
      "GET /workspaces/ws_1/api-keys": () => ({ apiKeys: [], scopes: [] }),
      "GET /workspaces/ws_1/webhooks": () => ({ endpoints: [ENDPOINT], events: EVENTS, wildcard: "*" }),
      "POST /workspaces/ws_1/webhooks/wh_1/test": () => ({
        delivery: { id: "d1", status: "failed", lastResponseStatus: 500, lastError: "Receiver answered HTTP 500" },
      }),
    });
    const { user } = renderWithProviders(<DevelopersSection />);

    expect(await screen.findByText("https://hooks.example.com/zimos")).toBeInTheDocument();
    expect(screen.getByText("whsec_…Ab12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText("Test not delivered: Receiver answered HTTP 500")).toBeInTheDocument();
  });
});
