/**
 * Seed data for the admin mock layer. Everything here is demo data for the
 * internal console — names use example.com addresses and documentation IP
 * ranges (RFC 5737) so nothing points at a real person.
 */
import type { Workspace } from "@store-builder/api-client";
import type {
  AdminUser,
  Announcement,
  AuditEntry,
  BlocklistEntry,
  FeatureFlag,
  FraudSignal,
  MarketplaceApp,
  Plan,
  Provider,
  ServiceTile,
  Supplier,
  Template,
  Ticket,
  WorkspaceMeta,
} from "./types";
import { between, daysAgo, daysFromNow, hashString, hoursAgo, pick, rng, slugify } from "./store";

const FIRST = ["Ahmed", "Mona", "Omar", "Sara", "Youssef", "Nour", "Karim", "Laila", "Hassan", "Mariam", "Tarek", "Salma", "Khaled", "Hana", "Amr", "Dina"];
const LAST = ["Hassan", "Mahmoud", "Farouk", "Saeed", "Nasser", "Adel", "Fathy", "Kamal", "Rashad", "Zaki", "Mansour", "Haddad"];

export const DEMO_WORKSPACE_NAMES = [
  "Nile Threads", "Souq Al Madina", "Cairo Kicks", "Delta Organics", "Luxor Home", "Alex Beauty Lab",
  "Red Sea Gear", "Giza Gadgets", "Zamalek Florals", "Maadi Pets", "Aswan Crafts", "Heliopolis Books",
  "Riyadh Oud House", "Jeddah Modest Wear", "Dubai Tech Hub", "Sharjah Sweets", "Kuwait Fit Store", "Amman Coffee Co",
  "Casablanca Leather", "Marrakech Rugs", "Tanta Kids", "Mansoura Mobile", "Port Said Marine", "Sohag Dates",
];

const COUNTRY_BY_INDEX = ["EG", "EG", "EG", "EG", "EG", "EG", "EG", "EG", "EG", "EG", "EG", "EG", "SA", "SA", "AE", "AE", "KW", "JO", "MA", "MA", "EG", "EG", "EG", "EG"];

export function seedDemoWorkspaces(): Workspace[] {
  return DEMO_WORKSPACE_NAMES.map((name, i) => ({
    id: `demo-ws-${i + 1}`,
    name,
    slug: slugify(name),
    createdAt: daysAgo(Math.round((i * 97) % 180) + (i < 5 ? 0 : 3), 10),
    ownerUserId: `demo-user-${i + 1}`,
    defaultCurrency: COUNTRY_BY_INDEX[i] === "SA" ? "SAR" : COUNTRY_BY_INDEX[i] === "AE" ? "AED" : "EGP",
    status: "active",
  }));
}

export function seedPlans(): Plan[] {
  const created = daysAgo(300);
  return [
    {
      id: "plan_starter",
      name: "Starter",
      code: "starter",
      monthlyPrice: 299,
      yearlyPrice: 2990,
      trialDays: 14,
      orderQuota: 300,
      transactionFeeBp: 150,
      codFeeBp: 100,
      features: ["custom_domain", "abandoned_cart"],
      active: true,
      createdAt: created,
      updatedAt: daysAgo(40),
    },
    {
      id: "plan_growth",
      name: "Growth",
      code: "growth",
      monthlyPrice: 799,
      yearlyPrice: 7990,
      trialDays: 14,
      orderQuota: 2000,
      transactionFeeBp: 100,
      codFeeBp: 75,
      features: ["custom_domain", "abandoned_cart", "funnels", "whatsapp_confirmation", "staff_accounts", "advanced_analytics"],
      active: true,
      createdAt: created,
      updatedAt: daysAgo(40),
    },
    {
      id: "plan_scale",
      name: "Scale",
      code: "scale",
      monthlyPrice: 1999,
      yearlyPrice: 19990,
      trialDays: 14,
      orderQuota: null,
      transactionFeeBp: 50,
      codFeeBp: 50,
      features: [
        "custom_domain", "abandoned_cart", "funnels", "whatsapp_confirmation", "staff_accounts",
        "advanced_analytics", "multi_warehouse", "api_access", "remove_branding", "priority_support",
      ],
      active: true,
      createdAt: created,
      updatedAt: daysAgo(12),
    },
  ];
}

