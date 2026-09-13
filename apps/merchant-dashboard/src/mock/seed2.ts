import { daysAgo, uid } from "./store";
import { DEMO_PRODUCTS } from "./seed";
import type {
  AdAccount,
  AdCreative,
  AdSet,
  Affiliate,
  Agent,
  CallCenterSettings,
  CallLog,
  Campaign,
  ConfirmationItem,
  PnlReport,
  ProductEconomics,
  ProductReview,
  ReturnRequest,
  Settlement,
  SettlementOrder,
  StoreSummary,
  Supplier,
  SupplierProduct,
  WaBotSettings,
  WaConversation,
} from "./types2";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const NAMES = ["أحمد محمود", "سارة علي", "محمد حسن", "منى إبراهيم", "خالد عبدالله", "نورهان سمير", "يوسف كمال", "هبة فتحي", "عمر طارق", "دينا رأفت"];
const GOVS = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الغربية", "الشرقية", "أسيوط", "المنوفية"];
const phone = (r: () => number) => `01${[0, 1, 2, 5][Math.floor(r() * 4)]}${String(Math.floor(r() * 1e8)).padStart(8, "0")}`;

// ---------------------------------------------------------------- Ads --

export function seedAdAccounts(): AdAccount[] {
  return [
    { id: "aa-fb", platform: "facebook", name: "EgyStore — Main", externalId: "act_1029384756", currency: "USD", status: "connected", lastSyncAt: daysAgo(0, 12), spendTodayAmount: 21500 },
    { id: "aa-tt", platform: "tiktok", name: "EgyStore TikTok", externalId: "7192837465", currency: "USD", status: "connected", lastSyncAt: daysAgo(0, 11), spendTodayAmount: 9800 },
    { id: "aa-sc", platform: "snapchat", name: "Snap — Ramadan", externalId: "sc-77a1", currency: "USD", status: "token_expired", lastSyncAt: daysAgo(4), spendTodayAmount: 0 },
  ];
}

function mkCreatives(r: () => number, spend: number, orders: number, revenue: number, n: number): AdCreative[] {
  const formats: AdCreative["format"][] = ["video", "image", "carousel"];
  const colors = ["#2563EB", "#DC2626", "#059669", "#7C3AED", "#EA580C"];
  const weights = Array.from({ length: n }, () => 0.5 + r());
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => {
    const f = w / total;
    const o = Math.round(orders * f * (0.6 + r() * 0.8));
    return {
      id: uid(),
      name: `${["UGC", "Hook", "Demo", "Testimonial", "Offer"][i % 5]} #${i + 1}`,
      format: formats[i % 3],
      thumbnailColor: colors[i % colors.length],
      spendAmount: Math.round(spend * f),
      impressions: Math.round(spend * f * 0.9),
      clicks: Math.round(spend * f * 0.9 * (0.012 + r() * 0.02)),
      orders: o,
      confirmedOrders: Math.round(o * 0.74),
      deliveredOrders: Math.round(o * 0.74 * 0.9),
      revenueAmount: Math.round(revenue * f),
    };
  });
}

