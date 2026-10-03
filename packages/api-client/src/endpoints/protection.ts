/**
 * Protection against fake orders (backend: src/modules/fraud, src/modules/risk).
 *
 * Mounted at /workspaces/:workspaceId/fraud. The blocklist reads need
 * customers.view and its writes customers.manage. All exported names in this
 * file are prefixed with `protection` / `Protection`, or name a blocked entry.
 *
 * Notable codes: VALIDATION_ERROR (422 — `details[0].field` is `value`,
 * `name` or `csv`, with a message that says what is wrong with it).
 */
import type { ApiClient } from "../client";

// -------------------------------------------------------------- blocklist --

export const BLOCKED_ENTRY_TYPES = ["phone", "ip", "email", "device", "name_address"] as const;
export type BlockedEntryType = (typeof BLOCKED_ENTRY_TYPES)[number];

/** `orders`: may not order. `otp`: is not sent a code. `visit`: does not see the store. */
export const BLOCKED_ENTRY_SCOPES = ["orders", "otp", "visit"] as const;
export type BlockedEntryScope = (typeof BLOCKED_ENTRY_SCOPES)[number];

export interface BlockedEntry {
  id: string;
  type: BlockedEntryType;
  /** Normalized form (a name + address entry holds a hash here; show `label`). */
  value: string;
  /** What the merchant blocked, as they typed it. */
  label: string;
  scope: BlockedEntryScope;
  reason: string | null;
  createdById: string | null;
  createdBy: string | null;
  createdAt: string;
  /** The customer a phone entry belongs to, when that phone has ordered. */
  customerId: string | null;
}

export interface BlockedEntryListParams {
  type?: BlockedEntryType;
  scope?: BlockedEntryScope;
  q?: string;
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string;
}

export interface BlockedEntryList {
  entries: BlockedEntry[];
  nextCursor: string | null;
  /** Entries per type, under the same scope filter. */
  counts: Record<BlockedEntryType, number>;
}

export interface BlockedEntryCreatePayload {
  type: BlockedEntryType;
  /** Every type except `name_address`. */
  value?: string;
  /** `name_address` only. */
  name?: string;
  address?: string;
  scopes: BlockedEntryScope[];
  reason?: string;
}

export interface BlockedEntryImportPayload {
  /** The file's text. Columns by header name: type, value, scope, reason, name, address. */
  csv: string;
  /** Used for rows that do not say. */
  type?: BlockedEntryType;
  scope?: BlockedEntryScope;
  reason?: string;
}

export interface BlockedEntryImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

const fraudBase = (workspaceId: string) => `/workspaces/${workspaceId}/fraud`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function protectionListBlocked(
  client: ApiClient,
  workspaceId: string,
  params: BlockedEntryListParams = {}
): Promise<BlockedEntryList> {
  return client.request<BlockedEntryList>(`${fraudBase(workspaceId)}/blocklist${query(params)}`);
}

/** One entry per scope. Blocking something already blocked only updates its reason. */
export async function protectionAddBlocked(
  client: ApiClient,
  workspaceId: string,
  payload: BlockedEntryCreatePayload
): Promise<BlockedEntry[]> {
  const { entries } = await client.request<{ entries: BlockedEntry[] }>(`${fraudBase(workspaceId)}/blocklist`, {
    method: "POST",
    body: payload,
  });
  return entries;
}

/** Deleting a phone entry of scope `orders` also un-blacklists that customer. */
export async function protectionRemoveBlocked(client: ApiClient, workspaceId: string, entryId: string): Promise<void> {
  await client.request<unknown>(`${fraudBase(workspaceId)}/blocklist/${entryId}`, { method: "DELETE" });
}

export async function protectionImportBlocked(
  client: ApiClient,
  workspaceId: string,
  payload: BlockedEntryImportPayload
): Promise<BlockedEntryImportResult> {
  return client.request<BlockedEntryImportResult>(`${fraudBase(workspaceId)}/blocklist/import`, {
    method: "POST",
    body: payload,
  });
}

// ------------------------------------------------------------------ rules --

/** What a rule does when it fires. `require_otp` asks for a verified phone; `to_lost` refuses and keeps a lost order. */
export const PROTECTION_ACTIONS = ["flag", "block", "require_otp", "to_lost"] as const;
export type ProtectionAction = (typeof PROTECTION_ACTIONS)[number];

/** Rules with a number: off when null. */
export const PROTECTION_NUMBER_RULES = [
  "duplicate_window_minutes",
  "max_orders_per_phone_per_day",
  "high_rejection_threshold",
  "max_items_per_order",
  "min_minutes_between_cod_orders_per_ip",
  "min_network_delivery_rate",
] as const;
export type ProtectionNumberRule = (typeof PROTECTION_NUMBER_RULES)[number];

