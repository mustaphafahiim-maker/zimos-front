/**
 * Phase-2 domain types: media-buyer analytics, call-center confirmation,
 * WhatsApp inbox/bot, COD settlements, profit & loss, affiliates, reviews,
 * returns, suppliers. Same conventions as types.ts. Mapped to endpoints in
 * BACKEND_CONTRACT.md (section "Phase 5 — beyond the competitors").
 */

// ------------------------------------------------- Ads / media buying --

export type AdPlatform = "facebook" | "tiktok" | "snapchat" | "google";

export interface AdAccount {
  id: string;
  platform: AdPlatform;
  name: string;
  externalId: string;
  currency: string;
  status: "connected" | "token_expired" | "disconnected";
  lastSyncAt: string | null;
  spendTodayAmount: number;
}

export interface AdCreative {
  id: string;
  name: string;
  format: "video" | "image" | "carousel";
  thumbnailColor: string;
  spendAmount: number;
  impressions: number;
  clicks: number;
  orders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  revenueAmount: number;
}

export interface AdSet {
  id: string;
  name: string;
  audience: string;
  spendAmount: number;
  impressions: number;
  clicks: number;
  orders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  revenueAmount: number;
  creatives: AdCreative[];
}

export interface Campaign {
  id: string;
  adAccountId: string;
  platform: AdPlatform;
  name: string;
  objective: "conversions" | "traffic" | "leads";
  status: "active" | "paused" | "ended";
  productId: string | null;
  productName: string | null;
  funnelId: string | null;
  dailyBudgetAmount: number;
  spendAmount: number;
  impressions: number;
  clicks: number;
  landingViews: number;
  addToCarts: number;
  checkouts: number;
  orders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  revenueAmount: number;
  /** COGS + shipping + carrier fees + payment fees for delivered orders. */
  costOfDeliveredAmount: number;
  adSets: AdSet[];
  daily: Array<{ date: string; spendAmount: number; orders: number; revenueAmount: number }>;
}

export interface ProductEconomics {
  productId: string;
  productName: string;
  sellingPriceAmount: number;
  cogsAmount: number;
  shippingCostAmount: number;
  carrierFeeAmount: number;
  paymentFeeAmount: number;
  packagingAmount: number;
  returnCostAmount: number;
  /** Rates in basis points, from history. */
  confirmationRateBp: number;
  deliveryRateBp: number;
  returnRateBp: number;
}

export interface PnlLine {
  key: string;
  label: string;
  amount: number;
  /** negative for costs */
  sign: 1 | -1;
}

export interface PnlReport {
  range: "7d" | "30d" | "90d";
  currency: string;
  lines: PnlLine[];
  netProfitAmount: number;
  netMarginBp: number;
  byProduct: Array<{ productId: string; productName: string; revenueAmount: number; adSpendAmount: number; cogsAmount: number; shippingAmount: number; returnsAmount: number; netProfitAmount: number; deliveredOrders: number }>;
  byDay: Array<{ date: string; revenueAmount: number; adSpendAmount: number; netProfitAmount: number }>;
}

// ------------------------------------------------------- Call center --

export type CallOutcome = "confirmed" | "no_answer" | "busy" | "cancelled" | "postponed" | "wrong_number" | "duplicate";

export interface CallLog {
  id: string;
  orderId: string;
  orderNumber: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  durationSeconds: number;
  outcome: CallOutcome;
  note: string | null;
  recordingUrl: string | null;
}

export interface ConfirmationItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  alternatePhone: string | null;
  governorate: string;
  address: string;
  items: Array<{ productName: string; variant: string | null; quantity: number; unitPriceAmount: number }>;
  totalAmount: number;
  shippingAmount: number;
  currency: string;
  source: string;
  attempts: number;
  lastOutcome: CallOutcome | null;
  nextAttemptAt: string | null;
  priority: "normal" | "high" | "flagged";
  assignedAgentId: string | null;
  createdAt: string;
  customerHistory: { totalOrders: number; delivered: number; returned: number; reliabilityScore: number };
  riskFlags: string[];
}