function mkCampaign(
  idx: number,
  platform: Campaign["platform"],
  adAccountId: string,
  name: string,
  status: Campaign["status"],
  productIdx: number,
  funnelId: string | null,
  spend: number,
  orders: number,
): Campaign {
  const r = rng(100 + idx);
  const p = DEMO_PRODUCTS[productIdx];
  const revenue = orders * p.price;
  const confirmed = Math.round(orders * (0.7 + r() * 0.1));
  const delivered = Math.round(confirmed * (0.85 + r() * 0.1));
  const returned = confirmed - delivered;
  const adSets: AdSet[] = ["Broad 18-45 EG", "Lookalike 1% Buyers", "Interest: Home & Kitchen"].slice(0, 2 + (idx % 2)).map((a, i) => {
    const f = i === 0 ? 0.5 : 0.5 / (1 + (idx % 2));
    const o = Math.round(orders * f);
    return {
      id: uid(),
      name: a,
      audience: a,
      spendAmount: Math.round(spend * f),
      impressions: Math.round(spend * f * 0.9),
      clicks: Math.round(spend * f * 0.9 * 0.018),
      orders: o,
      confirmedOrders: Math.round(o * 0.74),
      deliveredOrders: Math.round(o * 0.66),
      revenueAmount: Math.round(revenue * f),
      creatives: mkCreatives(r, spend * f, o, revenue * f, 3),
    };
  });
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const f = (0.6 + r() * 0.8) / 30;
    return { date: d.toISOString().slice(0, 10), spendAmount: Math.round(spend * f), orders: Math.round(orders * f), revenueAmount: Math.round(revenue * f) };
  });
  return {
    id: `cmp-${idx}`,
    adAccountId,
    platform,
    name,
    objective: "conversions",
    status,
    productId: p.id,
    productName: p.name,
    funnelId,
    dailyBudgetAmount: Math.round(spend / 30),
    spendAmount: spend,
    impressions: Math.round(spend * 0.9),
    clicks: Math.round(spend * 0.9 * 0.018),
    landingViews: Math.round(spend * 0.9 * 0.018 * 0.82),
    addToCarts: Math.round(orders * 2.4),
    checkouts: Math.round(orders * 1.5),
    orders,
    confirmedOrders: confirmed,
    deliveredOrders: delivered,
    returnedOrders: returned,
    revenueAmount: delivered * p.price,
    costOfDeliveredAmount: delivered * Math.round(p.price * 0.55 + 6500) + returned * 4500,
    adSets,
    daily,
  };
}

export function seedCampaigns(): Campaign[] {
  return [
    mkCampaign(1, "facebook", "aa-fb", "سماعة Pro — Conversions — Broad", "active", 0, "fn-1", 9800000, 611),
    mkCampaign(2, "tiktok", "aa-tt", "Fit Band 5 — Spark Ads", "active", 1, "fn-2", 5200000, 302),
    mkCampaign(3, "facebook", "aa-fb", "طقم أواني — Mothers Day", "paused", 2, "fn-3", 6200000, 88),
    mkCampaign(4, "facebook", "aa-fb", "عطر العود — Retargeting", "active", 3, null, 1400000, 96),
    mkCampaign(5, "snapchat", "aa-sc", "حامل السيارة — Snap Story", "ended", 4, null, 1400000, 71),
    mkCampaign(6, "tiktok", "aa-tt", "لمبة LED — Test creatives", "active", 5, null, 900000, 24),
  ];
}

export function seedEconomics(): ProductEconomics[] {
  return DEMO_PRODUCTS.map((p, i) => ({
    productId: p.id,
    productName: p.name,
    sellingPriceAmount: p.price,
    cogsAmount: Math.round(p.price * 0.55),
    shippingCostAmount: 5500,
    carrierFeeAmount: 1200,
    paymentFeeAmount: 0,
    packagingAmount: 800,
    returnCostAmount: 4500,
    confirmationRateBp: 7400 - i * 150,
    deliveryRateBp: 8800 - i * 200,
    returnRateBp: 1200 + i * 200,
  }));
}