/** Deterministic enrichment for any workspace id (real or demo). */
export function generateMeta(ws: Workspace, planIds: string[], index = 0): WorkspaceMeta {
  const rand = rng(hashString(ws.id));
  const first = pick(rand, FIRST);
  const last = pick(rand, LAST);
  const roll = rand();
  const status: WorkspaceMeta["subscriptionStatus"] =
    roll < 0.55 ? "active" : roll < 0.76 ? "trialing" : roll < 0.9 ? "past_due" : "canceled";
  const orders30 = status === "canceled" ? between(rand, 0, 40) : between(rand, 40, 2400);
  const avgOrder = between(rand, 180, 900);
  const deliveryRate = between(rand, 58, 92);
  const rtoRate = Math.max(2, 100 - deliveryRate - between(rand, 0, 8));
  const slug = ws.slug || slugify(ws.name);
  const country = index < COUNTRY_BY_INDEX.length && ws.id.startsWith("demo-") ? COUNTRY_BY_INDEX[index] : pick(rand, ["EG", "EG", "EG", "SA", "AE", "KW", "JO", "MA"]);
  const hasDomain = rand() > 0.35;
  const created = ws.createdAt;
  const ownerEmail = `${first}.${last}`.toLowerCase() + "@example.com";

  return {
    workspaceId: ws.id,
    planId: pick(rand, planIds.length ? planIds : ["plan_starter"]),
    subscriptionStatus: status,
    billingCycle: rand() > 0.75 ? "yearly" : "monthly",
    trialEndsAt: status === "trialing" ? daysFromNow(between(rand, 1, 13)) : null,
    nextBillingAt: status === "active" || status === "past_due" ? daysFromNow(between(rand, -3, 28)) : null,
    lastPaymentFailedAt: status === "past_due" ? daysAgo(between(rand, 1, 6)) : null,
    canceledAt: status === "canceled" ? daysAgo(between(rand, 2, 40)) : null,
    ownerName: `${first} ${last}`,
    ownerEmail,
    country,
    ordersAllTime: null,
    ordersLast30d: orders30,
    ordersToday: Math.round(orders30 / 30 + rand() * 6),
    gmvLast30d: orders30 * avgOrder,
    deliveryRate,
    rtoRate,
    suspended: rand() < 0.05,
    suspendedReason: null,
    members: [
      { id: `${ws.id}-m1`, name: `${first} ${last}`, email: ownerEmail, role: "owner", lastActiveAt: hoursAgo(between(rand, 1, 60)) },
      ...Array.from({ length: between(rand, 0, 3) }, (_, i) => {
        const f = pick(rand, FIRST);
        const l = pick(rand, LAST);
        return {
          id: `${ws.id}-m${i + 2}`,
          name: `${f} ${l}`,
          email: `${f}.${l}`.toLowerCase() + `+${slug}@example.com`,
          role: (i === 0 ? "admin" : "staff") as "admin" | "staff",
          lastActiveAt: rand() > 0.2 ? hoursAgo(between(rand, 2, 400)) : null,
        };
      }),
    ],
    membersKnown: true,
    domainsKnown: true,
    domains: [
      {
        id: `${ws.id}-d0`,
        hostname: `${slug}.zimos.store`,
        verified: true,
        ssl: "active",
        addedAt: created,
        lastCheckedAt: hoursAgo(3),
      },
      ...(hasDomain
        ? [
            {
              id: `${ws.id}-d1`,
              hostname: `www.${slug}.example`,
              verified: rand() > 0.3,
              ssl: (rand() > 0.3 ? "active" : "pending") as "active" | "pending",
              addedAt: daysAgo(between(rand, 1, 60)),
              lastCheckedAt: hoursAgo(between(rand, 1, 30)),
            },
          ]
        : []),
    ],
  };
}

