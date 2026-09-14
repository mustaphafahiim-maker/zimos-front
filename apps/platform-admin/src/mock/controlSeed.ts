/** Deterministic seed data for controlApi.ts. */
import { between, daysAgo, daysFromNow, hashString, hoursAgo, pick, rng, uid } from "./store";
import type { AdminRole, AdminWorkspace } from "./types";
import type {
  ApiKey,
  BackgroundJob,
  BackupSnapshot,
  ChangelogPost,
  CmsContent,
  CronSchedule,
  DataExportRequest,
  FaqEntry,
  IntegrationDefault,
  Invoice,
  LegalDoc,
  MessageTemplate,
  ModerationReport,
  Payout,
  PermissionKey,
  PlatformSettings,
  PlatformUser,
  Refund,
  RoleMatrix,
  WebhookDelivery,
  WebhookEndpoint,
  WorkspaceControl,
} from "./controlTypes";

export const EGYPT_GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia", "Gharbia", "Monufia", "Beheira", "Kafr El Sheikh",
  "Damietta", "Port Said", "Ismailia", "Suez", "Faiyum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena",
  "Luxor", "Aswan", "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai",
];

export const PERMISSIONS: Array<{ key: PermissionKey; label: string; group: string }> = [
  { key: "workspaces.view", label: "View workspaces", group: "Merchants" },
  { key: "workspaces.manage", label: "Manage workspaces (limits, storefront, suspend)", group: "Merchants" },
  { key: "subscriptions.manage", label: "Change plans, trials, discounts", group: "Merchants" },
  { key: "users.manage", label: "Manage platform users", group: "Merchants" },
  { key: "impersonate", label: "Log in as merchant", group: "Merchants" },
  { key: "finance.view", label: "View revenue & invoices", group: "Finance" },
  { key: "finance.payouts", label: "Approve / hold payouts, refunds", group: "Finance" },
  { key: "risk.manage", label: "Fraud, blocklist, KYC", group: "Risk" },
  { key: "moderation.manage", label: "Moderation queue actions", group: "Risk" },
  { key: "support.manage", label: "Tickets & announcements", group: "Support" },
  { key: "content.manage", label: "Marketing site CMS", group: "Support" },
  { key: "settings.manage", label: "Global settings & templates", group: "System" },
  { key: "system.jobs", label: "Retry / cancel jobs, cron", group: "System" },
  { key: "system.backups", label: "Snapshots & restores", group: "System" },
  { key: "admins.manage", label: "Admin users & roles", group: "System" },
];

export const WEBHOOK_EVENTS = [
  "workspace.created", "workspace.suspended", "subscription.updated", "subscription.past_due",
  "invoice.paid", "payout.approved", "order.created", "moderation.report_created",
];

export const API_SCOPES = ["workspaces:read", "workspaces:write", "billing:read", "billing:write", "users:read", "audit:read"];

export function seedRoleMatrix(): RoleMatrix {
  const all = PERMISSIONS.map((p) => p.key);
  const permissions: Record<AdminRole, PermissionKey[]> = {
    super_admin: all,
    support: ["workspaces.view", "users.manage", "support.manage", "content.manage", "impersonate"],
    finance: ["workspaces.view", "subscriptions.manage", "finance.view", "finance.payouts"],
    ops: ["workspaces.view", "workspaces.manage", "risk.manage", "moderation.manage", "system.jobs", "system.backups"],
    read_only: ["workspaces.view", "finance.view"],
  };
  return { permissions, require2fa: true, updatedAt: daysAgo(12) };
}

