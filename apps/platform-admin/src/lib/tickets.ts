import type { SupportTicketPriority, SupportTicketStatus } from "@store-builder/api-client";

/** Queue wording: whose move it is, rather than the raw status. */
export const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "Waiting on us",
  pending: "Waiting on merchant",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/**
 * The badge a ticket wears beside its subject when it needs to be seen first
 * — high (how a store with priority support opens its tickets) or urgent;
 * null for the rest. The queue is already sorted the same way by the server.
 */
export function priorityBadge(priority: SupportTicketPriority): { label: string; tone: "warning" | "danger" } | null {
  if (priority === "urgent") return { label: "Urgent", tone: "danger" };
  if (priority === "high") return { label: "High priority", tone: "warning" };
  return null;
}
