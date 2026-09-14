import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("renders for an unknown route and links back into the dashboard", async () => {
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/orders" element={<p>Orders content</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>,
      { route: "/no/such/page" }
    );

    expect(screen.getByRole("heading", { name: "We couldn't find that page" })).toBeInTheDocument();
    expect(screen.getByText("/no/such/page", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("link", { name: "View orders" }));
    expect(await screen.findByText("Orders content")).toBeInTheDocument();
    expect(currentPath()).toBe("/orders");
  });

  it("is translated in Arabic", () => {
    renderWithProviders(<NotFoundPage />, { route: "/x", locale: "ar" });
    expect(screen.getByRole("heading", { name: "لم نعثر على هذه الصفحة" })).toBeInTheDocument();
  });
});