export function seedTemplates(): Template[] {
  const rows: Array<[string, Template["kind"], string, number, string, boolean, boolean]> = [
    ["Aurora", "store", "Fashion", 0, "#0066FF", true, true],
    ["Bazaar", "store", "General", 0, "#0B1F66", true, true],
    ["Glow", "store", "Beauty", 499, "#66C2FF", true, true],
    ["Circuit", "store", "Electronics", 699, "#0052D6", false, true],
    ["One Product Funnel", "funnel", "General", 0, "#0066FF", true, true],
    ["COD Upsell Funnel", "funnel", "General", 299, "#0B1F66", true, false],
    ["Launch Page", "landing", "General", 0, "#3D8BFF", true, true],
    ["Ramadan Offer", "landing", "Food", 199, "#0B1F66", true, false],
  ];
  return rows.map(([name, kind, category, price, primaryColor, rtl, published], i) => ({
    id: `tpl_${slugify(name)}`,
    name,
    kind,
    category,
    price,
    free: price === 0,
    primaryColor,
    rtl,
    published,
    versions: [
      { id: `tpl_${i}_v1`, version: "1.0.0", notes: "Initial release.", createdAt: daysAgo(160 - i * 5) },
      ...(i % 2 === 0 ? [{ id: `tpl_${i}_v2`, version: "1.1.0", notes: "Mobile header and RTL spacing fixes.", createdAt: daysAgo(30 - i) }] : []),
    ],
    createdAt: daysAgo(160 - i * 5),
    updatedAt: daysAgo(30 - i),
  }));
}

export function seedSuppliers(): Supplier[] {
  const rows: Array<[string, string, string, string[], number, Supplier["status"]]> = [
    ["Cairo Cotton Mills", "EG", "Cairo", ["Fashion", "Home"], 142, "pending"],
    ["Delta Beauty Supplies", "EG", "Mansoura", ["Beauty"], 88, "pending"],
    ["Gulf Electronics Trading", "AE", "Dubai", ["Electronics"], 310, "pending"],
    ["Alexandria Home Goods", "EG", "Alexandria", ["Home"], 64, "approved"],
    ["Najd Perfumes", "SA", "Riyadh", ["Beauty"], 51, "approved"],
    ["Atlas Leather Works", "MA", "Fes", ["Fashion"], 37, "approved"],
    ["Quick Gadgets Wholesale", "EG", "Giza", ["Electronics"], 12, "rejected"],
    ["Levant Pantry", "JO", "Amman", ["Food"], 73, "pending"],
    ["Kids Corner Supply", "EG", "Tanta", ["Kids", "Toys"], 45, "approved"],
    ["Sinai Natural Oils", "EG", "El Tor", ["Beauty", "Food"], 19, "pending"],
  ];
  return rows.map(([name, country, city, categories, productsCount, status], i) => {
    const rand = rng(hashString(name));
    const first = pick(rand, FIRST);
    const last = pick(rand, LAST);
    return {
      id: `sup_${slugify(name)}`,
      name,
      contactName: `${first} ${last}`,
      email: `partners+${slugify(name)}@example.com`,
      phone: `+20 10${between(rand, 10, 99)} ${between(rand, 100, 999)} ${between(rand, 1000, 9999)}`,
      country,
      city,
      categories,
      productsCount,
      description: `${name} applied to list wholesale ${categories.join(" and ").toLowerCase()} products for merchants to import.`,
      status,
      submittedAt: daysAgo(i * 3 + 1),
      reviewedAt: status === "pending" ? null : daysAgo(i * 2),
      reviewedBy: status === "pending" ? null : "Mona Adel",
      rejectionReason: status === "rejected" ? "Product images and descriptions did not meet listing guidelines." : null,
    };
  });
}