export function seedPnl(range: "7d" | "30d" | "90d"): PnlReport {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const r = rng(days + 7);
  const campaigns = seedCampaigns();
  const scale = days / 30;
  const revenue = Math.round(campaigns.reduce((a, c) => a + c.revenueAmount, 0) * scale * 1.18);
  const adSpend = Math.round(campaigns.reduce((a, c) => a + c.spendAmount, 0) * scale);
  const cogs = Math.round(revenue * 0.5);
  const shipping = Math.round(revenue * 0.065);
  const carrierFees = Math.round(revenue * 0.012);
  const returns = Math.round(revenue * 0.045);
  const packaging = Math.round(revenue * 0.008);
  const platformFees = Math.round(revenue * 0.006);
  const team = Math.round(1200000 * scale);
  const net = revenue - adSpend - cogs - shipping - carrierFees - returns - packaging - platformFees - team;
  const byDay = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const f = (0.6 + r() * 0.8) / days;
    const rev = Math.round(revenue * f);
    const spend = Math.round(adSpend * f * (0.8 + r() * 0.4));
    return { date: d.toISOString().slice(0, 10), revenueAmount: rev, adSpendAmount: spend, netProfitAmount: Math.round(rev * 0.32 - spend * 0.35) };
  });
  return {
    range,
    currency: "EGP",
    lines: [
      { key: "revenue", label: "Delivered revenue", amount: revenue, sign: 1 },
      { key: "cogs", label: "Cost of goods", amount: cogs, sign: -1 },
      { key: "ads", label: "Ad spend", amount: adSpend, sign: -1 },
      { key: "shipping", label: "Shipping paid to carriers", amount: shipping, sign: -1 },
      { key: "carrier_fees", label: "COD collection fees", amount: carrierFees, sign: -1 },
      { key: "returns", label: "Returns & RTO cost", amount: returns, sign: -1 },
      { key: "packaging", label: "Packaging", amount: packaging, sign: -1 },
      { key: "platform", label: "Platform & payment fees", amount: platformFees, sign: -1 },
      { key: "team", label: "Confirmation team", amount: team, sign: -1 },
    ],
    netProfitAmount: net,
    netMarginBp: Math.round((net / Math.max(revenue, 1)) * 10000),
    byProduct: DEMO_PRODUCTS.map((p, i) => {
      const c = campaigns.filter((x) => x.productId === p.id);
      const rev = Math.round(c.reduce((a, x) => a + x.revenueAmount, 0) * scale * 1.18);
      const spend = Math.round(c.reduce((a, x) => a + x.spendAmount, 0) * scale);
      const cg = Math.round(rev * 0.5);
      const sh = Math.round(rev * 0.077);
      const rt = Math.round(rev * (0.03 + i * 0.008));
      return { productId: p.id, productName: p.name, revenueAmount: rev, adSpendAmount: spend, cogsAmount: cg, shippingAmount: sh, returnsAmount: rt, netProfitAmount: rev - spend - cg - sh - rt, deliveredOrders: Math.round(c.reduce((a, x) => a + x.deliveredOrders, 0) * scale) };
    }),
    byDay,
  };
}

// --------------------------------------------------------- Call center --

export function seedAgents(): Agent[] {
  return [
    { id: "ag-1", name: "أميرة سعيد", status: "on_call", callsToday: 63, confirmedToday: 41, avgHandleSeconds: 84, extension: "101" },
    { id: "ag-2", name: "محمود عادل", status: "online", callsToday: 48, confirmedToday: 29, avgHandleSeconds: 97, extension: "102" },
    { id: "ag-3", name: "ندى حسام", status: "break", callsToday: 37, confirmedToday: 25, avgHandleSeconds: 76, extension: "103" },
    { id: "ag-4", name: "كريم فوزي", status: "offline", callsToday: 0, confirmedToday: 0, avgHandleSeconds: 0, extension: "104" },
  ];
}

export function seedConfirmationQueue(): ConfirmationItem[] {
  const r = rng(42);
  const outcomes: Array<ConfirmationItem["lastOutcome"]> = [null, null, "no_answer", "busy", "postponed", null];
  return Array.from({ length: 22 }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    const qty = 1 + Math.floor(r() * 2);
    const attempts = Math.floor(r() * 3);
    const total = p.price * qty + 5500;
    const risk = i % 7 === 3 ? ["duplicate_order_window"] : [];
    return {
      id: `cq-${i}`,
      orderId: `ord-${1000 + i}`,
      orderNumber: `#10${600 + i}`,
      customerName: NAMES[Math.floor(r() * NAMES.length)],
      phone: phone(r),
      alternatePhone: r() > 0.6 ? phone(r) : null,
      governorate: GOVS[Math.floor(r() * GOVS.length)],
      address: `${Math.floor(r() * 90) + 1} ش ${["الهرم", "التحرير", "الجمهورية", "النصر", "فيصل"][Math.floor(r() * 5)]}، الدور ${Math.floor(r() * 8) + 1}`,
      items: [{ productName: p.name, variant: r() > 0.5 ? "أسود" : null, quantity: qty, unitPriceAmount: p.price }],
      totalAmount: total,
      shippingAmount: 5500,
      currency: "EGP",
      source: r() > 0.5 ? "Facebook — سماعة Pro" : r() > 0.5 ? "TikTok — Fit Band" : "المتجر",
      attempts,
      lastOutcome: attempts === 0 ? null : outcomes[Math.floor(r() * outcomes.length)],
      nextAttemptAt: attempts > 0 ? daysAgo(0, 14 + (i % 4)) : null,
      priority: risk.length ? "flagged" : total > 200000 ? "high" : "normal",
      assignedAgentId: i % 3 === 0 ? "ag-1" : i % 3 === 1 ? "ag-2" : null,
      createdAt: daysAgo(Math.floor(i / 8), 20 - (i % 10)),
      customerHistory: { totalOrders: Math.floor(r() * 6), delivered: Math.floor(r() * 4), returned: Math.floor(r() * 2), reliabilityScore: Math.round(40 + r() * 60) },
      riskFlags: risk,
    };
  });
}

