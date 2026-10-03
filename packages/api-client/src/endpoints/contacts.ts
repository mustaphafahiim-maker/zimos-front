/**
 * Contacts, segments and form submissions (backend: src/modules/contacts).
 *
 * Mounted at /workspaces/:workspaceId/contacts. Reads need customers.view,
 * writes customers.manage, the export customers.reveal_sensitive and the form
 * submissions form_submissions.view. The storefront posts a page form to
 * /store/:workspaceId/forms (no auth).
 *
 * Notable codes: PHONE_TAKEN (409, `details.customerId` is the existing
 * contact), INVALID_PHONE (422), SEGMENT_NAME_TAKEN (409), CONTACT_REQUIRED
 * (422 — a form needs a phone or an email), INVALID_CURSOR (400).
 */
import type { ApiClient } from "../client";

export type ContactType = "lead" | "customer";

export interface Contact {
  id: string;
  /** `customer` once they have ordered, `lead` until then. */
  type: ContactType;
  fullName: string | null;
  phoneNormalized: string;
  phoneRaw: string | null;
  email: string | null;
  tags: string[];
  /** Where the contact first came from: checkout, form, manual, import. */
  source: string | null;
  marketingConsent: boolean;
  isBlacklisted: boolean;
  ordersCount: number;
  /** Minor units, over orders that stand as sales. */
  totalSpent: string;
  lastOrderAt: string | null;
  deliveredCount: number;
  /** Parcels that reached an end: delivered, returned or failed. */
  closedCount: number;
  /** 0–100, or null while no parcel has reached an end. */
  deliveryRate: number | null;
  governorate: string | null;
  createdAt: string;
}

export interface ContactFilter {
  q?: string;
  type?: ContactType;
  tag?: string;
  consent?: boolean;
  segmentId?: string;
}

export interface ContactListParams extends ContactFilter {
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string;
}

export interface ContactList {
  contacts: Contact[];
  nextCursor: string | null;
  /** Totals under the same filter. First page only. */
  total?: number;
  leads?: number;
  customers?: number;
  consenting?: number;
}

export interface ContactCreatePayload {
  phone: string;
  fullName?: string;
  email?: string;
  marketingConsent?: boolean;
  tags?: string[];
}

