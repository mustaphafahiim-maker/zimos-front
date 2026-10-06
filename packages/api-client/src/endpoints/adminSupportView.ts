import type { ApiClient } from "../client";
import type { SupportAccessGrant } from "./security";

/** A store's own data as support sees it (platformAdmin/supportViewRoutes.js). Opens only under the merchant's grant. */
export interface AdminSupportView {
  grant: SupportAccessGrant;
  store: { id: string; name: string; slug: string; status: string; defaultCurrency: string; defaultLocale: string; timezone: string; createdAt: string };
  team: { name: string; email: string | null; role: string; status: string; lastLoginAt: string | null }[];
  domains: { hostname: string; status: string; isPrimary: boolean; sslStatus: string }[];
  connections: {
    carriers: { code: string; status: string; isDefault: boolean; lastVerifiedAt: string | null }[];
    gateways: { code: string; mode: string; status: string; lastWebhookAt: string | null }[];
    integrations: { code: string; status: string; lastError: string | null; lastVerifiedAt: string | null }[];
  };
  orders: {
    id: string;
    orderNumber: string;
    confirmationState: string;
    financialState: string;
    fulfillmentState: string;
    paymentMethod: string;
    totalAmount: string;
    currency: string;
    source: string | null;
    createdAt: string;
  }[];
  alerts: { type: string; title: string; createdAt: string }[];
  activity: { action: string; entityType: string; createdAt: string; actor: string | null }[];
}

/** POST /admin/workspaces/:id/support-view — 403 SUPPORT_ACCESS_NOT_GRANTED without the merchant's grant; each opening is logged with its reason. */
export function adminSupportView(client: ApiClient, workspaceId: string, reason: string): Promise<AdminSupportView> {
  return client.request<AdminSupportView>(`/admin/workspaces/${workspaceId}/support-view`, { method: "POST", body: { reason } });
}