export function seedControl(ws: AdminWorkspace): WorkspaceControl {
  const rand = rng(hashString(`ctl-${ws.id}`));
  const kycRoll = rand();
  const kycStatus = kycRoll < 0.55 ? "approved" : kycRoll < 0.75 ? "pending" : kycRoll < 0.85 ? "rejected" : "not_submitted";
  const carriers = ["Bosta", "Aramex", "J&T Express", "Mylerz"];
  const settlements = Array.from({ length: 4 }, (_, i) => {
    const cod = Math.round((ws.meta.gmvLast30d / 4) * (0.7 + rand() * 0.4));
    return {
      id: `${ws.id}-st${i}`,
      carrier: pick(rand, carriers),
      codCollected: cod,
      fees: Math.round(cod * 0.035),
      status: (i === 0 ? (rand() < 0.2 ? "held" : "pending") : "settled") as "pending" | "settled" | "held",
      periodEnd: daysAgo(i * 7 + 1),
    };
  });
  const score = Math.min(99, Math.round(ws.meta.rtoRate * 1.6 + rand() * 25));
  return {
    workspaceId: ws.id,
    limitOverrides: {},
    featureOverrides: {},
    compMonths: 0,
    discount: null,
    storeStatus: ws.meta.suspended ? "suspended" : "live",
    maintenanceMessage: "",
    themeResetAt: null,
    payoutHold: settlements[0].status === "held",
    payoutHoldReason: settlements[0].status === "held" ? "Pending chargeback review" : null,
    balance: Math.round(settlements.filter((s) => s.status !== "settled").reduce((s, x) => s + x.codCollected - x.fees, 0)),
    adjustments: [],
    settlements,
    fraudScore: score,
    blocked: false,
    blockedReason: null,
    kycStatus,
    kycHistory:
      kycStatus === "not_submitted"
        ? []
        : [{ id: uid("kyc"), status: "pending", note: "Commercial register & national ID uploaded.", actorName: ws.meta.ownerName, createdAt: daysAgo(between(rand, 5, 40)) }],
    notes:
      rand() < 0.5
        ? [{ id: uid("note"), body: "Owner prefers WhatsApp contact. Asked about bulk import in onboarding call.", authorName: "Mona Adel", pinned: true, createdAt: daysAgo(between(rand, 2, 30)) }]
        : [],
    deletionScheduledAt: null,
    forcedLogoutAt: null,
    lastExportAt: null,
  };
}

export function seedUsers(rows: AdminWorkspace[]): PlatformUser[] {
  const map = new Map<string, PlatformUser>();
  rows.forEach((ws) => {
    ws.meta.members.forEach((m) => {
      const key = m.email.toLowerCase();
      const rand = rng(hashString(key));
      const existing = map.get(key);
      if (existing) {
        existing.workspaces.push({ id: ws.id, name: ws.name, role: m.role });
        return;
      }
      const roll = rand();
      map.set(key, {
        id: `usr_${hashString(key).toString(36)}`,
        name: m.name,
        email: m.email,
        phone: rand() > 0.3 ? `+20 10${between(rand, 10000000, 99999999)}` : null,
        status: roll < 0.85 ? "active" : roll < 0.95 ? "pending" : "suspended",
        emailVerified: roll < 0.85,
        platformAdmin: false,
        createdAt: ws.createdAt,
        lastLoginAt: m.lastActiveAt,
        workspaces: [{ id: ws.id, name: ws.name, role: m.role }],
        passwordResetSentAt: null,
      });
    });
  });
  const list = [...map.values()];
  list.unshift({
    id: "usr_demo",
    name: "Demo Merchant",
    email: "demo@zimos.test",
    phone: null,
    status: "active",
    emailVerified: true,
    platformAdmin: false,
    createdAt: daysAgo(60),
    lastLoginAt: hoursAgo(1),
    workspaces: rows.slice(0, 1).map((w) => ({ id: w.id, name: w.name, role: "owner" })),
    passwordResetSentAt: null,
  });
  list.push(
    { id: "usr_pend1", name: "Karim Nabil", email: "karim.nabil@example.com", phone: "+20 1001234567", status: "pending", emailVerified: false, platformAdmin: false, createdAt: hoursAgo(20), lastLoginAt: null, workspaces: [], passwordResetSentAt: null },
    { id: "usr_ops", name: "Mona Adel", email: "mona@zimos.io", phone: null, status: "active", emailVerified: true, platformAdmin: true, createdAt: daysAgo(300), lastLoginAt: hoursAgo(3), workspaces: [], passwordResetSentAt: null }
  );
  return list;
}

export function seedSettings(defaultPlanId: string): PlatformSettings {
  return {
    platform: {
      name: "ZIMOS",
      supportEmail: "support@zimos.io",
      supportPhone: "+20 2 2345 6789",
      supportWhatsapp: "+20 100 555 0101",
      defaultCurrency: "EGP",
      defaultLocale: "ar",
      timezone: "Africa/Cairo",
      maintenanceMode: false,
      maintenanceMessage: "ZIMOS is getting an upgrade. We'll be back within 30 minutes.",
      maintenanceAllowlist: ["41.33.0.10"],
    },
    signup: { allowSignups: true, requireEmailVerification: true, defaultTrialDays: 14, defaultPlanId, allowedCountries: ["EG", "SA", "AE", "KW", "JO", "MA"] },
    commerce: { defaultCodFee: 15, minOrderValue: 50, maxOrderValue: 25000, returnWindowDays: 14, governorates: [...EGYPT_GOVERNORATES] },
    localization: { enabledLocales: ["ar", "en"], defaultLocale: "ar" },
    updatedAt: daysAgo(4),
  };
}

