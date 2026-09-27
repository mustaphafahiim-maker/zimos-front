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
