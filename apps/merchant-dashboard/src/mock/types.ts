/**
 * Domain types for the features that exist in the dashboard UI but NOT yet in
 * the backend. Every type here is a proposed backend contract — see
 * BACKEND_CONTRACT.md at the repo root for the endpoint each one maps to.
 *
 * Conventions match the real api-client: money is a string of integer minor
 * units (piastres), percentages are basis points (100 = 1%), ids are uuids,
 * timestamps are ISO strings.
 */

// ---------------------------------------------------------------- Funnels --

export type FunnelStepType =
  | "landing"
  | "checkout"
  | "order_bump"
  | "upsell"
  | "downsell"
  | "thank_you";

export type FunnelStatus = "draft" | "published" | "paused";

export interface FunnelStep {
  id: string;
  key: string;
  name: string;
  type: FunnelStepType;
  /** Product/offer attached (required for upsell/downsell/order_bump). */
  offerId: string | null;
  offerName: string | null;
  priceAmount: string | null;
  /** Optional A/B experiment attached to this step. */
  experimentId: string | null;
  /** Prototype-level stats. */
  views: number;
  conversions: number;
  x: number;
  y: number;
}

export type FunnelEdgeCondition =
  | "always"
  | "completed_checkout"
  | "accepted_offer"
  | "declined_offer";

export interface FunnelEdge {
  id: string;
  fromStepKey: string;
  toStepKey: string;
  condition: FunnelEdgeCondition;
  priority: number;
}

export interface Funnel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: FunnelStatus;
  entryStepKey: string | null;
  steps: FunnelStep[];
  edges: FunnelEdge[];
  visits: number;
  orders: number;
  revenueAmount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// --------------------------------------------------------- A/B experiments --

export interface ExperimentVariant {
  id: string;
  name: string;
  trafficPercent: number;
  visitors: number;
  conversions: number;
}

export interface Experiment {
  id: string;
  workspaceId: string;
  name: string;
  targetType: "funnel_step" | "page";
  targetLabel: string;
  status: "draft" | "running" | "paused" | "completed";
  winnerVariantId: string | null;
  autoPauseLoser: boolean;
  variants: ExperimentVariant[];
  startedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------- Offers / conversion --

export type ConversionOfferType =
  | "order_bump"
  | "post_purchase_upsell"
  | "cross_sell"
  | "downsell"
  | "bundle";

export interface OfferProductRef {
  productId: string;
  productName: string;
  quantity: number;
}

export interface ConversionOffer {
  id: string;
  workspaceId: string;
  type: ConversionOfferType;
  name: string;
  headline: string;
  status: "active" | "disabled";
  /** Where it shows: on checkout for bumps, after purchase for upsells, in cart for cross-sell, on cancel for downsell. */
  triggerProductIds: string[];
  triggerLabel: string;
  products: OfferProductRef[];
  discountType: "none" | "percentage" | "fixed";
  discountValue: number;
  /** Bundle tiers: buy 2 -> 10%, buy 3 -> 20% */
  tiers: Array<{ quantity: number; discountBasisPoints: number }>;
  impressions: number;
  accepted: number;
  revenueAmount: string;
  createdAt: string;
}

// ------------------------------------------------------ Tracking / pixels --

export type PixelPlatform = "facebook" | "tiktok" | "snapchat" | "google_ads" | "ga4";

export interface TrackingPixel {
  id: string;
  workspaceId: string;
  platform: PixelPlatform;
  label: string;
  pixelId: string;
  /** Server-side Conversions API token (Facebook/TikTok/Snap). */
  capiEnabled: boolean;
  capiTokenSet: boolean;
  events: Array<"page_view" | "view_content" | "add_to_cart" | "initiate_checkout" | "purchase" | "lead">;
  status: "active" | "disabled";
  lastEventAt: string | null;
  createdAt: string;
}

// ----------------------------------------------------------- Automations --

export type AutomationTrigger =
  | "order_created"
  | "order_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "checkout_abandoned"
  | "confirmation_unreachable";

export type AutomationChannel = "whatsapp" | "sms" | "email" | "webhook";

export interface AutomationStep {
  id: string;
  delayMinutes: number;
  channel: AutomationChannel;
  templateName: string;
  body: string;
}

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  trigger: AutomationTrigger;
  status: "active" | "paused";
  steps: AutomationStep[];
  runs: number;
  lastRunAt: string | null;
  createdAt: string;
}

// ------------------------------------------------------ Fraud protection --

export type FraudRuleKey =
  | "block_blacklisted_phone"
  | "duplicate_order_window"
  | "max_orders_per_phone_per_day"
  | "block_invalid_phone_format"
  | "high_rejection_customer"
  | "require_otp_high_value"
  | "block_ip_country_mismatch";

export interface FraudRule {
  key: FraudRuleKey;
  label: string;
  description: string;
  enabled: boolean;
  /** Optional numeric parameter (minutes, count, amount). */
  value: number | null;
  valueLabel: string | null;
}

export interface FraudSettings {
  workspaceId: string;
  rules: FraudRule[];
  action: "block" | "flag_for_review";
  blockedToday: number;
  blockedThisMonth: number;
}

export interface BlockedEntry {
  id: string;
  workspaceId: string;
  type: "phone" | "ip" | "email";
  value: string;
  reason: string;
  source: "manual" | "rule";
  hits: number;
  createdAt: string;
}

