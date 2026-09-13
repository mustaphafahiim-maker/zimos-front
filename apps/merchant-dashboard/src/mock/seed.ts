import { daysAgo, uid } from "./store";
import type {
  AbandonedCheckout,
  AnalyticsOverview,
  AppIntegration,
  Automation,
  BlockedEntry,
  CamouflageSettings,
  Carrier,
  CarrierAccount,
  CheckoutSettings,
  ConversionOffer,
  CurrencySetting,
  DailyPoint,
  DomainRecord,
  Experiment,
  FlaggedOrder,
  FraudSettings,
  Funnel,
  InventoryRow,
  PaymentGateway,
  PlanInfo,
  StaffMember,
  StoreTemplate,
  TrackingPixel,
} from "./types";

// Deterministic pseudo-random so the demo looks the same on every reload.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const DEMO_PRODUCTS = [
  { id: "p-1", name: "سماعة بلوتوث لاسلكية Pro", price: 89900 },
  { id: "p-2", name: "ساعة ذكية Fit Band 5", price: 129900 },
  { id: "p-3", name: "طقم أواني طهي 12 قطعة", price: 249900 },
  { id: "p-4", name: "عطر عود ملكي 100ml", price: 69900 },
  { id: "p-5", name: "حامل موبايل للسيارة", price: 19900 },
  { id: "p-6", name: "لمبة LED ذكية RGB", price: 34900 },
];

const NAMES = ["أحمد محمود", "سارة علي", "محمد حسن", "منى إبراهيم", "خالد عبدالله", "نورهان سمير", "يوسف كمال", "هبة فتحي"];
const GOVS = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الغربية", "الشرقية", "أسيوط", "المنوفية"];

export function seedFunnels(workspaceId: string): Funnel[] {
  const mk = (
    name: string,
    slug: string,
    status: Funnel["status"],
    visits: number,
    orders: number,
    revenue: number,
    offerName: string,
    idx: number
  ): Funnel => {
    const steps: Funnel["steps"] = [
      { id: uid(), key: "landing", name: "صفحة الهبوط", type: "landing", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: visits, conversions: Math.round(visits * 0.42), x: 40, y: 120 },
      { id: uid(), key: "checkout", name: "الدفع", type: "checkout", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: Math.round(visits * 0.42), conversions: orders, x: 320, y: 120 },
      { id: uid(), key: "bump", name: "Order bump", type: "order_bump", offerId: "p-5", offerName: "حامل موبايل للسيارة", priceAmount: "14900", experimentId: null, views: Math.round(visits * 0.42), conversions: Math.round(orders * 0.31), x: 320, y: 300 },
      { id: uid(), key: "upsell", name: "عرض بعد الشراء", type: "upsell", offerId: "p-6", offerName: offerName, priceAmount: "27900", experimentId: null, views: orders, conversions: Math.round(orders * 0.18), x: 600, y: 120 },
      { id: uid(), key: "downsell", name: "Downsell", type: "downsell", offerId: "p-6", offerName: "لمبة LED ذكية RGB", priceAmount: "19900", experimentId: null, views: Math.round(orders * 0.82), conversions: Math.round(orders * 0.07), x: 600, y: 300 },
      { id: uid(), key: "thanks", name: "شكراً لطلبك", type: "thank_you", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: orders, conversions: orders, x: 880, y: 200 },
    ];
    return {
      id: `fn-${idx}`,
      workspaceId,
      name,
      slug,
      status,
      entryStepKey: "landing",
      steps,
      edges: [
        { id: uid(), fromStepKey: "landing", toStepKey: "checkout", condition: "always", priority: 1 },
        { id: uid(), fromStepKey: "checkout", toStepKey: "upsell", condition: "completed_checkout", priority: 1 },
        { id: uid(), fromStepKey: "upsell", toStepKey: "thanks", condition: "accepted_offer", priority: 1 },
        { id: uid(), fromStepKey: "upsell", toStepKey: "downsell", condition: "declined_offer", priority: 2 },
        { id: uid(), fromStepKey: "downsell", toStepKey: "thanks", condition: "always", priority: 1 },
      ],
      visits,
      orders,
      revenueAmount: String(revenue),
      currency: "EGP",
      createdAt: daysAgo(40 - idx * 7),
      updatedAt: daysAgo(idx),
      publishedAt: status === "published" ? daysAgo(30 - idx * 5) : null,
    };
  };
  return [
    mk("عرض السماعة Pro — رمضان", "headset-pro-ramadan", "published", 12480, 611, 61100000, "لمبة LED ذكية RGB", 1),
    mk("الساعة الذكية — عرض التيك توك", "smartwatch-tiktok", "published", 8210, 302, 39400000, "حامل موبايل للسيارة", 2),
    mk("طقم الأواني — عرض الأم", "cookware-mothers-day", "paused", 3120, 88, 21900000, "لمبة LED ذكية RGB", 3),
    mk("عطر العود — تجربة جديدة", "oud-perfume-test", "draft", 0, 0, 0, "حامل موبايل للسيارة", 4),
  ];
}

