import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@store-builder/api-client";
import {
  closeEmailConfirm,
  emailRefusal,
  getEmailConfirmState,
  holdForEmailConfirm,
  listenForConfirmation,
  maskEmail,
  noteCodeSent,
  openEmailConfirm,
} from "./emailConfirm";
import { closeGoLive, getGoLiveState } from "./goLive";

const refusalBody = {
  error: { code: "EMAIL_NOT_VERIFIED", message: "Confirm your email address first.", details: { email: "a***@example.com" } },
};
const refusal = () => new ApiError("Confirm your email address first.", 403, "EMAIL_NOT_VERIFIED", refusalBody);

const draftBody = {
  error: {
    code: "SUBSCRIPTION_REQUIRED",
    message: "This store is a draft.",
    details: { draft: true, planId: "p1", planName: "Pro", trial: { eligible: true, days: 14 } },
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  closeEmailConfirm(false);
  closeGoLive(false);
  noteCodeSent(null);
  vi.unstubAllGlobals();
});

describe("emailRefusal", () => {
  it("reads the refusal of an account whose email isn't confirmed", () => {
    expect(emailRefusal(refusal())).toEqual({ email: "a***@example.com" });
  });

  it("ignores anything else", () => {
    expect(emailRefusal(new ApiError("Draft", 403, "SUBSCRIPTION_REQUIRED", draftBody))).toBeNull();
    expect(emailRefusal(new ApiError("No", 403, "FORBIDDEN", {}))).toBeNull();
    expect(emailRefusal(new Error("boom"))).toBeNull();
  });
});

describe("holding a refused request", () => {
  it("sends it again once the email is confirmed, and tells the other tabs", async () => {
    const posted: unknown[] = [];
    class FakeChannel {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage(message: unknown) {
        posted.push(message);
      }
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const retry = vi.fn().mockResolvedValue({ published: true });
    const held = holdForEmailConfirm(refusal(), retry);
    expect(getEmailConfirmState()).toMatchObject({ open: true, holding: true });
    const before = getEmailConfirmState().confirmedVersion;
    closeEmailConfirm(true);
    await expect(held).resolves.toEqual({ published: true });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(getEmailConfirmState()).toMatchObject({ open: false, holding: false, confirmedVersion: before + 1 });
    expect(posted).toEqual(["confirmed"]);
  });

  it("fails with the refusal when the dialog closes unconfirmed", async () => {
    const error = refusal();
    const retry = vi.fn();
    const held = holdForEmailConfirm(error, retry);
    closeEmailConfirm(false);
    await expect(held).rejects.toBe(error);
    expect(retry).not.toHaveBeenCalled();
  });

  it("opens from the banner with nothing held, and remembers the code the sign-up sent", () => {
    noteCodeSent({ target: "a***@example.com", expiresAt: "2030-01-01T00:00:00Z", resendAvailableAt: "2030-01-01T00:00:00Z" });
    openEmailConfirm();
    expect(getEmailConfirmState()).toMatchObject({ open: true, holding: false, sent: { target: "a***@example.com" } });
  });
});

describe("another tab confirming", () => {
  it("is heard through BroadcastChannel", () => {
    let channel: { onmessage: (() => void) | null } | null = null;
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        onmessage: (() => void) | null = null;
        constructor() {
          channel = this;
        }
        close() {}
      }
    );
    const heard = vi.fn();
    const stop = listenForConfirmation(heard);
    channel!.onmessage?.();
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does without it where it doesn't exist", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(() => listenForConfirmation(vi.fn())()).not.toThrow();
  });
});

describe("maskEmail", () => {
  it("masks like the server", () => {
    expect(maskEmail("amr@example.com")).toBe("a***@example.com");
  });
});

describe("the dashboard's API client", () => {
  it("asks for the code first, then for the subscription, then publishes — without a reload", async () => {
    const responses = [
      json(403, refusalBody),
      json(403, draftBody),
      json(201, { website: { status: "published" } }),
    ];
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const { apiClient } = await import("./apiClient");

    const publishing = apiClient.request<{ website: { status: string } }>("/workspaces/w/websites/s/publish", { method: "POST" });
    await vi.waitFor(() => expect(getEmailConfirmState().holding).toBe(true));
    closeEmailConfirm(true);
    await vi.waitFor(() => expect(getGoLiveState().holding).toBe(true));
    closeGoLive(true);
    await expect(publishing).resolves.toEqual({ website: { status: "published" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