export function seedApps(): MarketplaceApp[] {
  const rows: Array<[string, string, string, MarketplaceApp["status"], number]> = [
    ["Meta Pixel", "Marketing", "Send storefront events to a Meta pixel.", "live", 1840],
    ["TikTok Pixel", "Marketing", "Send storefront events to a TikTok pixel.", "live", 960],
    ["Google Sheets Orders", "Productivity", "Append new orders to a Google Sheet.", "live", 1210],
    ["WhatsApp Confirmation", "Customer service", "Confirm COD orders over WhatsApp before shipping.", "beta", 430],
    ["Reviews", "Marketing", "Collect and display product reviews.", "beta", 215],
    ["Shipping Label Printer", "Shipping", "Bulk-print carrier labels from the orders list.", "live", 780],
    ["Cohort Reports", "Analytics", "Retention and repeat-purchase cohorts.", "hidden", 0],
    ["Live Chat", "Customer service", "Chat widget for the storefront.", "hidden", 12],
  ];
  return rows.map(([name, category, description, status, installs], i) => ({
    id: `app_${slugify(name)}`,
    name,
    slug: slugify(name),
    category,
    description,
    status,
    installs,
    createdAt: daysAgo(200 - i * 10),
    updatedAt: daysAgo(i * 4 + 2),
  }));
}

export function seedProviders(): Provider[] {
  const base = (p: Partial<Provider> & Pick<Provider, "kind" | "name" | "code" | "region">, i: number): Provider => ({
    id: `prv_${p.kind}_${p.code}`,
    health: "operational",
    lastCheckAt: hoursAgo(0.1 + i * 0.05),
    latencyMs: 180 + i * 37,
    errorRate24h: 0.4,
    lastError: null,
    enabled: true,
    credentialStatus: "configured",
    credentialUpdatedAt: daysAgo(20 + i * 9),
    workspacesUsing: 40 + i * 13,
    phoneNumber: null,
    qualityRating: null,
    ...p,
  });
  return [
    base({ kind: "carrier", name: "Bosta", code: "bosta", region: "Egypt", workspacesUsing: 184 }, 0),
    base({ kind: "carrier", name: "Aramex", code: "aramex", region: "MENA", health: "degraded", latencyMs: 2400, errorRate24h: 7.8, lastError: "Timeout creating shipment (504 from upstream)." }, 1),
    base({ kind: "carrier", name: "J&T Express", code: "jt", region: "Egypt, Saudi Arabia" }, 2),
    base({ kind: "carrier", name: "Mylerz", code: "mylerz", region: "Egypt", health: "down", latencyMs: 0, errorRate24h: 61.2, lastError: "Authentication failed: 401 Unauthorized.", credentialStatus: "expired" }, 3),
    base({ kind: "carrier", name: "SMSA Express", code: "smsa", region: "Saudi Arabia", enabled: false, credentialStatus: "missing", credentialUpdatedAt: null, workspacesUsing: 0 }, 4),
    base({ kind: "payment", name: "Paymob", code: "paymob", region: "Egypt", workspacesUsing: 212 }, 0),
    base({ kind: "payment", name: "Fawry", code: "fawry", region: "Egypt" }, 1),
    base({ kind: "payment", name: "Kashier", code: "kashier", region: "Egypt", health: "degraded", latencyMs: 1650, errorRate24h: 3.1, lastError: "Elevated webhook delivery delays." }, 2),
    base({ kind: "payment", name: "Tap Payments", code: "tap", region: "GCC" }, 3),
    base({ kind: "payment", name: "Stripe", code: "stripe", region: "UAE", enabled: false, credentialStatus: "missing", credentialUpdatedAt: null, workspacesUsing: 0 }, 4),
    base({ kind: "whatsapp", name: "Order confirmations — EG", code: "wa_confirm_eg", region: "Egypt", phoneNumber: "+20 100 000 4821", qualityRating: "high", workspacesUsing: 290 }, 0),
    base({ kind: "whatsapp", name: "Order confirmations — KSA", code: "wa_confirm_sa", region: "Saudi Arabia", phoneNumber: "+966 50 000 1177", qualityRating: "medium", health: "degraded", errorRate24h: 4.2, lastError: "Message template rate limit reached." }, 1),
    base({ kind: "whatsapp", name: "Platform notifications", code: "wa_platform", region: "Global", phoneNumber: "+20 101 000 9034", qualityRating: "high" }, 2),
    base({ kind: "whatsapp", name: "Support line", code: "wa_support", region: "Global", phoneNumber: "+20 102 000 5560", qualityRating: "low", enabled: false, credentialStatus: "expired" }, 3),
  ];
}