export function seedExperiments(workspaceId: string): Experiment[] {
  return [
    {
      id: "exp-1",
      workspaceId,
      name: "عنوان صفحة الهبوط: خصم vs شحن مجاني",
      targetType: "funnel_step",
      targetLabel: "عرض السماعة Pro — صفحة الهبوط",
      status: "running",
      winnerVariantId: null,
      autoPauseLoser: true,
      variants: [
        { id: "v-a", name: "A — خصم 30%", trafficPercent: 50, visitors: 4210, conversions: 1712 },
        { id: "v-b", name: "B — شحن مجاني", trafficPercent: 50, visitors: 4188, conversions: 1901 },
      ],
      startedAt: daysAgo(9),
      createdAt: daysAgo(10),
    },
    {
      id: "exp-2",
      workspaceId,
      name: "الدفع: صفحة واحدة vs خطوتين",
      targetType: "funnel_step",
      targetLabel: "الساعة الذكية — الدفع",
      status: "completed",
      winnerVariantId: "v-c",
      autoPauseLoser: true,
      variants: [
        { id: "v-c", name: "A — صفحة واحدة", trafficPercent: 50, visitors: 2600, conversions: 301 },
        { id: "v-d", name: "B — خطوتين", trafficPercent: 50, visitors: 2588, conversions: 214 },
      ],
      startedAt: daysAgo(30),
      createdAt: daysAgo(31),
    },
  ];
}

export function seedOffers(workspaceId: string): ConversionOffer[] {
  return [
    {
      id: "off-1", workspaceId, type: "order_bump", name: "حامل السيارة مع السماعة", headline: "أضف حامل الموبايل بـ 149 بدل 199 — عرض لمرة واحدة",
      status: "active", triggerProductIds: ["p-1"], triggerLabel: "سماعة بلوتوث لاسلكية Pro", products: [{ productId: "p-5", productName: "حامل موبايل للسيارة", quantity: 1 }],
      discountType: "fixed", discountValue: 5000, tiers: [], impressions: 5240, accepted: 1624, revenueAmount: "24197600", createdAt: daysAgo(25),
    },
    {
      id: "off-2", workspaceId, type: "post_purchase_upsell", name: "لمبة ذكية بعد الشراء", headline: "مبروك! أضف لمبة LED ذكية بخصم 20% قبل ما الطلب يتشحن",
      status: "active", triggerProductIds: ["p-1", "p-2"], triggerLabel: "السماعة + الساعة", products: [{ productId: "p-6", productName: "لمبة LED ذكية RGB", quantity: 1 }],
      discountType: "percentage", discountValue: 2000, tiers: [], impressions: 913, accepted: 164, revenueAmount: "4575600", createdAt: daysAgo(20),
    },
    {
      id: "off-3", workspaceId, type: "bundle", name: "اشترِ أكتر وفّر أكتر — العطور", headline: "قطعتين خصم 10% · 3 قطع خصم 20%",
      status: "active", triggerProductIds: ["p-4"], triggerLabel: "عطر عود ملكي 100ml", products: [{ productId: "p-4", productName: "عطر عود ملكي 100ml", quantity: 1 }],
      discountType: "none", discountValue: 0, tiers: [{ quantity: 2, discountBasisPoints: 1000 }, { quantity: 3, discountBasisPoints: 2000 }], impressions: 2210, accepted: 402, revenueAmount: "39795000", createdAt: daysAgo(15),
    },
    {
      id: "off-4", workspaceId, type: "downsell", name: "بدل الإلغاء — خصم 15%", headline: "قبل ما تلغي: خصم 15% لو أكدت الطلب دلوقتي",
      status: "active", triggerProductIds: [], triggerLabel: "أي طلب عند الإلغاء", products: [], discountType: "percentage", discountValue: 1500, tiers: [], impressions: 340, accepted: 71, revenueAmount: "6034000", createdAt: daysAgo(12),
    },
    {
      id: "off-5", workspaceId, type: "cross_sell", name: "يُشترى معاً — الأواني", headline: "العملاء اللي اشتروا الطقم ده اشتروا كمان",
      status: "disabled", triggerProductIds: ["p-3"], triggerLabel: "طقم أواني طهي 12 قطعة", products: [{ productId: "p-6", productName: "لمبة LED ذكية RGB", quantity: 1 }], discountType: "none", discountValue: 0, tiers: [], impressions: 0, accepted: 0, revenueAmount: "0", createdAt: daysAgo(3),
    },
  ];
}

