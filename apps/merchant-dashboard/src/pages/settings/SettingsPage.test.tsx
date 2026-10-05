import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

function profileSection() {
  return screen.getByRole("heading", { name: "Store profile" }).closest("section")!;
}

describe("SettingsPage store profile", () => {
  it("saves the profile and colours onto the store's latest themeSettings", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({
      id: "ws_1",
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D" },
    });
    // A theme saved from another tab after this one loaded.
    api.listWorkspaces.mockResolvedValue([
      fake<ListedWorkspace>({ id: "ws_1", themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D", storeTheme: "glass" } }),
    ]);
    const saved = fake<Workspace>({ id: "ws_1", name: "Nile Store" });
    api.updateWorkspace.mockResolvedValue(saved);
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D", storeTheme: "glass" },
    });
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledWith(saved);
    expect(await screen.findByText("Store profile saved.")).toBeInTheDocument();
  });

  it("never writes the default colours over a store theme when only the name changes", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({
      id: "ws_1",
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { storeTheme: "warm" },
    });
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { storeTheme: "warm" } })]);
    api.updateWorkspace.mockResolvedValue(fake<Workspace>({ id: "ws_1", name: "Nile Store" }));
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { storeTheme: "warm" },
    });
  });

  it("saves nothing, and says why, when the store is gone from the account", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    api.listWorkspaces.mockResolvedValue([]);
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    expect(
      await within(profileSection()).findByText("This store is no longer available to your account, so nothing was saved.")
    ).toBeInTheDocument();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });
});

describe("SettingsPage team invitations", () => {
  const inviteRefused = () =>
    new ApiError("That person's account hasn't confirmed its email yet.", 409, "INVITEE_NOT_CONFIRMED", {
      error: { code: "INVITEE_NOT_CONFIRMED", message: "That person's account hasn't confirmed its email yet." },
    });

  // PLAN_FEATURE_ENFORCEMENT on, and the store's plan has no staff accounts.
  const planLacksStaff = () =>
    new ApiError("Your plan doesn't include Staff accounts. Upgrade your plan to use it.", 403, "PLAN_FEATURE_REQUIRED", {
      error: {
        code: "PLAN_FEATURE_REQUIRED",
        message: "Your plan doesn't include Staff accounts. Upgrade your plan to use it.",
        details: { feature: "staff_accounts", label: { en: "Staff accounts", ar: "حسابات الفريق" } },
      },
    });

  async function invite(locale: "en" | "ar", refusal: ApiError = inviteRefused()) {
    api.listWorkspaceMembers.mockResolvedValue([]);
    api.listPendingInvites.mockResolvedValue([]);
    api.listWorkspaceRoles.mockResolvedValue([fake({ id: "role_1", key: "order_operator", name: "Order operator" })]);
    api.inviteMember.mockRejectedValue(refusal);
    const { user } = renderWithProviders(<SettingsPage />, { locale });
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = screen.getByRole("dialog", { name: "Invite member" });
    await user.type(within(dialog).getByLabelText(/Email/), "new.person@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Send invite" }));
  }

  it("tells the inviter that an unconfirmed account must confirm its email first", async () => {
    await invite("en");
    expect(await screen.findByText(/hasn't confirmed its email yet\. Ask them to confirm it, then invite them again\./)).toBeInTheDocument();
  });

  it("says it in Arabic on an Arabic dashboard", async () => {
    await invite("ar");
    expect(await screen.findByText("لم يؤكد صاحب هذا الحساب بريده الإلكتروني بعد. اطلب منه تأكيده، ثم أرسل الدعوة مرة أخرى.")).toBeInTheDocument();
  });

  it("asks for an upgrade, naming the feature, when the plan has no staff accounts", async () => {
    await invite("en", planLacksStaff());
    expect(await screen.findByText("Your plan doesn't include Staff accounts. Upgrade your plan from My Plan to use it.")).toBeInTheDocument();
    expect(screen.queryByText(/don't have permission/)).not.toBeInTheDocument();
  });

  it("asks for it in Arabic on an Arabic dashboard", async () => {
    await invite("ar", planLacksStaff());
    expect(await screen.findByText("خطتك الحالية لا تشمل «حسابات الفريق». رقِّ خطتك من قسم خطتي لاستخدامها.")).toBeInTheDocument();
  });
});
