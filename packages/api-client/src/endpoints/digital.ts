/**
 * Digital products (backend: src/modules/digital).
 *
 * Staff routes are mounted at /workspaces/:workspaceId/digital: the file
 * library and deliveries need products.view / products.manage, an order's
 * grants orders.view / orders.manage. The buyer's side is public at
 * /store/:workspaceId/downloads/:token — the token is the credential.
 *
 * Notable codes: PRODUCT_NOT_DIGITAL (422), FILE_IN_USE (409), FILE_TOO_LARGE
 * (413), CODE_ASSIGNED (409), ORDER_NOT_PAID (409), DOWNLOAD_UNAVAILABLE (410,
 * `details.state` is expired | used_up | revoked).
 */
import { ApiError, type ApiClient } from "../client";

export const DIGITAL_DELIVERY_TYPES = ["file", "link", "license_codes"] as const;
export type DigitalDeliveryType = (typeof DIGITAL_DELIVERY_TYPES)[number];

export interface DigitalFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** How many products deliver this file. A file in use cannot be deleted. */
  usedByProducts?: number;
}

export interface DigitalDelivery {
  id: string;
  productId: string;
  type: DigitalDeliveryType;
  fileId: string | null;
  file: DigitalFile | null;
  linkUrl: string | null;
  /** Shown to the buyer with the download. */
  message: string | null;
  /** `file` only; null = no limit. */
  maxDownloads: number | null;
  /** null = the link never expires. */
  linkValidHours: number | null;
  isActive: boolean;
  updatedAt: string;
}

export interface DigitalCodeStock {
  total: number;
  available: number;
}

export interface DigitalProduct {
  id: string;
  name: string;
  status: string;
  productCode: string | null;
  imageUrl: string | null;
  /** null until the merchant sets it up: nothing is delivered. */
  delivery: DigitalDelivery | null;
  codes: DigitalCodeStock;
}

export interface DigitalDeliveryPayload {
  type: DigitalDeliveryType;
  fileId?: string | null;
  linkUrl?: string | null;
  message?: string | null;
  maxDownloads?: number | null;
  linkValidHours?: number | null;
  isActive?: boolean;
}

export interface LicenseCode {
  id: string;
  code: string;
  assignedAt: string | null;
  grantId: string | null;
  createdAt: string;
}

export type DigitalGrantState = "active" | "expired" | "used_up" | "revoked";

/** What one paid order line gave its buyer. */
export interface DigitalGrant {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string | null;
  productName: string;
  type: DigitalDeliveryType;
  fileName: string | null;
  linkUrl: string | null;
  codes: string[];
  /** Codes still owed because the stock ran out; filled when codes are added. */
  codesMissing: number;
  /** The buyer's link is /downloads/<token> on the storefront. */
  token: string;
  maxDownloads: number | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
  expiresAt: string | null;
  state: DigitalGrantState;
  createdAt: string;
}

/** The buyer's view of a grant. Content is only present while `state` is active. */
export interface PublicDownload {
  productName: string;
  type: DigitalDeliveryType;
  state: DigitalGrantState;
  message: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  linkUrl: string | null;
  codes: string[];
  codesPending: number;
  /** `file` with a limit only. */
  downloadsLeft: number | null;
  expiresAt: string | null;
}

/** On the customer's tracking result (`downloads`). */
export interface TrackDownload {
  token: string;
  productName: string;
  type: DigitalDeliveryType;
}

const digitalBase = (workspaceId: string) => `/workspaces/${workspaceId}/digital`;

export async function digitalListFiles(
  client: ApiClient,
  workspaceId: string
): Promise<{ files: DigitalFile[]; maxFileBytes: number; /** Above maxFileBytes the upload goes in parts (digitalUploadLargeFile), up to this. */ maxLargeFileBytes?: number; partSizeBytes?: number }> {
  return client.request(`${digitalBase(workspaceId)}/files`);
}

/**
 * Multipart upload of one file into the library. `apiBaseUrl` is the base the
 * client was built with (the typed client only sends JSON).
 */
