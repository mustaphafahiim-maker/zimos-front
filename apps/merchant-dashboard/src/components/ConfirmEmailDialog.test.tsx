import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { api, authMock, fake, testUser } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { closeEmailConfirm, getEmailConfirmState, holdForEmailConfirm, noteCodeSent, openEmailConfirm } from "@/lib/emailConfirm";
import { ConfirmEmailDialog } from "./ConfirmEmailDialog";

afterEach(() => {
  closeEmailConfirm(false);
  noteCodeSent(null);
});

const refusal = () => new ApiError("Confirm", 403, "EMAIL_NOT_VERIFIED", { error: { details: { email: "a***@zimos.test" } } });

describe("ConfirmEmailDialog", () => {
  it("confirms the code, refreshes the account and sends the held request again", async () => {
    api.confirmAccountCode.mockResolvedValue(fake({ user: testUser, confirmed: true }));
    const retry = vi.fn().mockResolvedValue("published");
    renderWithProviders(<ConfirmEmailDialog />);
    let held!: Promise<unknown>;
    act(() => {
      held = holdForEmailConfirm(refusal(), retry);
    });

    expect(screen.getByRole("dialog", { name: "Confirm your email" })).toHaveTextContent(/Your work is saved/);
    fireEvent.paste(screen.getAllByRole("textbox")[0], { clipboardData: { getData: () => "123456" } });
    await expect(held).resolves.toBe("published");
    expect(authMock.refreshUser).toHaveBeenCalled();
    expect(getEmailConfirmState().open).toBe(false);
  });

  it("says a code is on its way when the sign-up just sent one", () => {
    noteCodeSent({ target: "a***@zimos.test", expiresAt: new Date(Date.now() + 600_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
    renderWithProviders(<ConfirmEmailDialog />);
    act(() => openEmailConfirm());
    expect(screen.getByText(/We sent a 6-digit code to/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send a new code in \d+s/ })).toBeDisabled();
  });

  it("closes without confirming, handing the refusal back", async () => {
    renderWithProviders(<ConfirmEmailDialog />);
    const error = refusal();
    let held!: Promise<unknown>;
    act(() => {
      held = holdForEmailConfirm(error, vi.fn());
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await expect(held).rejects.toBe(error);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
