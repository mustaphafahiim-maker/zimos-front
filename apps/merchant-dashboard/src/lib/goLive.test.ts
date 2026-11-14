import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { closeGoLive, draftRefusal, getGoLiveState, holdForGoLive, openGoLive } from "./goLive";

const draftBody = {
  error: {
    code: "SUBSCRIPTION_REQUIRED",
    message: "This store is a draft.",
    details: { draft: true, planId: "p1", planName: "Pro", trial: { eligible: true, days: 7 } },
  },
};
const draftError = () => new ApiError("This store is a draft.", 403, "SUBSCRIPTION_REQUIRED", draftBody);

afterEach(() => {
  closeGoLive(false);
  vi.unstubAllGlobals();
});

describe("draftRefusal", () => {
  it("reads a draft store's refusal", () => {
    expect(draftRefusal(draftError())).toEqual({ planId: "p1", planName: "Pro", trial: { eligible: true, days: 7 } });
  });

  it("ignores an expired subscription's refusal and anything else", () => {
    expect(draftRefusal(new ApiError("Expired", 402, "SUBSCRIPTION_REQUIRED", { error: { details: {} } }))).toBeNull();
    expect(draftRefusal(new ApiError("No", 403, "FORBIDDEN", {}))).toBeNull();
    expect(draftRefusal(new Error("boom"))).toBeNull();
  });
});

describe("holding a refused request", () => {
  it("sends it again and hands back its answer once the store is live", async () => {
    const retry = vi.fn().mockResolvedValue({ published: true });
    const held = holdForGoLive(draftError(), draftRefusal(draftError())!, retry);
    expect(getGoLiveState()).toMatchObject({ open: true, holding: true, refusal: { planName: "Pro" } });
    const before = getGoLiveState().liveVersion;
    closeGoLive(true);
    await expect(held).resolves.toEqual({ published: true });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(getGoLiveState()).toMatchObject({ open: false, holding: false, liveVersion: before + 1 });
  });

  it("fails with the refusal when the dialog closes without going live", async () => {
    const error = draftError();
    const retry = vi.fn();
    const held = holdForGoLive(error, draftRefusal(error)!, retry);
    closeGoLive(false);
    await expect(held).rejects.toBe(error);
    expect(retry).not.toHaveBeenCalled();
  });

  it("opens from the banner with nothing held", () => {
    openGoLive({ planId: "p1", planName: "Pro", trial: { eligible: false, days: 7 } });
    expect(getGoLiveState()).toMatchObject({ open: true, holding: false });
  });
});

describe("the dashboard's API client", () => {
  it("holds a draft refusal and replays the request once the store goes live", async () => {
    const responses = [
      new Response(JSON.stringify(draftBody), { status: 403, headers: { "content-type": "application/json" } }),
      new Response(JSON.stringify({ website: { status: "published" } }), { status: 201, headers: { "content-type": "application/json" } }),
    ];
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const { apiClient } = await import("./apiClient");

    const publishing = apiClient.request<{ website: { status: string } }>("/workspaces/w/websites/s/publish", { method: "POST" });
    await vi.waitFor(() => expect(getGoLiveState().holding).toBe(true));
    closeGoLive(true);
    await expect(publishing).resolves.toEqual({ website: { status: "published" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