export function seedLegal(): LegalDoc[] {
  const mk = (id: LegalDoc["id"], title: string, body: string): LegalDoc => ({
    id,
    title,
    body,
    version: 2,
    updatedAt: daysAgo(20),
    history: [
      { version: 1, body: `# ${title}\n\nInitial version.`, publishedAt: daysAgo(200), publishedBy: "Mona Adel" },
      { version: 2, body, publishedAt: daysAgo(20), publishedBy: "Mona Adel" },
    ],
  });
  return [
    mk("terms", "Terms of service", "# Terms of service\n\nBy creating a ZIMOS store you agree to these terms.\n\n## Accounts\n\n- You are responsible for your account.\n- **Cash on delivery** orders must be fulfilled honestly.\n\n## Fees\n\nPlan fees are billed monthly or yearly."),
    mk("privacy", "Privacy policy", "# Privacy policy\n\nWe process merchant and shopper data to run the platform.\n\n## Data we collect\n\n- Account details\n- Order and delivery details"),
    mk("refund", "Refund policy", "# Refund policy\n\nSubscription fees are refundable within **7 days** of the first charge."),
  ];
}

export function seedMessageTemplates(): MessageTemplate[] {
  const t = (id: string, name: string, channel: MessageTemplate["channel"], description: string, variables: string[], en: [string, string], ar: [string, string]): MessageTemplate => ({
    id, name, channel, description, variables, en: { subject: en[0], body: en[1] }, ar: { subject: ar[0], body: ar[1] }, updatedAt: daysAgo(9),
  });
  return [
    t("order_confirmation", "Order confirmation", "email", "Sent to shoppers when an order is placed.", ["customer_name", "order_number", "order_total", "store_name"],
      ["Order {{order_number}} confirmed", "Hi {{customer_name}},\n\nThanks for your order from {{store_name}}. Total: {{order_total}} (cash on delivery)."],
      ["تم تأكيد طلبك {{order_number}}", "أهلاً {{customer_name}}،\n\nشكراً لطلبك من {{store_name}}. الإجمالي: {{order_total}} (الدفع عند الاستلام)."]),
    t("order_shipped", "Order shipped", "sms", "Sent when the carrier picks up the parcel.", ["customer_name", "order_number", "tracking_url", "carrier"],
      ["", "{{customer_name}}, order {{order_number}} shipped with {{carrier}}: {{tracking_url}}"],
      ["", "{{customer_name}}، طلبك {{order_number}} خرج للشحن مع {{carrier}}: {{tracking_url}}"]),
    t("otp", "One-time password", "sms", "Login and phone verification code.", ["code", "minutes"],
      ["", "Your ZIMOS code is {{code}}. It expires in {{minutes}} minutes."],
      ["", "رمز ZIMOS الخاص بك هو {{code}}. صالح لمدة {{minutes}} دقائق."]),
    t("password_reset", "Password reset", "email", "Merchant requested a password reset.", ["name", "reset_url"],
      ["Reset your ZIMOS password", "Hi {{name}},\n\nUse this link to reset your password: {{reset_url}}"],
      ["إعادة تعيين كلمة المرور", "أهلاً {{name}}،\n\nاستخدم هذا الرابط لإعادة تعيين كلمة المرور: {{reset_url}}"]),
    t("team_invite", "Team invite", "email", "Invite a staff member to a workspace.", ["inviter_name", "store_name", "invite_url"],
      ["{{inviter_name}} invited you to {{store_name}}", "Join {{store_name}} on ZIMOS: {{invite_url}}"],
      ["{{inviter_name}} دعاك للانضمام إلى {{store_name}}", "انضم إلى {{store_name}} على ZIMOS: {{invite_url}}"]),
  ];
}

export const SAMPLE_VARIABLES: Record<string, string> = {
  customer_name: "Ahmed Hassan", order_number: "#10482", order_total: "EGP 1,250", store_name: "Nile Threads",
  tracking_url: "https://track.zimos.io/10482", carrier: "Bosta", code: "482913", minutes: "10", name: "Sara",
  reset_url: "https://app.zimos.io/reset/abc", inviter_name: "Omar", invite_url: "https://app.zimos.io/invite/xyz",
};

