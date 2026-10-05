/**
 * Store design and settings (lane 5): the purchase form builder and the
 * thank-you page. Backend: src/modules/checkout/checkoutForm.js and
 * src/modules/storefront/thankYouPage.js.
 *
 * Both live in the workspace settings blob and are written through
 * PATCH /workspaces/:workspaceId (website.edit) and read back publicly from
 * GET /store/:workspaceId as `checkout` and `thankYou`.
 */
import type { ApiClient } from "../client";
import type { LocalizedText, Workspace } from "../types";

// ------------------------------------------------------- purchase form ----

export const CHECKOUT_FORM_FIXED_KEYS = [
  "full_name",
  "phone",
  "phone_alt",
  "email",
  "country",
  "government",
  "city",
  "address",
  "postal_code",
  "sa_national_address",
  "note",
] as const;

export type CheckoutFormFixedKey = (typeof CHECKOUT_FORM_FIXED_KEYS)[number];
export type CheckoutFormCustomKey = "custom_1" | "custom_2" | "custom_3" | "custom_4" | "custom_5";
export type CheckoutFormFieldKey = CheckoutFormFixedKey | CheckoutFormCustomKey;
export const CHECKOUT_FORM_CUSTOM_KEYS: CheckoutFormCustomKey[] = [
  "custom_1",
  "custom_2",
  "custom_3",
  "custom_4",
  "custom_5",
];
/** Always shown and required; the server ignores any attempt to change that. */
export const CHECKOUT_FORM_LOCKED_KEYS: CheckoutFormFieldKey[] = ["full_name", "phone"];

export interface CheckoutFormField {
  key: CheckoutFormFieldKey;
  /** Empty strings mean "use the storefront's built-in label". */
  label: LocalizedText;
  helpText: LocalizedText;
  position: number;
  enabled: boolean;
  required: boolean;
  custom: boolean;
  /** Custom fields only. */
  type?: "text" | "choice";
  options?: string[];
}

export type CheckoutFormLayout = "one_step" | "inline_on_product";

export interface CheckoutForm {
  fields: CheckoutFormField[];
  layout: CheckoutFormLayout;
  show_trust_badges: boolean;
  allow_discount_codes: boolean;
  thank_you_message: string | null;
  auto_select_region: boolean;
  auto_select_variant: boolean;
}

const DEFAULT_FIELD_STATE: Record<CheckoutFormFixedKey, [enabled: boolean, required: boolean]> = {
  full_name: [true, true],
  phone: [true, true],
  phone_alt: [true, false],
  email: [true, false],
  country: [false, false],
  government: [true, true],
  city: [true, true],
  address: [true, true],
  postal_code: [true, false],
  sa_national_address: [false, false],
  note: [true, false],
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const localized = (v: unknown): LocalizedText => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { ar: text(o.ar), en: text(o.en) };
};

/**
 * The effective purchase form for a stored `checkout_settings` blob or for
 * the public `checkout` object — mirrors resolveCheckoutForm in the backend,
 * including the three switches that predate the builder.
 */