export function seedPixels(workspaceId: string): TrackingPixel[] {
  return [
    { id: "px-1", workspaceId, platform: "facebook", label: "Main FB Pixel", pixelId: "1029384756610293", capiEnabled: true, capiTokenSet: true, events: ["page_view", "view_content", "add_to_cart", "initiate_checkout", "purchase"], status: "active", lastEventAt: daysAgo(0, 9), createdAt: daysAgo(60) },
    { id: "px-2", workspaceId, platform: "tiktok", label: "TikTok Ads", pixelId: "CJ8K2L3M4N5O6P7Q", capiEnabled: true, capiTokenSet: false, events: ["page_view", "purchase"], status: "active", lastEventAt: daysAgo(0, 11), createdAt: daysAgo(30) },
    { id: "px-3", workspaceId, platform: "ga4", label: "Google Analytics 4", pixelId: "G-7XK2P9Q1ZA", capiEnabled: false, capiTokenSet: false, events: ["page_view", "purchase"], status: "active", lastEventAt: daysAgo(0, 8), createdAt: daysAgo(90) },
    { id: "px-4", workspaceId, platform: "snapchat", label: "Snap Pixel", pixelId: "a1b2c3d4-e5f6", capiEnabled: false, capiTokenSet: false, events: ["page_view"], status: "disabled", lastEventAt: daysAgo(14), createdAt: daysAgo(20) },
  ];
}

export function seedAutomations(workspaceId: string): Automation[] {
  return [
    {
      id: "au-1", workspaceId, name: "تأكيد الطلب على واتساب", trigger: "order_created", status: "active",
      steps: [{ id: uid(), delayMinutes: 0, channel: "whatsapp", templateName: "order_confirm_v2", body: "أهلاً {{customer.firstName}} 👋 وصلنا طلبك رقم {{order.number}} بقيمة {{order.total}}. رد بـ 1 لتأكيد الطلب." }],
      runs: 1842, lastRunAt: daysAgo(0, 10), createdAt: daysAgo(50),
    },
    {
      id: "au-2", workspaceId, name: "استرجاع السلة المتروكة", trigger: "checkout_abandoned", status: "active",
      steps: [
        { id: uid(), delayMinutes: 30, channel: "whatsapp", templateName: "cart_recovery_1", body: "سيبت {{cart.itemCount}} منتج في السلة! كمّل طلبك دلوقتي: {{cart.link}}" },
        { id: uid(), delayMinutes: 1440, channel: "sms", templateName: "cart_recovery_2", body: "خصم 10% لو كملت طلبك النهاردة بكود BACK10 — {{cart.link}}" },
      ],
      runs: 623, lastRunAt: daysAgo(0, 7), createdAt: daysAgo(40),
    },
    {
      id: "au-3", workspaceId, name: "إشعار الشحن + رقم التتبع", trigger: "order_shipped", status: "active",
      steps: [{ id: uid(), delayMinutes: 0, channel: "sms", templateName: "shipped", body: "طلبك {{order.number}} اتشحن مع {{shipment.carrier}}. تتبع: {{shipment.trackingUrl}}" }],
      runs: 1211, lastRunAt: daysAgo(0, 12), createdAt: daysAgo(45),
    },
    {
      id: "au-4", workspaceId, name: "محاولة تانية للعميل اللي مش بيرد", trigger: "confirmation_unreachable", status: "paused",
      steps: [{ id: uid(), delayMinutes: 180, channel: "whatsapp", templateName: "unreachable", body: "حاولنا نتصل بيك لتأكيد طلبك {{order.number}}. رد بـ 1 للتأكيد أو 2 للإلغاء." }],
      runs: 210, lastRunAt: daysAgo(6), createdAt: daysAgo(30),
    },
    {
      id: "au-5", workspaceId, name: "Webhook → Google Sheet", trigger: "order_confirmed", status: "active",
      steps: [{ id: uid(), delayMinutes: 0, channel: "webhook", templateName: "https://hooks.zapier.com/…/confirmed", body: "" }],
      runs: 1590, lastRunAt: daysAgo(0, 11), createdAt: daysAgo(35),
    },
  ];
}