export function seedApiKeys(): ApiKey[] {
  return [
    { id: uid("key"), name: "Finance BI export", prefix: "zk_live_4f2a", scopes: ["billing:read", "workspaces:read"], createdAt: daysAgo(90), createdBy: "Mona Adel", lastUsedAt: hoursAgo(5), revokedAt: null },
    { id: uid("key"), name: "Old Zapier sync", prefix: "zk_live_91cd", scopes: ["workspaces:read"], createdAt: daysAgo(400), createdBy: "Youssef Samir", lastUsedAt: daysAgo(120), revokedAt: daysAgo(100) },
  ];
}

export function seedWebhooks(): WebhookEndpoint[] {
  return [
    { id: "wh_slack", url: "https://hooks.slack.example/zimos-ops", description: "Ops Slack channel", events: ["workspace.suspended", "subscription.past_due", "moderation.report_created"], enabled: true, createdAt: daysAgo(60) },
    { id: "wh_crm", url: "https://crm.example.com/zimos/webhook", description: "CRM sync", events: ["workspace.created", "subscription.updated"], enabled: true, createdAt: daysAgo(30) },
  ];
}

export function seedDeliveries(): WebhookDelivery[] {
  const rand = rng(77);
  return Array.from({ length: 18 }, (_, i) => {
    const ep = i % 2 === 0 ? "wh_slack" : "wh_crm";
    return {
      id: `whd_${i}`,
      endpointId: ep,
      event: pick(rand, ep === "wh_slack" ? ["workspace.suspended", "subscription.past_due"] : ["workspace.created", "subscription.updated"]),
      statusCode: rand() < 0.85 ? 200 : pick(rand, [500, 502, 408]),
      durationMs: between(rand, 80, 1400),
      createdAt: hoursAgo(i * 3 + 1),
    };
  });
}

export function seedIntegrations(): IntegrationDefault[] {
  const i = (kind: IntegrationDefault["kind"], name: string, code: string, enabled: boolean, description: string): IntegrationDefault => ({ id: `int_${code}`, kind, name, code, enabled, description });
  return [
    i("carrier", "Bosta", "bosta", true, "Egypt-wide COD delivery"),
    i("carrier", "Aramex", "aramex", true, "GCC & Egypt"),
    i("carrier", "J&T Express", "jnt", true, "Egypt & KSA"),
    i("carrier", "Mylerz", "mylerz", false, "Egypt, same-day in Cairo"),
    i("gateway", "Paymob", "paymob", true, "Cards, wallets, Fawry"),
    i("gateway", "Kashier", "kashier", false, "Cards & installments"),
    i("gateway", "Tap Payments", "tap", true, "GCC cards, mada, Apple Pay"),
    i("messaging", "WhatsApp Cloud API", "whatsapp", true, "Order confirmation & OTP"),
    i("messaging", "Twilio SMS", "twilio", true, "SMS fallback"),
    i("messaging", "Vodafone SMS", "vodafone_sms", false, "Local sender IDs"),
  ];
}