export function resolveCheckoutForm(stored: unknown): CheckoutForm {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const list = Array.isArray(s.fields)
    ? (s.fields as Array<Record<string, unknown>>).filter((f) => f && typeof f.key === "string")
    : null;
  const byKey = new Map((list ?? []).map((f) => [f.key as string, f]));
  const legacy = (key: CheckoutFormFixedKey): [boolean, boolean] => {
    const mode = key === "email" ? s.email : key === "postal_code" ? s.postal_code : key === "note" ? s.notes : null;
    if (list || typeof mode !== "string") return DEFAULT_FIELD_STATE[key];
    if (mode === "hidden") return [false, false];
    if (mode === "required" && key !== "note") return [true, true];
    return [true, false];
  };

  const fields: CheckoutFormField[] = CHECKOUT_FORM_FIXED_KEYS.map((key, index) => {
    const f = byKey.get(key) ?? {};
    const [defEnabled, defRequired] = legacy(key);
    const locked = CHECKOUT_FORM_LOCKED_KEYS.includes(key);
    const enabled = locked ? true : typeof f.enabled === "boolean" ? f.enabled : defEnabled;
    const required = locked
      ? true
      : key === "note"
        ? false
        : enabled && (typeof f.required === "boolean" ? f.required : defRequired);
    return {
      key,
      label: localized(f.label),
      helpText: localized(f.helpText),
      position: Number.isInteger(f.position) ? (f.position as number) : index + 1,
      enabled,
      required,
      custom: false,
    };
  });

  for (const f of list ?? []) {
    const key = f.key as CheckoutFormCustomKey;
    if (!CHECKOUT_FORM_CUSTOM_KEYS.includes(key)) continue;
    const type = f.type === "choice" ? "choice" : "text";
    const options = type === "choice" && Array.isArray(f.options) ? (f.options as unknown[]).map(text).filter(Boolean) : [];
    if (!text((f.label as Record<string, unknown> | undefined)?.ar) && !text((f.label as Record<string, unknown> | undefined)?.en)) continue;
    fields.push({
      key,
      label: localized(f.label),
      helpText: localized(f.helpText),
      position: Number.isInteger(f.position) ? (f.position as number) : 50,
      enabled: f.enabled === true,
      required: f.enabled === true && f.required === true,
      custom: true,
      type,
      options,
    });
  }

  const sorted = fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.position - b.f.position || a.i - b.i)
    .map(({ f }) => f);
  const bool = (key: string, fallback: boolean) => (typeof s[key] === "boolean" ? (s[key] as boolean) : fallback);

  return {
    fields: sorted,
    layout: s.layout === "one_step" ? "one_step" : "inline_on_product",
    show_trust_badges: bool("show_trust_badges", true),
    allow_discount_codes: bool("allow_discount_codes", true),
    thank_you_message: text(s.thank_you_message) || null,
    auto_select_region: bool("auto_select_region", true),
    auto_select_variant: bool("auto_select_variant", true),
  };
}

const modeOf = (f: CheckoutFormField | undefined) => (!f || !f.enabled ? "hidden" : f.required ? "required" : "optional");

/** Saves the whole form. Positions are rewritten from the list order. */
export async function storeDesignSaveCheckoutForm(
  client: ApiClient,
  workspaceId: string,
  form: CheckoutForm
): Promise<Workspace> {
  const fields = form.fields.map((f, index) => ({
    key: f.key,
    label: f.label,
    helpText: f.helpText,
    position: index + 1,
    enabled: f.enabled,
    required: f.enabled && f.required,
    ...(f.custom ? { type: f.type ?? "text", options: f.type === "choice" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : [] } : {}),
  }));
  const find = (key: CheckoutFormFieldKey) => form.fields.find((f) => f.key === key);
  const { workspace } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: {
      settings: {
        checkout_settings: {
          fields,
          // The switches older readers know, kept in step with the list.
          email: modeOf(find("email")),
          postal_code: modeOf(find("postal_code")),
          notes: find("note")?.enabled ? "optional" : "hidden",
          layout: form.layout,
          show_trust_badges: form.show_trust_badges,
          allow_discount_codes: form.allow_discount_codes,
          thank_you_message: form.thank_you_message?.trim() || null,
          auto_select_region: form.auto_select_region,
          auto_select_variant: form.auto_select_variant,
        },
      },
    },
  });
  return workspace;
}

/** One answer to a purchase-form field with no column of its own (Order.checkoutFields). */
export interface OrderCheckoutFieldAnswer {
  key: string;
  label: LocalizedText;
  value: string;
}

// ------------------------------------------------------ thank-you page ----

export interface ThankYouPageSettings {
  enabled: boolean;
  /** Plain text; {{order_number}} and {{customer_name}} are filled in. */
  content: string;
  show_back_home_button: boolean;
  show_products_from_collection_id: string | null;
}

export const THANK_YOU_PAGE_DEFAULTS: ThankYouPageSettings = {
  enabled: false,
  content: "",
  show_back_home_button: true,
  show_products_from_collection_id: null,
};