export function seedFraudSettings(workspaceId: string): FraudSettings {
  return {
    workspaceId,
    action: "flag_for_review",
    blockedToday: 7,
    blockedThisMonth: 143,
    rules: [
      { key: "block_blacklisted_phone", label: "حظر الأرقام في القائمة السوداء", description: "أي طلب من رقم موجود في القائمة السوداء يتحظر فوراً.", enabled: true, value: null, valueLabel: null },
      { key: "duplicate_order_window", label: "منع الطلبات المكررة", description: "نفس الرقم + نفس المنتج خلال فترة قصيرة يعتبر تكرار.", enabled: true, value: 30, valueLabel: "دقيقة" },
      { key: "max_orders_per_phone_per_day", label: "حد أقصى للطلبات من نفس الرقم يومياً", description: "أكتر من العدد ده في يوم واحد يتعلّم كطلب مشبوه.", enabled: true, value: 3, valueLabel: "طلبات" },
      { key: "block_invalid_phone_format", label: "رفض الأرقام غير الصالحة", description: "رقم مصري لازم يبدأ بـ 010/011/012/015 و11 رقم.", enabled: true, value: null, valueLabel: null },
      { key: "high_rejection_customer", label: "العميل كتير الرفض", description: "عميل نسبة رفضه/إرجاعه أعلى من الحد ده يتعلّم.", enabled: true, value: 50, valueLabel: "% رفض" },
      { key: "require_otp_high_value", label: "تحقق OTP للطلبات الكبيرة", description: "طلب أعلى من المبلغ ده يطلب كود تحقق على الموبايل.", enabled: false, value: 2000, valueLabel: "جنيه" },
      { key: "block_ip_country_mismatch", label: "IP من خارج بلد الشحن", description: "لو الـ IP من دولة مختلفة عن عنوان الشحن.", enabled: false, value: null, valueLabel: null },
    ],
  };
}

export function seedBlocked(workspaceId: string): BlockedEntry[] {
  return [
    { id: uid(), workspaceId, type: "phone", value: "01012345678", reason: "رفض 6 طلبات متتالية", source: "rule", hits: 4, createdAt: daysAgo(12) },
    { id: uid(), workspaceId, type: "phone", value: "01198765432", reason: "طلبات وهمية من صفحة الإعلان", source: "manual", hits: 11, createdAt: daysAgo(8) },
    { id: uid(), workspaceId, type: "ip", value: "197.54.12.0/24", reason: "سبام طلبات — 40 طلب في ساعة", source: "manual", hits: 38, createdAt: daysAgo(3) },
    { id: uid(), workspaceId, type: "email", value: "test@test.com", reason: "إيميل وهمي", source: "rule", hits: 2, createdAt: daysAgo(1) },
  ];
}