export async function digitalUploadFile(client: ApiClient, apiBaseUrl: string, workspaceId: string, file: File): Promise<DigitalFile> {
  const send = () => {
    const form = new FormData();
    form.append("file", file);
    const { accessToken } = client.tokens;
    return fetch(`${apiBaseUrl.replace(/\/$/, "")}${digitalBase(workspaceId)}/files`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  };
  let res = await send();
  if (res.status === 401) {
    // Any typed call refreshes an expired session; then the upload goes again.
    await digitalListFiles(client, workspaceId);
    res = await send();
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(payload?.error?.message ?? `Upload failed with status ${res.status}`, res.status, payload?.error?.code, payload?.error?.details);
  }
  return payload.file as DigitalFile;
}

export async function digitalDeleteFile(client: ApiClient, workspaceId: string, fileId: string): Promise<void> {
  await client.request<unknown>(`${digitalBase(workspaceId)}/files/${fileId}`, { method: "DELETE" });
}

export async function digitalListProducts(client: ApiClient, workspaceId: string): Promise<DigitalProduct[]> {
  const { products } = await client.request<{ products: DigitalProduct[] }>(`${digitalBase(workspaceId)}/products`);
  return products;
}

export async function digitalSaveDelivery(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  payload: DigitalDeliveryPayload
): Promise<{ delivery: DigitalDelivery; codes: DigitalCodeStock }> {
  return client.request(`${digitalBase(workspaceId)}/products/${productId}/delivery`, { method: "PUT", body: payload });
}

export async function digitalListCodes(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  status?: "available" | "assigned"
): Promise<{ codes: LicenseCode[] } & DigitalCodeStock> {
  return client.request(`${digitalBase(workspaceId)}/products/${productId}/codes${status ? `?status=${status}` : ""}`);
}

/** `codes`: pasted text, one code per line. Codes already in stock are skipped. */
export async function digitalAddCodes(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  codes: string
): Promise<{ added: number; duplicates: number; tooLong: number }> {
  return client.request(`${digitalBase(workspaceId)}/products/${productId}/codes`, { method: "POST", body: { codes } });
}

/** Only a code that was not given to a customer yet. */
export async function digitalDeleteCode(client: ApiClient, workspaceId: string, codeId: string): Promise<void> {
  await client.request<unknown>(`${digitalBase(workspaceId)}/codes/${codeId}`, { method: "DELETE" });
}

export interface DigitalOrderGrants {
  grants: DigitalGrant[];
  /** Digital lines whose product has a delivery but that were not delivered yet. */
  pending: number;
}

export async function digitalOrderGrants(client: ApiClient, workspaceId: string, orderId: string): Promise<DigitalOrderGrants> {
  return client.request<DigitalOrderGrants>(`${digitalBase(workspaceId)}/orders/${orderId}/grants`);
}

/** Delivers a paid order's digital lines that have no grant yet. */
export async function digitalDeliverOrder(client: ApiClient, workspaceId: string, orderId: string): Promise<DigitalOrderGrants> {
  return client.request<DigitalOrderGrants>(`${digitalBase(workspaceId)}/orders/${orderId}/deliver`, { method: "POST", body: {} });
}

/** `renew`: downloads back to zero and a fresh expiry. `revoke`: the link stops working. */
export async function digitalUpdateGrant(client: ApiClient, workspaceId: string, grantId: string, action: "renew" | "revoke"): Promise<DigitalGrant> {
  const { grant } = await client.request<{ grant: DigitalGrant }>(`${digitalBase(workspaceId)}/grants/${grantId}`, {
    method: "POST",
    body: { action },
  });
  return grant;
}

/** Storefront: what a download link gives. `workspaceRef` is the id or slug. */
export async function storeGetDownload(client: ApiClient, workspaceRef: string, token: string): Promise<PublicDownload> {
  const { download } = await client.request<{ download: PublicDownload }>(`/store/${workspaceRef}/downloads/${token}`, { auth: false });
  return download;
}

/** Storefront: the address the browser downloads the file from (counts one download). */
export function storeDownloadFileUrl(apiBaseUrl: string, workspaceRef: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/store/${workspaceRef}/downloads/${token}/file`;
}
