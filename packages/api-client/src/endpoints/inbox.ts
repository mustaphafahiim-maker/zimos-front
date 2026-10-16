/**
 * The WhatsApp inbox beyond messages (backend: src/modules/whatsapp/inbox*.js).
 *
 * Mounted at /workspaces/:workspaceId/inbox (orders.confirm): the conversation
 * list with its filters, assignment, the customer panel beside a thread, the
 * store's saved quick replies, and the ticket for the live stream. Sending and
 * reading messages stay on the WhatsApp methods of the client. All exported
 * names are prefixed `inbox` / `Inbox`.
 *
 * Live updates: `inboxStreamUrl` is a Server-Sent Events URL. It is opened
 * with a one-minute ticket (EventSource cannot send an Authorization header);
 * events only say that something changed — re-read through the API.
 */
import type { ApiClient } from "../client";

export interface InboxUser {
  id: string;
  fullName: string | null;
}

export interface InboxConversation {
  id: string;
  phone: string;
  customerName: string | null;
  customerId: string | null;
  status: "open" | "closed";
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /** Inside WhatsApp's 24-hour window: free text is allowed. */
  canReply: boolean;
  assignedTo: InboxUser | null;
}

export interface InboxCounts {
  open: number;
  /** Open conversations assigned to the caller. */
  mine: number;
  /** Open conversations with unread messages. */
  unread: number;
}

export interface InboxConversationList {
  conversations: InboxConversation[];
  nextCursor: string | null;
  counts: InboxCounts;
}

export interface InboxListParams {
  status?: "open" | "closed";
  assigned?: "me" | "none";
  unread?: boolean;
  search?: string;
  limit?: number;
  before?: string | null;
}

export interface InboxAssignee extends InboxUser {
  role: string;
}

export interface InboxCustomerOrder {
  id: string;
  orderNumber: string;
  /** Minor units, as a string. */
  totalAmount: string;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  /** The stage the orders screen shows (an OrderStage). */
  stage: string;
}

export interface InboxCustomerPanel {
  /** Null when no customer has this phone number yet. */
  customer: { id: string; fullName: string | null; phone: string; email: string | null; isBlacklisted: boolean } | null;
  stats: {
    totalOrders: number;
    delivered: number;
    cancelled: number;
    returned: number;
    /** Delivered ÷ finished orders, in percent; null until one order has finished. */
    deliveryRate: number | null;
  } | null;
  /** The five latest orders. */
  orders: InboxCustomerOrder[];
}

export interface InboxQuickReply {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** One event of the live stream. */
export interface InboxStreamEvent {
  type: "ready" | "change";
  at?: string;
  conversationId?: string;
  reason?: "message_in" | "message_out" | "status" | "conversation" | "assignment";
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/inbox`;

export async function inboxListConversations(
  client: ApiClient,
  workspaceId: string,
  params: InboxListParams = {}
): Promise<InboxConversationList> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.assigned) query.set("assigned", params.assigned);
  if (params.unread) query.set("unread", "true");
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.before) query.set("before", params.before);
  const qs = query.toString();
  return client.request<InboxConversationList>(`${base(workspaceId)}/conversations${qs ? `?${qs}` : ""}`);
}

export async function inboxListAssignees(client: ApiClient, workspaceId: string): Promise<InboxAssignee[]> {
  const { assignees } = await client.request<{ assignees: InboxAssignee[] }>(`${base(workspaceId)}/assignees`);
  return assignees;
}

/** `userId: null` unassigns. 422 when the teammate cannot work the inbox. */
export async function inboxAssign(
  client: ApiClient,
  workspaceId: string,
  conversationId: string,
  userId: string | null
): Promise<InboxConversation> {
  const { conversation } = await client.request<{ conversation: InboxConversation }>(
    `${base(workspaceId)}/conversations/${conversationId}/assignee`,
    { method: "PUT", body: { userId } }
  );
  return conversation;
}

export async function inboxGetCustomerPanel(
  client: ApiClient,
  workspaceId: string,
  conversationId: string
): Promise<InboxCustomerPanel> {
  return client.request<InboxCustomerPanel>(`${base(workspaceId)}/conversations/${conversationId}/customer`);
}

export async function inboxListQuickReplies(client: ApiClient, workspaceId: string): Promise<InboxQuickReply[]> {
  const { quickReplies } = await client.request<{ quickReplies: InboxQuickReply[] }>(`${base(workspaceId)}/quick-replies`);
  return quickReplies;
}

export async function inboxCreateQuickReply(
  client: ApiClient,
  workspaceId: string,
  payload: { title: string; body: string }
): Promise<InboxQuickReply> {
  const { quickReply } = await client.request<{ quickReply: InboxQuickReply }>(`${base(workspaceId)}/quick-replies`, {
    method: "POST",
    body: payload,
  });
  return quickReply;
}

export async function inboxDeleteQuickReply(client: ApiClient, workspaceId: string, quickReplyId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/quick-replies/${quickReplyId}`, { method: "DELETE" });
}

/**
 * The URL of the live stream, with a fresh one-minute ticket. Open it with
 * `new EventSource(url)`; when the connection drops, ask for a new URL rather
 * than letting EventSource retry the old one (its ticket will have expired).
 */
export async function inboxStreamUrl(client: ApiClient, workspaceId: string, apiBaseUrl: string): Promise<string> {
  const { ticket } = await client.request<{ ticket: string }>(`${base(workspaceId)}/stream-ticket`, { method: "POST" });
  return `${apiBaseUrl.replace(/\/$/, "")}/inbox-stream/${workspaceId}?ticket=${encodeURIComponent(ticket)}`;
}