export function seedInvoices(rows: AdminWorkspace[]): Invoice[] {
  const out: Invoice[] = [];
  let n = 1040;
  rows.forEach((ws) => {
    if (!ws.plan || ws.plan.monthlyPrice === 0) return;
    const months = ws.meta.subscriptionStatus === "trialing" ? 0 : 3;
    for (let m = months - 1; m >= 0; m--) {
      const status: Invoice["status"] = m === 0 && ws.meta.subscriptionStatus === "past_due" ? "open" : "paid";
      const amount = ws.meta.billingCycle === "yearly" ? Math.round(ws.plan.yearlyPrice / 12) : ws.plan.monthlyPrice;
      out.push({
        id: `inv_${ws.id}_${m}`,
        number: `ZIM-${n++}`,
        workspaceId: ws.id,
        workspaceName: ws.name,
        planName: ws.plan.name,
        amount,
        status,
        periodStart: daysAgo((m + 1) * 30),
        periodEnd: daysAgo(m * 30),
        issuedAt: daysAgo(m * 30 + 1),
        paidAt: status === "paid" ? daysAgo(m * 30) : null,
      });
    }
  });
  return out.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function seedRefunds(): Refund[] {
  return [];
}

export function seedPayouts(rows: AdminWorkspace[]): Payout[] {
  return rows
    .filter((w) => w.meta.ordersLast30d > 100)
    .slice(0, 10)
    .map((w, i) => {
      const cod = Math.round(w.meta.gmvLast30d / 4);
      const fees = Math.round(cod * 0.035);
      return {
        id: `po_${w.id}`,
        workspaceId: w.id,
        workspaceName: w.name,
        codCollected: cod,
        fees,
        amount: cod - fees,
        status: (i < 5 ? "pending" : i < 7 ? "paid" : i === 7 ? "held" : "approved") as Payout["status"],
        requestedAt: hoursAgo(i * 9 + 2),
        decidedAt: i >= 5 ? hoursAgo(i * 4) : null,
        note: i === 7 ? "Held: RTO spike under review" : null,
      };
    });
}

export function seedCms(planIds: string[]): CmsContent {
  return {
    announcementBar: { enabled: true, textAr: "جرّب ZIMOS مجاناً لمدة 14 يوماً", textEn: "Try ZIMOS free for 14 days", link: "/signup" },
    hero: {
      titleAr: "ابدأ متجرك للدفع عند الاستلام في دقائق",
      titleEn: "Launch your cash-on-delivery store in minutes",
      subtitleAr: "تأكيد الطلبات عبر واتساب، شحن مع أفضل الشركات، وتحصيل مضمون.",
      subtitleEn: "WhatsApp order confirmation, top carriers, and reliable COD settlement.",
      ctaAr: "ابدأ مجاناً",
      ctaEn: "Start free",
    },
    planDisplay: planIds.map((planId, i) => ({ planId, visible: true, highlighted: i === 1 })),
    updatedAt: daysAgo(6),
  };
}

export function seedFaq(): FaqEntry[] {
  return [
    { id: "faq_1", questionEn: "Do I need a company to sign up?", questionAr: "هل أحتاج شركة للتسجيل؟", answerEn: "No. Individuals can start; KYC is required before payouts.", answerAr: "لا. يمكن للأفراد البدء، والتحقق مطلوب قبل التحويلات.", published: true, order: 1 },
    { id: "faq_2", questionEn: "Which carriers are supported?", questionAr: "ما شركات الشحن المدعومة؟", answerEn: "Bosta, Aramex, J&T and more.", answerAr: "بوسطة وأرامكس وJ&T وغيرها.", published: true, order: 2 },
    { id: "faq_3", questionEn: "When do I receive COD money?", questionAr: "متى أستلم أموال الدفع عند الاستلام؟", answerEn: "Weekly, after carrier settlement.", answerAr: "أسبوعياً بعد تسوية شركة الشحن.", published: false, order: 3 },
  ];
}

export function seedChangelog(): ChangelogPost[] {
  return [
    { id: "cl_1", title: "WhatsApp order confirmation v2", body: "Confirm orders with one tap buttons and auto-cancel after 24h.", tag: "feature", published: true, publishedAt: daysAgo(5), createdAt: daysAgo(6) },
    { id: "cl_2", title: "Faster checkout on slow networks", body: "Checkout page is now 40% lighter.", tag: "improvement", published: true, publishedAt: daysAgo(18), createdAt: daysAgo(18) },
    { id: "cl_3", title: "Upcoming: Morocco carriers", body: "Draft — do not publish yet.", tag: "news", published: false, publishedAt: null, createdAt: daysAgo(1) },
  ];
}

export function seedReports(rows: AdminWorkspace[]): ModerationReport[] {
  const rand = rng(991);
  const reasons: ModerationReport["reason"][] = ["counterfeit", "prohibited_item", "scam", "offensive", "ip_infringement", "misleading"];
  const products = ["Replica Rolex Submariner", "Weight-loss miracle pills", "Nike Air Jordan 1 (AAA)", "Unlicensed IPTV box", "Herbal cure-all oil", "Fake designer bag"];
  return rows.slice(0, 8).map((ws, i) => {
    const isStore = i % 3 === 0;
    return {
      id: `rep_${i}`,
      targetType: isStore ? "storefront" : "product",
      targetName: isStore ? ws.name : pick(rand, products),
      workspaceId: ws.id,
      workspaceName: ws.name,
      reason: pick(rand, reasons),
      details: isStore ? "Shoppers report never receiving orders after paying the courier." : "Listing appears to violate the prohibited items policy.",
      reporterEmail: `shopper${i + 1}@example.com`,
      previewUrl: `https://${ws.slug}.zimos.store${isStore ? "" : "/products/" + i}`,
      reportsCount: between(rand, 1, 9),
      status: i < 6 ? "open" : "dismissed",
      createdAt: hoursAgo(i * 11 + 1),
      resolvedAt: i < 6 ? null : hoursAgo(i * 5),
      resolvedBy: i < 6 ? null : "Mona Adel",
    };
  });
}

export function seedJobs(): BackgroundJob[] {
  const rand = rng(4242);
  const types: Array<[BackgroundJob["type"], string]> = [
    ["email_send", "Order confirmation email"],
    ["carrier_sync", "Bosta status sync"],
    ["settlement_import", "Aramex COD settlement import"],
    ["webhook_delivery", "Webhook → crm.example.com"],
  ];
  const stores = ["Nile Threads", "Cairo Glow", "Desert Tech", null];
  return Array.from({ length: 22 }, (_, i) => {
    const [type, label] = types[i % types.length];
    const roll = rand();
    const status: BackgroundJob["status"] = roll < 0.55 ? "succeeded" : roll < 0.7 ? "failed" : roll < 0.82 ? "running" : "queued";
    return {
      id: `job_${1000 + i}`,
      type,
      label,
      workspaceName: pick(rand, stores),
      status,
      attempts: status === "failed" ? 5 : status === "queued" ? 0 : between(rand, 1, 2),
      maxAttempts: 5,
      lastError: status === "failed" ? pick(rand, ["ETIMEDOUT carrier API", "SMTP 421 rate limited", "Endpoint returned 502", "CSV row 88: invalid AWB"]) : null,
      createdAt: hoursAgo(i * 2 + 1),
      updatedAt: hoursAgo(i * 2),
    };
  });
}

export function seedCron(): CronSchedule[] {
  return [
    { id: "cron_trials", name: "Expire stale trials", expression: "0 3 * * *", description: "billingService.expireStaleTrials", enabled: true, lastRunAt: hoursAgo(9), lastStatus: "succeeded", nextRunAt: daysFromNow(1, 3) },
    { id: "cron_carrier", name: "Carrier status sync", expression: "*/15 * * * *", description: "Poll carrier APIs for shipment updates", enabled: true, lastRunAt: hoursAgo(0.2), lastStatus: "succeeded", nextRunAt: new Date(Date.now() + 600_000).toISOString() },
    { id: "cron_settle", name: "COD settlement import", expression: "0 6 * * 1", description: "Import weekly carrier settlements", enabled: true, lastRunAt: daysAgo(3, 6), lastStatus: "failed", nextRunAt: daysFromNow(4, 6) },
    { id: "cron_backup", name: "Nightly database backup", expression: "30 1 * * *", description: "pg_dump snapshot to object storage", enabled: true, lastRunAt: hoursAgo(11), lastStatus: "succeeded", nextRunAt: daysFromNow(1, 1) },
    { id: "cron_abandoned", name: "Abandoned cart reminders", expression: "0 * * * *", description: "WhatsApp nudges for abandoned carts", enabled: false, lastRunAt: daysAgo(10), lastStatus: "succeeded", nextRunAt: null },
  ];
}

export function seedSnapshots(): BackupSnapshot[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `snap_${i}`,
    label: `Nightly ${new Date(daysAgo(i, 1)).toISOString().slice(0, 10)}`,
    kind: "automatic" as const,
    sizeMb: 4200 - i * 35,
    status: (i === 3 ? "failed" : "completed") as BackupSnapshot["status"],
    createdAt: daysAgo(i, 1),
    createdBy: "system",
    restoredAt: null,
  }));
}

export function seedExportRequests(rows: AdminWorkspace[]): DataExportRequest[] {
  return rows.slice(2, 6).map((ws, i) => ({
    id: `exp_${i}`,
    workspaceId: ws.id,
    workspaceName: ws.name,
    requestedBy: ws.meta.ownerEmail,
    scope: (["full", "orders", "customers", "products"] as const)[i % 4],
    status: (i < 2 ? "pending" : i === 2 ? "processing" : "ready") as DataExportRequest["status"],
    createdAt: hoursAgo(i * 14 + 3),
    completedAt: i === 3 ? hoursAgo(2) : null,
  }));
}
