/**
 * mockApi — the prototype's stand-in for backend endpoints that do not exist
 * yet. Every method is annotated with the endpoint it should become. Keep the
 * signatures; when the backend lands, replace the body with an `apiClient`
 * call and delete the localStorage plumbing.
 *
 * See BACKEND_CONTRACT.md at the repo root for the full list.
 */
import { delay, nowIso, readCollection, uid, writeCollection, slugify } from "./store";
import * as seed from "./seed";
import type {
  AbandonedCheckout,
  AppIntegration,
  Automation,
  BlockedEntry,
  CamouflageSettings,
  Carrier,
  CarrierAccount,
  CheckoutSettings,
  ConversionOffer,
  CurrencySetting,
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

function col<T>(ws: string, name: string, seeder: () => T) {
  return {
    get: () => readCollection<T>(ws, name, seeder),
    set: (v: T) => writeCollection<T>(ws, name, v),
  };
}

export const mockApi = {
  // ------------------------------------------------------------ Funnels --
  // BACKEND: GET /workspaces/:id/funnels  (exists — funnelsService)
  listFunnels: (ws: string) => delay(col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws)).get()),
  // BACKEND: GET /workspaces/:id/funnels/:funnelId  (exists)
  getFunnel: (ws: string, id: string) =>
    delay(col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws)).get().find((f) => f.id === id) ?? null),
  // BACKEND: POST /workspaces/:id/funnels  (exists)
  createFunnel: (ws: string, input: { name: string; templateId?: string | null }) => {
    const c = col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws));
    const list = c.get();
    const landingId = uid();
    const funnel: Funnel = {
      id: uid(),
      workspaceId: ws,
      name: input.name,
      slug: slugify(input.name) || `funnel-${list.length + 1}`,
      status: "draft",
      entryStepKey: "landing",
      steps: [
        { id: landingId, key: "landing", name: "صفحة الهبوط", type: "landing", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: 0, conversions: 0, x: 40, y: 120 },
        { id: uid(), key: "checkout", name: "الدفع", type: "checkout", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: 0, conversions: 0, x: 320, y: 120 },
        { id: uid(), key: "thanks", name: "شكراً لطلبك", type: "thank_you", offerId: null, offerName: null, priceAmount: null, experimentId: null, views: 0, conversions: 0, x: 600, y: 120 },
      ],
      edges: [
        { id: uid(), fromStepKey: "landing", toStepKey: "checkout", condition: "always", priority: 1 },
        { id: uid(), fromStepKey: "checkout", toStepKey: "thanks", condition: "completed_checkout", priority: 1 },
      ],
      visits: 0,
      orders: 0,
      revenueAmount: "0",
      currency: "EGP",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      publishedAt: null,
    };
    c.set([funnel, ...list]);
    return delay(funnel);
  },
  // BACKEND: PATCH /workspaces/:id/funnels/:funnelId (+ steps/edges sub-routes exist)
  saveFunnel: (ws: string, funnel: Funnel) => {
    const c = col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws));
    const next = { ...funnel, updatedAt: nowIso() };
    c.set(c.get().map((f) => (f.id === funnel.id ? next : f)));
    return delay(next);
  },
  // BACKEND: POST /workspaces/:id/funnels/:funnelId/publish | /pause | /resume  (exist)
  setFunnelStatus: (ws: string, id: string, status: Funnel["status"]) => {
    const c = col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws));
    c.set(c.get().map((f) => (f.id === id ? { ...f, status, publishedAt: status === "published" ? nowIso() : f.publishedAt, updatedAt: nowIso() } : f)));
    return delay(true);
  },
  // BACKEND: POST /workspaces/:id/funnels/:funnelId/duplicate  (NEW)
  duplicateFunnel: (ws: string, id: string) => {
    const c = col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws));
    const list = c.get();
    const src = list.find((f) => f.id === id);
    if (!src) return delay(null);
    const copy: Funnel = { ...src, id: uid(), name: `${src.name} (نسخة)`, slug: `${src.slug}-copy`, status: "draft", visits: 0, orders: 0, revenueAmount: "0", publishedAt: null, createdAt: nowIso(), updatedAt: nowIso() };
    c.set([copy, ...list]);
    return delay(copy);
  },
  // BACKEND: DELETE /workspaces/:id/funnels/:funnelId  (exists)
  deleteFunnel: (ws: string, id: string) => {
    const c = col<Funnel[]>(ws, "funnels", () => seed.seedFunnels(ws));
    c.set(c.get().filter((f) => f.id !== id));
    return delay(true);
  },

  // -------------------------------------------------------- Experiments --
  // BACKEND: GET/POST /workspaces/:id/experiments  (model exists, no routes)
  listExperiments: (ws: string) => delay(col<Experiment[]>(ws, "experiments", () => seed.seedExperiments(ws)).get()),
  saveExperiment: (ws: string, exp: Experiment) => {
    const c = col<Experiment[]>(ws, "experiments", () => seed.seedExperiments(ws));
    const list = c.get();
    const exists = list.some((e) => e.id === exp.id);
    c.set(exists ? list.map((e) => (e.id === exp.id ? exp : e)) : [exp, ...list]);
    return delay(exp);
  },
  deleteExperiment: (ws: string, id: string) => {
    const c = col<Experiment[]>(ws, "experiments", () => seed.seedExperiments(ws));
    c.set(c.get().filter((e) => e.id !== id));
    return delay(true);
  },

  // ------------------------------------------------------------- Offers --
  // BACKEND: GET/POST/PATCH/DELETE /workspaces/:id/conversion-offers  (NEW — extends `offers`)
  listOffers: (ws: string) => delay(col<ConversionOffer[]>(ws, "offers", () => seed.seedOffers(ws)).get()),
  saveOffer: (ws: string, offer: ConversionOffer) => {
    const c = col<ConversionOffer[]>(ws, "offers", () => seed.seedOffers(ws));
    const list = c.get();
    const exists = list.some((o) => o.id === offer.id);
    c.set(exists ? list.map((o) => (o.id === offer.id ? offer : o)) : [offer, ...list]);
    return delay(offer);
  },
  deleteOffer: (ws: string, id: string) => {
    const c = col<ConversionOffer[]>(ws, "offers", () => seed.seedOffers(ws));
    c.set(c.get().filter((o) => o.id !== id));
    return delay(true);
  },

  // ------------------------------------------------------------- Pixels --
  // BACKEND: GET/POST/PATCH/DELETE /workspaces/:id/tracking-pixels  (NEW)
  listPixels: (ws: string) => delay(col<TrackingPixel[]>(ws, "pixels", () => seed.seedPixels(ws)).get()),
  savePixel: (ws: string, px: TrackingPixel) => {
    const c = col<TrackingPixel[]>(ws, "pixels", () => seed.seedPixels(ws));
    const list = c.get();
    const exists = list.some((p) => p.id === px.id);
    c.set(exists ? list.map((p) => (p.id === px.id ? px : p)) : [px, ...list]);
    return delay(px);
  },
  deletePixel: (ws: string, id: string) => {
    const c = col<TrackingPixel[]>(ws, "pixels", () => seed.seedPixels(ws));
    c.set(c.get().filter((p) => p.id !== id));
    return delay(true);
  },

  // -------------------------------------------------------- Automations --
  // BACKEND: GET/POST/PATCH/DELETE /workspaces/:id/automations  (AutomationRule model exists, no routes)
  listAutomations: (ws: string) => delay(col<Automation[]>(ws, "automations", () => seed.seedAutomations(ws)).get()),
  saveAutomation: (ws: string, a: Automation) => {
    const c = col<Automation[]>(ws, "automations", () => seed.seedAutomations(ws));
    const list = c.get();
    const exists = list.some((x) => x.id === a.id);
    c.set(exists ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]);
    return delay(a);
  },
  deleteAutomation: (ws: string, id: string) => {
    const c = col<Automation[]>(ws, "automations", () => seed.seedAutomations(ws));
    c.set(c.get().filter((x) => x.id !== id));
    return delay(true);
  },

  // -------------------------------------------------------------- Fraud --
  // BACKEND: GET/PUT /workspaces/:id/fraud/settings  (NEW)
  getFraudSettings: (ws: string) => delay(col<FraudSettings>(ws, "fraud", () => seed.seedFraudSettings(ws)).get()),
  saveFraudSettings: (ws: string, s: FraudSettings) => delay(col<FraudSettings>(ws, "fraud", () => seed.seedFraudSettings(ws)).set(s)),
  // BACKEND: GET/POST/DELETE /workspaces/:id/fraud/blocklist  (NEW)
  listBlocked: (ws: string) => delay(col<BlockedEntry[]>(ws, "blocked", () => seed.seedBlocked(ws)).get()),
  addBlocked: (ws: string, entry: Omit<BlockedEntry, "id" | "createdAt" | "hits" | "workspaceId">) => {
    const c = col<BlockedEntry[]>(ws, "blocked", () => seed.seedBlocked(ws));
    const e: BlockedEntry = { ...entry, id: uid(), workspaceId: ws, hits: 0, createdAt: nowIso() };
    c.set([e, ...c.get()]);
    return delay(e);
  },
  removeBlocked: (ws: string, id: string) => {
    const c = col<BlockedEntry[]>(ws, "blocked", () => seed.seedBlocked(ws));
    c.set(c.get().filter((e) => e.id !== id));
    return delay(true);
  },
  // BACKEND: GET /workspaces/:id/fraud/flagged + POST .../:orderId/approve|block  (NEW — reuse orders.riskFlags)
  listFlagged: (ws: string) => delay(col<FlaggedOrder[]>(ws, "flagged", seed.seedFlaggedOrders).get()),
  resolveFlagged: (ws: string, id: string, status: "approved" | "blocked") => {
    const c = col<FlaggedOrder[]>(ws, "flagged", seed.seedFlaggedOrders);
    c.set(c.get().map((f) => (f.id === id ? { ...f, status } : f)));
    return delay(true);
  },

  // ----------------------------------------------------------- Shipping --
  // BACKEND: GET /shipping/carriers (static catalogue)  (NEW)
  listCarriers: (): Promise<Carrier[]> => delay(seed.CARRIERS),
  // BACKEND: GET/POST/PATCH/DELETE /workspaces/:id/shipping/carrier-accounts  (NEW)
  listCarrierAccounts: (ws: string) => delay(col<CarrierAccount[]>(ws, "carriers", () => seed.seedCarrierAccounts(ws)).get()),
  saveCarrierAccount: (ws: string, acc: CarrierAccount) => {
    const c = col<CarrierAccount[]>(ws, "carriers", () => seed.seedCarrierAccounts(ws));
    let list = c.get();
    if (acc.isDefault) list = list.map((a) => ({ ...a, isDefault: false }));
    const exists = list.some((a) => a.id === acc.id);
    c.set(exists ? list.map((a) => (a.id === acc.id ? acc : a)) : [...list, acc]);
    return delay(acc);
  },
  deleteCarrierAccount: (ws: string, id: string) => {
    const c = col<CarrierAccount[]>(ws, "carriers", () => seed.seedCarrierAccounts(ws));
    c.set(c.get().filter((a) => a.id !== id));
    return delay(true);
  },

  // -------------------------------------------------- Abandoned checkouts --
  // BACKEND: GET /workspaces/:id/abandoned-checkouts  (checkout_sessions table exists; needs a list + recovery status)
  listAbandoned: (ws: string) => delay(col<AbandonedCheckout[]>(ws, "abandoned", () => seed.seedAbandoned(ws)).get()),
  // BACKEND: POST /workspaces/:id/abandoned-checkouts/:id/recover  (NEW — sends WhatsApp/SMS with cart link)
  setAbandonedStatus: (ws: string, id: string, status: AbandonedCheckout["recoveryStatus"]) => {
    const c = col<AbandonedCheckout[]>(ws, "abandoned", () => seed.seedAbandoned(ws));
    c.set(c.get().map((a) => (a.id === id ? { ...a, recoveryStatus: status } : a)));
    return delay(true);
  },

  // --------------------------------------------------------------- Apps --
  // BACKEND: GET /apps + POST /workspaces/:id/apps/:key/install|uninstall  (NEW)
  listApps: (ws: string) => delay(col<AppIntegration[]>(ws, "apps", seed.seedApps).get()),
  setAppInstalled: (ws: string, key: string, installed: boolean) => {
    const c = col<AppIntegration[]>(ws, "apps", seed.seedApps);
    c.set(c.get().map((a) => (a.key === key ? { ...a, installed, status: installed ? "needs_setup" : "not_installed" } : a)));
    return delay(true);
  },

  // ----------------------------------------------------------- Settings --
  // BACKEND: GET/PUT /workspaces/:id/settings/checkout  (NEW — could live in workspaces.settings jsonb)
  getCheckoutSettings: (ws: string) => delay(col<CheckoutSettings>(ws, "checkout", () => seed.seedCheckoutSettings(ws)).get()),
  saveCheckoutSettings: (ws: string, s: CheckoutSettings) => delay(col<CheckoutSettings>(ws, "checkout", () => seed.seedCheckoutSettings(ws)).set(s)),
  // BACKEND: GET/PUT /workspaces/:id/settings/payments  (payments/providers exists; needs per-workspace gateway config)
  listGateways: (ws: string) => delay(col<PaymentGateway[]>(ws, "gateways", seed.seedGateways).get()),
  saveGateways: (ws: string, g: PaymentGateway[]) => delay(col<PaymentGateway[]>(ws, "gateways", seed.seedGateways).set(g)),
  // BACKEND: GET/PUT /workspaces/:id/settings/currencies  (NEW)
  listCurrencies: (ws: string) => delay(col<CurrencySetting[]>(ws, "currencies", seed.seedCurrencies).get()),
  saveCurrencies: (ws: string, c: CurrencySetting[]) => delay(col<CurrencySetting[]>(ws, "currencies", seed.seedCurrencies).set(c)),
  // BACKEND: GET/PUT /workspaces/:id/settings/camouflage  (NEW)
  getCamouflage: (ws: string) => delay(col<CamouflageSettings>(ws, "camouflage", seed.seedCamouflage).get()),
  saveCamouflage: (ws: string, s: CamouflageSettings) => delay(col<CamouflageSettings>(ws, "camouflage", seed.seedCamouflage).set(s)),
  // BACKEND: GET/POST/DELETE /workspaces/:id/domains + /verify  (exists — needs `target` funnel|store)
  listDomains: (ws: string) => delay(col<DomainRecord[]>(ws, "domains", seed.seedDomains).get()),
  addDomain: (ws: string, d: Omit<DomainRecord, "id" | "createdAt" | "status" | "verificationToken">) => {
    const c = col<DomainRecord[]>(ws, "domains", seed.seedDomains);
    const rec: DomainRecord = { ...d, id: uid(), status: "pending_verification", verificationToken: `zimos-verify=${uid().slice(0, 12)}`, createdAt: nowIso() };
    c.set([...c.get(), rec]);
    return delay(rec);
  },
  verifyDomain: (ws: string, id: string) => {
    const c = col<DomainRecord[]>(ws, "domains", seed.seedDomains);
    c.set(c.get().map((d) => (d.id === id ? { ...d, status: "verified" } : d)));
    return delay(true, 900);
  },
  removeDomain: (ws: string, id: string) => {
    const c = col<DomainRecord[]>(ws, "domains", seed.seedDomains);
    c.set(c.get().filter((d) => d.id !== id));
    return delay(true);
  },
  // BACKEND: GET /workspaces/:id/members + invites  (exists)
  listStaff: (ws: string) => delay(col<StaffMember[]>(ws, "staff", seed.seedStaff).get()),
  saveStaff: (ws: string, list: StaffMember[]) => delay(col<StaffMember[]>(ws, "staff", seed.seedStaff).set(list)),
  // BACKEND: GET /workspaces/:id/subscription  (billing exists — needs usage counters)
  getPlan: (ws: string) => delay(col<PlanInfo>(ws, "plan", seed.seedPlan).get()),

  // ---------------------------------------------------------- Analytics --
  // BACKEND: GET /workspaces/:id/analytics/overview?range=30d  (analytics_events table exists; needs aggregation)
  getAnalytics: (_ws: string, range: "7d" | "30d" | "90d") => delay(seed.seedAnalytics(range), 350),

  // ---------------------------------------------------------- Inventory --
  // BACKEND: GET /workspaces/:id/inventory?lowStock=true  (inventory module exists per-variant; needs a list)
  listInventory: (ws: string) => delay(col<InventoryRow[]>(ws, "inventory", seed.seedInventory).get()),
  // BACKEND: POST /workspaces/:id/inventory/adjust  (exists)
  adjustInventory: (ws: string, variantId: string, deltaOnHand: number) => {
    const c = col<InventoryRow[]>(ws, "inventory", seed.seedInventory);
    c.set(c.get().map((r) => (r.variantId === variantId ? { ...r, onHand: r.onHand + deltaOnHand, available: r.onHand + deltaOnHand - r.reserved } : r)));
    return delay(true);
  },
  setLowStockThreshold: (ws: string, variantId: string, threshold: number) => {
    const c = col<InventoryRow[]>(ws, "inventory", seed.seedInventory);
    c.set(c.get().map((r) => (r.variantId === variantId ? { ...r, lowStockThreshold: threshold } : r)));
    return delay(true);
  },

  // ---------------------------------------------------------- Templates --
  // BACKEND: GET /templates  (exists — needs kind/category/price fields)
  listTemplates: (): Promise<StoreTemplate[]> => delay(seed.seedTemplates()),

  // Products for pickers (prototype only; real code uses apiClient.listProducts)
  demoProducts: () => delay(seed.DEMO_PRODUCTS),
};

export type MockApi = typeof mockApi;
