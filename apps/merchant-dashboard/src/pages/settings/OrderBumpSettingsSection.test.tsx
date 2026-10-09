import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type Workspace, type WorkspaceOfferOption } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrderBumpSettingsSection } from "./OrderBumpSettingsSection";

const offer = (over: Partial<WorkspaceOfferOption>): WorkspaceOfferOption => ({
  id: "of_1",
  name: "Two pairs",
  priceAmount: "8000",
  currency: "EGP",
  isDefault: false,
  productId: "p_1",
  productName: "Socks",
  imageUrl: null,
  lines: [{ variantId: "v_1", quantity: 2 }],
  bumpProblem: null,
  ...over,
});

describe("OrderBumpSettingsSection", () => {
  it("switches the add-on on with the chosen offer, heading and text", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner", settings: {} });
    api.listWorkspaceOffers.mockResolvedValue([
      offer({}),
      offer({ id: "of_2", name: "Engraved mug", productId: "p_2", productName: "Mug", bumpProblem: "custom_fields" }),
    ]);
    api.updateWorkspace.mockImplementation(async (_id, payload) =>
      fake<Workspace>({ id: "ws_1", settings: { order_bump: payload.settings?.order_bump ?? undefined } })
    );
    const { user } = renderWithProviders(<OrderBumpSettingsSection />);

    // An offer whose product asks the customer something can't be picked.
    const mug = await screen.findByRole("option", { name: /Engraved mug.*asks the customer for details/ });
    expect(mug).toBeDisabled();

    await user.click(screen.getByRole("switch", { name: /Offer an add-on at checkout/ }));
    await user.selectOptions(screen.getByLabelText("The offer"), "of_1");
    await user.type(screen.getByLabelText("Heading (optional)"), "Complete the look");
    await user.click(screen.getByRole("button", { name: "Save add-on offer" }));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
        settings: { order_bump: { enabled: true, offer_id: "of_1", title: "Complete the look", description: null } },
      })
    );
  });

  it("asks for an offer before saving it switched on, and explains a refused one", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner", settings: {} });
    api.listWorkspaceOffers.mockResolvedValue([offer({})]);
    api.updateWorkspace.mockRejectedValue(new ApiError("Invalid", 422, "VALIDATION_ERROR", null));
    const { user } = renderWithProviders(<OrderBumpSettingsSection />);
    await screen.findByRole("option", { name: /Two pairs/ });

    await user.click(screen.getByRole("switch", { name: /Offer an add-on at checkout/ }));
    await user.click(screen.getByRole("button", { name: "Save add-on offer" }));
    expect(await screen.findByText("Choose the offer to show.")).toBeInTheDocument();
    expect(api.updateWorkspace).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("The offer"), "of_1");
    await user.click(screen.getByRole("button", { name: "Save add-on offer" }));
    expect(await screen.findByText(/can't be used as an add-on/)).toBeInTheDocument();
  });

  it("warns when the saved offer was archived since", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({
      id: "ws_1",
      role: "owner",
      settings: { order_bump: { enabled: true, offer_id: "of_gone" } },
    });
    api.listWorkspaceOffers.mockResolvedValue([offer({})]);
    renderWithProviders(<OrderBumpSettingsSection />);
    expect(await screen.findByText(/can no longer be offered/)).toBeInTheDocument();
  });

  it("is read-only for a role that cannot edit the website", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "confirmation_agent", settings: {} });
    api.listWorkspaceOffers.mockResolvedValue([]);
    renderWithProviders(<OrderBumpSettingsSection />);
    expect(await screen.findByText(/Only the store owner/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save add-on offer" })).not.toBeInTheDocument();
  });
});