export function seedCallLogs(): CallLog[] {
  const r = rng(9);
  const outcomes: CallLog["outcome"][] = ["confirmed", "confirmed", "no_answer", "busy", "cancelled", "postponed", "confirmed", "wrong_number"];
  const agents = seedAgents();
  return Array.from({ length: 40 }, (_, i) => {
    const a = agents[i % 3];
    const o = outcomes[Math.floor(r() * outcomes.length)];
    return {
      id: uid(),
      orderId: `ord-${900 + i}`,
      orderNumber: `#10${500 + i}`,
      agentId: a.id,
      agentName: a.name,
      startedAt: daysAgo(Math.floor(i / 14), 18 - (i % 9)),
      durationSeconds: o === "no_answer" ? 0 : 30 + Math.floor(r() * 150),
      outcome: o,
      note: o === "cancelled" ? "العميل لقى أرخص" : o === "postponed" ? "اتصل بعد 6 مساءً" : null,
      recordingUrl: o === "no_answer" ? null : "#recording",
    };
  });
}

export function seedCallCenterSettings(): CallCenterSettings {
  return {
    maxAttempts: 3,
    retryAfterMinutes: 180,
    autoCancelAfterAttempts: true,
    workingHours: { from: "10:00", to: "22:00" },
    whatsappFallbackAfterAttempt: 1,
    voipProvider: "none",
    recordCalls: true,
  };
}

// ---------------------------------------------------------- WhatsApp --

export function seedWaConversations(): WaConversation[] {
  const r = rng(21);
  const templates: Array<[string, WaConversation["status"], string[]]> = [
    ["1", "resolved", ["confirmed"]],
    ["فين طلبي؟", "bot", ["tracking"]],
    ["عايز أغير العنوان", "open", ["address_change"]],
    ["المنتج ده متوفر باللون الأبيض؟", "open", ["question"]],
    ["2", "resolved", ["cancelled"]],
    ["ممكن خصم؟", "open", ["negotiation"]],
    ["وصل الطلب شكراً", "resolved", ["delivered"]],
    ["1", "resolved", ["confirmed"]],
  ];
  return templates.map(([last, status, tags], i) => {
    const name = NAMES[i % NAMES.length];
    const orderNumber = `#10${640 + i}`;
    const msgs: WaConversation["messages"] = [
      { id: uid(), direction: "out", body: `أهلاً ${name.split(" ")[0]} 👋 وصلنا طلبك رقم ${orderNumber}. رد بـ 1 لتأكيد الطلب أو 2 للإلغاء.`, at: daysAgo(0, 9 + i), status: "read", byBot: true },
      { id: uid(), direction: "in", body: last, at: daysAgo(0, 9 + i), status: "delivered", byBot: false },
    ];
    if (last === "1") msgs.push({ id: uid(), direction: "out", body: "تمام ✅ طلبك اتأكد وهيتشحن خلال 24 ساعة.", at: daysAgo(0, 9 + i), status: "read", byBot: true });
    if (last === "2") msgs.push({ id: uid(), direction: "out", body: "تم إلغاء الطلب. لو غيرت رأيك ابعتلنا في أي وقت.", at: daysAgo(0, 9 + i), status: "read", byBot: true });
    if (last.includes("فين")) msgs.push({ id: uid(), direction: "out", body: "طلبك مع شركة Bosta 🚚 رقم التتبع: zg8F2K1 — متوقع يوصل بكرة.", at: daysAgo(0, 9 + i), status: "read", byBot: true });
    return {
      id: `wa-${i}`,
      customerName: name,
      phone: phone(r),
      orderNumber,
      lastMessage: msgs[msgs.length - 1].body,
      lastAt: daysAgo(0, 9 + i),
      unread: status === "open" ? 1 + Math.floor(r() * 3) : 0,
      status,
      assignedAgentName: status === "open" && i % 2 === 0 ? "أميرة سعيد" : null,
      tags,
      messages: msgs,
    };
  });
}

