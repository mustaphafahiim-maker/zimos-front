import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiError, type VerificationChallenge } from "@store-builder/api-client";
import { api, fake, testUser } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { VerifyCodePanel } from "./VerifyCodePanel";

const challenge = (overrides: Partial<VerificationChallenge> = {}): VerificationChallenge => ({
  verificationRequired: true,
  verificationToken: "vt",
  channels: ["email", "sms"],
  targets: { email: "a***@example.com", sms: "01******234" },
  codeSent: true,
  channel: "email",
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  ...overrides,
});

const digits = () => screen.getAllByRole("textbox");

describe("VerifyCodePanel", () => {
  it("takes a pasted code whole and signs in with it", async () => {
    api.confirmVerificationCode.mockResolvedValue(fake({ user: testUser, accessToken: "a", refreshToken: "r" }));
    const onVerified = vi.fn();
    renderWithProviders(<VerifyCodePanel challenge={challenge()} onVerified={onVerified} />);

    expect(digits()).toHaveLength(6);
    expect(digits()[0]).toHaveAttribute("autocomplete", "one-time-code");
    expect(digits()[0]).toHaveAttribute("inputmode", "numeric");
    fireEvent.paste(digits()[0], { clipboardData: { getData: () => " 123 456 " } });

    await waitFor(() => expect(api.confirmVerificationCode).toHaveBeenCalledWith("vt", "123456"));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(testUser));
  });

  it("moves on as each digit is typed, and back on Backspace", async () => {
    const { user } = renderWithProviders(<VerifyCodePanel challenge={challenge()} onVerified={vi.fn()} />);
    await user.type(digits()[0], "1");
    expect(digits()[1]).toHaveFocus();
    await user.type(digits()[1], "2");
    expect(digits()[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(digits()[1]).toHaveFocus();
    expect(digits()[1]).toHaveValue("");
  });

  it("says how many attempts are left after a wrong code", async () => {
    api.confirmVerificationCode.mockRejectedValue(
      new ApiError("wrong", 422, "INVALID_CODE", { error: { code: "INVALID_CODE", details: { attemptsLeft: 3 } } })
    );
    renderWithProviders(<VerifyCodePanel challenge={challenge()} onVerified={vi.fn()} />);
    fireEvent.paste(digits()[0], { clipboardData: { getData: () => "000000" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("3 attempts left");
    expect(digits()[0]).toHaveValue("");
  });

  it("explains an expired code and too many attempts", async () => {
    api.confirmVerificationCode.mockRejectedValueOnce(new ApiError("expired", 422, "CODE_EXPIRED", {}));
    renderWithProviders(<VerifyCodePanel challenge={challenge()} onVerified={vi.fn()} />);
    fireEvent.paste(digits()[0], { clipboardData: { getData: () => "111111" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/);

    api.confirmVerificationCode.mockRejectedValueOnce(new ApiError("many", 429, "TOO_MANY_ATTEMPTS", {}));
    fireEvent.paste(digits()[0], { clipboardData: { getData: () => "222222" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Too many wrong attempts/));
  });

  it("makes a new code wait out the 60 seconds, then sends one on the chosen channel", async () => {
    api.sendVerificationCode.mockResolvedValue(
      fake({ sent: true, channel: "sms", target: "01******234", expiresAt: "x", resendAvailableAt: new Date(Date.now() + 60_000).toISOString() })
    );
    const { user } = renderWithProviders(
      <VerifyCodePanel challenge={challenge({ resendAvailableAt: new Date(Date.now() - 1000).toISOString() })} onVerified={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: /SMS/ }));
    await waitFor(() => expect(api.sendVerificationCode).toHaveBeenCalledWith("vt", "sms", "en"));
    expect(await screen.findByRole("button", { name: /Send a new code in \d+s/ })).toBeDisabled();
  });

  it("offers only email when the account has no usable phone", () => {
    renderWithProviders(
      <VerifyCodePanel challenge={challenge({ channels: ["email"], targets: { email: "a***@example.com" } })} onVerified={vi.fn()} />
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