export function resolveThankYouPage(stored: unknown): ThankYouPageSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return {
    enabled: s.enabled === true,
    content: typeof s.content === "string" ? s.content : "",
    show_back_home_button: typeof s.show_back_home_button === "boolean" ? s.show_back_home_button : true,
    show_products_from_collection_id:
      typeof s.show_products_from_collection_id === "string" ? s.show_products_from_collection_id : null,
  };
}

export async function storeDesignSaveThankYouPage(
  client: ApiClient,
  workspaceId: string,
  page: ThankYouPageSettings
): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { settings: { thank_you_page: page } },
  });
  return workspace;
}

/** Replaces {{order_number}} and {{customer_name}} in thank-you content. */
export function fillThankYouContent(content: string, vars: { orderNumber?: string | null; customerName?: string | null }) {
  return content
    .replace(/\{\{\s*order_number\s*\}\}/g, vars.orderNumber ?? "")
    .replace(/\{\{\s*customer_name\s*\}\}/g, vars.customerName ?? "");
}

// ------------------------------------------- store info and policies ----
// Backend: src/modules/storefront/storeInfo.js. `settings.store_info` and
// `settings.legal`, both sent whole through PATCH /workspaces/:workspaceId.

export const STORE_INFO_CARD_KEYS = ["shipping_policy", "return_policy", "cod_policy"] as const;
export type StoreInfoCardKey = (typeof STORE_INFO_CARD_KEYS)[number];

export interface StoreInfoCard {
  enabled: boolean;
  title: string;
  /** Short bullet points, e.g. "Delivery within 2-5 business days". */
  points: string[];
}

export interface StoreInfoSettings {
  enabled: boolean;
  email: string;
  phone: string;
  address: string;
  shipping_policy: StoreInfoCard;
  return_policy: StoreInfoCard;
  cod_policy: StoreInfoCard;
}

function resolveStoreInfoCard(raw: unknown): StoreInfoCard {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: c.enabled !== false,
    title: text(c.title),
    points: Array.isArray(c.points) ? (c.points as unknown[]).map((p) => (typeof p === "string" ? p : "")) : [],
  };
}

export function resolveStoreInfo(stored: unknown): StoreInfoSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return {
    enabled: s.enabled === true,
    email: text(s.email),
    phone: text(s.phone),
    address: text(s.address),
    shipping_policy: resolveStoreInfoCard(s.shipping_policy),
    return_policy: resolveStoreInfoCard(s.return_policy),
    cod_policy: resolveStoreInfoCard(s.cod_policy),
  };
}

export async function storeDesignSaveStoreInfo(
  client: ApiClient,
  workspaceId: string,
  info: StoreInfoSettings
): Promise<Workspace> {
  const card = (c: StoreInfoCard) => ({
    enabled: c.enabled,
    title: c.title.trim(),
    points: c.points.map((p) => p.trim()).filter(Boolean).slice(0, 8),
  });
  const { workspace } = await client.request<{ workspace: Workspace }>("/workspaces/" + workspaceId, {
    method: "PATCH",
    body: {
      settings: {
        store_info: {
          enabled: info.enabled,
          email: info.email.trim() || null,
          phone: info.phone.trim() || null,
          address: info.address.trim() || null,
          shipping_policy: card(info.shipping_policy),
          return_policy: card(info.return_policy),
          cod_policy: card(info.cod_policy),
        },
      },
    },
  });
  return workspace;
}

export const LEGAL_POLICY_KEYS = ["refund_policy", "privacy_policy", "terms_of_service"] as const;
export type LegalPolicyKey = (typeof LEGAL_POLICY_KEYS)[number];
/** Plain text; {{store.name}}, {{store.address}}, {{store.email}}, {{store.phone}} are filled in when served. */
export type LegalSettings = Record<LegalPolicyKey, string>;

export function resolveLegal(stored: unknown): LegalSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return {
    refund_policy: typeof s.refund_policy === "string" ? s.refund_policy : "",
    privacy_policy: typeof s.privacy_policy === "string" ? s.privacy_policy : "",
    terms_of_service: typeof s.terms_of_service === "string" ? s.terms_of_service : "",
  };
}