export function seedFlaggedOrders(): FlaggedOrder[] {
  const r = rng(11);
  return Array.from({ length: 9 }, (_, i) => ({
    id: uid(),
    orderNumber: `#10${420 + i}`,
    customerName: NAMES[Math.floor(r() * NAMES.length)],
    phone: `01${Math.floor(r() * 3)}${String(Math.floor(r() * 1e8)).padStart(8, "0")}`,
    totalAmount: String(Math.round(300 + r() * 2500) * 100),
    currency: "EGP",
    triggeredRules: i % 3 === 0 ? ["duplicate_order_window"] : i % 3 === 1 ? ["max_orders_per_phone_per_day", "high_rejection_customer"] : ["block_invalid_phone_format"],
    status: i < 6 ? "flagged" : i === 6 ? "approved" : "blocked",
    createdAt: daysAgo(0, 18 - i),
  }));
}

export const CARRIERS: Carrier[] = [
  { key: "bosta", name: "Bosta", countries: ["EG", "SA"], supportsCod: true, supportsTracking: true, supportsPickup: true, logoText: "B" },
  { key: "aramex", name: "Aramex", countries: ["EG", "SA", "AE", "KW"], supportsCod: true, supportsTracking: true, supportsPickup: true, logoText: "A" },
  { key: "jnt", name: "J&T Express", countries: ["EG", "SA", "AE"], supportsCod: true, supportsTracking: true, supportsPickup: true, logoText: "J&T" },
  { key: "mylerz", name: "Mylerz", countries: ["EG"], supportsCod: true, supportsTracking: true, supportsPickup: true, logoText: "M" },
  { key: "fedex", name: "FedEx", countries: ["EG", "SA", "AE", "US"], supportsCod: false, supportsTracking: true, supportsPickup: true, logoText: "Fx" },
  { key: "custom", name: "شركة شحن يدوية", countries: ["*"], supportsCod: true, supportsTracking: false, supportsPickup: false, logoText: "✎" },
];

export function seedCarrierAccounts(workspaceId: string): CarrierAccount[] {
  return [
    { id: "ca-1", workspaceId, carrierKey: "bosta", label: "Bosta — الحساب الرئيسي", status: "connected", isDefault: true, credentialsSet: true, autoCreateShipmentOn: "confirmed", codCollection: true, shipmentsThisMonth: 412, connectedAt: daysAgo(70) },
    { id: "ca-2", workspaceId, carrierKey: "jnt", label: "J&T — الصعيد", status: "connected", isDefault: false, credentialsSet: true, autoCreateShipmentOn: "never", codCollection: true, shipmentsThisMonth: 96, connectedAt: daysAgo(20) },
    { id: "ca-3", workspaceId, carrierKey: "aramex", label: "Aramex — الخليج", status: "error", isDefault: false, credentialsSet: true, autoCreateShipmentOn: "never", codCollection: false, shipmentsThisMonth: 0, connectedAt: daysAgo(5) },
  ];
}

export function seedAbandoned(workspaceId: string): AbandonedCheckout[] {
  const r = rng(7);
  return Array.from({ length: 14 }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    const qty = 1 + Math.floor(r() * 2);
    const hasContact = r() > 0.25;
    const steps: AbandonedCheckout["step"][] = ["contact", "shipping", "payment"];
    const statuses: AbandonedCheckout["recoveryStatus"][] = ["not_contacted", "contacted", "recovered", "lost"];
    return {
      id: uid(),
      workspaceId,
      customerName: hasContact ? NAMES[Math.floor(r() * NAMES.length)] : null,
      phone: hasContact ? `01${Math.floor(r() * 3)}${String(Math.floor(r() * 1e8)).padStart(8, "0")}` : null,
      email: hasContact && r() > 0.6 ? "customer@example.com" : null,
      items: [{ productName: p.name, quantity: qty, unitPriceAmount: String(p.price) }],
      totalAmount: String(p.price * qty + 5000),
      currency: "EGP",
      step: hasContact ? steps[1 + Math.floor(r() * 2)] : "contact",
      source: r() > 0.5 ? "funnel" : "store",
      sourceLabel: r() > 0.5 ? "عرض السماعة Pro" : "المتجر",
      recoveryStatus: i < 5 ? "not_contacted" : statuses[Math.floor(r() * statuses.length)],
      lastActivityAt: daysAgo(Math.floor(i / 3), 20 - (i % 12)),
    };
  });
}