export interface FlaggedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  totalAmount: string;
  currency: string;
  triggeredRules: FraudRuleKey[];
  status: "flagged" | "approved" | "blocked";
  createdAt: string;
}

// -------------------------------------------------------------- Shipping --

export type CarrierKey = "bosta" | "aramex" | "jnt" | "mylerz" | "fedex" | "custom";

export interface Carrier {
  key: CarrierKey;
  name: string;
  countries: string[];
  supportsCod: boolean;
  supportsTracking: boolean;
  supportsPickup: boolean;
  logoText: string;
}

export interface CarrierAccount {
  id: string;
  workspaceId: string;
  carrierKey: CarrierKey;
  label: string;
  status: "connected" | "disconnected" | "error";
  isDefault: boolean;
  credentialsSet: boolean;
  autoCreateShipmentOn: "never" | "confirmed" | "paid";
  codCollection: boolean;
  shipmentsThisMonth: number;
  connectedAt: string | null;
}

// ----------------------------------------------------- Abandoned checkout --

export interface AbandonedCheckout {
  id: string;
  workspaceId: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  items: Array<{ productName: string; quantity: number; unitPriceAmount: string }>;
  totalAmount: string;
  currency: string;
  step: "contact" | "shipping" | "payment";
  source: "store" | "funnel";
  sourceLabel: string;
  recoveryStatus: "not_contacted" | "contacted" | "recovered" | "lost";
  lastActivityAt: string;
}

// ---------------------------------------------------------- Integrations --

export type AppCategory = "marketing" | "shipping" | "payments" | "messaging" | "analytics" | "ai";

export interface AppIntegration {
  key: string;
  name: string;
  category: AppCategory;
  description: string;
  installed: boolean;
  status: "connected" | "needs_setup" | "not_installed";
  logoText: string;
}

// -------------------------------------------------------------- Settings --

export interface CheckoutSettings {
  workspaceId: string;
  layout: "one_page" | "two_step";
  fields: {
    email: "hidden" | "optional" | "required";
    alternatePhone: "hidden" | "optional" | "required";
    address2: "hidden" | "optional" | "required";
    notes: "hidden" | "optional" | "required";
  };
  phoneOtpVerification: boolean;
  showTrustBadges: boolean;
  showCountdown: boolean;
  countdownMinutes: number;
  allowDiscountCodes: boolean;
  defaultPaymentMethod: "cod" | "card";
  thankYouMessage: string;
  /** Optional extra fee charged on COD orders, minor units. Absent = none. */
  codFeeAmount?: string | null;
}

export interface PaymentGateway {
  key: "cod" | "paymob" | "fawry" | "stripe" | "paypal" | "instapay";
  name: string;
  enabled: boolean;
  configured: boolean;
  feePercent: number;
  currencies: string[];
}

export interface CurrencySetting {
  code: string;
  enabled: boolean;
  isDefault: boolean;
  rateToDefault: number;
  rounding: "none" | "0.99" | "whole";
}

export interface CamouflageSettings {
  enabled: boolean;
  mode: "hide_product" | "decoy_page";
  decoyPageTitle: string;
  blockedCountries: string[];
  blockedUserAgents: string[];
}

export interface DomainRecord {
  id: string;
  hostname: string;
  status: "pending_verification" | "verified" | "active" | "failed";
  isPrimary: boolean;
  target: "store" | "funnel";
  targetLabel: string;
  verificationToken: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: "owner" | "admin" | "staff" | "confirmation_agent" | "fulfillment";
  status: "active" | "invited";
  lastActiveAt: string | null;
}

export interface PlanInfo {
  planKey: "starter" | "growth" | "scale";
  planName: string;
  status: "trialing" | "active" | "past_due";
  trialEndsAt: string | null;
  monthlyPriceAmount: string;
  currency: string;
  ordersThisMonth: number;
  softOrderQuota: number;
  transactionFeeBasisPoints: number;
  codFeeBasisPoints: number;
}

// -------------------------------------------------------------- Analytics --

export interface DailyPoint {
  date: string;
  orders: number;
  revenueAmount: number; // minor units, as a number for charting
  visitors: number;
}

export interface AnalyticsOverview {
  currency: string;
  range: "7d" | "30d" | "90d";
  totals: {
    revenueAmount: number;
    orders: number;
    visitors: number;
    conversionBasisPoints: number;
    averageOrderAmount: number;
    confirmationRateBasisPoints: number;
    deliveryRateBasisPoints: number;
    returnRateBasisPoints: number;
  };
  previous: {
    revenueAmount: number;
    orders: number;
    visitors: number;
    conversionBasisPoints: number;
  };
  daily: DailyPoint[];
  topProducts: Array<{ productId: string; name: string; units: number; revenueAmount: number }>;
  bySource: Array<{ source: string; orders: number; revenueAmount: number }>;
  byGovernorate: Array<{ name: string; orders: number; deliveryRateBasisPoints: number }>;
  pipeline: {
    newOrders: number;
    awaitingConfirmation: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    returned: number;
    cancelled: number;
  };
}

// ---------------------------------------------------------- Inventory ----

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  costAmount: string | null;
}

// ------------------------------------------------------------ Templates --

export interface StoreTemplate {
  id: string;
  name: string;
  kind: "store" | "funnel" | "landing";
  category: string;
  priceAmount: string;
  isFree: boolean;
  primaryColor: string;
  tags: string[];
  rtl: boolean;
}
