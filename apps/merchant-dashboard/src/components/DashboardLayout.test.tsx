import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { DashboardLayout } from "./DashboardLayout";

function renderShell() {
  return renderWithProviders(
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/orders" element={<p>Orders content</p>} />
        <Route path="/settlements" element={<p>Settlements content</p>} />
      </Route>
    </Routes>,
    { route: "/orders" }
  );
}

describe("DashboardLayout", () => {
  it("switches the navigation between English and Arabic", async () => {
    const { user } = renderShell();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByText("Sell")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Switch to Arabic" })[0]);
    expect(await screen.findByRole("link", { name: "الطلبات" })).toBeInTheDocument();
    expect(screen.getByText("البيع")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));

    await user.click(screen.getAllByRole("button", { name: "التبديل إلى الإنجليزية" })[0]);
    expect(await screen.findByRole("link", { name: "Orders" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  });

  it("opens the command palette with Ctrl+K and jumps to a typed destination", async () => {
    const { user } = renderShell();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByPlaceholderText("Search pages and actions…");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    await user.type(input, "settlements");
    expect(screen.getByRole("option", { name: /COD settlements/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Settlements content")).toBeInTheDocument();
    expect(currentPath()).toBe("/settlements");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });
});
