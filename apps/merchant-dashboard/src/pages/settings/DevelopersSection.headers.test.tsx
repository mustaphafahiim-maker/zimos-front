import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DevelopersSection } from "./DevelopersSection";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ headers: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get WEBHOOK_HEADERS_ENABLED() {
    return flags.headers;
  },
}));

const ENDPOINT = {
  id: "wh_1",
  url: "https://hooks.example.com/zimos",
  events: ["*"],
  isActive: true,
  secretHint: "whsec_…Ab12",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
  customHeaders: [{ name: "X-Tenant", valueMask: "••••42" }],
};
const EVENTS = [{ name: "order.created", description: "A new order was placed." }];

function serve() {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  return fakeBackend({
    "GET /api-keys": { apiKeys: [], scopes: [] },
    "GET /webhooks": { endpoints: [ENDPOINT], events: EVENTS },
    "GET /webhooks/deliveries": { deliveries: [], nextCursor: null },
    "POST /webhooks": { endpoint: { ...ENDPOINT, id: "wh_2" }, signingSecret: "whsec_new" },
    "PATCH /webhooks/wh_1": { endpoint: ENDPOINT },
  });
}

/** The create dialog's own button (the dialog is titled like the button that opens it). */
const SUBMIT = "Create";

async function openNewEndpoint(user: ReturnType<typeof renderWithProviders>["user"]) {
  await screen.findByText("https://hooks.example.com/zimos");
  await user.click(screen.getByRole("button", { name: "Add endpoint" }));
  return screen.findByRole("dialog");
}

describe("custom headers on a webhook endpoint", () => {
  it("shows nothing of them while the feature is off, and sends none", async () => {
    flags.headers = false;
    const calls = serve();
    const { user } = renderWithProviders(<DevelopersSection />);
    const dialog = await openNewEndpoint(user);
    expect(within(dialog).queryByText("Custom headers")).not.toBeInTheDocument();
    expect(screen.queryByText(/X-Tenant/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/URL/), "https://example.com/hook");
    await user.click(within(dialog).getByRole("button", { name: SUBMIT }));
    await waitFor(() => expect(callsTo(calls, "POST", "/webhooks")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/webhooks")[0].body).toEqual({ url: "https://example.com/hook", events: ["*"] });
  });

  it("names an endpoint's headers with their values masked, and offers to edit it", async () => {
    flags.headers = true;
    serve();
    renderWithProviders(<DevelopersSection />);
    expect(await screen.findByText(/X-Tenant/)).toBeInTheDocument();
    expect(screen.getByText(/••••42/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("sends the headers typed for a new endpoint", async () => {
    flags.headers = true;
    const calls = serve();
    const { user } = renderWithProviders(<DevelopersSection />);
    const dialog = await openNewEndpoint(user);
    await user.type(within(dialog).getByLabelText(/URL/), "https://example.com/hook");
    await user.click(within(dialog).getByRole("button", { name: "Add header" }));
    await user.type(within(dialog).getByLabelText("Header name"), "Authorization");
    await user.type(within(dialog).getByLabelText("Value"), "Bearer abc123");
    await user.click(within(dialog).getByRole("button", { name: SUBMIT }));

    await waitFor(() => expect(callsTo(calls, "POST", "/webhooks")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/webhooks")[0].body).toEqual({
      url: "https://example.com/hook",
      events: ["*"],
      customHeaders: [{ name: "Authorization", value: "Bearer abc123" }],
    });
  });

  it("refuses a header the platform sets itself before anything is sent", async () => {
    flags.headers = true;
    const calls = serve();
    const { user } = renderWithProviders(<DevelopersSection />);
    const dialog = await openNewEndpoint(user);
    await user.type(within(dialog).getByLabelText(/URL/), "https://example.com/hook");
    await user.click(within(dialog).getByRole("button", { name: "Add header" }));
    await user.type(within(dialog).getByLabelText("Header name"), "Content-Type");
    await user.type(within(dialog).getByLabelText("Value"), "text/plain");
    await user.click(within(dialog).getByRole("button", { name: SUBMIT }));

    expect(await within(dialog).findByText("Zimos sets this header itself, so it can't be changed.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/webhooks")).toHaveLength(0);
  });
});