export function seedWaBot(): WaBotSettings {
  return {
    connected: true,
    phoneNumber: "+20 100 123 4567",
    businessName: "EgyStore",
    confirmationEnabled: true,
    trackingRepliesEnabled: true,
    handoffKeyword: "موظف",
    outsideHoursReply: "شكراً لرسالتك! فريقنا بيرد من 10 صباحاً لـ 10 مساءً. هنرد عليك أول ما نبدأ.",
    rules: [
      { id: uid(), name: "تأكيد بـ 1", match: "reply_1", keyword: null, action: "confirm_order", responseText: "تمام ✅ طلبك اتأكد وهيتشحن خلال 24 ساعة.", enabled: true, hits: 1412 },
      { id: uid(), name: "إلغاء بـ 2", match: "reply_2", keyword: null, action: "cancel_order", responseText: "تم إلغاء الطلب. لو غيرت رأيك ابعتلنا في أي وقت.", enabled: true, hits: 236 },
      { id: uid(), name: "فين طلبي", match: "keyword", keyword: "فين", action: "send_tracking", responseText: "طلبك مع {{shipment.carrier}} 🚚 رقم التتبع: {{shipment.tracking}}", enabled: true, hits: 890 },
      { id: uid(), name: "طلب موظف", match: "keyword", keyword: "موظف", action: "handoff_agent", responseText: "ثواني وهيرد عليك حد من الفريق 🙏", enabled: true, hits: 141 },
      { id: uid(), name: "أي رسالة تانية", match: "any", keyword: null, action: "send_text", responseText: "وصلتنا رسالتك، هنرد عليك في أقرب وقت.", enabled: false, hits: 0 },
    ],
  };
}

// -------------------------------------------------------- Settlements --

export function seedSettlements(): Settlement[] {
  const mk = (i: number, carrierKey: string, carrierName: string, status: Settlement["status"], orders: number, collected: number, disc: number): Settlement => {
    const fees = orders * 5500;
    const cod = Math.round(collected * 0.01);
    return {
      id: `st-${carrierKey}-${i}`,
      carrierKey,
      carrierName,
      reference: `${carrierKey.toUpperCase()}-${2026090 + i}`,
      periodFrom: daysAgo(7 * i + 7),
      periodTo: daysAgo(7 * i),
      ordersCount: orders,
      collectedAmount: collected,
      carrierFeesAmount: fees,
      codFeesAmount: cod,
      netAmount: collected - fees - cod,
      status,
      receivedAt: status === "received" || status === "reconciled" ? daysAgo(7 * i - 2) : null,
      discrepancyAmount: disc,
    };
  };
  return [
    mk(0, "bosta", "Bosta", "expected", 112, 11340000, 0),
    mk(1, "bosta", "Bosta", "discrepancy", 131, 13210000, -189900),
    mk(1, "jnt", "J&T Express", "received", 34, 3420000, 0),
    mk(2, "bosta", "Bosta", "reconciled", 118, 11980000, 0),
    mk(2, "jnt", "J&T Express", "reconciled", 29, 2910000, 0),
    mk(3, "bosta", "Bosta", "reconciled", 104, 10300000, 0),
  ];
}

export function seedSettlementOrders(settlementId: string): SettlementOrder[] {
  const r = rng(settlementId.length * 13);
  const n = 18;
  return Array.from({ length: n }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    const cod = p.price + 5500;
    const returned = r() > 0.85;
    const mismatch = settlementId === "st-bosta-1" && (i === 4 || i === 11);
    return {
      orderNumber: `#10${300 + i}`,
      customerName: NAMES[Math.floor(r() * NAMES.length)],
      codAmount: cod,
      carrierStatus: returned ? "returned" : "delivered",
      carrierReportedAmount: returned ? 0 : mismatch ? cod - 94950 : cod,
      matched: !mismatch,
    };
  });
}

