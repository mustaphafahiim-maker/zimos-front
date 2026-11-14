import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend, type FakeCall } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GeneralTab } from "./GeneralTab";

/**
 * The "Hide ZIMOS branding" switch: saved with the general settings on any
 * plan, usable only while the plan has remove_branding (GET /plan-features).
 */
function asOwner(settings: Record<string, unknown> = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", settings });
}

const plan = (features: string[]) => ({ planFeatures: { features, enforced: false } });
const STORE_APP = { storeApp: { enabled: false, name: "", shortName: "", iconUrl: null, themeColor: null } };

describe("GeneralTab — platform branding", () => {
  it("saves the switch with the general settings when the plan has remove_branding", async () => {
    asOwner();
    const calls = fakeBackend({
      "GET /workspaces/ws_1/plan-features": plan(["remove_branding"]),
      "GET /workspaces/ws_1/store-app": STORE_APP,
      "PATCH /workspaces/ws_1": (call: FakeCall) => ({
        workspace: { id: "ws_1", name: "Nile Store", settings: (call.body as { settings: unknown }).settings },
      }),
    });
    const { user } = renderWithProviders(<GeneralTab />);

    const toggle = await screen.findByLabelText(/Hide ZIMOS branding/);
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText(/Your plan doesn't include/)).not.toBeInTheDocument();

    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(callsTo(calls, "PATCH", "/workspaces/ws_1")).toHaveLength(1));
    const body = callsTo(calls, "PATCH", "/workspaces/ws_1")[0].body as { settings: { general: Record<string, unknown> } };
    expect(body.settings.general).toEqual({ favicon_url: null, country: null, hide_platform_branding: true });
  });

  it("without remove_branding: shows what is stored, can't be flipped, and points to the plans", async () => {
    asOwner({ general: { hide_platform_branding: true } });
    fakeBackend({
      "GET /workspaces/ws_1/plan-features": plan(["funnels"]),
      "GET /workspaces/ws_1/store-app": STORE_APP,
    });
    renderWithProviders(<GeneralTab />);

    const toggle = await screen.findByLabelText(/Hide ZIMOS branding/);
    await waitFor(() => expect(toggle).toBeDisabled());
    expect(toggle).toBeChecked();
    expect(screen.getByText("Your plan doesn't include Remove platform branding. Upgrade your plan to use it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See the plans" }).getAttribute("href")).toBe("/subscription");
  });
});
