// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const VARIABLE = "NEXT_PUBLIC_SHOPPER_ACCOUNTS_ENABLED";

async function loadWith(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv(VARIABLE, value);
  return import("./features");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("store feature switches", () => {
  it("leave shopper accounts off when the build variable is unset", async () => {
    expect((await loadWith(undefined)).SHOPPER_ACCOUNTS_ENABLED).toBe(false);
  });

  it("turn shopper accounts on only for exactly \"true\"", async () => {
    for (const value of ["TRUE", "1", "yes", " true", ""]) {
      expect([value, (await loadWith(value)).SHOPPER_ACCOUNTS_ENABLED]).toEqual([value, false]);
    }
    expect((await loadWith("true")).SHOPPER_ACCOUNTS_ENABLED).toBe(true);
  });
});
