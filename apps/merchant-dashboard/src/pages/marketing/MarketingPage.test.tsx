import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MarketingPage } from "./MarketingPage";

const workspace = fake<Workspace>({
  id: "ws_1",
  name: "Nile Store",
  slug: "nile-store",
  settings: { tracking_pixels: { meta: "123456789012345", tiktok: null } },
});

describe("MarketingPage", () => {
  it("seeds the fields from the stored pixels and marks which ones are live", async () => {
    renderWithProviders(<MarketingPage />, {
      route: "/marketing",
      workspace: { currentWorkspace: workspace, workspaces: [workspace] },
    });

    expect(
      await screen.findByRole("textbox", { name: "Meta (Facebook & Instagram)" })
    ).toHaveValue("123456789012345");
    expect(screen.getByRole("textbox", { name: "TikTok" })).toHaveValue("");
    expect(screen.getAllByText("Connected")).toHaveLength(1);
    expect(screen.getAllByText("Not connected")).toHaveLength(3);
  });

  it("refuses to save an ID the platform would reject", async () => {
    const { user } = renderWithProviders(<MarketingPage />, {
      route: "/marketing",
      workspace: { currentWorkspace: workspace, workspaces: [workspace] },
    });

    const tiktok = await screen.findByRole("textbox", { name: "TikTok" });
    await user.type(tiktok, "nope");

    expect(
      screen.getByText("That doesn't look like a valid ID for this platform.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save pixels" })).toBeDisabled();
    expect(api.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("sends every key, clearing an emptied field to null", async () => {
    api.updateWorkspaceSettings.mockResolvedValue(workspace);

    const { user } = renderWithProviders(<MarketingPage />, {
      route: "/marketing",
      workspace: { currentWorkspace: workspace, workspaces: [workspace] },
    });

    await user.clear(await screen.findByRole("textbox", { name: "Meta (Facebook & Instagram)" }));
    await user.type(screen.getByRole("textbox", { name: "Google (GA4 / Ads)" }), "G-ABC123XYZ");
    await user.click(screen.getByRole("button", { name: "Save pixels" }));

    expect(api.updateWorkspaceSettings).toHaveBeenCalledWith("ws_1", {
      tracking_pixels: {
        meta: null,
        tiktok: null,
        snapchat: null,
        google_tag: "G-ABC123XYZ",
      },
    });
    expect(await screen.findByText(/Pixels saved/)).toBeInTheDocument();
  });

  it("builds a tracked store link from the UTM fields", async () => {
    const { user } = renderWithProviders(<MarketingPage />, {
      route: "/marketing",
      workspace: { currentWorkspace: workspace, workspaces: [workspace] },
    });

    await user.type(await screen.findByRole("textbox", { name: "Campaign (utm_campaign)" }), "eid");

    expect(
      screen.getByText(
        "http://localhost:3000/store/nile-store?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid"
      )
    ).toBeInTheDocument();
  });
});
