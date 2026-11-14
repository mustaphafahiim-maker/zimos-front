/**
 * ZIMOS's social accounts on the support page (usePlatformSocialLinks): the
 * code's list while VITE_PLATFORM_SETTINGS_ENABLED is off; on, the console's
 * list, or the code's again whenever the API fails or nothing was saved.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SOCIAL_LINKS } from "@store-builder/ui/social-links";
import { usePlatformSocialLinks } from "./usePlatformSocialLinks";

const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the support page's social accounts", () => {
  it("are the code's list at once while the flag is off, with no request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePlatformSocialLinks(false));
    expect(result.current).toBe(SOCIAL_LINKS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("are the console's list once it arrives, nothing before", async () => {
    const links = [{ platform: "youtube", url: "https://www.youtube.com/@zimos", enabled: true, order: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(answer({ settings: { contact: null, social: { links }, company: null, footer: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePlatformSocialLinks(true));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(links));
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/v1/platform-settings/public");
  });

  it("fall back to the code's list when the API is down, off, or the links were never saved", async () => {
    for (const reply of [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve(answer({ error: { code: "ROUTE_NOT_FOUND" } }, 404)),
      () => Promise.resolve(answer({ settings: { contact: null, social: null, company: null, footer: null } })),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(reply));
      const { result, unmount } = renderHook(() => usePlatformSocialLinks(true));
      await waitFor(() => expect(result.current).toBe(SOCIAL_LINKS));
      unmount();
    }
  });
});
