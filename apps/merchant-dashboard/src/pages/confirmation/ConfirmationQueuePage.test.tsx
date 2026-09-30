import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { ConfirmationQueueCounts, ConfirmationTask, Workspace } from "@store-builder/api-client";
import { api, authMock, fake, testUser, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConfirmationQueuePage } from "./ConfirmationQueuePage";

const counts: ConfirmationQueueCounts = {
  pending: 1,
  pendingDue: 1,
  inProgress: 0,
  inProgressMine: 0,
  done: 0,
  assignedToMe: 0,
  unassigned: 0,
};

function task(overrides: Partial<ConfirmationTask> = {}): ConfirmationTask {
  return fake<ConfirmationTask>({
    id: "task_1",
    orderId: "o1",
    status: "queued",
    lockedByUserId: null,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    assignedToUserId: "agent_2",
    assignedTo: { id: "agent_2", fullName: "Bassem" },
    assignedAt: "2026-09-30T10:00:00Z",
    attemptCount: 0,
    nextRetryAt: null,
    attempts: [],
    correctable: false,
    order: {
      id: "o1",
      orderNumber: "ORD-1001",
      totalAmount: "25000",
      currency: "EGP",
      riskFlags: [],
      items: [{ productNameSnapshot: "Mug", quantity: 2, variantOptionsSnapshot: null }],
      contactSnapshot: { fullName: "Mona Ali", phone: "010 1234 5678" },
      shippingAddressSnapshot: { city: "Cairo", addressLine: "1 Nile St" },
      confirmationState: "pending",
      createdAt: "2026-09-30T09:00:00Z",
    },
    ...overrides,
  });
}

function asRole(role: string) {
  authMock.user = testUser;
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role, settings: {} });
}

describe("ConfirmationQueuePage assignment", () => {
  it("shows who a task is assigned to, and keeps an agent off another agent's task", async () => {
    asRole("confirmation_agent");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [task()], nextCursor: null });
    renderWithProviders(<ConfirmationQueuePage />);

    expect(await screen.findByText("Assigned to Bassem")).toBeInTheDocument();
    expect(screen.getByText("Assigned to Bassem. Only they or a manager can take it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim & call" })).not.toBeInTheDocument();
    // An agent never assigns.
    expect(api.listConfirmationAssignees).not.toHaveBeenCalled();
  });

  it("asks the server for the chosen assignment filter", async () => {
    asRole("confirmation_agent");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [], nextCursor: null });
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await waitFor(() => expect(api.listConfirmationQueue).toHaveBeenCalled());
    expect(api.listConfirmationQueue.mock.calls[0][1]).not.toHaveProperty("assignedTo");
    await user.selectOptions(screen.getByLabelText("Assignment"), "me");
    await waitFor(() =>
      expect(api.listConfirmationQueue).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ assignedTo: "me" }))
    );
  });

  it("lets a manager assign one task and a selection in bulk", async () => {
    asRole("owner");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationAssignees.mockResolvedValue([
      { id: "agent_1", fullName: "Amal", email: "a@x.test", role: { key: "confirmation_agent", name: "Confirmation Agent" } },
      { id: "agent_2", fullName: "Bassem", email: "b@x.test", role: { key: "confirmation_agent", name: "Confirmation Agent" } },
    ]);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [task({ assignedTo: null, assignedToUserId: null })], nextCursor: null });
    api.assignConfirmationTask.mockResolvedValue(task({ assignedTo: { id: "agent_1", fullName: "Amal" } }));
    api.assignConfirmationTasks.mockResolvedValue({
      assignedTo: { id: "agent_2", fullName: "Bassem" },
      tasks: [task()],
      skipped: [],
    });
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    const single = await screen.findByLabelText("Assign ORD-1001 to");
    await waitFor(() => expect(within(single).getByRole("option", { name: "Amal" })).toBeInTheDocument());
    await user.selectOptions(single, "agent_1");
    await waitFor(() => expect(api.assignConfirmationTask).toHaveBeenCalledWith("ws_1", "task_1", "agent_1"));

    await user.click(screen.getByRole("checkbox", { name: "Select ORD-1001" }));
    await user.selectOptions(screen.getByLabelText("Agent for the selected tasks", { selector: "select" }), "agent_2");
    await user.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(api.assignConfirmationTasks).toHaveBeenCalledWith("ws_1", ["task_1"], "agent_2"));
  });
});

describe("ConfirmationQueuePage channel", () => {
  it("offers WhatsApp beside the phone, and picks it for the outcome once opened during the claim", async () => {
    asRole("confirmation_agent");
    const claimed = task({
      status: "in_progress",
      assignedTo: null,
      assignedToUserId: null,
      lockedByUserId: testUser.id,
      lockedBy: { id: testUser.id, fullName: testUser.fullName },
      lockedAt: new Date().toISOString(),
      lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [claimed], nextCursor: null });
    api.recordConfirmationOutcome.mockResolvedValue(task({ status: "done" }));
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    const link = await screen.findByRole("link", { name: /Message Mona Ali on WhatsApp/ });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/);
    expect(screen.getByRole("radio", { name: "Call" })).toBeChecked();

    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Confirmed" }));
    await user.click(screen.getByRole("button", { name: "Save outcome" }));
    await waitFor(() =>
      expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "task_1", { outcome: "confirmed", channel: "whatsapp" })
    );
  });
});

describe("ConfirmationQueuePage offers window", () => {
  it("lists a funnel order still in its offers window without letting anyone take it", async () => {
    asRole("owner");
    api.getConfirmationQueueCounts.mockResolvedValue({ ...counts, pendingDue: 0, waitingForOffers: 1 });
    api.listConfirmationQueue.mockResolvedValue({
      tasks: [
        task({
          assignedToUserId: null,
          assignedTo: null,
          availableAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          waitingForOffers: true,
        }),
      ],
      nextCursor: null,
    });
    api.listConfirmationAssignees.mockResolvedValue([]);
    renderWithProviders(<ConfirmationQueuePage />);

    expect(await screen.findByText("Waiting for the offers window")).toBeInTheDocument();
    expect(screen.getByText(/opens for confirmation in 10 min/)).toBeInTheDocument();
    expect(screen.getByText("ORD-1001")).toBeInTheDocument();
    // Nothing to act on, and no customer details yet.
    expect(screen.queryByRole("button", { name: "Claim & call" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mona Ali")).not.toBeInTheDocument();
  });
});