export function seedApps(): AppIntegration[] {
  return [
    { key: "whatsapp", name: "WhatsApp Business API", category: "messaging", description: "تأكيد الطلبات والرسائل التلقائية عبر واتساب.", installed: true, status: "connected", logoText: "WA" },
    { key: "fb_capi", name: "Facebook Conversions API", category: "marketing", description: "تتبع أدق للتحويلات من السيرفر بعيداً عن حظر المتصفح.", installed: true, status: "connected", logoText: "f" },
    { key: "tiktok", name: "TikTok Events API", category: "marketing", description: "إرسال أحداث الشراء لتحسين حملات تيك توك.", installed: true, status: "needs_setup", logoText: "TT" },
    { key: "google_sheets", name: "Google Sheets", category: "analytics", description: "مزامنة الطلبات لحظياً مع شيت.", installed: true, status: "connected", logoText: "GS" },
    { key: "bosta", name: "Bosta", category: "shipping", description: "إنشاء شحنات وتتبع تلقائي.", installed: true, status: "connected", logoText: "B" },
    { key: "paymob", name: "Paymob", category: "payments", description: "بطاقات، محافظ، فوري، تقسيط.", installed: false, status: "not_installed", logoText: "PM" },
    { key: "instapay", name: "InstaPay", category: "payments", description: "تحويل فوري بدون رسوم.", installed: false, status: "not_installed", logoText: "IP" },
    { key: "shopify_import", name: "استيراد من Shopify", category: "ai", description: "انقل منتجاتك وعملاءك من Shopify بضغطة.", installed: false, status: "not_installed", logoText: "S" },
    { key: "aliexpress", name: "AliExpress Importer", category: "ai", description: "استيراد منتجات دروبشيبينج مع الصور والمقاسات.", installed: false, status: "not_installed", logoText: "Ali" },
    { key: "zimos_ai", name: "Zimos AI Pages", category: "ai", description: "اكتب فكرة المنتج واطلع صفحة هبوط كاملة.", installed: true, status: "connected", logoText: "AI" },
    { key: "klaviyo", name: "Klaviyo", category: "marketing", description: "حملات إيميل و flows متقدمة.", installed: false, status: "not_installed", logoText: "K" },
    { key: "zapier", name: "Zapier", category: "analytics", description: "اربط Zimos بـ 5000+ تطبيق.", installed: false, status: "not_installed", logoText: "Z" },
  ];
}

export function seedCheckoutSettings(workspaceId: string): CheckoutSettings {
  return {
    workspaceId,
    layout: "one_page",
    fields: { email: "optional", alternatePhone: "optional", address2: "hidden", notes: "optional" },
    phoneOtpVerification: false,
    showTrustBadges: true,
    showCountdown: true,
    countdownMinutes: 15,
    allowDiscountCodes: true,
    defaultPaymentMethod: "cod",
    thankYouMessage: "شكراً لطلبك! هنتصل بيك خلال 24 ساعة لتأكيد الطلب.",
  };
}

export function seedGateways(): PaymentGateway[] {
  return [
    { key: "cod", name: "الدفع عند الاستلام", enabled: true, configured: true, feePercent: 0, currencies: ["EGP", "SAR"] },
    { key: "paymob", name: "Paymob", enabled: true, configured: true, feePercent: 2.5, currencies: ["EGP"] },
    { key: "fawry", name: "Fawry", enabled: false, configured: false, feePercent: 2, currencies: ["EGP"] },
    { key: "instapay", name: "InstaPay", enabled: false, configured: false, feePercent: 0, currencies: ["EGP"] },
    { key: "stripe", name: "Stripe", enabled: false, configured: false, feePercent: 2.9, currencies: ["USD", "EUR", "SAR", "AED"] },
    { key: "paypal", name: "PayPal", enabled: false, configured: false, feePercent: 3.4, currencies: ["USD", "EUR"] },
  ];
}