/** Rules that are only on or off. */
export const PROTECTION_SWITCH_RULES = ["block_outside_country", "block_vpn", "high_risk"] as const;
export type ProtectionSwitchRule = (typeof PROTECTION_SWITCH_RULES)[number];

export type ProtectionRuleKey = ProtectionNumberRule | ProtectionSwitchRule;

export interface ProtectionRules {
  /** Refuse blocked customers and blocked entries whatever the actions say. */
  block_blacklisted: boolean;
  /** `strict`: refuse a phone that is not a mobile number of the store's country. */
  phone_validation: "strict" | "off";
  /** ISO2 codes for `block_outside_country`; empty = the store's own country. */
  allowed_countries: string[];
  /** ISO2 codes whose visitors do not see the store at all. */
  blocked_countries: string[];
  /** Checkout bot guard. null = the platform default (on in production). */
  bot_protection: boolean | null;
  /** Phone verification at checkout. */
  checkout_otp: CheckoutOtpSettings;
  numbers: Record<ProtectionNumberRule, number | null>;
  switches: Record<ProtectionSwitchRule, boolean>;
  actions: Record<ProtectionRuleKey, ProtectionAction>;
}

function isAction(value: unknown): value is ProtectionAction {
  return typeof value === "string" && (PROTECTION_ACTIONS as readonly string[]).includes(value);
}

/**
 * The effective rules for `workspace.settings.fraud_rules` — mirrors the
 * backend's fraudRules.resolveFraudRules. A rule is stored as its bare value
 * (the older shape) or as `{ value, action }`; a rule without its own action
 * uses the store-wide `action`.
 */
export function protectionResolveRules(stored: unknown): ProtectionRules {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const fallback: ProtectionAction = isAction(s.action) ? s.action : "flag";
  const valueOf = (key: string): unknown => {
    const raw = s[key];
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { value?: unknown }).value : raw;
  };
  const actionOf = (key: string): ProtectionAction => {
    const raw = s[key];
    const own = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { action?: unknown }).action : null;
    return isAction(own) ? own : fallback;
  };
  const numbers = {} as Record<ProtectionNumberRule, number | null>;
  for (const key of PROTECTION_NUMBER_RULES) {
    const value = valueOf(key);
    numbers[key] = typeof value === "number" && value > 0 ? value : null;
  }
  const switches = {} as Record<ProtectionSwitchRule, boolean>;
  for (const key of PROTECTION_SWITCH_RULES) switches[key] = valueOf(key) === true;
  const actions = {} as Record<ProtectionRuleKey, ProtectionAction>;
  for (const key of [...PROTECTION_NUMBER_RULES, ...PROTECTION_SWITCH_RULES]) actions[key] = actionOf(key);
  return {
    block_blacklisted: s.block_blacklisted === true,
    phone_validation: s.phone_validation === "strict" ? "strict" : "off",
    allowed_countries: Array.isArray(s.allowed_countries) ? s.allowed_countries.map(String) : [],
    blocked_countries: Array.isArray(s.blocked_countries) ? s.blocked_countries.map(String) : [],
    bot_protection: typeof s.bot_protection === "boolean" ? s.bot_protection : null,
    checkout_otp: protectionResolveCheckoutOtp(s),
    numbers,
    switches,
    actions,
  };
}

/**
 * Saves the whole rule set (needs workspace.manage; 403 otherwise) and
 * returns it as the server now holds it. An off rule is sent as null.
 */
export async function protectionSaveRules(
  client: ApiClient,
  workspaceId: string,
  rules: ProtectionRules
): Promise<ProtectionRules> {
  const fraud_rules: Record<string, unknown> = {
    block_blacklisted: rules.block_blacklisted,
    phone_validation: rules.phone_validation,
    allowed_countries: rules.allowed_countries.length ? rules.allowed_countries : null,
    blocked_countries: rules.blocked_countries.length ? rules.blocked_countries : null,
    bot_protection: rules.bot_protection,
    checkout_otp: rules.checkout_otp,
  };
  for (const key of PROTECTION_NUMBER_RULES) {
    fraud_rules[key] = rules.numbers[key] == null ? null : { value: rules.numbers[key], action: rules.actions[key] };
  }
  for (const key of PROTECTION_SWITCH_RULES) {
    fraud_rules[key] = rules.switches[key] ? { value: true, action: rules.actions[key] } : null;
  }
  const body = await client.request<{ workspace?: { settings?: { fraud_rules?: unknown } }; settings?: { fraud_rules?: unknown } }>(
    `/workspaces/${workspaceId}`,
    { method: "PATCH", body: { settings: { fraud_rules } } }
  );
  const settings = body.workspace?.settings ?? body.settings;
  return protectionResolveRules(settings?.fraud_rules);
}

// ------------------------------------------------------- storefront guard --

