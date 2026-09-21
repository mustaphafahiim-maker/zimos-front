import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { FunnelDetailDto, FunnelEdgeDto, FunnelStepDto } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelEditorPage } from "./FunnelEditorPage";
import { stepPageTree } from "./funnelPages";

function step(key: string, stepType: FunnelStepDto["stepType"], name: string, i: number, offerId: string | null = null): FunnelStepDto {
  return fake<FunnelStepDto>({
    id: `step_${key}`,
    key,
    stepType,
    name,
    builderData: stepPageTree(stepType, "en"),
    offerId,
    abTestExperimentId: null,
    seo: { zimosCanvas: { x: 40 + i * 280, y: 64, order: i } },
  });
}

function edge(id: string, fromStepKey: string, toStepKey: string, type: string, priority = 0): FunnelEdgeDto {
  return fake<FunnelEdgeDto>({ id, fromStepKey, toStepKey, condition: { type }, priority });
}

const liveFunnel = fake<FunnelDetailDto>({
  funnel: { id: "f1", name: "Headphones COD", subdomain: "headphones", status: "published", publishedRevisionId: "rev_3", createdAt: "", updatedAt: "" },
  steps: [
    step("product", "landing", "Product page", 0),
    step("checkout", "checkout", "COD checkout", 1),
    step("upsell", "upsell", "Extra offer", 2),
    step("thank-you", "thank_you", "Thank you", 3),
  ],
  edges: [
    edge("e1", "product", "checkout", "always"),
    edge("e2", "checkout", "upsell", "completed_checkout"),
    edge("e3", "upsell", "thank-you", "accepted_offer", 1),
    edge("e4", "upsell", "thank-you", "declined_offer"),
  ],
  publishedRevision: { id: "rev_3", revisionNumber: 3, note: null, createdAt: "" },
});

const emptyFunnel = fake<FunnelDetailDto>({
  funnel: { id: "f1", name: "New funnel", subdomain: "new", status: "draft", publishedRevisionId: null, createdAt: "", updatedAt: "" },
  steps: [],
  edges: [],
  publishedRevision: null,
});

function serve(detail: FunnelDetailDto) {
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (!init?.method && path === "/workspaces/ws_1/funnels/f1") return detail;
    if (init?.method === "PATCH") return { step: {} };
    return new Promise(() => undefined);
  });
}

const renderEditor = (locale: "en" | "ar" = "en") =>
  renderWithProviders(<FunnelEditorPage />, { route: "/funnels/f1", path: "/funnels/:funnelId", locale });

describe("FunnelEditorPage", () => {
  it("says the funnel is live and puts each publish problem on its step", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();

    expect(await screen.findByText("Live — revision #3")).toBeInTheDocument();
    // The upsell has no offer: flagged on the card, counted in the header.
    expect(screen.getByText("No offer picked")).toBeInTheDocument();
    const pill = screen.getByRole("button", { name: /1 thing to fix before publishing/ });

    await user.click(pill);
    const panel = screen.getByRole("alert");
    expect(within(panel).getByText("Extra offer")).toBeInTheDocument();
    expect(within(panel).getByText(/needs an offer/)).toBeInTheDocument();

    // "Show step" opens that step in the inspector, with the same problem inline.
    await user.click(within(panel).getByRole("button", { name: "Show step" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Extra offer");
    expect(screen.getByText("Fix before publishing")).toBeInTheDocument();
  });

  it("draws yes and no connectors and can add a step into one", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();
    await screen.findByText("Live — revision #3");

    expect(screen.getAllByText("Yes")).not.toHaveLength(0);
    expect(screen.getAllByText("No")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Add a step between Product page and COD checkout" }));
    await user.click(screen.getByRole("button", { name: "Sales page" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Sales page");
  });

  it("edits a step's page with the section library and saves it with the funnel", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();
    await screen.findByText("Live — revision #3");

    await user.click(screen.getByRole("button", { name: "Page" }));
    expect(await screen.findByText("Page of “Product page”")).toBeInTheDocument();

    const library = screen.getAllByRole("button", { name: /^Divider/ })[0];
    await user.click(library);
    await user.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith(
        "/workspaces/ws_1/funnels/f1/steps/step_product",
        expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ builderData: expect.anything() }) })
      )
    );
  });

  it("offers templates on an empty funnel, in Arabic too", async () => {
    serve(emptyFunnel);
    const { user } = renderEditor("ar");

    expect(await screen.findByText("مسودة — مش منشور")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /منتج بالدفع عند الاستلام \+ عرض إضافي بضغطة/ }));

    expect(screen.getByRole("button", { name: "صفحة المنتج" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "عرض إضافي بضغطة" })).toBeInTheDocument();
    // Its upsell still needs an offer before it can go live.
    expect(screen.getByText("لسه مختارتش عرض")).toBeInTheDocument();
  });
});
