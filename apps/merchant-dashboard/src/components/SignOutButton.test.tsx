import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { authMock } from "@/test/mocks";
import { SignOutButton } from "./SignOutButton";

function renderButton(locale: "en" | "ar" = "en") {
  return renderWithProviders(<SignOutButton>{locale === "ar" ? "تسجيل الخروج" : "Sign out"}</SignOutButton>, { locale });
}

describe("signing out asks first", () => {
  it("one click only opens the confirmation", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    const dialog = screen.getByRole("alertdialog", { name: "Sign out?" });
    expect(dialog).toHaveAccessibleDescription("You'll need to sign in again to manage your stores.");
    expect(authMock.logout).not.toHaveBeenCalled();
  });

  it("Cancel closes it without signing out, and focus goes back to the link", async () => {
    const { user } = renderButton();
    const trigger = screen.getByRole("button", { name: "Sign out" });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(authMock.logout).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("Escape closes it, and only it", async () => {
    const drawerEscape = vi.fn();
    window.addEventListener("keydown", drawerEscape);
    const { user } = renderButton();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(authMock.logout).not.toHaveBeenCalled();
    expect(drawerEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", drawerEscape);
  });

  it("works from the keyboard: focus starts on Cancel, Tab stays inside, Enter on Sign out signs out", async () => {
    const { user } = renderButton();
    screen.getByRole("button", { name: "Sign out" }).focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("alertdialog");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();

    await user.tab();
    const confirm = dialog.querySelectorAll("button")[1];
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(authMock.logout).toHaveBeenCalledTimes(1));
  });

  it("the dialog's Sign out signs out once, and shows it is working", async () => {
    let finish: () => void = () => undefined;
    authMock.logout.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user } = renderButton();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(dialog.querySelectorAll("button")[1]);

    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(authMock.logout).toHaveBeenCalledTimes(1);
    finish();
  });

  it("in Arabic", async () => {
    const { user } = renderButton("ar");

    await user.click(screen.getByRole("button", { name: "تسجيل الخروج" }));

    const dialog = screen.getByRole("alertdialog", { name: "تسجيل الخروج؟" });
    expect(dialog).toHaveAccessibleDescription("ستحتاج إلى تسجيل الدخول مرة أخرى لإدارة متاجرك.");
    expect(screen.getByRole("button", { name: "إلغاء" })).toHaveFocus();
    expect(dialog.querySelectorAll("button")[1]).toHaveTextContent("تسجيل الخروج");
  });
});