export function seedCurrencies(): CurrencySetting[] {
  return [
    { code: "EGP", enabled: true, isDefault: true, rateToDefault: 1, rounding: "none" },
    { code: "SAR", enabled: true, isDefault: false, rateToDefault: 0.078, rounding: "0.99" },
    { code: "AED", enabled: false, isDefault: false, rateToDefault: 0.076, rounding: "0.99" },
    { code: "USD", enabled: false, isDefault: false, rateToDefault: 0.0207, rounding: "0.99" },
  ];
}

export function seedCamouflage(): CamouflageSettings {
  return {
    enabled: false,
    mode: "decoy_page",
    decoyPageTitle: "مدونة نصائح منزلية",
    blockedCountries: ["US", "IE", "SG"],
    blockedUserAgents: ["facebookexternalhit", "Google-Ads-Bot"],
  };
}

export function seedDomains(): DomainRecord[] {
  return [
    { id: uid(), hostname: "shop.egystore.com", status: "active", isPrimary: true, target: "store", targetLabel: "المتجر الرئيسي", verificationToken: "zimos-verify=8f2a…c91", createdAt: daysAgo(60) },
    { id: uid(), hostname: "offer.egystore.com", status: "verified", isPrimary: false, target: "funnel", targetLabel: "عرض السماعة Pro", verificationToken: "zimos-verify=1b7d…e40", createdAt: daysAgo(25) },
    { id: uid(), hostname: "watch-deal.com", status: "pending_verification", isPrimary: false, target: "funnel", targetLabel: "الساعة الذكية", verificationToken: "zimos-verify=aa30…77f", createdAt: daysAgo(1) },
  ];
}

export function seedStaff(): StaffMember[] {
  return [
    { id: uid(), fullName: "مصطفى فهيم", email: "owner@egystore.com", role: "owner", status: "active", lastActiveAt: daysAgo(0, 13) },
    { id: uid(), fullName: "أميرة سعيد", email: "amira@egystore.com", role: "confirmation_agent", status: "active", lastActiveAt: daysAgo(0, 12) },
    { id: uid(), fullName: "كريم عادل", email: "karim@egystore.com", role: "fulfillment", status: "active", lastActiveAt: daysAgo(1) },
    { id: uid(), fullName: "—", email: "newagent@egystore.com", role: "confirmation_agent", status: "invited", lastActiveAt: null },
  ];
}

export function seedPlan(): PlanInfo {
  return {
    planKey: "growth",
    planName: "Growth",
    status: "active",
    trialEndsAt: null,
    monthlyPriceAmount: "49900",
    currency: "EGP",
    ordersThisMonth: 1184,
    softOrderQuota: 2000,
    transactionFeeBasisPoints: 50,
    codFeeBasisPoints: 10,
  };
}

export function seedInventory(): InventoryRow[] {
  const rows: InventoryRow[] = [];
  const variants: Record<string, string[]> = {
    "p-1": ["أسود", "أبيض"],
    "p-2": ["أسود", "وردي", "أزرق"],
    "p-3": ["افتراضي"],
    "p-4": ["100ml"],
    "p-5": ["افتراضي"],
    "p-6": ["افتراضي"],
  };
  const r = rng(3);
  for (const p of DEMO_PRODUCTS) {
    for (const v of variants[p.id]) {
      const onHand = Math.floor(r() * 120);
      const reserved = Math.floor(r() * Math.min(onHand, 15));
      rows.push({
        variantId: `${p.id}-${v}`,
        productId: p.id,
        productName: p.name,
        variantLabel: v,
        sku: `${p.id.toUpperCase()}-${v.slice(0, 2)}`,
        onHand,
        reserved,
        available: onHand - reserved,
        lowStockThreshold: 10,
        costAmount: String(Math.round(p.price * 0.55)),
      });
    }
  }
  return rows;
}

