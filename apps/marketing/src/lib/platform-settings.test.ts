import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatformSettings, PLATFORM_SETTINGS_REVALIDATE_SECONDS } from "./platform-settings";
import { companyDetails, policyPage } from "./policies";

/**
 * The platform details from the console (lib/platform-settings.ts): never
 * read while PLATFORM_SETTINGS_ENABLED is off, and every failure of the API —
 * down, off, slow, odd — gives `null`, so the pages keep the values in this
 * repo.
 */

const SAVED = {
  settings: {
    contact: { supportEmail: "help@zimos.co", phone: "+201001234567", address: { ar: "القاهرة", en: "Cairo" }, hours: { ar: "كل يوم", en: "Every day" } },
    social: { links: [{ platform: "youtube", url: "https://www.youtube.com/@zimos", enabled: true, order: 1 }] },
    company: { platformName: "ZIMOS Co", legalName: { ar: "زيموس", en: "Zimos LLC" }, registration: { ar: "١٢٣", en: "123" }, taxRegistration: "111-222-333" },
    footer: null,
  },
};

const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("reading the settings", () => {
  it("reads nothing while the flag is off, whatever the API holds", async () => {
    vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "false");
    expect(await getPlatformSettings()).toBeNull();
    vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "");
    expect(await getPlatformSettings()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the public endpoint, cached by Next for a short while", async () => {
    fetchMock.mockResolvedValue(answer(SAVED));
    const settings = await getPlatformSettings();
    expect(settings?.contact?.supportEmail).toBe("help@zimos.co");
    expect(settings?.footer).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/platform-settings\/public$/);
    expect(init.next).toEqual({ revalidate: PLATFORM_SETTINGS_REVALIDATE_SECONDS });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("gives null when the API is down, off (404), failing (500) or answers something else", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await getPlatformSettings()).toBeNull();
    fetchMock.mockResolvedValueOnce(answer({ error: { code: "ROUTE_NOT_FOUND" } }, 404));
    expect(await getPlatformSettings()).toBeNull();
    fetchMock.mockResolvedValueOnce(answer({ error: "x" }, 500));
    expect(await getPlatformSettings()).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("<html>gateway</html>", { status: 200 }));
    expect(await getPlatformSettings()).toBeNull();
    fetchMock.mockResolvedValueOnce(answer(["not", "settings"]));
    expect(await getPlatformSettings()).toBeNull();
  });

  it("gives up on a slow API after its timeout instead of holding the page", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
    );
    const started = Date.now();
    expect(await getPlatformSettings()).toBeNull();
    expect(Date.now() - started).toBeLessThan(6000);
  }, 10000);

  it("drops only the group that came back malformed", async () => {
    fetchMock.mockResolvedValue(answer({ settings: { ...SAVED.settings, company: { platformName: "", legalName: "x" } } }));
    const settings = await getPlatformSettings();
    expect(settings?.company).toBeNull();
    expect(settings?.contact?.phone).toBe("+201001234567");
  });
});

describe("the company details the pages show", () => {
  it("are the file's while nothing is saved", () => {
    expect(companyDetails("en")).toMatchObject({ email: "zimossupport@gmail.com", phone: "01023641956", legalName: "ZIMOS", taxRegistration: "783-889-615" });
    expect(companyDetails("en", null)).toEqual(companyDetails("en"));
  });

  it("take the saved contact and company, field by field, in the page's language", () => {
    fetchMock.mockResolvedValue(answer(SAVED));
    const saved = { ...SAVED.settings, social: null } as never;
    expect(companyDetails("ar", saved)).toMatchObject({ email: "help@zimos.co", address: "القاهرة", legalName: "زيموس", taxRegistration: "111-222-333", governingLaw: "القانون المصري والمحاكم المصرية المختصة" });
  });

  it("fill the policies' text with the saved email", () => {
    const saved = { ...SAVED.settings, social: null } as never;
    const text = JSON.stringify(policyPage("privacy", "en", saved));
    expect(text).toContain("help@zimos.co");
    expect(text).not.toContain("zimossupport@gmail.com");
  });
});
