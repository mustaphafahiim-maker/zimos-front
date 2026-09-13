/** Domain types for the admin mock layer. Shapes mirror the intended backend contracts. */

export interface ChartPoint {
  label: string;
  value: number;
}

// ---------------------------------------------------------------- workspaces

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "yearly";

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "staff";
  lastActiveAt: string | null;
}

export interface WorkspaceDomain {
  id: string;
  hostname: string;
  verified: boolean;
  ssl: "active" | "pending" | "failed";
  addedAt: string;
  lastCheckedAt: string | null;
}

export interface WorkspaceMeta {
  workspaceId: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  nextBillingAt: string | null;
  lastPaymentFailedAt: string | null;
  canceledAt: string | null;
  ownerName: string;
  ownerEmail: string;
  country: string;
  ordersLast30d: number;
  ordersToday: number;
  gmvLast30d: number;
  deliveryRate: number;
  rtoRate: number;
  suspended: boolean;
  suspendedReason: string | null;
  members: WorkspaceMember[];
  domains: WorkspaceDomain[];
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  currency: string;
  meta: WorkspaceMeta;
  plan: Plan | null;
  /** Monthly recurring revenue contribution in platform currency. */
  mrr: number;
}

export interface WorkspaceListResult {
  rows: AdminWorkspace[];
  /** `api` = GET /admin/workspaces succeeded; `demo` = backend unreachable, demo rows shown. */
  source: "api" | "demo";
  apiError: string | null;
}

// ---------------------------------------------------------------- plans

export type PlanFeatureKey =
  | "custom_domain"
  | "funnels"
  | "whatsapp_confirmation"
  | "abandoned_cart"
  | "multi_warehouse"
  | "api_access"
  | "staff_accounts"
  | "advanced_analytics"
  | "remove_branding"
  | "priority_support";

export interface Plan {
  id: string;
  name: string;
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  /** Orders per month; null = unlimited. */
  orderQuota: number | null;
  transactionFeeBp: number;
  codFeeBp: number;
  features: PlanFeatureKey[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlanInput = Omit<Plan, "id" | "createdAt" | "updatedAt"> & { id?: string };

// ---------------------------------------------------------------- marketplace

export type TemplateKind = "store" | "funnel" | "landing";

export interface TemplateVersion {
  id: string;
  version: string;
  notes: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  category: string;
  price: number;
  free: boolean;
  primaryColor: string;
  rtl: boolean;
  published: boolean;
  versions: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
}

export type TemplateInput = Omit<Template, "id" | "createdAt" | "updatedAt" | "versions"> & { id?: string };

export type SupplierStatus = "pending" | "approved" | "rejected";

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  categories: string[];
  productsCount: number;
  description: string;
  status: SupplierStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export type AppStatus = "beta" | "live" | "hidden";

export interface MarketplaceApp {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  status: AppStatus;
  installs: number;
  createdAt: string;
  updatedAt: string;
}

export type MarketplaceAppInput = Pick<MarketplaceApp, "name" | "category" | "description" | "status"> & { id?: string };

// ---------------------------------------------------------------- operations

export type ProviderKind = "carrier" | "payment" | "whatsapp";
export type HealthStatus = "operational" | "degraded" | "down";
export type CredentialStatus = "configured" | "missing" | "expired";

export interface Provider {
  id: string;
  kind: ProviderKind;
  name: string;
  code: string;
  region: string;
  health: HealthStatus;
  lastCheckAt: string;
  latencyMs: number;
  errorRate24h: number;
  lastError: string | null;
  enabled: boolean;
  credentialStatus: CredentialStatus;
  credentialUpdatedAt: string | null;
  workspacesUsing: number;
  /** WhatsApp only — display number, never a secret. */
  phoneNumber: string | null;
  qualityRating: "high" | "medium" | "low" | null;
}

// ---------------------------------------------------------------- risk

export interface FraudSignal {
  id: string;
  type: "phone" | "ip";
  value: string;
  storesCount: number;
  ordersCount: number;
  rtoCount: number;
  workspaceNames: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  blocked: boolean;
}

export type BlocklistType = "phone" | "ip" | "email";

export interface BlocklistEntry {
  id: string;
  type: BlocklistType;
  value: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export type BlocklistInput = Pick<BlocklistEntry, "type" | "value" | "reason" | "expiresAt"> & { id?: string };

// ---------------------------------------------------------------- support

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketMessage {
  id: string;
  authorType: "merchant" | "admin";
  authorName: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  workspaceId: string;
  workspaceName: string;
  requesterName: string;
  requesterEmail: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export type AnnouncementSeverity = "info" | "warning";
export type AnnouncementAudience = "all" | "plan" | "workspace";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  planId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  startsAt: string;
  endsAt: string | null;
  dismissible: boolean;
  createdBy: string;
  createdAt: string;
}

export type AnnouncementInput = Omit<Announcement, "id" | "createdAt" | "createdBy"> & { id?: string };

// ---------------------------------------------------------------- system

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  /** 0–100 percentage of workspaces. */
  rollout: number;
  targetWorkspaceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type FeatureFlagInput = Pick<FeatureFlag, "key" | "description" | "enabled" | "rollout" | "targetWorkspaceIds"> & {
  id?: string;
};

export interface AuditEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  workspaceId: string | null;
  workspaceName: string | null;
  ip: string;
  userAgent: string;
  createdAt: string;
  before: unknown;
  after: unknown;
}

export interface ServiceTile {
  id: string;
  name: string;
  description: string;
  status: HealthStatus;
  latencyMs: number | null;
  uptime30d: number;
  lastCheckAt: string;
  lastIncidentAt: string | null;
  lastIncidentSummary: string | null;
}

export type AdminRole = "super_admin" | "support" | "finance" | "ops";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "invited" | "disabled";
  mfaEnabled: boolean;
  lastActiveAt: string | null;
  invitedAt: string;
}

// ---------------------------------------------------------------- overview

export interface AttentionItem {
  id: string;
  kind: "past_due" | "high_rto" | "carrier_error" | "unverified_domain";
  title: string;
  detail: string;
  to: string;
  severity: "warning" | "danger" | "info";
}

export interface OverviewData {
  workspaces: WorkspaceListResult;
  kpis: {
    activeWorkspaces: number;
    trialing: number;
    pastDue: number;
    mrr: number;
    gmv30d: number;
    ordersToday: number;
    deliveryRate: number;
  };
  signupsPerDay: ChartPoint[];
  mrrTrend: ChartPoint[];
  ordersPerDay: ChartPoint[];
  attention: AttentionItem[];
  recentSignups: AdminWorkspace[];
}
