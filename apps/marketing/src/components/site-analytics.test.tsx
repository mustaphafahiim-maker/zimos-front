import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The site's beacon (lib/site-analytics.ts, components/site-analytics.tsx):
 * with NEXT_PUBLIC_SITE_TRAFFIC_DETAILS_ENABLED a sign-up / sign-in click says
 * which link it was (`cta`); without it every body is exactly today's, which
 * an API without SITE_TRAFFIC_DETAILS_ENABLED accepts.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/en/pricing" }));

let fetchMock: ReturnType<typeof vi.fn>;

/** The modules read their flags once, on import. */
async function load(details: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_ANALYTICS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_TRAFFIC_DETAILS_ENABLED", details ? "true" : "");
  return { lib: await import("@/lib/site-analytics"), component: await import("./site-analytics") };
}

const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);

function clickLink(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = "link";
  a.addEventListener("click", (e) => e.preventDefault());
  document.body.appendChild(a);
  a.click();
  a.remove();
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("NEXT_PUBLIC_SITE_TRAFFIC_DETAILS_ENABLED off", () => {
  it("a click is sent as today, without saying which link", async () => {
    const { lib } = await load(false);
    lib.sendSiteEvent("cta_click", "/en", "register");
    expect(bodies()).toHaveLength(1);
    expect(bodies()[0].event).toBe("cta_click");
    expect(bodies()[0]).not.toHaveProperty("cta");
  });

  it("the page's links send no cta either", async () => {
    const { component } = await load(false);
    render(createElement(component.SiteAnalytics));
    clickLink("https://app.zimos.co/register");
    const clicks = bodies().filter((b) => b.event === "cta_click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).not.toHaveProperty("cta");
  });
});

describe("NEXT_PUBLIC_SITE_TRAFFIC_DETAILS_ENABLED on", () => {
  it("a sign-up click and a sign-in click say which they were; views and pings never carry it", async () => {
    const { lib } = await load(true);
    lib.sendSiteEvent("cta_click", "/en", "register");
    lib.sendSiteEvent("cta_click", "/ar", "login");
    lib.sendSiteEvent("view", "/en", "register");
    lib.sendSiteEvent("ping", "/en", "login");
    expect(bodies().map((b) => [b.event, b.cta])).toEqual([
      ["cta_click", "register"],
      ["cta_click", "login"],
      ["view", undefined],
      ["ping", undefined],
    ]);
  });

  it("the page's sign-up and sign-in links send their kind; other links send nothing", async () => {
    const { component } = await load(true);
    render(createElement(component.SiteAnalytics));
    clickLink("https://app.zimos.co/register?plan=p1");
    clickLink("https://app.zimos.co/login");
    clickLink("https://zimos.co/en/blog");
    const clicks = bodies().filter((b) => b.event === "cta_click");
    expect(clicks.map((b) => [b.cta, b.path])).toEqual([
      ["register", "/"],
      ["login", "/"],
    ]);
  });
});