export function seedFraudSignals(): FraudSignal[] {
  const rand = rng(424242);
  const phones = ["+20 100 555 0142", "+20 111 555 0199", "+20 122 555 0107", "+20 106 555 0163", "+966 55 555 0134", "+20 101 555 0178", "+20 128 555 0120", "+971 50 555 0111"];
  const ips = ["203.0.113.24", "198.51.100.77", "203.0.113.190", "192.0.2.51", "198.51.100.5", "192.0.2.200"];
  const make = (type: FraudSignal["type"], value: string, i: number): FraudSignal => {
    const stores = between(rand, 2, 9);
    const orders = stores * between(rand, 2, 6);
    const names = Array.from({ length: stores }, (_, k) => DEMO_WORKSPACE_NAMES[(i * 5 + k * 3) % DEMO_WORKSPACE_NAMES.length]);
    return {
      id: `sig_${type}_${i}`,
      type,
      value,
      storesCount: stores,
      ordersCount: orders,
      rtoCount: Math.round(orders * (0.4 + rand() * 0.5)),
      workspaceNames: Array.from(new Set(names)),
      firstSeenAt: daysAgo(between(rand, 10, 90)),
      lastSeenAt: hoursAgo(between(rand, 1, 120)),
      blocked: i === 2 && type === "phone",
    };
  };
  return [...phones.map((p, i) => make("phone", p, i)), ...ips.map((p, i) => make("ip", p, i))];
}

export function seedBlocklist(): BlocklistEntry[] {
  return [
    { id: "blk_1", type: "phone", value: "+20 122 555 0107", reason: "Refused delivery at 7 stores in 30 days.", createdBy: "Mona Adel", createdAt: daysAgo(12), expiresAt: null },
    { id: "blk_2", type: "ip", value: "192.0.2.14", reason: "Scripted checkout attempts across stores.", createdBy: "Karim Nasser", createdAt: daysAgo(20), expiresAt: daysFromNow(10) },
    { id: "blk_3", type: "email", value: "fake.orders@example.com", reason: "Repeated fake COD orders.", createdBy: "Mona Adel", createdAt: daysAgo(33), expiresAt: null },
    { id: "blk_4", type: "phone", value: "+20 109 555 0188", reason: "Chargeback abuse reported by payment provider.", createdBy: "Salma Kamal", createdAt: daysAgo(51), expiresAt: daysFromNow(40) },
  ];
}

export function seedAdminUsers(): AdminUser[] {
  return [
    { id: "adm_1", name: "Mona Adel", email: "mona.adel@example.com", role: "super_admin", status: "active", mfaEnabled: true, lastActiveAt: hoursAgo(1), invitedAt: daysAgo(400) },
    { id: "adm_2", name: "Karim Nasser", email: "karim.nasser@example.com", role: "ops", status: "active", mfaEnabled: true, lastActiveAt: hoursAgo(5), invitedAt: daysAgo(300) },
    { id: "adm_3", name: "Salma Kamal", email: "salma.kamal@example.com", role: "finance", status: "active", mfaEnabled: false, lastActiveAt: hoursAgo(26), invitedAt: daysAgo(210) },
    { id: "adm_4", name: "Youssef Zaki", email: "youssef.zaki@example.com", role: "support", status: "active", mfaEnabled: true, lastActiveAt: hoursAgo(2), invitedAt: daysAgo(150) },
    { id: "adm_5", name: "Hana Rashad", email: "hana.rashad@example.com", role: "support", status: "invited", mfaEnabled: false, lastActiveAt: null, invitedAt: daysAgo(2) },
    { id: "adm_6", name: "Tarek Fathy", email: "tarek.fathy@example.com", role: "ops", status: "disabled", mfaEnabled: false, lastActiveAt: daysAgo(90), invitedAt: daysAgo(380) },
  ];
}