export async function storeDesignSaveLegal(
  client: ApiClient,
  workspaceId: string,
  legal: LegalSettings
): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>("/workspaces/" + workspaceId, {
    method: "PATCH",
    body: { settings: { legal } },
  });
  return workspace;
}

/** GET /store/:workspaceId `storeInfo` — null while the merchant has it off. */
export interface StorefrontStoreInfo {
  email: string;
  phone: string;
  address: string;
  cards: Array<{ key: StoreInfoCardKey; title: string; points: string[] }>;
}

/** GET /store/:workspaceId `navPages` — published, active pages flagged for the header or footer. */
export interface StorefrontNavPage {
  path: string;
  title: string;
  showInHeader: boolean;
  showInFooter: boolean;
}

/** The lane-5 additions to GET /store/:workspaceId, read defensively from the meta object. */
export function storefrontDesignMeta(store: unknown): {
  storeInfo: StorefrontStoreInfo | null;
  legal: LegalPolicyKey[];
  navPages: StorefrontNavPage[];
} {
  const s = (store && typeof store === "object" ? store : {}) as Record<string, unknown>;
  const info = s.storeInfo && typeof s.storeInfo === "object" ? (s.storeInfo as StorefrontStoreInfo) : null;
  return {
    storeInfo: info && Array.isArray(info.cards) ? info : null,
    legal: Array.isArray(s.legal)
      ? (s.legal as unknown[]).filter((k): k is LegalPolicyKey => LEGAL_POLICY_KEYS.includes(k as LegalPolicyKey))
      : [],
    navPages: Array.isArray(s.navPages) ? (s.navPages as StorefrontNavPage[]) : [],
  };
}

/** One legal policy as the shopper reads it (public; 404 when the store has not written it). */
export async function storefrontPolicy(
  client: ApiClient,
  workspaceId: string,
  key: string
): Promise<{ key: LegalPolicyKey; content: string }> {
  const { policy } = await client.request<{ policy: { key: LegalPolicyKey; content: string } }>(
    "/store/" + workspaceId + "/policies/" + encodeURIComponent(key),
    { auth: false }
  );
  return policy;
}

// ---------------------------------------------------------- page flags ----
// Backend: src/modules/pages/pageFlags.js — live switches on a website page.

export interface StoreDesignPageRow {
  id: string;
  websiteId: string;
  path: string;
  title: string;
  pageType: string;
  isLive: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  isActive: boolean;
}

export async function storeDesignListPages(
  client: ApiClient,
  workspaceId: string,
  websiteId: string
): Promise<StoreDesignPageRow[]> {
  const { pages } = await client.request<{ pages: StoreDesignPageRow[] }>(
    "/workspaces/" + workspaceId + "/websites/" + websiteId + "/pages"
  );
  return pages;
}

export async function storeDesignUpdatePageFlags(
  client: ApiClient,
  workspaceId: string,
  websiteId: string,
  pageId: string,
  flags: Partial<Pick<StoreDesignPageRow, "showInHeader" | "showInFooter" | "isActive">>
): Promise<StoreDesignPageRow> {
  const { page } = await client.request<{ page: StoreDesignPageRow }>(
    "/workspaces/" + workspaceId + "/websites/" + websiteId + "/pages/" + pageId,
    { method: "PATCH", body: flags }
  );
  return page;
}

// ------------------------------------- general settings and store SEO ----
// Backend: src/modules/storefront/generalSettings.js. Four settings blobs,
// each sent whole through PATCH /workspaces/:workspaceId.

export const SOCIAL_LINK_KEYS = ["facebook", "instagram", "tiktok", "whatsapp", "youtube", "snapchat", "x"] as const;
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];

export interface GeneralStoreSettings {
  favicon_url: string;
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  country: string;
  social_links: Record<SocialLinkKey, string>;
  floating_whatsapp: { enabled: boolean; phone: string; message: string };
}

