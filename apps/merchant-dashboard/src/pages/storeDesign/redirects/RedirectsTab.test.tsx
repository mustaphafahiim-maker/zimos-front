import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type UrlRedirect } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RedirectsTab } from "./RedirectsTab";

const old: UrlRedirect = {
  id: "red_1",
  fromPath: "/old-shirt",
  toPath: "/products/linen-shirt",
  statusCode: 301,
  source: "manual",
  hits: 12,
  lastHitAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
};

describe("RedirectsTab", () => {
  it("lists the store's redirects", async () => {
    const calls = fakeBackend({ "GET /redirects": { redirects: [old], total: 1 } });
    renderWithProviders(<RedirectsTab />);
    expect((await screen.findAllByText("/old-shirt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("/products/linen-shirt").length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/redirects").length).toBeGreaterThan(0);
  });

  it("adds a redirect from an old address to a new one", async () => {
    const calls = fakeBackend({
      "GET /redirects": { redirects: [], total: 0 },
      "POST /redirects": { redirect: { ...old, id: "red_2", fromPath: "/sale", toPath: "/offers" } },
    });
    const { user } = renderWithProviders(<RedirectsTab />);
    expect(await screen.findByText("No redirects yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Add redirect" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Old address/), "/sale");
    await user.type(within(dialog).getByLabelText(/Goes to/), "/offers");
    await user.click(within(dialog).getByRole("button", { name: "Add redirect" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/redirects")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/redirects")[0].body).toEqual({ fromPath: "/sale", toPath: "/offers", statusCode: 301 });
    expect(await screen.findByText("Redirect added.")).toBeInTheDocument();
  });

  it("checks the addresses before it asks the API", async () => {
    const calls = fakeBackend({ "GET /redirects": { redirects: [], total: 0 } });
    const { user } = renderWithProviders(<RedirectsTab />);
    await screen.findByText("No redirects yet");
    await user.click(screen.getAllByRole("button", { name: "Add redirect" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Old address/), "sale");
    await user.type(within(dialog).getByLabelText(/Goes to/), "http://example.com");
    await user.click(within(dialog).getByRole("button", { name: "Add redirect" }));
    expect(await within(dialog).findByText("The old address must start with /")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/redirects")).toHaveLength(0);
  });

  it("says why the API refused an address", async () => {
    fakeBackend({
      "GET /redirects": { redirects: [], total: 0 },
      "POST /redirects": new ApiError("Validation failed", 422, "VALIDATION_ERROR", {
        error: { code: "VALIDATION_ERROR", details: [{ field: "fromPath", message: "This path already redirects" }] },
      }),
    });
    const { user } = renderWithProviders(<RedirectsTab />);
    await screen.findByText("No redirects yet");
    await user.click(screen.getAllByRole("button", { name: "Add redirect" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Old address/), "/sale");
    await user.type(within(dialog).getByLabelText(/Goes to/), "/offers");
    await user.click(within(dialog).getByRole("button", { name: "Add redirect" }));
    expect(await within(dialog).findByText("This path already redirects")).toBeInTheDocument();
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /redirects": { redirects: [], total: 0 } });
    renderWithProviders(<RedirectsTab />, { locale: "ar" });
    expect(await screen.findByText("لا توجد تحويلات بعد")).toBeInTheDocument();
  });
});
