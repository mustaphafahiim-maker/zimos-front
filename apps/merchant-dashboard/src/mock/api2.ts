/**
 * Phase-2 mock endpoints. Same rules as api.ts: keep the signature, swap the
 * body for an apiClient call when the backend lands. Endpoint per method is in
 * the BACKEND comment.
 */
import { delay, nowIso, readCollection, uid, writeCollection } from "./store";
import * as seed from "./seed2";
import type {
  AdAccount,
  Affiliate,
  Agent,
  CallCenterSettings,
  CallLog,
  CallOutcome,
  Campaign,
  ConfirmationItem,
  ProductEconomics,
  ProductReview,
  ReturnRequest,
  Settlement,
  StoreSummary,
  Supplier,
  SupplierProduct,
  WaBotSettings,
  WaConversation,
  WaMessage,
} from "./types2";

function col<T>(ws: string, name: string, seeder: () => T) {
  return {
    get: () => readCollection<T>(ws, name, seeder),
    set: (v: T) => writeCollection<T>(ws, name, v),
  };
}

export const mockApi2 = {
  // ------------------------------------------------- Ads / media buying --
  // BACKEND: GET/POST/DELETE /workspaces/:id/ads/accounts  (NEW — OAuth with Meta/TikTok/Snap marketing APIs)
  listAdAccounts: (ws: string) => delay(col<AdAccount[]>(ws, "adAccounts", seed.seedAdAccounts).get()),
  reconnectAdAccount: (ws: string, id: string) => {
    const c = col<AdAccount[]>(ws, "adAccounts", seed.seedAdAccounts);
    c.set(c.get().map((a) => (a.id === id ? { ...a, status: "connected", lastSyncAt: nowIso() } : a)));
    return delay(true, 800);
  },
  // BACKEND: POST /workspaces/:id/ads/accounts  (NEW — OAuth callback stores the platform token)
  connectAdAccount: (ws: string, platform: AdAccount["platform"], name: string) => {
    const c = col<AdAccount[]>(ws, "adAccounts", seed.seedAdAccounts);
    const acc: AdAccount = { id: uid(), platform, name, externalId: `act_${uid().slice(0, 10)}`, currency: "USD", status: "connected", lastSyncAt: nowIso(), spendTodayAmount: 0 };
    c.set([...c.get(), acc]);
    return delay(acc, 900);
  },
  // BACKEND: GET /workspaces/:id/ads/campaigns?range=  (NEW — pulls spend from ad platforms, joins orders via utm_campaign / fbclid / ttclid)
  listCampaigns: (ws: string) => delay(col<Campaign[]>(ws, "campaigns.v2", seed.seedCampaigns).get(), 350),
  // BACKEND: POST /workspaces/:id/ads/campaigns/:id/status  (NEW — writes back to the ad platform)
  setCampaignStatus: (ws: string, id: string, status: Campaign["status"]) => {
    const c = col<Campaign[]>(ws, "campaigns.v2", seed.seedCampaigns);
    c.set(c.get().map((x) => (x.id === id ? { ...x, status } : x)));
    return delay(true);
  },
  setCampaignBudget: (ws: string, id: string, dailyBudgetAmount: number) => {
    const c = col<Campaign[]>(ws, "campaigns.v2", seed.seedCampaigns);
    c.set(c.get().map((x) => (x.id === id ? { ...x, dailyBudgetAmount } : x)));
    return delay(true);
  },
  // BACKEND: GET/PUT /workspaces/:id/products/:productId/economics  (NEW — COGS + cost assumptions per product)
  listEconomics: (ws: string) => delay(col<ProductEconomics[]>(ws, "economics", seed.seedEconomics).get()),
  saveEconomics: (ws: string, rows: ProductEconomics[]) => delay(col<ProductEconomics[]>(ws, "economics", seed.seedEconomics).set(rows)),
  // BACKEND: GET /workspaces/:id/analytics/pnl?range=  (NEW — delivered revenue minus every cost)
  getPnl: (_ws: string, range: "7d" | "30d" | "90d") => delay(seed.seedPnl(range), 350),

  // ----------------------------------------------------- Call center --
  // BACKEND: GET /workspaces/:id/confirmation-tasks (exists) — extend with customer history, priority, attempts, nextAttemptAt
  listConfirmationQueue: (ws: string) => delay(col<ConfirmationItem[]>(ws, "cq", seed.seedConfirmationQueue).get()),
  // BACKEND: POST /confirmation-tasks/:id/claim (exists)
  claimConfirmation: (ws: string, id: string, agentId: string) => {
    const c = col<ConfirmationItem[]>(ws, "cq", seed.seedConfirmationQueue);
    c.set(c.get().map((x) => (x.id === id ? { ...x, assignedAgentId: agentId } : x)));
    return delay(true);
  },
  // BACKEND: POST /confirmation-tasks/:id/outcome (exists) + POST /calls (NEW — VoIP call log with recording)
  recordCallOutcome: (ws: string, id: string, input: { agentId: string; agentName: string; outcome: CallOutcome; note: string | null; durationSeconds: number; postponeMinutes?: number }) => {
    const c = col<ConfirmationItem[]>(ws, "cq", seed.seedConfirmationQueue);
    const logs = col<CallLog[]>(ws, "callLogs", seed.seedCallLogs);
    const list = c.get();
    const item = list.find((x) => x.id === id);
    if (!item) return delay(false);
    logs.set([{ id: uid(), orderId: item.orderId, orderNumber: item.orderNumber, agentId: input.agentId, agentName: input.agentName, startedAt: nowIso(), durationSeconds: input.durationSeconds, outcome: input.outcome, note: input.note, recordingUrl: input.durationSeconds > 0 ? "#recording" : null }, ...logs.get()]);
    const terminal = input.outcome === "confirmed" || input.outcome === "cancelled" || input.outcome === "duplicate" || input.outcome === "wrong_number";
    if (terminal) c.set(list.filter((x) => x.id !== id));
    else {
      const next = new Date(Date.now() + (input.postponeMinutes ?? 180) * 60000).toISOString();
      c.set(list.map((x) => (x.id === id ? { ...x, attempts: x.attempts + 1, lastOutcome: input.outcome, nextAttemptAt: next } : x)));
    }
    return delay(true);
  },
  // BACKEND: GET /workspaces/:id/calls?agentId=&outcome=  (NEW)
  listCallLogs: (ws: string) => delay(col<CallLog[]>(ws, "callLogs", seed.seedCallLogs).get()),
  // BACKEND: GET /workspaces/:id/agents (members with role confirmation_agent + presence)  (EXTEND)
  listAgents: (ws: string) => delay(col<Agent[]>(ws, "agents", seed.seedAgents).get()),
  setAgentStatus: (ws: string, id: string, status: Agent["status"]) => {
    const c = col<Agent[]>(ws, "agents", seed.seedAgents);
    c.set(c.get().map((a) => (a.id === id ? { ...a, status } : a)));
    return delay(true);
  },
  // BACKEND: GET/PUT /workspaces/:id/settings/call-center  (NEW)
  getCallCenterSettings: (ws: string) => delay(col<CallCenterSettings>(ws, "ccSettings", seed.seedCallCenterSettings).get()),
  saveCallCenterSettings: (ws: string, s: CallCenterSettings) => delay(col<CallCenterSettings>(ws, "ccSettings", seed.seedCallCenterSettings).set(s)),

  // ---------------------------------------------------------- WhatsApp --
  // BACKEND: GET /workspaces/:id/whatsapp/conversations  (NEW — Meta Cloud API webhooks → conversations table)
  listWaConversations: (ws: string) => delay(col<WaConversation[]>(ws, "wa", seed.seedWaConversations).get()),
  // BACKEND: POST /workspaces/:id/whatsapp/conversations/:id/messages  (NEW)
  sendWaMessage: (ws: string, id: string, body: string) => {
    const c = col<WaConversation[]>(ws, "wa", seed.seedWaConversations);
    const msg: WaMessage = { id: uid(), direction: "out", body, at: nowIso(), status: "sent", byBot: false };
    c.set(c.get().map((x) => (x.id === id ? { ...x, messages: [...x.messages, msg], lastMessage: body, lastAt: msg.at, unread: 0, status: "open" } : x)));
    return delay(msg);
  },
  setWaStatus: (ws: string, id: string, status: WaConversation["status"]) => {
    const c = col<WaConversation[]>(ws, "wa", seed.seedWaConversations);
    c.set(c.get().map((x) => (x.id === id ? { ...x, status, unread: 0 } : x)));
    return delay(true);
  },
  // BACKEND: GET/PUT /workspaces/:id/whatsapp/bot  (NEW)
  getWaBot: (ws: string) => delay(col<WaBotSettings>(ws, "waBot", seed.seedWaBot).get()),
  saveWaBot: (ws: string, s: WaBotSettings) => delay(col<WaBotSettings>(ws, "waBot", seed.seedWaBot).set(s)),

  // -------------------------------------------------------- Settlements --
  // BACKEND: GET /workspaces/:id/settlements  (NEW — one row per carrier payout; import carrier CSV or pull via API)
  listSettlements: (ws: string) => delay(col<Settlement[]>(ws, "settlements.v2", seed.seedSettlements).get()),
  // BACKEND: GET /workspaces/:id/settlements/:id/orders  (NEW — order-level reconciliation)
  getSettlementOrders: (_ws: string, id: string) => delay(seed.seedSettlementOrders(id), 300),
  // BACKEND: POST /workspaces/:id/settlements/:id/reconcile | /mark-received  (NEW)
  setSettlementStatus: (ws: string, id: string, status: Settlement["status"]) => {
    const c = col<Settlement[]>(ws, "settlements.v2", seed.seedSettlements);
    c.set(c.get().map((s) => (s.id === id ? { ...s, status, receivedAt: status === "received" || status === "reconciled" ? s.receivedAt ?? nowIso() : s.receivedAt } : s)));
    return delay(true);
  },

  // ---------------------------------------------------------- Affiliates --
  // BACKEND: GET/POST/PATCH /workspaces/:id/affiliates + public /ref/:code redirect  (NEW)
  listAffiliates: (ws: string) => delay(col<Affiliate[]>(ws, "affiliates", seed.seedAffiliates).get()),
  saveAffiliate: (ws: string, a: Affiliate) => {
    const c = col<Affiliate[]>(ws, "affiliates", seed.seedAffiliates);
    const list = c.get();
    c.set(list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]);
    return delay(a);
  },
  payAffiliate: (ws: string, id: string) => {
    const c = col<Affiliate[]>(ws, "affiliates", seed.seedAffiliates);
    c.set(c.get().map((a) => (a.id === id ? { ...a, paidAmount: a.earnedAmount } : a)));
    return delay(true);
  },

  // ------------------------------------------------------------- Reviews --
  // BACKEND: GET /workspaces/:id/reviews?status= + PATCH /reviews/:id  (EXISTS — reviews module)
  listReviews: (ws: string) => delay(col<ProductReview[]>(ws, "reviews.v2", seed.seedReviews).get()),
  setReviewStatus: (ws: string, id: string, status: ProductReview["status"]) => {
    const c = col<ProductReview[]>(ws, "reviews.v2", seed.seedReviews);
    c.set(c.get().map((r) => (r.id === id ? { ...r, status } : r)));
    return delay(true);
  },

  // ------------------------------------------------------------- Returns --
  // BACKEND: GET /workspaces/:id/returns + PATCH /returns/:id (EXISTS) — add kind rto + carrier + restock step
  listReturns: (ws: string) => delay(col<ReturnRequest[]>(ws, "returns", seed.seedReturns).get()),
  setReturnStatus: (ws: string, id: string, status: ReturnRequest["status"]) => {
    const c = col<ReturnRequest[]>(ws, "returns", seed.seedReturns);
    c.set(c.get().map((r) => (r.id === id ? { ...r, status } : r)));
    return delay(true);
  },

  // ----------------------------------------------------------- Suppliers --
  // BACKEND: GET /suppliers, GET /suppliers/products, POST /workspaces/:id/catalog/import-from-supplier  (NEW marketplace)
  listSuppliers: () => delay(seed.seedSuppliers()),
  listSupplierProducts: (ws: string) => delay(col<SupplierProduct[]>(ws, "supplierProducts", seed.seedSupplierProducts).get()),
  importSupplierProduct: (ws: string, id: string) => {
    const c = col<SupplierProduct[]>(ws, "supplierProducts", seed.seedSupplierProducts);
    c.set(c.get().map((p) => (p.id === id ? { ...p, imported: true } : p)));
    return delay(true, 600);
  },

  // ---------------------------------------------------------- Multi-store --
  // BACKEND: GET /me/stores/overview  (NEW — aggregates across the user's workspaces)
  listStores: (ws: string, name: string) => delay(seed.seedStores(ws, name)),

  // Helper for pickers
  listAgentsSync: (ws: string) => col<Agent[]>(ws, "agents", seed.seedAgents).get(),
};

export type { StoreSummary, Supplier };
