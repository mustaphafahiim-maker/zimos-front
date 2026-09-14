import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ErrorBoundary } from "./ErrorBoundary";

let explode = true;
function Flaky() {
  if (explode) throw new Error("kaboom: orders chart failed");
  return <p>Recovered content</p>;
}

describe("ErrorBoundary", () => {
  it("shows the friendly error card when a child throws and recovers on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    explode = true;
    const { user } = renderWithProviders(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );

    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("Something went wrong on this page");
    expect(card).toHaveTextContent("The rest of the dashboard still works.");
    expect(screen.getByText("kaboom: orders chart failed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");

    explode = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
