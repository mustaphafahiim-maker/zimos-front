import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { StoreDomain } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DomainsTab } from "./DomainsTab";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ redirect: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get DOMAIN_REDIRECT_ENABLED() {
    return flags.redirect;
  },
}));

type Call = { path: string; method: string; body?: unknown };

function domain(over: Record<string, unknown> = {}): StoreDomain {
  return {
    id: "dom_1",
    hostname: "shop.example.com",
    status: "active",
    verifiedAt: "2026-10-01T00:00:00.000Z",
    isPrimary: false,
    sslStatus: "issued",
    sslProvider: "cloudflare",
    sslCheckedAt: null,
    sslDetail: null,
    suspended: false,
    suspendedReason: null,
    homeFunnel: null,
    records: [
      { type: "TXT", name: "_zimos-verify.shop.example.com", value: "zimos-verify=abc123", ttl: 300, purpose: "verification" },
      { type: "CNAME", name: "shop.example.com", value: "customers.zimos.co", ttl: 300, purpose: "routing" },
    ],
    ...over,
  } as StoreDomain;
}

/** The overview, the funnels of the home-funnel select, and a PATCH that answers with the changed domain. */
function serve(domains: StoreDomain[]) {
  const calls: Call[] = [];
  api.request.mockImplementation((async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    calls.push(call);
    if (call.method === "GET" && path.endsWith("/overview")) return { domains, cnameTarget: "customers.zimos.co", certificateProvider: "cloudflare", maxPerStore: 2 };
    if (call.method === "PATCH") return { domain: { ...domains[0], ...(call.body as object) } };
    return { funnels: [], items: [], nextCursor: null };
  }) as never);
  return calls;
}

const label = "Redirect visitors to the primary domain";

describe("DomainsTab and the redirect to the primary domain", () => {
  it("has no redirect switch while the feature is off", async () => {
    flags.redirect = false;
    const calls = serve([domain()]);
    renderWithProviders(<DomainsTab />);
    expect((await screen.findAllByText("shop.example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("shows the switch on for a connected domain that is not the primary one, and saves a change", async () => {
    flags.redirect = true;
    const calls = serve([domain()]);
    const { user } = renderWithProviders(<DomainsTab />);
    const toggle = await screen.findByLabelText(new RegExp(label));
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/workspaces/ws_1/domains/dom_1");
    expect(patch.body).toEqual({ redirectToPrimary: false });
    expect(await screen.findByText("Domain updated.")).toBeInTheDocument();
  });

  it("reads the stored choice: off stays off", async () => {
    flags.redirect = true;
    serve([domain({ redirectToPrimary: false })]);
    renderWithProviders(<DomainsTab />);
    expect(await screen.findByLabelText(new RegExp(label))).not.toBeChecked();
  });

  it("does not offer it on the primary domain or on one still waiting for DNS", async () => {
    flags.redirect = true;
    serve([domain({ isPrimary: true })]);
    const first = renderWithProviders(<DomainsTab />);
    expect((await screen.findAllByText("shop.example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
    first.unmount();

    serve([domain({ status: "pending_verification", verifiedAt: null, sslStatus: "none" })]);
    renderWithProviders(<DomainsTab />);
    expect((await screen.findAllByText("shop.example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
  });

  it("names the switch in formal Arabic", async () => {
    flags.redirect = true;
    serve([domain()]);
    renderWithProviders(<DomainsTab />, { locale: "ar" });
    expect(await screen.findByLabelText(/تحويل الزوار إلى النطاق الأساسي/)).toBeChecked();
  });
});
