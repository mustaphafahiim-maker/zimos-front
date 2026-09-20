import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type {
  ConfirmationAgent,
  ConfirmationAttempt,
  ConfirmationTask,
} from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CallCenterPage } from "./CallCenterPage";

const task = fake<ConfirmationTask>({
  id: "tsk_1",
  status: "queued",
  attemptCount: 1,
  nextRetryAt: null,
  outcome: null,
  order: {
    id: "ord_1",
    orderNumber: "#1001",
    totalAmount: 25000,
    currency: "EGP",
    contactSnapshot: { fullName: "Mona Adel", phone: "01098765432" },
  },
});

const agent = fake<ConfirmationAgent>({
  userId: "usr_1",
  fullName: "Amr Hassan",
  email: "amr@zimos.test",
  role: { key: "agent", name: "Call agent" },
  attempts: 10,
  confirmed: 6,
  rejected: 2,
  unreachable: 1,
  postponed: 1,
  confirmationRate: 75,
  tasksInProgress: 1,
});

const attempt = fake<ConfirmationAttempt>({
  id: "att_1",
  outcome: "unreachable",
  notes: "Phone switched off",
  createdAt: "2026-09-14T08:00:00.000Z",
  taskId: "tsk_1",
  attemptNumber: 2,
  agent: { id: "usr_1", fullName: "Amr Hassan", email: "amr@zimos.test" },
  order: {
    id: "ord_1",
    orderNumber: "#1001",
    customerName: "Mona Adel",
    phone: "01098765432",
    totalAmount: 25000,
    currency: "EGP",
  },
});

describe("CallCenterPage", () => {
  it("summarises the queue and links to the screen where calls are made", async () => {
    api.listConfirmationQueue.mockResolvedValue([task]);

    renderWithProviders(<CallCenterPage />, { route: "/call-center" });

    expect(await screen.findByText("Mona Adel")).toBeInTheDocument();
    expect(api.listConfirmationQueue).toHaveBeenCalledWith("ws_1", {
      status: "queued",
      limit: 200,
    });
    expect(api.listConfirmationQueue).toHaveBeenCalledWith("ws_1", {
      status: "in_progress",
      limit: 200,
    });
    // Calling itself lives on the existing confirmation queue screen.
    expect(screen.getByText("Open the confirmation queue").closest("a")).toHaveAttribute(
      "href",
      "/confirmation-queue"
    );
  });

  it("shows the agent scoreboard and re-queries when the period changes", async () => {
    api.listConfirmationQueue.mockResolvedValue([]);
    api.listConfirmationAgents.mockResolvedValue({
      range: { days: 30, since: "2026-08-22T00:00:00.000Z" },
      agents: [agent],
    });

    const { user } = renderWithProviders(<CallCenterPage />, { route: "/call-center" });

    await user.click(screen.getByRole("button", { name: "Agents" }));
    expect(await screen.findByText("Amr Hassan")).toBeInTheDocument();
    expect(screen.getByText("Call agent")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(api.listConfirmationAgents).toHaveBeenCalledWith("ws_1", { days: 30 });

    await user.selectOptions(screen.getByRole("combobox", { name: "Period" }), "7");
    expect(api.listConfirmationAgents).toHaveBeenLastCalledWith("ws_1", { days: 7 });
  });

  it("filters the call log by outcome", async () => {
    api.listConfirmationQueue.mockResolvedValue([]);
    api.listConfirmationAgents.mockResolvedValue({
      range: { days: 90, since: "2026-06-23T00:00:00.000Z" },
      agents: [agent],
    });
    api.listConfirmationAttempts.mockResolvedValue({ attempts: [attempt], nextCursor: null });

    const { user } = renderWithProviders(<CallCenterPage />, { route: "/call-center" });

    await user.click(screen.getByRole("button", { name: "Call log" }));
    expect(await screen.findByText("Phone switched off")).toBeInTheDocument();
    expect(screen.getByText("1 attempts loaded")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Outcome" }), "confirmed");
    expect(api.listConfirmationAttempts).toHaveBeenLastCalledWith(
      "ws_1",
      expect.objectContaining({ outcome: "confirmed", limit: 50 })
    );
  });

  it("says the queue is clear rather than showing an empty table", async () => {
    api.listConfirmationQueue.mockResolvedValue([]);

    renderWithProviders(<CallCenterPage />, { route: "/call-center" });

    expect(await screen.findByText("The queue is clear")).toBeInTheDocument();
  });
});