export function resolveGeneralStoreSettings(settings: unknown): GeneralStoreSettings {
  const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
  const general = (s.general ?? {}) as Record<string, unknown>;
  const links = (s.social_links ?? {}) as Record<string, unknown>;
  const wa = (s.floating_whatsapp ?? {}) as Record<string, unknown>;
  return {
    favicon_url: text(general.favicon_url),
    country: text(general.country),
    social_links: Object.fromEntries(SOCIAL_LINK_KEYS.map((key) => [key, text(links[key])])) as Record<
      SocialLinkKey,
      string
    >,
    floating_whatsapp: { enabled: wa.enabled === true, phone: text(wa.phone), message: text(wa.message) },
  };
}

export async function storeDesignSaveGeneral(
  client: ApiClient,
  workspaceId: string,
  draft: GeneralStoreSettings
): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>("/workspaces/" + workspaceId, {
    method: "PATCH",
    body: {
      settings: {
        general: { favicon_url: draft.favicon_url.trim() || null, country: draft.country.trim() || null },
        social_links: Object.fromEntries(SOCIAL_LINK_KEYS.map((key) => [key, draft.social_links[key].trim() || null])),
        floating_whatsapp: {
          enabled: draft.floating_whatsapp.enabled,
          phone: draft.floating_whatsapp.phone.replace(/[\s-]/g, "") || null,
          message: draft.floating_whatsapp.message.trim() || null,
        },
      },
    },
  });
  return workspace;
}

export interface StoreSeoSettings {
  /** "%s" stands for the page's own title, e.g. "%s | My store". */
  title_template: string;
  description: string;
  og_image_url: string;
  google_site_verification: string;
}

export function resolveStoreSeo(stored: unknown): StoreSeoSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return {
    title_template: text(s.title_template),
    description: text(s.description),
    og_image_url: text(s.og_image_url),
    google_site_verification: text(s.google_site_verification),
  };
}

export async function storeDesignSaveSeo(
  client: ApiClient,
  workspaceId: string,
  seo: StoreSeoSettings
): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>("/workspaces/" + workspaceId, {
    method: "PATCH",
    body: {
      settings: {
        store_seo: {
          title_template: seo.title_template.trim() || null,
          description: seo.description.trim() || null,
          og_image_url: seo.og_image_url.trim() || null,
          google_site_verification: seo.google_site_verification.trim() || null,
        },
      },
    },
  });
  return workspace;
}

/** The general-settings additions to GET /store/:workspaceId, read defensively. */
export interface StorefrontGeneralMeta {
  general: { faviconUrl: string | null; country: string | null };
  social: Partial<Record<SocialLinkKey, string>>;
  floatingWhatsapp: { phone: string; message: string } | null;
  seo: {
    titleTemplate: string | null;
    description: string | null;
    ogImageUrl: string | null;
    googleSiteVerification: string | null;
  };
}

export function storefrontGeneralMeta(store: unknown): StorefrontGeneralMeta {
  const s = (store && typeof store === "object" ? store : {}) as Record<string, unknown>;
  const general = (s.general ?? {}) as Record<string, unknown>;
  const seo = (s.seo ?? {}) as Record<string, unknown>;
  const wa = s.floatingWhatsapp as { phone?: unknown; message?: unknown } | null | undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const social: Partial<Record<SocialLinkKey, string>> = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const url = str(((s.social ?? {}) as Record<string, unknown>)[key]);
    // Only http(s) ever reaches an href.
    if (url && /^https?:\/\//i.test(url)) social[key] = url;
  }
  return {
    general: { faviconUrl: str(general.faviconUrl), country: str(general.country) },
    social,
    floatingWhatsapp: wa && str(wa.phone) ? { phone: str(wa.phone) as string, message: text(wa.message) } : null,
    seo: {
      titleTemplate: str(seo.titleTemplate),
      description: str(seo.description),
      ogImageUrl: str(seo.ogImageUrl),
      googleSiteVerification: str(seo.googleSiteVerification),
    },
  };
}