// ----------------------------------------------------------- Affiliates --

export function seedAffiliates(): Affiliate[] {
  return [
    { id: uid(), name: "محمد الشريف — Reels", phone: "01001112233", code: "SHERIF10", commissionType: "percentage", commissionValue: 1000, payOn: "delivered", status: "active", clicks: 8420, orders: 312, deliveredOrders: 241, earnedAmount: 2166000, paidAmount: 1500000, joinedAt: daysAgo(80) },
    { id: uid(), name: "نور — TikTok", phone: "01112223344", code: "NOUR", commissionType: "fixed", commissionValue: 5000, payOn: "confirmed", status: "active", clicks: 5100, orders: 188, deliveredOrders: 140, earnedAmount: 940000, paidAmount: 940000, joinedAt: daysAgo(45) },
    { id: uid(), name: "جروب الأمهات", phone: "01223334455", code: "MOMS", commissionType: "percentage", commissionValue: 800, payOn: "delivered", status: "paused", clicks: 1400, orders: 41, deliveredOrders: 30, earnedAmount: 216000, paidAmount: 0, joinedAt: daysAgo(20) },
  ];
}

// -------------------------------------------------------------- Reviews --

export function seedReviews(): ProductReview[] {
  const r = rng(5);
  const bodies = ["جودة ممتازة والتوصيل كان سريع", "الصوت حلو بس البطارية أقل من المتوقع", "زي الوصف بالظبط، شكراً", "وصل متأخر يومين بس المنتج كويس", "مش زي الصور خالص", "أفضل من اللي اشتريته قبل كده بضعف السعر"];
  return Array.from({ length: 14 }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    // Realistic skew: most COD reviews are 4-5 stars, a few complaints.
    const roll = r();
    const rating = (roll > 0.45 ? 5 : roll > 0.2 ? 4 : roll > 0.1 ? 3 : roll > 0.04 ? 2 : 1) as ProductReview["rating"];
    return {
      id: uid(),
      productId: p.id,
      productName: p.name,
      customerName: NAMES[Math.floor(r() * NAMES.length)],
      rating,
      title: r() > 0.5 ? (rating >= 4 ? "ممتاز" : "مش مقتنع") : null,
      body: bodies[Math.floor(r() * bodies.length)],
      verifiedPurchase: r() > 0.2,
      status: i < 4 ? "pending" : r() > 0.15 ? "approved" : "rejected",
      createdAt: daysAgo(Math.floor(i * 1.5), 12),
      photos: r() > 0.7 ? 1 + Math.floor(r() * 3) : 0,
    };
  });
}

// -------------------------------------------------------------- Returns --

export function seedReturns(): ReturnRequest[] {
  const r = rng(17);
  const reasons: ReturnRequest["reason"][] = ["no_longer_wanted", "not_as_described", "wrong_item", "damaged", "arrived_late", "rto_unreachable", "rto_refused"];
  const statuses: ReturnRequest["status"][] = ["requested", "approved", "received", "restocked", "refunded", "rejected"];
  return Array.from({ length: 16 }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    const reason = reasons[Math.floor(r() * reasons.length)];
    const rto = reason.startsWith("rto");
    return {
      id: uid(),
      orderNumber: `#10${200 + i}`,
      customerName: NAMES[Math.floor(r() * NAMES.length)],
      phone: phone(r),
      reason,
      kind: rto ? "rto" : "customer_return",
      items: [{ productName: p.name, quantity: 1 }],
      refundAmount: rto ? 0 : p.price,
      currency: "EGP",
      status: i < 5 ? "requested" : statuses[Math.floor(r() * statuses.length)],
      carrierName: r() > 0.4 ? "Bosta" : "J&T Express",
      createdAt: daysAgo(Math.floor(i * 1.2), 10),
    };
  });
}

// ------------------------------------------------------------ Suppliers --

