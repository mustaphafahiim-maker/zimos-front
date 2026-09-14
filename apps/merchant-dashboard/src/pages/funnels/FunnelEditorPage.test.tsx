import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { FunnelDetailDto } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelEditorPage } from "./FunnelEditorPage";

const detail = fake<FunnelDetailDto>({
  funnel: {
    id: "fun_1",
    name: "Ramadan funnel",
    subdomain: null,
    status: "draft",
    publishedRevisionId: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  },
  publishedRevision: null,
  steps: [
    { id: "s1", key: "landing", name: "Landing page", stepType: "landing", offerId: null, abTestExperimentId: null, seo: {} },
    { id: "s2", key: "upsell", name: "Gold upsell", stepType: "upsell", offerId: null, abTestExperimentId: null, seo: {} },
  ],
  edges: [{ id: "e1", fromStepKey: "landing", toStepKey: "upsell", condition: null, priority: 0 }],
});

describe("FunnelEditorPage", () => {
  it("lists the steps and blocks publishing an upsell without an offer", async () => {
    api.request.mockImplementation(((path: string) =>
      path === "/workspaces/ws_1/funnels/fun_1" ? Promise.resolve(detail) : new Promise(() => undefined)) as typeof api.request);
    api.listProducts.mockResolvedValue({ products: [], nextCursor: null } as Awaited<ReturnType<typeof api.listProducts>>);

    const { user } = renderWithProviders(<FunnelEditorPage />, { route: "/funnels/fun_1", path: "/funnels/:funnelId" });

    expect(await screen.findByRole("button", { name: "Ramadan funnel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Landing page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Gold upsell" })).toBeInTheDocument();
    expect(screen.getAllByText("Landing page").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gold upsell").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("This funnel can’t be published yet:")).toBeInTheDocument();
    expect(screen.getByText('"Gold upsell" (Upsell) needs an offer.')).toBeInTheDocument();
    const publishCalls = api.request.mock.calls.filter(([path]) => String(path).includes("/publish"));
    expect(publishCalls).toHaveLength(0);
  });
});