/** Every public path of a store (GET /store/:workspaceId/sitemap). */
export async function storefrontSitemap(
  client: ApiClient,
  workspaceId: string
): Promise<Array<{ path: string; updatedAt: string | null }>> {
  const { entries } = await client.request<{ entries: Array<{ path: string; updatedAt: string | null }> }>(
    "/store/" + workspaceId + "/sitemap",
    { auth: false }
  );
  return entries;
}

// --------------------------------------------------- custom code slots ----
// Backend: src/modules/customCode. /workspaces/:workspaceId/custom-code
// (website.publish, every edit audited) and the public /store/:ws/custom-code.

export const CUSTOM_CODE_SLOTS = [
  "above_header",
  "below_header",
  "above_gallery",
  "below_gallery",
  "above_form",
  "below_form",
  "above_footer",
  "below_footer",
  "head",
  "css",
  "js",
] as const;
export type CustomCodeSlotKey = (typeof CUSTOM_CODE_SLOTS)[number];
export const CUSTOM_CODE_MAX_LENGTH = 50000;

export interface CustomCodeSlot {
  slot: CustomCodeSlotKey;
  html: string;
  isActive: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function storeDesignListCustomCode(client: ApiClient, workspaceId: string): Promise<CustomCodeSlot[]> {
  const { slots } = await client.request<{ slots: CustomCodeSlot[] }>("/workspaces/" + workspaceId + "/custom-code");
  return slots;
}

export async function storeDesignSaveCustomCode(
  client: ApiClient,
  workspaceId: string,
  slot: CustomCodeSlotKey,
  payload: { html: string; isActive: boolean }
): Promise<CustomCodeSlot> {
  const { slot: saved } = await client.request<{ slot: CustomCodeSlot }>(
    "/workspaces/" + workspaceId + "/custom-code/" + slot,
    { method: "PUT", body: payload }
  );
  return saved;
}

/** The live store's active slots as { slot: code }; empty for a staff preview. */
export async function storefrontCustomCode(
  client: ApiClient,
  workspaceId: string
): Promise<Partial<Record<CustomCodeSlotKey, string>>> {
  const { slots } = await client.request<{ slots: Partial<Record<CustomCodeSlotKey, string>> }>(
    "/store/" + workspaceId + "/custom-code",
    { auth: false }
  );
  return slots ?? {};
}

// ------------------------------------------------------------- domains ----
// Backend: src/modules/domains (domainsService.js + domainSettings.js),
// under /workspaces/:workspaceId/domains — permission domain.manage.
// Codes: DOMAIN_TAKEN (409), STORE_NOT_SET_UP (409), DOMAIN_NOT_VERIFIED
// (400 on verify, 409 on primary / certificate), FUNNEL_NOT_PUBLISHED (409),
// CERTIFICATE_PROVIDER_ERROR (502), NO_COUNTERPART (422), COUNTERPART_CONNECTED (409).
//
// Root domains and www (domains/rootDomains.js): a root domain takes A records
// (or an ALIAS where the DNS provider has one) instead of a CNAME, and a root
// or its www can have the other one — its counterpart — sent to it.

export type StoreDomainStatus = "pending_verification" | "verified" | "active" | "failed";
export type StoreDomainSslStatus = "none" | "pending" | "issued" | "failed";

export interface StoreDomainRecord {
  type: "TXT" | "CNAME" | "A" | "ALIAS";
  name: string;
  value: string;
  ttl: number;
  /** "redirect": the counterpart's record (www / root sent to this domain). */
  purpose: "verification" | "routing" | "redirect";
}

/** The www / root counterpart of a root domain or of its www. */
export interface StoreDomainCounterpart {
  hostname: string;
  /** Visits to it go to this domain, same path. */
  redirect: boolean;
  sslStatus: StoreDomainSslStatus;
  records: StoreDomainRecord[];
  alternatives?: StoreDomainRecord[];
}

export interface StoreDomain {
  id: string;
  hostname: string;
  status: StoreDomainStatus;
  verifiedAt: string | null;
  isPrimary: boolean;
  sslStatus: StoreDomainSslStatus;
  sslProvider: string | null;
  sslCheckedAt: string | null;
  homeFunnel: { id: string; name: string; status: string } | null;
  records: StoreDomainRecord[];
  /** A root domain (example.com), which takes A records or an ALIAS rather than a CNAME. */
  isRoot?: boolean;
  /** Instead of the A records, where the DNS provider has it: an ALIAS / ANAME (CNAME flattening). */
  alternatives?: StoreDomainRecord[];
  counterpart?: StoreDomainCounterpart | null;
}

export interface StoreDomainsOverview {
  domains: StoreDomain[];
  /** What a merchant's CNAME points at. */
  cnameTarget: string;
  /** The certificate provider in use ("sandbox" until a real one is configured), or null. */
  certificateProvider: string | null;
}

export interface StoreDomainDnsCheck {
  hostname: string;
  txt: { expected: string; found: boolean; values: string[] };
  cname: { expected: string; found: boolean; values: string[] };
  /** The routing record, whichever kind the host takes. */
  routing?: { kind: "A" | "ALIAS" | "CNAME"; expected: string[]; found: boolean; values: string[] };
  counterpart?: { hostname: string; kind: "A" | "ALIAS" | "CNAME"; expected: string[]; found: boolean; values: string[] } | null;
  checkedAt: string;
}

const domainsBase = (workspaceId: string) => "/workspaces/" + workspaceId + "/domains";

export function storeDesignDomainsOverview(client: ApiClient, workspaceId: string): Promise<StoreDomainsOverview> {
  return client.request<StoreDomainsOverview>(domainsBase(workspaceId) + "/overview");
}

export async function storeDesignAddDomain(client: ApiClient, workspaceId: string, hostname: string): Promise<void> {
  await client.request(domainsBase(workspaceId), { method: "POST", body: { hostname } });
}

/** Looks for the TXT record now; rejects with DOMAIN_NOT_VERIFIED when it is not there yet. */
export async function storeDesignVerifyDomain(client: ApiClient, workspaceId: string, domainId: string): Promise<void> {
  await client.request(domainsBase(workspaceId) + "/" + domainId + "/verify", { method: "POST" });
}

/** Requests the certificate (first call) or asks the provider where it stands. */
export function storeDesignCheckDomainSsl(
  client: ApiClient,
  workspaceId: string,
  domainId: string
): Promise<{ domain: StoreDomain; detail: string | null }> {
  return client.request<{ domain: StoreDomain; detail: string | null }>(
    domainsBase(workspaceId) + "/" + domainId + "/ssl/check",
    { method: "POST" }
  );
}

export async function storeDesignUpdateDomain(
  client: ApiClient,
  workspaceId: string,
  domainId: string,
  patch: { isPrimary?: boolean; homeFunnelId?: string | null; redirectCounterpart?: boolean }
): Promise<StoreDomain> {
  const { domain } = await client.request<{ domain: StoreDomain }>(domainsBase(workspaceId) + "/" + domainId, {
    method: "PATCH",
    body: patch,
  });
  return domain;
}

export async function storeDesignDomainDnsCheck(
  client: ApiClient,
  workspaceId: string,
  domainId: string
): Promise<StoreDomainDnsCheck> {
  const { dns } = await client.request<{ dns: StoreDomainDnsCheck }>(
    domainsBase(workspaceId) + "/" + domainId + "/dns-check"
  );
  return dns;
}

export async function storeDesignDeleteDomain(client: ApiClient, workspaceId: string, domainId: string): Promise<void> {
  await client.request(domainsBase(workspaceId) + "/" + domainId, { method: "DELETE" });
}

// ------------------------------------------------------ saved sections ----
// Backend: src/modules/savedSections — /workspaces/:workspaceId/saved-sections
// (website.edit). A page section with `settings.savedSectionId` is a linked
// copy: publishing the website fills it from the saved section.

export const SAVED_SECTION_LINK_KEY = "savedSectionId";

export interface SavedSectionDto {
  id: string;
  name: string;
  type: string | null;
  scope: "global" | "funnel";
  funnelId: string | null;
  /** One page-tree section node. */
  tree: import("../types").PageSection;
  updatedAt: string;
}

const savedSectionsBase = (workspaceId: string) => "/workspaces/" + workspaceId + "/saved-sections";

export async function storeDesignListSavedSections(
  client: ApiClient,
  workspaceId: string,
  funnelId?: string
): Promise<SavedSectionDto[]> {
  const { savedSections } = await client.request<{ savedSections: SavedSectionDto[] }>(
    savedSectionsBase(workspaceId) + (funnelId ? "?funnelId=" + encodeURIComponent(funnelId) : "")
  );
  return savedSections;
}

export async function storeDesignCreateSavedSection(
  client: ApiClient,
  workspaceId: string,
  payload: { name: string; type?: string; scope?: "global" | "funnel"; funnelId?: string; section: import("../types").PageSection }
): Promise<SavedSectionDto> {
  const { savedSection } = await client.request<{ savedSection: SavedSectionDto }>(savedSectionsBase(workspaceId), {
    method: "POST",
    body: payload,
  });
  return savedSection;
}

export async function storeDesignUpdateSavedSection(
  client: ApiClient,
  workspaceId: string,
  sectionId: string,
  patch: { name?: string; type?: string; section?: import("../types").PageSection }
): Promise<SavedSectionDto> {
  const { savedSection } = await client.request<{ savedSection: SavedSectionDto }>(
    savedSectionsBase(workspaceId) + "/" + sectionId,
    { method: "PATCH", body: patch }
  );
  return savedSection;
}

export async function storeDesignDeleteSavedSection(client: ApiClient, workspaceId: string, sectionId: string): Promise<void> {
  await client.request(savedSectionsBase(workspaceId) + "/" + sectionId, { method: "DELETE" });
}

// --------------------------------------------- languages and translations ----
// Backend: src/modules/translations — /workspaces/:workspaceId/translations
// (website.edit). The store's extra languages are `settings.store_languages`
// (PATCH /workspaces/:workspaceId). The storefront names the shopper's language
// with the X-Store-Locale header and gets products and collections translated.

export const STORE_LOCALES = ["ar", "en", "fr", "es", "it", "de"] as const;
export type StoreLocale = (typeof STORE_LOCALES)[number];
export type TranslatableEntity = "product" | "collection";

export interface TranslationsOverview {
  defaultLocale: StoreLocale;
  available: StoreLocale[];
  /** How many names and descriptions there are to translate. */
  totalFields: number;
  languages: Array<{ locale: StoreLocale; isDefault: boolean; translatedFields: number; percent: number }>;
}

export interface TranslationItem {
  entityType: TranslatableEntity;
  entityId: string;
  /** The original text, in the store's own language. */
  source: { name: string; description: string };
  /** The translation in the requested language; "" where there is none. */
  translation: { name: string; description: string };
}

export function translationsOverview(client: ApiClient, workspaceId: string): Promise<TranslationsOverview> {
  return client.request<TranslationsOverview>("/workspaces/" + workspaceId + "/translations/overview");
}

export async function translationsList(
  client: ApiClient,
  workspaceId: string,
  entityType: TranslatableEntity,
  locale: StoreLocale
): Promise<TranslationItem[]> {
  const { items } = await client.request<{ items: TranslationItem[] }>(
    "/workspaces/" + workspaceId + "/translations?entityType=" + entityType + "&locale=" + locale
  );
  return items;
}

/** Saves one item's fields in one language; an empty field goes back to the original. */
export async function translationsSave(
  client: ApiClient,
  workspaceId: string,
  payload: { entityType: TranslatableEntity; entityId: string; locale: StoreLocale; fields: Partial<Record<"name" | "description", string>> }
): Promise<TranslationItem | null> {
  const { item } = await client.request<{ item: TranslationItem | null }>("/workspaces/" + workspaceId + "/translations", {
    method: "PUT",
    body: payload,
  });
  return item;
}

/** Which languages the store offers besides its own (sent whole). */
export async function storeDesignSaveLanguages(client: ApiClient, workspaceId: string, languages: StoreLocale[]): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>("/workspaces/" + workspaceId, {
    method: "PATCH",
    body: { settings: { store_languages: languages } },
  });
  return workspace;
}
