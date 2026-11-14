import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { authMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { closeEmailConfirm, getEmailConfirmState } from "@/lib/emailConfirm";
import { EmailConfirmBanner } from "./EmailConfirmBanner";

afterEach(() => closeEmailConfirm(false));

describe("EmailConfirmBanner", () => {
  it("asks an unconfirmed account for its code, and opens the code dialog", async () => {
    authMock.confirmed = false;
    const { user } = renderWithProviders(<EmailConfirmBanner />);
    expect(screen.getByTestId("email-confirm-banner")).toHaveTextContent(/Confirm your email address \(.*a\*\*\*@zimos\.test.*\)/);
    await user.click(screen.getByRole("button", { name: "Enter the code" }));
    expect(getEmailConfirmState()).toMatchObject({ open: true, holding: false });
  });

  it("is in Arabic for an Arabic dashboard", () => {
    authMock.confirmed = false;
    renderWithProviders(<EmailConfirmBanner />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "إدخال الرمز" })).toBeInTheDocument();
  });

  it("is gone once the account is confirmed", () => {
    authMock.confirmed = true;
    renderWithProviders(<EmailConfirmBanner />);
    expect(screen.queryByTestId("email-confirm-banner")).not.toBeInTheDocument();
  });
});