export interface Agent {
  id: string;
  name: string;
  status: "online" | "on_call" | "break" | "offline";
  callsToday: number;
  confirmedToday: number;
  avgHandleSeconds: number;
  extension: string;
}

export interface CallCenterSettings {
  maxAttempts: number;
  retryAfterMinutes: number;
  autoCancelAfterAttempts: boolean;
  workingHours: { from: string; to: string };
  whatsappFallbackAfterAttempt: number;
  voipProvider: "none" | "twilio" | "maqsam" | "ziwo";
  recordCalls: boolean;
}

// ------------------------------------------------------- WhatsApp inbox --

export interface WaMessage {
  id: string;
  direction: "in" | "out";
  body: string;
  at: string;
  status: "sent" | "delivered" | "read" | "failed";
  byBot: boolean;
}

export interface WaConversation {
  id: string;
  customerName: string;
  phone: string;
  orderNumber: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  status: "open" | "bot" | "resolved";
  assignedAgentName: string | null;
  tags: string[];
  messages: WaMessage[];
}

export interface WaBotRule {
  id: string;
  name: string;
  match: "reply_1" | "reply_2" | "keyword" | "any";
  keyword: string | null;
  action: "confirm_order" | "cancel_order" | "send_tracking" | "handoff_agent" | "send_text";
  responseText: string;
  enabled: boolean;
  hits: number;
}

export interface WaBotSettings {
  connected: boolean;
  phoneNumber: string;
  businessName: string;
  confirmationEnabled: boolean;
  trackingRepliesEnabled: boolean;
  handoffKeyword: string;
  outsideHoursReply: string;
  rules: WaBotRule[];
}

// -------------------------------------------------- COD settlements --

export interface Settlement {
  id: string;
  carrierKey: string;
  carrierName: string;
  reference: string;
  periodFrom: string;
  periodTo: string;
  ordersCount: number;
  collectedAmount: number;
  carrierFeesAmount: number;
  codFeesAmount: number;
  netAmount: number;
  status: "expected" | "received" | "discrepancy" | "reconciled";
  receivedAt: string | null;
  discrepancyAmount: number;
}

export interface SettlementOrder {
  orderNumber: string;
  customerName: string;
  codAmount: number;
  carrierStatus: "delivered" | "returned" | "lost";
  carrierReportedAmount: number | null;
  matched: boolean;
}

// ---------------------------------------------------------- Affiliates --

export interface Affiliate {
  id: string;
  name: string;
  phone: string;
  code: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  payOn: "confirmed" | "delivered";
  status: "active" | "paused";
  clicks: number;
  orders: number;
  deliveredOrders: number;
  earnedAmount: number;
  paidAmount: number;
  joinedAt: string;
}

// ---------------------------------------------------------- Reviews ----

export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  photos: number;
}

// ---------------------------------------------------------- Returns ----

export interface ReturnRequest {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  reason: "no_longer_wanted" | "not_as_described" | "wrong_item" | "damaged" | "arrived_late" | "rto_unreachable" | "rto_refused";
  kind: "customer_return" | "rto";
  items: Array<{ productName: string; quantity: number }>;
  refundAmount: number;
  currency: string;
  status: "requested" | "approved" | "rejected" | "received" | "restocked" | "refunded";
  carrierName: string | null;
  createdAt: string;
}

// -------------------------------------------------------- Suppliers ----

export interface Supplier {
  id: string;
  name: string;
  city: string;
  category: string;
  rating: number;
  products: number;
  leadTimeDays: number;
  minOrder: number;
  shipsDirect: boolean;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  category: string;
  costAmount: number;
  suggestedPriceAmount: number;
  stock: number;
  imageColor: string;
  imported: boolean;
}

// -------------------------------------------------------- Multi-store --

export interface StoreSummary {
  workspaceId: string;
  name: string;
  currency: string;
  ordersToday: number;
  revenueTodayAmount: number;
  ordersMonth: number;
  revenueMonthAmount: number;
  netProfitMonthAmount: number;
  adSpendMonthAmount: number;
  deliveryRateBp: number;
  status: "active" | "paused";
}