/** What a checkout form needs to pass the bot guard (GET /store/:ws/checkout/guard, no auth). */
export interface CheckoutGuard {
  enabled: boolean;
  /** Sent back as `botToken` with the order; null when the guard is off. */
  token: string | null;
  /** An order sent sooner than this after the token was issued is refused. */
  minSeconds: number;
  /** The hidden field that must stay empty, sent under this name. */
  honeypotField: string;
  /** Present when the store asks for an invisible challenge; its token goes in `captchaToken`. */
  captcha: { provider: string; siteKey: string | null } | null;
}

export async function protectionCheckoutGuard(client: ApiClient, workspaceId: string): Promise<CheckoutGuard> {
  return client.request<CheckoutGuard>(`/store/${workspaceId}/checkout/guard`, { auth: false });
}

// ---------------------------------------------------- network delivery rate --

/** A customer's delivery numbers across every store on the platform. Counters only. */
export interface NetworkScore {
  /** Delivered share of finished orders, 0–100; null for a customer with no finished order yet. */
  rate: number | null;
  isNew: boolean;
  ordersTotal: number;
  /** delivered + returned + cancelledAfterConfirm. */
  finished: number;
  delivered: number;
  returned: number;
  cancelledAfterConfirm: number;
  rejected: number;
  spamReports: number;
  /** Filled segments of the 4-segment bar. */
  segments: number;
  /** Below 50%: suggest asking for a deposit or the shipping fee upfront. */
  recommendDeposit: boolean;
}

/** `enabled: false` (and no score) while the feature is off for the store. */
export async function protectionNetworkScore(
  client: ApiClient,
  workspaceId: string,
  customerId: string
): Promise<{ enabled: boolean; score: NetworkScore | null }> {
  return client.request<{ enabled: boolean; score: NetworkScore | null }>(
    `/workspaces/${workspaceId}/customers/${customerId}/network-score`
  );
}

/** The scores of up to 200 customers at once, keyed by customer id (orders list). */
export async function protectionNetworkScores(
  client: ApiClient,
  workspaceId: string,
  customerIds: string[]
): Promise<{ enabled: boolean; scores: Record<string, NetworkScore> }> {
  return client.request<{ enabled: boolean; scores: Record<string, NetworkScore> }>(`${fraudBase(workspaceId)}/network-scores`, {
    method: "POST",
    body: { customerIds },
  });
}

/** One report per store and customer; `reported: false` when this store already reported them. */
export async function protectionReportSpam(
  client: ApiClient,
  workspaceId: string,
  customerId: string
): Promise<{ reported: boolean }> {
  return client.request<{ reported: boolean }>(`/workspaces/${workspaceId}/customers/${customerId}/report-spam`, {
    method: "POST",
  });
}

// ------------------------------------------------------------ checkout OTP --

/** `details` of the 428 OTP_REQUIRED a checkout answers while the phone is unverified. */
export interface CheckoutOtpChallenge {
  channel: "whatsapp" | "sms";
  codeLength: number;
  resendAfterSeconds: number;
  /** The phone with all but its last four digits masked. */
  phoneHint: string;
}

/** Phone verification at checkout, stored under `settings.fraud_rules.checkout_otp`. */
export interface CheckoutOtpSettings {
  enabled: boolean;
  channel: "whatsapp" | "sms";
  apply_to: "all" | "cod_only" | "risky_only";
  code_length: number;
}

export function protectionResolveCheckoutOtp(fraudRules: unknown): CheckoutOtpSettings {
  const rules = (fraudRules && typeof fraudRules === "object" ? fraudRules : {}) as { checkout_otp?: Partial<CheckoutOtpSettings> };
  const s = rules.checkout_otp ?? {};
  return {
    enabled: s.enabled === true,
    channel: s.channel === "sms" ? "sms" : "whatsapp",
    apply_to: s.apply_to === "cod_only" || s.apply_to === "risky_only" ? s.apply_to : "all",
    code_length: s.code_length === 5 || s.code_length === 6 ? s.code_length : 4,
  };
}

/**
 * Storefront, no auth. 422 INVALID_CODE / EXPIRED, 429 TOO_MANY_ATTEMPTS.
 * The token goes back with the same checkout as `otpToken`.
 */
export async function protectionVerifyCheckoutOtp(
  client: ApiClient,
  workspaceId: string,
  payload: { phone: string; code: string }
): Promise<string> {
  const { otpToken } = await client.request<{ otpToken: string }>(`/store/${workspaceId}/checkout/otp/verify`, {
    method: "POST",
    body: payload,
    auth: false,
  });
  return otpToken;
}

/** Storefront, no auth. 429 OTP_RESEND_TOO_SOON inside the first minute, 429 OTP_RATE_LIMITED after three codes. */
export async function protectionResendCheckoutOtp(client: ApiClient, workspaceId: string, phone: string): Promise<void> {
  await client.request<unknown>(`/store/${workspaceId}/checkout/otp/resend`, { method: "POST", body: { phone }, auth: false });
}