export function seedTickets(): Ticket[] {
  const rows: Array<[string, number, Ticket["priority"], Ticket["status"], string | null, string]> = [
    ["Orders not syncing to Bosta", 6, "urgent", "open", "adm_4", "Since this morning new orders are not being pushed to Bosta. We have around 40 orders waiting."],
    ["Custom domain stuck on pending SSL", 1, "high", "pending", "adm_4", "I connected www domain two days ago and SSL still shows pending."],
    ["Charged twice for subscription", 13, "high", "open", null, "My card was charged twice for this month's plan. Please refund one of the charges."],
    ["How to add a second warehouse?", 3, "low", "resolved", "adm_5", "Where do I add another warehouse location for Alexandria?"],
    ["WhatsApp confirmations not sending", 14, "normal", "open", null, "Customers say they are not receiving the confirmation message."],
    ["Template RTL layout broken on mobile", 12, "normal", "pending", "adm_4", "On the Aurora template the header overlaps the logo in Arabic on phones."],
    ["Request to export all customers", 8, "low", "closed", "adm_5", "Is there a way to export the full customer list to CSV?"],
    ["Paymob payouts delayed", 0, "high", "open", "adm_3", "Payouts from last week haven't reached our bank account yet."],
    ["Cannot invite staff member", 20, "normal", "open", null, "When I invite my colleague the email never arrives."],
  ];
  return rows.map(([subject, wsIndex, priority, status, assigneeId, body], i) => {
    const rand = rng(hashString(subject));
    const f = pick(rand, FIRST);
    const l = pick(rand, LAST);
    const created = hoursAgo(between(rand, 2, 240));
    const messages: Ticket["messages"] = [
      { id: `tm_${i}_1`, authorType: "merchant", authorName: `${f} ${l}`, body, internal: false, createdAt: created },
    ];
    if (status !== "open" || i % 2 === 0) {
      messages.push({
        id: `tm_${i}_2`,
        authorType: "admin",
        authorName: "Youssef Zaki",
        body: "Thanks for reaching out — we're looking into this now and will update you here.",
        internal: false,
        createdAt: new Date(new Date(created).getTime() + 3_600_000).toISOString(),
      });
    }
    if (status === "resolved" || status === "closed") {
      messages.push({
        id: `tm_${i}_3`,
        authorType: "merchant",
        authorName: `${f} ${l}`,
        body: "That worked, thank you!",
        internal: false,
        createdAt: new Date(new Date(created).getTime() + 7_200_000).toISOString(),
      });
    }
    return {
      id: `tkt_${1040 + i}`,
      number: 1040 + i,
      subject,
      workspaceId: `demo-ws-${wsIndex + 1}`,
      workspaceName: DEMO_WORKSPACE_NAMES[wsIndex],
      requesterName: `${f} ${l}`,
      requesterEmail: `${f}.${l}`.toLowerCase() + "@example.com",
      priority,
      status,
      assigneeId,
      createdAt: created,
      updatedAt: messages[messages.length - 1].createdAt,
      messages,
    };
  });
}