export function seedTemplates(): StoreTemplate[] {
  return [
    { id: "t-1", name: "Dar — متجر", kind: "store", category: "منزل ومطبخ", priceAmount: "0", isFree: true, primaryColor: "#2563EB", tags: ["COD", "عربي"], rtl: true },
    { id: "t-2", name: "Dar — فانل", kind: "funnel", category: "منزل ومطبخ", priceAmount: "0", isFree: true, primaryColor: "#0F766E", tags: ["COD", "منتج واحد"], rtl: true },
    { id: "t-3", name: "Convertify COD", kind: "store", category: "عام", priceAmount: "49900", isFree: false, primaryColor: "#DC2626", tags: ["COD", "تحويل عالي"], rtl: true },
    { id: "t-4", name: "Aether — بيوتي", kind: "store", category: "تجميل", priceAmount: "0", isFree: true, primaryColor: "#DB2777", tags: ["أزياء", "تجميل"], rtl: true },
    { id: "t-5", name: "Atlas — أثاث", kind: "store", category: "أثاث", priceAmount: "49900", isFree: false, primaryColor: "#78350F", tags: ["أثاث"], rtl: true },
    { id: "t-6", name: "Hilal — رمضان", kind: "landing", category: "مواسم", priceAmount: "0", isFree: true, primaryColor: "#7C3AED", tags: ["رمضان", "COD"], rtl: true },
    { id: "t-7", name: "Ebookly — رقمي", kind: "funnel", category: "منتجات رقمية", priceAmount: "29900", isFree: false, primaryColor: "#0891B2", tags: ["كورس", "رقمي"], rtl: false },
    { id: "t-8", name: "Nawat — عطور", kind: "landing", category: "عطور", priceAmount: "0", isFree: true, primaryColor: "#B45309", tags: ["عطور", "منتج واحد"], rtl: true },
  ];
}

export function seedAnalytics(range: "7d" | "30d" | "90d"): AnalyticsOverview {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const r = rng(days);
  const daily: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const weekend = d.getDay() === 5 || d.getDay() === 6;
    const visitors = Math.round((weekend ? 620 : 480) + r() * 300);
    const orders = Math.round(visitors * (0.045 + r() * 0.03));
    daily.push({ date: d.toISOString().slice(0, 10), orders, revenueAmount: orders * Math.round(85000 + r() * 40000), visitors });
  }
  const sum = (k: keyof DailyPoint) => daily.reduce((a, p) => a + (p[k] as number), 0);
  const revenue = sum("revenueAmount");
  const orders = sum("orders");
  const visitors = sum("visitors");
  return {
    currency: "EGP",
    range,
    totals: {
      revenueAmount: revenue,
      orders,
      visitors,
      conversionBasisPoints: Math.round((orders / visitors) * 10000),
      averageOrderAmount: Math.round(revenue / Math.max(orders, 1)),
      confirmationRateBasisPoints: 7420,
      deliveryRateBasisPoints: 6810,
      returnRateBasisPoints: 940,
    },
    previous: {
      revenueAmount: Math.round(revenue * 0.86),
      orders: Math.round(orders * 0.9),
      visitors: Math.round(visitors * 0.97),
      conversionBasisPoints: Math.round((orders / visitors) * 10000 * 0.93),
    },
    daily,
    topProducts: DEMO_PRODUCTS.slice(0, 5).map((p, i) => ({ productId: p.id, name: p.name, units: Math.round(orders * (0.32 - i * 0.05)), revenueAmount: Math.round(orders * (0.32 - i * 0.05)) * p.price })),
    bySource: [
      { source: "Facebook Ads", orders: Math.round(orders * 0.46), revenueAmount: Math.round(revenue * 0.47) },
      { source: "TikTok Ads", orders: Math.round(orders * 0.27), revenueAmount: Math.round(revenue * 0.26) },
      { source: "Organic / Direct", orders: Math.round(orders * 0.15), revenueAmount: Math.round(revenue * 0.15) },
      { source: "WhatsApp / Recovery", orders: Math.round(orders * 0.08), revenueAmount: Math.round(revenue * 0.08) },
      { source: "Google", orders: Math.round(orders * 0.04), revenueAmount: Math.round(revenue * 0.04) },
    ],
    byGovernorate: GOVS.map((g, i) => ({ name: g, orders: Math.round(orders * (0.28 - i * 0.03)), deliveryRateBasisPoints: 7800 - i * 320 })),
    pipeline: {
      newOrders: 38,
      awaitingConfirmation: 61,
      confirmed: 124,
      shipped: 212,
      delivered: Math.round(orders * 0.62),
      returned: Math.round(orders * 0.09),
      cancelled: Math.round(orders * 0.11),
    },
  };
}