export function seedSuppliers(): Supplier[] {
  return [
    { id: "sp-1", name: "مصنع النور للإلكترونيات", city: "القاهرة — العتبة", category: "إلكترونيات", rating: 4.6, products: 84, leadTimeDays: 2, minOrder: 1, shipsDirect: true },
    { id: "sp-2", name: "الشروق للأدوات المنزلية", city: "الجيزة — الوراق", category: "منزل ومطبخ", rating: 4.3, products: 120, leadTimeDays: 3, minOrder: 5, shipsDirect: true },
    { id: "sp-3", name: "عطور الخليج", city: "الإسكندرية", category: "عطور وتجميل", rating: 4.8, products: 45, leadTimeDays: 2, minOrder: 1, shipsDirect: false },
    { id: "sp-4", name: "China Direct — وكيل", city: "شحن دولي", category: "متنوع", rating: 3.9, products: 2100, leadTimeDays: 14, minOrder: 10, shipsDirect: false },
  ];
}

export function seedSupplierProducts(): SupplierProduct[] {
  const r = rng(33);
  const items: Array<[string, string, string, number]> = [
    ["sp-1", "سماعة بلوتوث TWS X9", "إلكترونيات", 32000],
    ["sp-1", "شاحن سريع 65W GaN", "إلكترونيات", 21000],
    ["sp-1", "ساعة ذكية Ultra 8", "إلكترونيات", 48000],
    ["sp-2", "قلاية هوائية 5 لتر", "منزل ومطبخ", 95000],
    ["sp-2", "طقم سكاكين 7 قطع", "منزل ومطبخ", 18000],
    ["sp-2", "مكنسة لاسلكية", "منزل ومطبخ", 72000],
    ["sp-3", "عود كمبودي 50ml", "عطور وتجميل", 26000],
    ["sp-3", "مسك أبيض 100ml", "عطور وتجميل", 14000],
    ["sp-4", "مصباح قمر 3D", "ديكور", 9000],
    ["sp-4", "حامل لابتوب ألومنيوم", "مكتب", 15000],
    ["sp-4", "كاميرا مراقبة WiFi", "إلكترونيات", 38000],
    ["sp-1", "باور بانك 20000mAh", "إلكترونيات", 27000],
  ];
  const sup = seedSuppliers();
  const colors = ["#0F766E", "#B45309", "#7C3AED", "#DC2626", "#2563EB", "#059669"];
  return items.map(([supplierId, name, category, cost], i) => ({
    id: `spp-${i}`,
    supplierId,
    supplierName: sup.find((s) => s.id === supplierId)?.name ?? "",
    name,
    category,
    costAmount: cost,
    suggestedPriceAmount: Math.round(cost * (2.2 + r() * 0.8) / 100) * 100,
    stock: Math.floor(50 + r() * 900),
    imageColor: colors[i % colors.length],
    imported: false,
  }));
}

// ---------------------------------------------------------- Multi-store --

export function seedStores(currentId: string, currentName: string): StoreSummary[] {
  return [
    { workspaceId: currentId, name: currentName, currency: "EGP", ordersToday: 41, revenueTodayAmount: 4210000, ordersMonth: 1184, revenueMonthAmount: 118400000, netProfitMonthAmount: 31200000, adSpendMonthAmount: 38600000, deliveryRateBp: 6810, status: "active" },
    { workspaceId: "ws-2", name: "Nawat Perfumes", currency: "EGP", ordersToday: 12, revenueTodayAmount: 980000, ordersMonth: 402, revenueMonthAmount: 29100000, netProfitMonthAmount: 8900000, adSpendMonthAmount: 7400000, deliveryRateBp: 7420, status: "active" },
    { workspaceId: "ws-3", name: "KSA Store — SAR", currency: "SAR", ordersToday: 6, revenueTodayAmount: 129000, ordersMonth: 188, revenueMonthAmount: 4120000, netProfitMonthAmount: 1310000, adSpendMonthAmount: 1200000, deliveryRateBp: 8100, status: "active" },
    { workspaceId: "ws-4", name: "Old Fashion Store", currency: "EGP", ordersToday: 0, revenueTodayAmount: 0, ordersMonth: 0, revenueMonthAmount: 0, netProfitMonthAmount: 0, adSpendMonthAmount: 0, deliveryRateBp: 0, status: "paused" },
  ];
}