export function seedAnnouncements(): Announcement[] {
  return [
    {
      id: "ann_1",
      title: "Scheduled maintenance",
      body: "The dashboard will be read-only for up to 20 minutes during scheduled database maintenance.",
      severity: "warning",
      audience: "all",
      planId: null,
      workspaceId: null,
      workspaceName: null,
      startsAt: daysFromNow(3, 1),
      endsAt: daysFromNow(3, 3),
      dismissible: false,
      createdBy: "Karim Nasser",
      createdAt: daysAgo(1),
    },
    {
      id: "ann_2",
      title: "New: WhatsApp order confirmation",
      body: "Growth and Scale workspaces can now enable WhatsApp confirmation for COD orders from Settings.",
      severity: "info",
      audience: "plan",
      planId: "plan_growth",
      workspaceId: null,
      workspaceName: null,
      startsAt: daysAgo(4),
      endsAt: daysFromNow(10),
      dismissible: true,
      createdBy: "Mona Adel",
      createdAt: daysAgo(5),
    },
    {
      id: "ann_3",
      title: "Carrier delays",
      body: "Some shipments created through Aramex may show delayed status updates.",
      severity: "warning",
      audience: "all",
      planId: null,
      workspaceId: null,
      workspaceName: null,
      startsAt: daysAgo(20),
      endsAt: daysAgo(17),
      dismissible: true,
      createdBy: "Karim Nasser",
      createdAt: daysAgo(20),
    },
  ];
}

export function seedFlags(): FeatureFlag[] {
  const rows: Array<[string, string, boolean, number, string[]]> = [
    ["checkout.one_page_v2", "New single-page checkout.", true, 25, ["demo-ws-1", "demo-ws-3"]],
    ["orders.whatsapp_confirmation", "WhatsApp confirmation flow for COD orders.", true, 100, []],
    ["funnels.upsell_builder", "Post-purchase upsell step in funnels.", true, 10, ["demo-ws-6"]],
    ["analytics.cohorts", "Cohort retention reports.", false, 0, []],
    ["storefront.ai_descriptions", "Generated product description suggestions.", false, 0, ["demo-ws-2"]],
    ["shipping.auto_carrier_selection", "Pick the carrier with the best delivery rate per governorate.", true, 50, []],
    ["billing.yearly_plans", "Offer yearly billing in plan picker.", true, 100, []],
    ["risk.shared_blocklist", "Apply the global blocklist at checkout.", true, 75, []],
  ];
  return rows.map(([key, description, enabled, rollout, targetWorkspaceIds], i) => ({
    id: `flag_${i + 1}`,
    key,
    description,
    enabled,
    rollout,
    targetWorkspaceIds,
    createdAt: daysAgo(120 - i * 9),
    updatedAt: daysAgo(i * 3 + 1),
  }));
}

export function seedServices(): ServiceTile[] {
  return [
    { id: "svc_db", name: "Database", description: "Primary PostgreSQL cluster", status: "operational", latencyMs: 4, uptime30d: 99.99, lastCheckAt: hoursAgo(0.02), lastIncidentAt: daysAgo(41), lastIncidentSummary: "Failover to replica during maintenance window (3 min)." },
    { id: "svc_queue", name: "Redis queue", description: "Background jobs and webhooks", status: "operational", latencyMs: 2, uptime30d: 99.97, lastCheckAt: hoursAgo(0.02), lastIncidentAt: daysAgo(9), lastIncidentSummary: "Webhook backlog after carrier outage, drained in 25 min." },
    { id: "svc_email", name: "Email", description: "Transactional email delivery", status: "operational", latencyMs: 210, uptime30d: 99.9, lastCheckAt: hoursAgo(0.05), lastIncidentAt: daysAgo(18), lastIncidentSummary: "Provider throttling raised bounce retries." },
    { id: "svc_sms", name: "SMS", description: "OTP and order notifications", status: "degraded", latencyMs: 1800, uptime30d: 99.2, lastCheckAt: hoursAgo(0.05), lastIncidentAt: hoursAgo(3), lastIncidentSummary: "Delayed delivery on one Egyptian network." },
    { id: "svc_whatsapp", name: "WhatsApp", description: "Business messaging API", status: "operational", latencyMs: 340, uptime30d: 99.6, lastCheckAt: hoursAgo(0.05), lastIncidentAt: daysAgo(2), lastIncidentSummary: "Template rate limit on the KSA number." },
    { id: "svc_storage", name: "Storage", description: "Media uploads and exports", status: "operational", latencyMs: 60, uptime30d: 100, lastCheckAt: hoursAgo(0.03), lastIncidentAt: null, lastIncidentSummary: null },
  ];
}

