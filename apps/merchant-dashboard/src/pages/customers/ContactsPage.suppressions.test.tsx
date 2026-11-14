import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { EmailSuppression } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ContactsPage } from "./ContactsPage";
import { CustomerSuppressionBanner } from "./suppressions/CustomerSuppressionBanner";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ suppressions: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get EMAIL_SUPPRESSIONS_ENABLED() {
    return flags.suppressions;
  },
}));

const bounced: EmailSuppression = {
  id: "sup_1",
  email: "mona@example.com",
  reason: "hard_bounce",
  source: "brevo",
  detail: "Mailbox does not exist",
  notificationLogId: null,
  createdAt: "2026-10-08T10:00:00.000Z",
};

describe("Contacts and the suppressed addresses", () => {
  it("has no such tab, and asks the API nothing about it, while the feature is off", async () => {
    flags.suppressions = false;
    const calls = fakeBackend({});
    renderWithProviders(<ContactsPage />, { route: "/customers?tab=suppressed" });
    const tabs = await screen.findByRole("group", { name: "Contacts view" });
    expect(tabs).not.toHaveTextContent("Suppressed emails");
    // The address of a tab that is off opens All.
    expect(within(tabs).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(callsTo(calls, "GET", "/email-suppressions")).toHaveLength(0);
  });

  it("lists the stopped addresses with why, while it is on", async () => {
    flags.suppressions = true;
    const calls = fakeBackend({ "GET /email-suppressions": { suppressions: [bounced], next: null } });
    renderWithProviders(<ContactsPage />, { route: "/customers?tab=suppressed" });
    const tabs = await screen.findByRole("group", { name: "Contacts view" });
    expect(within(tabs).getByRole("button", { name: "Suppressed emails" })).toHaveAttribute("aria-pressed", "true");
    expect((await screen.findAllByText("mona@example.com")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bounce").length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/email-suppressions").length).toBeGreaterThan(0);
  });

  it("lifts a stop only after asking", async () => {
    flags.suppressions = true;
    const calls = fakeBackend({
      "GET /email-suppressions": { suppressions: [bounced], next: null },
      "DELETE /email-suppressions/sup_1": { lifted: true, suppression: bounced },
    });
    const { user } = renderWithProviders(<ContactsPage />, { route: "/customers?tab=suppressed" });
    await user.click((await screen.findAllByRole("button", { name: "Lift the stop on mona@example.com" }))[0]);
    expect(callsTo(calls, "DELETE", "/email-suppressions/sup_1")).toHaveLength(0);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Allow emails to mona@example.com again?");
    await user.click(within(dialog).getByRole("button", { name: "Allow emails again" }));

    await waitFor(() => expect(callsTo(calls, "DELETE", "/workspaces/ws_1/email-suppressions/sup_1")).toHaveLength(1));
    expect(await screen.findByText("Emails go to mona@example.com again.")).toBeInTheDocument();
  });

  it("names the tab in formal Arabic", async () => {
    flags.suppressions = true;
    fakeBackend({ "GET /email-suppressions": { suppressions: [], next: null } });
    renderWithProviders(<ContactsPage />, { route: "/customers?tab=suppressed", locale: "ar" });
    expect(await screen.findByText("لا توجد عناوين موقوفة — كل رسائلك تصل")).toBeInTheDocument();
  });
});

describe("the notice on a customer whose address is stopped", () => {
  it("says why no email reaches the address", async () => {
    const calls = fakeBackend({ "GET /email-suppressions": { suppressions: [bounced], next: null } });
    renderWithProviders(<CustomerSuppressionBanner email="mona@example.com" />);
    expect(await screen.findByText(/Emails to this address are stopped: it bounced/)).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/email-suppressions")[0].path).toContain("email=mona%40example.com");
  });

  it("shows nothing for an address that is not stopped, or a customer with no email", async () => {
    const calls = fakeBackend({ "GET /email-suppressions": { suppressions: [], next: null } });
    const first = renderWithProviders(<CustomerSuppressionBanner email="ok@example.com" />);
    await waitFor(() => expect(callsTo(calls, "GET", "/email-suppressions")).toHaveLength(1));
    expect(screen.queryByText(/Emails to this address are stopped/)).not.toBeInTheDocument();
    first.unmount();

    renderWithProviders(<CustomerSuppressionBanner email={null} />);
    expect(callsTo(calls, "GET", "/email-suppressions")).toHaveLength(1);
  });
});
