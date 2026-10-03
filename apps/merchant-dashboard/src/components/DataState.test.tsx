import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { DataState } from "./DataState";

// ApiError carries the whole response body; the server's details sit in body.error.details.
const featureRequired = (details: unknown = { feature: "advanced_analytics", label: { en: "Advanced analytics", ar: "تحليلات متقدمة" } }) =>
  new ApiError("Your plan doesn't include Advanced analytics. Upgrade your plan to use it.", 403, "PLAN_FEATURE_REQUIRED", {
    error: { code: "PLAN_FEATURE_REQUIRED", details },
  });

describe("DataState and the plan feature gate (PLAN_FEATURE_REQUIRED)", () => {
  it("shows an upgrade prompt naming the feature in Arabic, with a way to the plans", async () => {
    const { user } = renderWithProviders(
      <DataState loading={false} error={featureRequired()} onRetry={() => {}}>
        <p>data</p>
      </DataState>,
      { locale: "ar" }
    );
    expect(screen.getByText("خطتك الحالية لا تشمل «تحليلات متقدمة». رقِّ خطتك من قسم الاشتراك لاستخدامها.")).toBeTruthy();
    // Not the permission sentence a plain 403 gets, and nothing to retry.
    expect(screen.queryByText(/ليست لديك صلاحية/)).toBeNull();
    expect(screen.queryByRole("button", { name: "حاول مرة أخرى" })).toBeNull();
    // The shared Button renders the router link as an <a> with role="button".
    const seePlans = screen.getByRole("button", { name: "عرض الخطط" });
    expect(seePlans.tagName).toBe("A");
    await user.click(seePlans);
    expect(currentPath()).toBe("/subscription");
  });

  it("names it in English too", () => {
    renderWithProviders(
      <DataState loading={false} error={featureRequired()}>
        <p>data</p>
      </DataState>,
      { locale: "en" }
    );
    expect(screen.getByText("Your plan doesn't include Advanced analytics. Upgrade your plan from Subscription to use it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See the plans" }).getAttribute("href")).toBe("/subscription");
  });

  it("falls back to a general upgrade sentence when the server names no feature", () => {
    renderWithProviders(
      <DataState loading={false} error={featureRequired(null)}>
        <p>data</p>
      </DataState>,
      { locale: "en" }
    );
    expect(screen.getByText("Your plan doesn't include this feature. Upgrade your plan from Subscription to use it.")).toBeTruthy();
  });

  it("keeps the permission message for any other 403", () => {
    renderWithProviders(
      <DataState loading={false} error={new ApiError("Forbidden", 403, "FORBIDDEN", {})}>
        <p>data</p>
      </DataState>,
      { locale: "en" }
    );
    expect(screen.getByText("You don't have permission to view this. Ask an owner to update your role.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "See the plans" })).toBeNull();
  });
});
