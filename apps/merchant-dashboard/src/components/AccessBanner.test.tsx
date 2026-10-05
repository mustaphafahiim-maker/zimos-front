import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Workspace, WorkspaceAccess } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AccessBanner } from "./AccessBanner";

const access = (billing: Partial<WorkspaceAccess["billing"]>) =>
  fake<WorkspaceAccess>({
    restricted: false,
    reasons: [],
    billing: { phase: "ok", status: "trialing", trialing: true, periodEnd: "2030-01-01", restrictsAt: null, enforced: false, ...billing },
    suspension: { suspended: false, since: null },
    wallet: null,
  });

describe("AccessBanner and paying", () => {
  it("sends an ending trial to the invoices, where the Pay button is", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_trial", name: "Nile Store", role: "owner" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "expiring" }));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Your free trial ends on");
    expect(within(banner).getByRole("link", { name: "My Plan" })).toHaveAttribute("href", "/subscription?tab=invoices");
  });

  it("sends a lapsed subscription to the invoices too, in Arabic", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_lapsed", name: "Nile Store", role: "accountant" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "restricted", status: "past_due", trialing: false, enforced: true }));
    renderWithProviders(<AccessBanner />, { locale: "ar" });
    const banner = await screen.findByRole("alert");
    expect(within(banner).getByRole("link", { name: "خطتي" })).toHaveAttribute("href", "/subscription?tab=invoices");
  });

  it("shows no link to whoever can't manage billing", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_staff", name: "Nile Store", role: "order_operator" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "expiring" }));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("status");
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
  });
});