export interface FormSubmission {
  id: string;
  customerId: string | null;
  formName: string;
  pagePath: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  /** Any further fields the form carried, label → text. */
  data: Record<string, string>;
  /** Tags the form added to the contact. */
  tags: string[];
  marketingConsent: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface ContactDetail {
  contact: Contact;
  /** The contact's latest form submissions, newest first. */
  submissions: FormSubmission[];
  /** Their WhatsApp thread in the inbox, when there is one. */
  conversationId: string | null;
}

export interface ContactTagCount {
  tag: string;
  count: number;
}

/** Every key is optional; all the given ones must hold. */
export interface SegmentRules {
  type?: ContactType;
  includeTags?: string[];
  excludeTags?: string[];
  minOrders?: number;
  maxOrders?: number;
  /** Minor units. */
  minSpent?: number;
  maxSpent?: number;
  lastOrderOlderThanDays?: number;
  lastOrderWithinDays?: number;
  governorates?: string[];
  productIds?: string[];
  /** 0–100. */
  minDeliveryRate?: number;
  maxDeliveryRate?: number;
  marketingConsent?: boolean;
}

export interface ContactSegment {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  createdAt: string;
  updatedAt: string;
  /** Evaluated now. */
  contactsCount?: number;
  /** Of those, how many accept marketing messages. */
  consentingCount?: number;
}

export interface SegmentPayload {
  name: string;
  description?: string | null;
  rules: SegmentRules;
}

export interface SegmentPreview {
  total: number;
  consenting: number;
  sample: Contact[];
}

export interface FormSubmissionListParams {
  limit?: number;
  cursor?: string;
  formName?: string;
  unreadOnly?: boolean;
  q?: string;
}

export interface FormSubmissionList {
  submissions: FormSubmission[];
  nextCursor: string | null;
  /** Every form that has submissions, with its count. First page only. */
  forms?: { formName: string; count: number }[];
  unread?: number;
}

/** What the storefront sends when a shopper submits a page form. */
export interface StoreFormPayload {
  /** The form element's id in the page tree; the server reads its tags. */
  elementId?: string;
  pagePath?: string;
  formName?: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  marketingConsent?: boolean;
  fields?: Record<string, string>;
  /** Honeypot. Leave empty. */
  website?: string;
}

const contactsBase = (workspaceId: string) => `/workspaces/${workspaceId}/contacts`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function contactsList(client: ApiClient, workspaceId: string, params: ContactListParams = {}): Promise<ContactList> {
  return client.request<ContactList>(`${contactsBase(workspaceId)}${query(params)}`);
}

/** The CSV text (UTF-8 with a BOM), at most 10,000 rows under the filter. */
export async function contactsExportCsv(client: ApiClient, workspaceId: string, params: ContactFilter = {}): Promise<string> {
  return client.request<string>(`${contactsBase(workspaceId)}/export${query(params)}`);
}

export async function contactsGet(client: ApiClient, workspaceId: string, customerId: string): Promise<ContactDetail> {
  return client.request<ContactDetail>(`${contactsBase(workspaceId)}/${customerId}`);
}

export async function contactsCreate(client: ApiClient, workspaceId: string, payload: ContactCreatePayload): Promise<Contact> {
  const { contact } = await client.request<{ contact: Contact }>(contactsBase(workspaceId), { method: "POST", body: payload });
  return contact;
}

/** Replaces the contact's tags. Returns them as stored (trimmed, lower-cased). */
export async function contactsSetTags(client: ApiClient, workspaceId: string, customerId: string, tags: string[]): Promise<string[]> {
  const result = await client.request<{ tags: string[] }>(`${contactsBase(workspaceId)}/${customerId}/tags`, {
    method: "PUT",
    body: { tags },
  });
  return result.tags;
}

export async function contactsBulkTag(
  client: ApiClient,
  workspaceId: string,
  payload: { customerIds: string[]; add?: string[]; remove?: string[] }
): Promise<{ updated: number }> {
  return client.request<{ updated: number }>(`${contactsBase(workspaceId)}/bulk-tag`, { method: "POST", body: payload });
}

export async function contactsListTags(client: ApiClient, workspaceId: string): Promise<ContactTagCount[]> {
  const { tags } = await client.request<{ tags: ContactTagCount[] }>(`${contactsBase(workspaceId)}/tags`);
  return tags;
}

export async function segmentsList(client: ApiClient, workspaceId: string): Promise<ContactSegment[]> {
  const { segments } = await client.request<{ segments: ContactSegment[] }>(`${contactsBase(workspaceId)}/segments`);
  return segments;
}

export async function segmentsCreate(client: ApiClient, workspaceId: string, payload: SegmentPayload): Promise<ContactSegment> {
  const { segment } = await client.request<{ segment: ContactSegment }>(`${contactsBase(workspaceId)}/segments`, {
    method: "POST",
    body: payload,
  });
  return segment;
}

export async function segmentsUpdate(
  client: ApiClient,
  workspaceId: string,
  segmentId: string,
  payload: Partial<SegmentPayload>
): Promise<ContactSegment> {
  const { segment } = await client.request<{ segment: ContactSegment }>(`${contactsBase(workspaceId)}/segments/${segmentId}`, {
    method: "PATCH",
    body: payload,
  });
  return segment;
}

export async function segmentsDelete(client: ApiClient, workspaceId: string, segmentId: string): Promise<void> {
  await client.request<unknown>(`${contactsBase(workspaceId)}/segments/${segmentId}`, { method: "DELETE" });
}

/** How many contacts a set of rules matches right now, before saving it. */
export async function segmentsPreview(client: ApiClient, workspaceId: string, rules: SegmentRules): Promise<SegmentPreview> {
  return client.request<SegmentPreview>(`${contactsBase(workspaceId)}/segments/preview`, { method: "POST", body: { rules } });
}

export async function formSubmissionsList(
  client: ApiClient,
  workspaceId: string,
  params: FormSubmissionListParams = {}
): Promise<FormSubmissionList> {
  return client.request<FormSubmissionList>(`${contactsBase(workspaceId)}/forms${query(params)}`);
}

export async function formSubmissionsMarkRead(
  client: ApiClient,
  workspaceId: string,
  submissionId: string,
  isRead: boolean
): Promise<FormSubmission> {
  const { submission } = await client.request<{ submission: FormSubmission }>(`${contactsBase(workspaceId)}/forms/${submissionId}`, {
    method: "PATCH",
    body: { isRead },
  });
  return submission;
}

export async function formSubmissionsDelete(client: ApiClient, workspaceId: string, submissionId: string): Promise<void> {
  await client.request<unknown>(`${contactsBase(workspaceId)}/forms/${submissionId}`, { method: "DELETE" });
}

/** Storefront: a shopper submits a page form. `workspaceRef` is the id or slug. */
export async function storeSubmitForm(client: ApiClient, workspaceRef: string, payload: StoreFormPayload): Promise<void> {
  await client.request<unknown>(`/store/${workspaceRef}/forms`, { method: "POST", body: payload, auth: false });
}
