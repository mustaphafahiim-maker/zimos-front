/** Types for the control-center mock layer (controlApi.ts). Shapes mirror intended backend contracts. */
import type { AdminRole, PlanFeatureKey } from "./types";

// ---------------------------------------------------------------- workspace control

export type LimitKey = "ordersPerMonth" | "products" | "staffSeats" | "domains" | "funnels";
/** null = unlimited. */
export type LimitValues = Record<LimitKey, number | null>;
/** Missing key = inherit plan default. */
export type LimitOverrides = Partial<Record<LimitKey, number | null>>;

export type StoreStatus = "live" | "maintenance" | "suspended";
export type KycStatus = "not_submitted" | "pending" | "approved" | "rejected";

export interface StaffNote {
  id: string;
  body: string;
  authorName: string;
  pinned: boolean;
  createdAt: string;
}

export interface KycEvent {
  id: string;
  status: KycStatus;
  note: string;
  actorName: string;
  createdAt: string;
}

export interface BalanceAdjustment {
  id: string;
  amount: number;
  reason: string;
  actorName: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  carrier: string;
  codCollected: number;
  fees: number;
  status: "pending" | "settled" | "held";
  periodEnd: string;
}

export interface WorkspaceDiscount {
  percent: number;
  months: number;
  reason: string;
  appliedAt: string;
}

export interface WorkspaceControl {
  workspaceId: string;
  limitOverrides: LimitOverrides;
  featureOverrides: Partial<Record<PlanFeatureKey, boolean>>;
  compMonths: number;
  discount: WorkspaceDiscount | null;
  storeStatus: StoreStatus;
  maintenanceMessage: string;
  themeResetAt: string | null;
  payoutHold: boolean;
  payoutHoldReason: string | null;
  balance: number;
  adjustments: BalanceAdjustment[];
  settlements: Settlement[];
  fraudScore: number;
  blocked: boolean;
  blockedReason: string | null;
  kycStatus: KycStatus;
  kycHistory: KycEvent[];
  notes: StaffNote[];
  deletionScheduledAt: string | null;
  forcedLogoutAt: string | null;
  lastExportAt: string | null;
}

// ---------------------------------------------------------------- users

export type PlatformUserStatus = "active" | "pending" | "suspended";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: PlatformUserStatus;
  emailVerified: boolean;
  platformAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: Array<{ id: string; name: string; role: string }>;
  passwordResetSentAt: string | null;
}

// ---------------------------------------------------------------- settings

export interface PlatformSettings {
  platform: {
    name: string;
    supportEmail: string;
    supportPhone: string;
    supportWhatsapp: string;
    defaultCurrency: string;
    defaultLocale: "ar" | "en";
    timezone: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    maintenanceAllowlist: string[];
  };
  signup: {
    allowSignups: boolean;
    requireEmailVerification: boolean;
    defaultTrialDays: number;
    defaultPlanId: string;
    allowedCountries: string[];
  };
  commerce: {
    defaultCodFee: number;
    minOrderValue: number;
    maxOrderValue: number;
    returnWindowDays: number;
    governorates: string[];
  };
  localization: {
    enabledLocales: Array<"ar" | "en">;
    defaultLocale: "ar" | "en";
  };
  updatedAt: string;
}

export type LegalDocKey = "terms" | "privacy" | "refund";

export interface LegalVersion {
  version: number;
  body: string;
  publishedAt: string;
  publishedBy: string;
}

export interface LegalDoc {
  id: LegalDocKey;
  title: string;
  body: string;
  version: number;
  history: LegalVersion[];
  updatedAt: string;
}

export interface LocalizedMessage {
  subject: string;
  body: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: "email" | "sms";
  description: string;
  variables: string[];
  ar: LocalizedMessage;
  en: LocalizedMessage;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

export type IntegrationKind = "carrier" | "gateway" | "messaging";

export interface IntegrationDefault {
  id: string;
  kind: IntegrationKind;
  name: string;
  code: string;
  enabled: boolean;
  description: string;
}

// ---------------------------------------------------------------- roles

export type PermissionKey =
  | "workspaces.view"
  | "workspaces.manage"
  | "subscriptions.manage"
  | "finance.view"
  | "finance.payouts"
  | "users.manage"
  | "risk.manage"
  | "moderation.manage"
  | "support.manage"
  | "content.manage"
  | "settings.manage"
  | "system.jobs"
  | "system.backups"
  | "admins.manage"
  | "impersonate";

export interface RoleMatrix {
  permissions: Record<AdminRole, PermissionKey[]>;
  require2fa: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------- finance

export type InvoiceStatus = "paid" | "open" | "refunded" | "void";

export interface Invoice {
  id: string;
  number: string;
  workspaceId: string;
  workspaceName: string;
  planName: string;
  amount: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  paidAt: string | null;
}

export interface Refund {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  workspaceName: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export type PayoutStatus = "pending" | "approved" | "held" | "paid";

export interface Payout {
  id: string;
  workspaceId: string;
  workspaceName: string;
  codCollected: number;
  fees: number;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
}

// ---------------------------------------------------------------- content

export interface CmsContent {
  announcementBar: { enabled: boolean; textAr: string; textEn: string; link: string };
  hero: { titleAr: string; titleEn: string; subtitleAr: string; subtitleEn: string; ctaAr: string; ctaEn: string };
  planDisplay: Array<{ planId: string; visible: boolean; highlighted: boolean }>;
  updatedAt: string;
}

export interface FaqEntry {
  id: string;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  published: boolean;
  order: number;
}

export interface ChangelogPost {
  id: string;
  title: string;
  body: string;
  tag: "feature" | "improvement" | "fix" | "news";
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- moderation

export type ReportStatus = "open" | "dismissed" | "warned" | "unpublished" | "suspended";

export interface ModerationReport {
  id: string;
  targetType: "storefront" | "product";
  targetName: string;
  workspaceId: string;
  workspaceName: string;
  reason: "counterfeit" | "prohibited_item" | "scam" | "offensive" | "ip_infringement" | "misleading";
  details: string;
  reporterEmail: string;
  previewUrl: string;
  reportsCount: number;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ---------------------------------------------------------------- jobs

export type JobType = "email_send" | "carrier_sync" | "settlement_import" | "webhook_delivery";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface BackgroundJob {
  id: string;
  type: JobType;
  label: string;
  workspaceName: string | null;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CronSchedule {
  id: string;
  name: string;
  expression: string;
  description: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: "succeeded" | "failed" | null;
  nextRunAt: string | null;
}

// ---------------------------------------------------------------- backups

export interface BackupSnapshot {
  id: string;
  label: string;
  kind: "automatic" | "manual";
  sizeMb: number;
  status: "completed" | "running" | "failed";
  createdAt: string;
  createdBy: string;
  restoredAt: string | null;
}

export interface DataExportRequest {
  id: string;
  workspaceId: string;
  workspaceName: string;
  requestedBy: string;
  scope: "full" | "orders" | "customers" | "products";
  status: "pending" | "processing" | "ready" | "rejected";
  createdAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------- control tower

export interface ControlAlert {
  id: string;
  kind: "past_due" | "suspended" | "kyc_pending" | "failed_jobs" | "moderation" | "maintenance" | "payout_queue" | "deletion_scheduled";
  title: string;
  detail: string;
  count: number;
  to: string;
  severity: "danger" | "warning" | "info";
}
