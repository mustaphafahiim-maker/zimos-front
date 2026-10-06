import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { StoreDomain } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DomainsTab } from "./DomainsTab";
import { isApex, registrableDomain, relativeName } from "./domainNames";

/** One fake request for every endpoint, routed by method and the end of the path. */
type Call = { path: string; method: string; body?: unknown };
function fakeBackend(routes: Record<string, (call: Call) => unknown>) {
  const calls: Call[] = [];
  api.request.mockImplementation(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    calls.push(call);
    const key = Object.keys(routes).find((k) => {
      const [method, suffix] = k.split(" ");
      return method === call.method && path.endsWith(suffix);
    });
    if (!key) throw new Error(`Unexpected request ${call.method} ${path}`);
    return routes[key](call);
  });
  return calls;
}

function domain(over: Partial<StoreDomain> = {}): StoreDomain {
  return {
    id: "dom_1",
    hostname: "www.example.com",
    status: "pending_verification",
    verifiedAt: null,
    isPrimary: false,
    sslStatus: "none",
    sslProvider: null,
    sslCheckedAt: null,
    sslDetail: null,
    suspended: false,
    suspendedReason: null,
    homeFunnel: null,
    records: [
      { type: "TXT", name: "_zimos-verify.www.example.com", value: "zimos-verify=abc123", ttl: 300, purpose: "verification" },
      { type: "CNAME", name: "www.example.com", value: "customers.zimos.co", ttl: 300, purpose: "routing" },
    ],
    ...over,
  };
}

const overview = (domains: StoreDomain[]) => () => ({
  domains,
  cnameTarget: "customers.zimos.co",
  certificateProvider: "cloudflare",
  maxPerStore: 1,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("domainNames", () => {
  it("tells a bare domain from a subdomain, with three-label suffixes", () => {
    expect(isApex("example.com")).toBe(true);
    expect(isApex("www.example.com")).toBe(false);
    expect(isApex("mystore.com.eg")).toBe(true);
    expect(isApex("shop.mystore.com.eg")).toBe(false);
    expect(registrableDomain("shop.mystore.com.eg")).toBe("mystore.com.eg");
    expect(relativeName("_zimos-verify.www.example.com", "example.com")).toBe("_zimos-verify.www");
  });
});

describe("DomainsTab", () => {
  it("turns a bare domain into www.<domain> with the reason, without sending it", async () => {
    const calls = fakeBackend({ "GET /overview": overview([]) });
    const { user } = renderWithProviders(<DomainsTab />);
    const input = await screen.findByPlaceholderText("www.example.com");
    await user.type(input, "https://Example.com/");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(input).toHaveValue("www.example.com");
    expect(screen.getByRole("status")).toHaveTextContent("Only a subdomain can be connected");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the two records by the names registrars ask for, the guides and the contact link", async () => {
    fakeBackend({ "GET /overview": overview([domain()]) });
    const { user } = renderWithProviders(<DomainsTab />);
    expect(await screen.findByText("_zimos-verify.www")).toBeInTheDocument();
    expect(screen.getByText("zimos-verify=abc123")).toBeInTheDocument();
    expect(screen.getAllByText("customers.zimos.co").length).toBeGreaterThan(0);
    expect(screen.getByText("Waiting for DNS")).toBeInTheDocument();

    for (const name of ["GoDaddy", "Namecheap", "Hostinger", "Cloudflare DNS"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("tab", { name: "Namecheap" }));
    expect(screen.getByText(/URL Redirect Record/)).toBeInTheDocument();
    expect(screen.getAllByText(/without www to arrive too/).length).toBeGreaterThan(0);

    const help = screen.getByRole("link", { name: /Contact us/ });
    expect(help.getAttribute("href")).toMatch(/\/en\/contact$/);
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names a failed certificate's reason and a suspended domain's", async () => {
    fakeBackend({
      "GET /overview": overview([
        domain({ id: "a", hostname: "www.a.com", status: "verified", sslStatus: "failed", sslDetail: "CAA record prevents issuance" }),
        domain({ id: "b", hostname: "www.b.com", status: "active", sslStatus: "issued", suspended: true, suspendedReason: "plan" }),
      ]),
    });
    renderWithProviders(<DomainsTab />);
    expect(await screen.findByText("CAA record prevents issuance")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText(/does not include custom domains/)).toBeInTheDocument();
  });

  it("checks a waiting domain every 30 seconds while the tab is open", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const calls = fakeBackend({
      "GET /overview": overview([domain()]),
      "POST /verify": () => {
        throw Object.assign(new Error("not yet"), { code: "DOMAIN_NOT_VERIFIED" });
      },
    });
    renderWithProviders(<DomainsTab />);
    await screen.findByText("Waiting for DNS");
    const poll = setIntervalSpy.mock.calls.find((call) => call[1] === 30_000);
    expect(poll).toBeDefined();
    (poll![0] as () => void)();
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/dom_1/verify"))).toBe(true));
  });

  it("reads right to left in Arabic", async () => {
    fakeBackend({ "GET /overview": overview([domain()]) });
    renderWithProviders(<DomainsTab />, { locale: "ar" });
    expect(await screen.findByText("في انتظار الـ DNS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /تواصل معنا/ }).getAttribute("href")).toMatch(/\/ar\/contact$/);
  });
});
