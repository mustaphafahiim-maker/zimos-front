import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { ProductQuestion } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { QuestionsPage } from "./QuestionsPage";
import { ProductQuestionsSection } from "./ProductQuestionsSection";

const waiting: ProductQuestion = {
  id: "q_1",
  productId: "prod_1",
  productName: "Linen shirt",
  question: "Does it shrink after washing?",
  askerName: "Mona",
  askerEmail: "mona@example.com",
  answer: null,
  answeredAt: null,
  answeredBy: null,
  status: "pending",
  locale: "en",
  createdAt: "2026-10-09T10:00:00.000Z",
};

describe("QuestionsPage", () => {
  it("lists the questions waiting for an answer first", async () => {
    const calls = fakeBackend({ "GET /product-questions": { questions: [waiting], total: 1, pending: 1 } });
    renderWithProviders(<QuestionsPage />);
    expect(await screen.findByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect((await screen.findAllByText("Does it shrink after washing?")).length).toBeGreaterThan(0);
    const first = callsTo(calls, "GET", "/workspaces/ws_1/product-questions")[0];
    expect(first.path).toContain("status=pending");
  });

  it("publishes a question with its answer", async () => {
    const calls = fakeBackend({
      "GET /product-questions": { questions: [waiting], total: 1, pending: 1 },
      "PATCH /product-questions/q_1": { ...waiting, answer: "No, it is pre-washed.", status: "published", answeredAt: "2026-10-10T08:00:00.000Z" },
    });
    const { user } = renderWithProviders(<QuestionsPage />);
    await screen.findAllByText("Does it shrink after washing?");
    await user.click(screen.getAllByRole("button", { name: "Answer" })[0]);
    await user.type(await screen.findByLabelText(/Your answer/), "No, it is pre-washed.");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(callsTo(calls, "PATCH", "/product-questions/q_1")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/product-questions/q_1")[0].body).toEqual({ answer: "No, it is pre-washed.", status: "published" });
    expect(await screen.findByText("Published — it's on the product page now.")).toBeInTheDocument();
  });

  it("says so when nothing is waiting, in formal Arabic too", async () => {
    fakeBackend({ "GET /product-questions": { questions: [], total: 0, pending: 0 } });
    renderWithProviders(<QuestionsPage />, { locale: "ar" });
    expect(await screen.findByText("لا توجد أسئلة بانتظار الرد")).toBeInTheDocument();
  });
});

describe("ProductQuestionsSection", () => {
  it("asks only for this product's questions, and shows nothing when nobody asked", async () => {
    const calls = fakeBackend({ "GET /product-questions": { questions: [], total: 0, pending: 0 } });
    renderWithProviders(<ProductQuestionsSection productId="prod_1" />);
    await waitFor(() => expect(callsTo(calls, "GET", "/product-questions")).toHaveLength(1));
    expect(callsTo(calls, "GET", "/product-questions")[0].path).toContain("productId=prod_1");
    expect(screen.queryByText("No one has asked about this product yet")).not.toBeInTheDocument();
  });

  it("opens on the questions when the link asked for them", async () => {
    fakeBackend({ "GET /product-questions": { questions: [], total: 0, pending: 0 } });
    renderWithProviders(<ProductQuestionsSection productId="prod_1" />, { route: "/catalog/prod_1?tab=questions" });
    expect(await screen.findByText("No one has asked about this product yet")).toBeInTheDocument();
  });
});