export function seedAudit(): AuditEntry[] {
  const rand = rng(777);
  const actors = seedAdminUsers().filter((a) => a.status !== "invited");
  const templates: Array<{ action: string; entityType: string; label: (ws: string) => string; before: unknown; after: unknown; ws: boolean }> = [
    { action: "workspace.plan_changed", entityType: "subscription", label: (ws) => `${ws} subscription`, before: { planId: "plan_starter", billingCycle: "monthly" }, after: { planId: "plan_growth", billingCycle: "monthly" }, ws: true },
    { action: "subscription.trial_extended", entityType: "subscription", label: (ws) => `${ws} subscription`, before: { trialEndsAt: daysFromNow(1) }, after: { trialEndsAt: daysFromNow(8) }, ws: true },
    { action: "subscription.marked_paid", entityType: "subscription", label: (ws) => `${ws} subscription`, before: { status: "past_due" }, after: { status: "active" }, ws: true },
    { action: "workspace.suspended", entityType: "workspace", label: (ws) => ws, before: { suspended: false }, after: { suspended: true, reason: "Chargeback investigation" }, ws: true },
    { action: "workspace.unsuspended", entityType: "workspace", label: (ws) => ws, before: { suspended: true }, after: { suspended: false }, ws: true },
    { action: "plan.updated", entityType: "plan", label: () => "Growth", before: { transactionFeeBp: 120 }, after: { transactionFeeBp: 100 }, ws: false },
    { action: "template.published", entityType: "template", label: () => "Glow", before: { published: false }, after: { published: true }, ws: false },
    { action: "supplier.approved", entityType: "supplier", label: () => "Najd Perfumes", before: { status: "pending" }, after: { status: "approved" }, ws: false },
    { action: "blocklist.entry_added", entityType: "blocklist_entry", label: () => "+20 122 555 0107", before: null, after: { type: "phone", value: "+20 122 555 0107" }, ws: false },
    { action: "feature_flag.updated", entityType: "feature_flag", label: () => "checkout.one_page_v2", before: { rollout: 10 }, after: { rollout: 25 }, ws: false },
    { action: "provider.disabled", entityType: "provider", label: () => "SMSA Express", before: { enabled: true }, after: { enabled: false }, ws: false },
    { action: "ticket.replied", entityType: "ticket", label: () => "#1041", before: null, after: { status: "pending" }, ws: true },
  ];
  return Array.from({ length: 48 }, (_, i) => {
    const t = pick(rand, templates);
    const actor = pick(rand, actors);
    const wsIndex = between(rand, 0, DEMO_WORKSPACE_NAMES.length - 1);
    const wsName = DEMO_WORKSPACE_NAMES[wsIndex];
    return {
      id: `aud_seed_${i}`,
      actorName: actor.name,
      actorEmail: actor.email,
      action: t.action,
      entityType: t.entityType,
      entityId: t.ws ? `demo-ws-${wsIndex + 1}` : `${t.entityType}_${i}`,
      entityLabel: t.label(wsName),
      workspaceId: t.ws ? `demo-ws-${wsIndex + 1}` : null,
      workspaceName: t.ws ? wsName : null,
      ip: `198.51.100.${between(rand, 2, 250)}`,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      createdAt: hoursAgo(i * 7 + between(rand, 0, 5)),
      before: t.before,
      after: t.after,
    };
  });
}

/** Deterministic daily/monthly series for the overview charts. */
export function seedSeries(days: number, seed: number, min: number, max: number) {
  const rand = rng(seed);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const trend = 1 + i / days / 2;
    return {
      label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      value: Math.round((min + rand() * (max - min)) * trend),
    };
  });
}
