/**
 * Admin mock API. The only real endpoint used here is GET /admin/workspaces
 * (via the shared api-client); everything else is a localStorage stand-in.
 * Each method carries a `// BACKEND:` comment with the endpoint it should
 * become once the platform-admin API exists.
 */
import type { Workspace } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import {
  collection,
  daysFromNow,
  delay,
  hoursAgo,
  nowIso,
  readCollection,
  resetMockData,
  slugify,
  uid,
  writeCollection,
} from "./store";
import {
  generateMeta,
  seedAdminUsers,
  seedAnnouncements,
  seedApps,
  seedAudit,
  seedBlocklist,
  seedDemoWorkspaces,
  seedFlags,
  seedFraudSignals,
  seedPlans,
  seedProviders,
  seedSeries,
  seedServices,
  seedSuppliers,
  seedTemplates,
  seedTickets,
} from "./seed";
import type {
  AdminRole,
  AdminUser,
  AdminWorkspace,
  Announcement,
  AnnouncementInput,
  AttentionItem,
  AuditEntry,
  BillingCycle,
  BlocklistEntry,
  BlocklistInput,
  FeatureFlag,
  FeatureFlagInput,
  FraudSignal,
  MarketplaceApp,
  MarketplaceAppInput,
  OverviewData,
  Plan,
  PlanInput,
  Provider,
  ProviderKind,
  ServiceTile,
  Supplier,
  Template,
  TemplateInput,
  Ticket,
  TicketPriority,
  TicketStatus,
  WorkspaceListResult,
  WorkspaceMeta,
} from "./types";

// ------------------------------------------------------------------ plumbing

const plans = collection<Plan>("plans", seedPlans);
const templates = collection<Template>("templates", seedTemplates);
const suppliers = collection<Supplier>("suppliers", seedSuppliers);
const apps = collection<MarketplaceApp>("apps", seedApps);
const providers = collection<Provider>("providers", seedProviders);
const fraudSignals = collection<FraudSignal>("fraudSignals", seedFraudSignals);
const blocklist = collection<BlocklistEntry>("blocklist", seedBlocklist);
const tickets = collection<Ticket>("tickets", seedTickets);
const announcements = collection<Announcement>("announcements", seedAnnouncements);
const flags = collection<FeatureFlag>("featureFlags", seedFlags);
const auditLog = collection<AuditEntry>("audit", seedAudit);
const services = collection<ServiceTile>("services", seedServices);
const adminUsers = collection<AdminUser>("adminUsers", seedAdminUsers);

let actor: { name: string; email: string } = { name: "Platform admin", email: "admin@example.com" };

/** Called by the layout so audit entries carry the signed-in admin. */
function setMockActor(next: { name: string; email: string } | null) {
  if (next) actor = next;
}

function fail(message: string): never {
  throw new Error(message);
}

function snapshot<T>(value: T): unknown {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
}

function audit(input: {
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  before: unknown;
  after: unknown;
}) {
  // BACKEND: written server-side by every admin mutation; no client call.
  auditLog.upsert({
    id: uid("aud"),
    actorName: actor.name,
    actorEmail: actor.email,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    workspaceId: input.workspaceId ?? null,
    workspaceName: input.workspaceName ?? null,
    ip: "127.0.0.1",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    createdAt: nowIso(),
    before: snapshot(input.before),
    after: snapshot(input.after),
  });
}

// ------------------------------------------------------------------ workspaces

interface BaseCache {
  list: Workspace[];
  source: "api" | "demo";
  apiError: string | null;
}

let baseCache: BaseCache | null = null;

function readMetaMap(): Record<string, WorkspaceMeta> {
  return readCollection<Record<string, WorkspaceMeta>>("workspaceMeta", () => ({}));
}

function metaFor(ws: Workspace, index: number, map: Record<string, WorkspaceMeta>, planIds: string[]): { meta: WorkspaceMeta; created: boolean } {
  const existing = map[ws.id];
  if (existing) return { meta: existing, created: false };
  const meta = generateMeta(ws, planIds, index);
  map[ws.id] = meta;
  return { meta, created: true };
}

function mrrOf(meta: WorkspaceMeta, plan: Plan | null): number {
  if (!plan) return 0;
  if (meta.subscriptionStatus !== "active" && meta.subscriptionStatus !== "past_due") return 0;
  return meta.billingCycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
}

function buildRows(base: BaseCache): WorkspaceListResult {
  const map = readMetaMap();
  const planList = plans.all();
  const planIds = planList.map((p) => p.id);
  let dirty = false;
  const rows: AdminWorkspace[] = base.list.map((ws, i) => {
    const { meta, created } = metaFor(ws, i, map, planIds);
    if (created) dirty = true;
    const plan = planList.find((p) => p.id === meta.planId) ?? null;
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      createdAt: ws.createdAt,
      currency: ws.defaultCurrency ?? "EGP",
      meta,
      plan,
      mrr: mrrOf(meta, plan),
    };
  });
  if (dirty) writeCollection("workspaceMeta", map);
  return { rows, source: base.source, apiError: base.apiError };
}

async function loadBase(force: boolean): Promise<BaseCache> {
  if (baseCache && !force) return baseCache;
  try {
    // BACKEND (real): GET /admin/workspaces
    const list = await apiClient.adminListWorkspaces();
    // A 200 with an unexpected shape resolves, so the catch below never sees
    // it. Guard here or buildRows() dies on `base.list.map`.
    if (!Array.isArray(list)) {
      throw new Error("Workspace list came back in an unexpected shape.");
    }
    baseCache = { list, source: "api", apiError: null };
  } catch (err) {
    baseCache = {
      list: readCollection<Workspace[]>("demoWorkspaces", seedDemoWorkspaces),
      source: "demo",
      apiError: getErrorMessage(err, "Couldn't load workspaces."),
    };
  }
  return baseCache;
}

function updateMeta(workspaceId: string, patch: Partial<WorkspaceMeta>): WorkspaceMeta {
  const map = readMetaMap();
  const current = map[workspaceId] ?? fail("Workspace not found.");
  const next = { ...current, ...patch };
  map[workspaceId] = next;
  writeCollection("workspaceMeta", map);
  return next;
}

async function requireWorkspace(id: string): Promise<AdminWorkspace> {
  const ws = (await getWorkspace(id)) ?? fail("Workspace not found.");
  return ws;
}

/**
 * Real workspace list merged with mock enrichment (plan, subscription, owner,
 * volume metrics, members, domains).
 */
async function listWorkspaces(opts: { force?: boolean } = {}): Promise<WorkspaceListResult> {
  // BACKEND: GET /admin/workspaces?include=subscription,owner,metrics — enrichment fields
  // (plan, subscription status, owner, orders/GMV 30d, delivery/RTO rate) should come from the API.
  const base = await loadBase(opts.force ?? true);
  return delay(buildRows(base), 120);
}

async function getWorkspace(id: string): Promise<AdminWorkspace | null> {
  // BACKEND: GET /admin/workspaces/:id
  const base = await loadBase(false);
  return delay(buildRows(base).rows.find((w) => w.id === id) ?? null, 120);
}

async function searchWorkspaces(query: string): Promise<AdminWorkspace[]> {
  // BACKEND: GET /admin/workspaces?search=:query&limit=8
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const base = await loadBase(false);
  return buildRows(base)
    .rows.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q) ||
        w.meta.ownerEmail.toLowerCase().includes(q) ||
        w.meta.ownerName.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

async function changePlan(workspaceId: string, planId: string, billingCycle: BillingCycle): Promise<AdminWorkspace> {
  // BACKEND: PATCH /admin/workspaces/:id/subscription { planId, billingCycle }
  const ws = await requireWorkspace(workspaceId);
  plans.find(planId) ?? fail("Plan not found.");
  const before = { planId: ws.meta.planId, billingCycle: ws.meta.billingCycle };
  updateMeta(workspaceId, { planId, billingCycle });
  audit({ action: "workspace.plan_changed", entityType: "subscription", entityId: workspaceId, entityLabel: `${ws.name} subscription`, workspaceId, workspaceName: ws.name, before, after: { planId, billingCycle } });
  return requireWorkspace(workspaceId);
}

async function extendTrial(workspaceId: string, days: number): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/subscription/extend-trial { days }
  if (!Number.isFinite(days) || days < 1 || days > 90) fail("Extend by 1 to 90 days.");
  const ws = await requireWorkspace(workspaceId);
  const from = ws.meta.trialEndsAt && new Date(ws.meta.trialEndsAt).getTime() > Date.now() ? new Date(ws.meta.trialEndsAt) : new Date();
  from.setDate(from.getDate() + days);
  const before = { status: ws.meta.subscriptionStatus, trialEndsAt: ws.meta.trialEndsAt };
  const patch: Partial<WorkspaceMeta> = { subscriptionStatus: "trialing", trialEndsAt: from.toISOString(), canceledAt: null, lastPaymentFailedAt: null };
  updateMeta(workspaceId, patch);
  audit({ action: "subscription.trial_extended", entityType: "subscription", entityId: workspaceId, entityLabel: `${ws.name} subscription`, workspaceId, workspaceName: ws.name, before, after: patch });
  return requireWorkspace(workspaceId);
}

async function markPaid(workspaceId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/subscription/mark-paid
  const ws = await requireWorkspace(workspaceId);
  const before = { status: ws.meta.subscriptionStatus, nextBillingAt: ws.meta.nextBillingAt };
  const patch: Partial<WorkspaceMeta> = {
    subscriptionStatus: "active",
    lastPaymentFailedAt: null,
    trialEndsAt: null,
    canceledAt: null,
    nextBillingAt: daysFromNow(ws.meta.billingCycle === "yearly" ? 365 : 30),
  };
  updateMeta(workspaceId, patch);
  audit({ action: "subscription.marked_paid", entityType: "subscription", entityId: workspaceId, entityLabel: `${ws.name} subscription`, workspaceId, workspaceName: ws.name, before, after: patch });
  return requireWorkspace(workspaceId);
}

async function retryPayment(workspaceId: string): Promise<{ ok: boolean; workspace: AdminWorkspace }> {
  // BACKEND: POST /admin/workspaces/:id/subscription/retry-payment
  const ws = await requireWorkspace(workspaceId);
  const ok = Math.random() < 0.7;
  const patch: Partial<WorkspaceMeta> = ok
    ? { subscriptionStatus: "active", lastPaymentFailedAt: null, nextBillingAt: daysFromNow(ws.meta.billingCycle === "yearly" ? 365 : 30) }
    : { lastPaymentFailedAt: nowIso() };
  updateMeta(workspaceId, patch);
  audit({ action: ok ? "subscription.payment_retried" : "subscription.payment_retry_failed", entityType: "subscription", entityId: workspaceId, entityLabel: `${ws.name} subscription`, workspaceId, workspaceName: ws.name, before: { status: ws.meta.subscriptionStatus }, after: patch });
  return delay({ ok, workspace: await requireWorkspace(workspaceId) }, 500);
}

async function cancelSubscription(workspaceId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/subscription/cancel
  const ws = await requireWorkspace(workspaceId);
  const patch: Partial<WorkspaceMeta> = { subscriptionStatus: "canceled", canceledAt: nowIso(), nextBillingAt: null, trialEndsAt: null };
  updateMeta(workspaceId, patch);
  audit({ action: "subscription.canceled", entityType: "subscription", entityId: workspaceId, entityLabel: `${ws.name} subscription`, workspaceId, workspaceName: ws.name, before: { status: ws.meta.subscriptionStatus }, after: patch });
  return requireWorkspace(workspaceId);
}

async function suspendWorkspace(workspaceId: string, reason: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/suspend { reason }
  if (!reason.trim()) fail("A reason is required.");
  const ws = await requireWorkspace(workspaceId);
  updateMeta(workspaceId, { suspended: true, suspendedReason: reason.trim() });
  audit({ action: "workspace.suspended", entityType: "workspace", entityId: workspaceId, entityLabel: ws.name, workspaceId, workspaceName: ws.name, before: { suspended: false }, after: { suspended: true, reason: reason.trim() } });
  return requireWorkspace(workspaceId);
}

async function unsuspendWorkspace(workspaceId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/unsuspend
  const ws = await requireWorkspace(workspaceId);
  updateMeta(workspaceId, { suspended: false, suspendedReason: null });
  audit({ action: "workspace.unsuspended", entityType: "workspace", entityId: workspaceId, entityLabel: ws.name, workspaceId, workspaceName: ws.name, before: { suspended: true, reason: ws.meta.suspendedReason }, after: { suspended: false } });
  return requireWorkspace(workspaceId);
}

async function recheckDomain(workspaceId: string, domainId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/domains/:domainId/verify
  const ws = await requireWorkspace(workspaceId);
  const domains = ws.meta.domains.map((d) =>
    d.id === domainId ? { ...d, verified: true, ssl: "active" as const, lastCheckedAt: nowIso() } : d
  );
  updateMeta(workspaceId, { domains });
  return delay(await requireWorkspace(workspaceId), 400);
}

async function listWorkspaceActivity(workspaceId: string): Promise<AuditEntry[]> {
  // BACKEND: GET /admin/audit-log?workspaceId=:id
  return delay(
    auditLog
      .all()
      .filter((e) => e.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

// ------------------------------------------------------------------ overview

async function getOverview(): Promise<OverviewData> {
  // BACKEND: GET /admin/metrics/overview (KPIs + series) and GET /admin/alerts (needs attention)
  const workspaces = await listWorkspaces({ force: false });
  const rows = workspaces.rows;
  const totalOrders30 = rows.reduce((s, w) => s + w.meta.ordersLast30d, 0);
  const kpis = {
    activeWorkspaces: rows.filter((w) => w.meta.subscriptionStatus === "active" && !w.meta.suspended).length,
    trialing: rows.filter((w) => w.meta.subscriptionStatus === "trialing").length,
    pastDue: rows.filter((w) => w.meta.subscriptionStatus === "past_due").length,
    mrr: rows.reduce((s, w) => s + w.mrr, 0),
    gmv30d: rows.reduce((s, w) => s + w.meta.gmvLast30d, 0),
    ordersToday: rows.reduce((s, w) => s + w.meta.ordersToday, 0),
    deliveryRate: totalOrders30 === 0 ? 0 : rows.reduce((s, w) => s + w.meta.deliveryRate * w.meta.ordersLast30d, 0) / totalOrders30,
  };

  const signupsPerDay = seedSeries(30, 11, 0, 6);
  const ordersPerDay = seedSeries(30, 23, Math.max(kpis.ordersToday * 0.6, 1), Math.max(kpis.ordersToday * 1.1, 2));
  if (ordersPerDay.length) ordersPerDay[ordersPerDay.length - 1].value = kpis.ordersToday;
  const mrrTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i), 1);
    const factor = 0.45 + (0.55 * i) / 11 + (i % 3 === 1 ? -0.02 : 0);
    return { label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }), value: Math.round(kpis.mrr * Math.min(factor, 1)) };
  });

  const attention: AttentionItem[] = [];
  for (const w of rows) {
    if (w.meta.subscriptionStatus === "past_due") {
      attention.push({ id: `pd-${w.id}`, kind: "past_due", title: `${w.name} is past due`, detail: `${w.plan?.name ?? "Plan"} · payment failed`, to: `/workspaces/${w.id}?tab=subscription`, severity: "warning" });
    }
    if (w.meta.rtoRate >= 30 && w.meta.ordersLast30d >= 50) {
      attention.push({ id: `rto-${w.id}`, kind: "high_rto", title: `High RTO at ${w.name}`, detail: `${w.meta.rtoRate}% returned to origin over ${w.meta.ordersLast30d} orders (30d)`, to: `/workspaces/${w.id}`, severity: "danger" });
    }
    for (const d of w.meta.domains) {
      if (!d.verified) {
        attention.push({ id: `dom-${d.id}`, kind: "unverified_domain", title: `Unverified domain ${d.hostname}`, detail: `${w.name} · added ${new Date(d.addedAt).toLocaleDateString("en")}`, to: `/workspaces/${w.id}?tab=domains`, severity: "info" });
      }
    }
  }
  for (const p of providers.all().filter((x) => x.kind === "carrier" && x.enabled && x.health !== "operational")) {
    attention.push({ id: `car-${p.id}`, kind: "carrier_error", title: `${p.name} API ${p.health}`, detail: p.lastError ?? `${p.errorRate24h}% error rate (24h)`, to: "/carriers", severity: p.health === "down" ? "danger" : "warning" });
  }
  const rank = { danger: 0, warning: 1, info: 2 } as const;
  attention.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const recentSignups = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return delay({ workspaces, kpis, signupsPerDay, mrrTrend, ordersPerDay, attention, recentSignups });
}

// ------------------------------------------------------------------ plans

async function listPlans(): Promise<Plan[]> {
  // BACKEND: GET /admin/plans
  return delay(plans.all());
}

async function savePlan(input: PlanInput): Promise<Plan> {
  // BACKEND: POST /admin/plans (create) | PATCH /admin/plans/:id (update)
  const name = input.name.trim();
  const code = slugify(input.code || name);
  if (!name) fail("Plan name is required.");
  if (input.monthlyPrice < 0 || input.yearlyPrice < 0) fail("Prices can't be negative.");
  if (input.transactionFeeBp < 0 || input.codFeeBp < 0) fail("Fees can't be negative.");
  if (plans.all().some((p) => p.code === code && p.id !== input.id)) fail(`Another plan already uses the code "${code}".`);
  const existing = input.id ? plans.find(input.id) : undefined;
  const plan: Plan = {
    ...input,
    id: existing?.id ?? uid("plan"),
    name,
    code,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  plans.upsert(plan);
  audit({ action: existing ? "plan.updated" : "plan.created", entityType: "plan", entityId: plan.id, entityLabel: plan.name, before: existing ?? null, after: plan });
  return delay(plan);
}

async function deletePlan(id: string): Promise<void> {
  // BACKEND: DELETE /admin/plans/:id
  const plan = plans.find(id) ?? fail("Plan not found.");
  const inUse = Object.values(readMetaMap()).filter((m) => m.planId === id && m.subscriptionStatus !== "canceled").length;
  if (inUse > 0) fail(`${inUse} workspace${inUse === 1 ? " is" : "s are"} on this plan. Move them to another plan first, or mark the plan inactive.`);
  plans.remove(id);
  audit({ action: "plan.deleted", entityType: "plan", entityId: id, entityLabel: plan.name, before: plan, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ templates

async function listTemplates(): Promise<Template[]> {
  // BACKEND: GET /admin/templates
  return delay(templates.all());
}

async function saveTemplate(input: TemplateInput): Promise<Template> {
  // BACKEND: POST /admin/templates | PATCH /admin/templates/:id
  const name = input.name.trim();
  if (!name) fail("Template name is required.");
  if (!/^#[0-9a-f]{6}$/i.test(input.primaryColor)) fail("Primary color must be a hex value like #0066FF.");
  if (!input.free && input.price <= 0) fail("Paid templates need a price above zero.");
  const existing = input.id ? templates.find(input.id) : undefined;
  const tpl: Template = {
    ...input,
    name,
    price: input.free ? 0 : input.price,
    id: existing?.id ?? uid("tpl"),
    versions: existing?.versions ?? [{ id: uid("tv"), version: "1.0.0", notes: "Initial release.", createdAt: nowIso() }],
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  templates.upsert(tpl);
  audit({ action: existing ? "template.updated" : "template.created", entityType: "template", entityId: tpl.id, entityLabel: tpl.name, before: existing ?? null, after: tpl });
  return delay(tpl);
}

async function setTemplatePublished(id: string, published: boolean): Promise<Template> {
  // BACKEND: POST /admin/templates/:id/publish | POST /admin/templates/:id/unpublish
  const before = templates.find(id) ?? fail("Template not found.");
  const tpl = templates.update(id, { published, updatedAt: nowIso() });
  audit({ action: published ? "template.published" : "template.unpublished", entityType: "template", entityId: id, entityLabel: tpl.name, before: { published: before.published }, after: { published } });
  return delay(tpl, 150);
}

async function addTemplateVersion(id: string, version: string, notes: string): Promise<Template> {
  // BACKEND: POST /admin/templates/:id/versions { version, notes }
  const tpl = templates.find(id) ?? fail("Template not found.");
  const v = version.trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) fail("Use a semantic version like 1.2.0.");
  if (tpl.versions.some((x) => x.version === v)) fail(`Version ${v} already exists.`);
  const next = templates.update(id, {
    versions: [...tpl.versions, { id: uid("tv"), version: v, notes: notes.trim(), createdAt: nowIso() }],
    updatedAt: nowIso(),
  });
  audit({ action: "template.version_added", entityType: "template", entityId: id, entityLabel: tpl.name, before: null, after: { version: v, notes } });
  return delay(next);
}

async function deleteTemplate(id: string): Promise<void> {
  // BACKEND: DELETE /admin/templates/:id
  const tpl = templates.find(id) ?? fail("Template not found.");
  templates.remove(id);
  audit({ action: "template.deleted", entityType: "template", entityId: id, entityLabel: tpl.name, before: tpl, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ suppliers

async function listSuppliers(): Promise<Supplier[]> {
  // BACKEND: GET /admin/suppliers?status=
  return delay([...suppliers.all()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
}

async function approveSupplier(id: string): Promise<Supplier> {
  // BACKEND: POST /admin/suppliers/:id/approve
  const before = suppliers.find(id) ?? fail("Supplier not found.");
  const s = suppliers.update(id, { status: "approved", reviewedAt: nowIso(), reviewedBy: actor.name, rejectionReason: null });
  audit({ action: "supplier.approved", entityType: "supplier", entityId: id, entityLabel: s.name, before: { status: before.status }, after: { status: "approved" } });
  return delay(s);
}

async function rejectSupplier(id: string, reason: string): Promise<Supplier> {
  // BACKEND: POST /admin/suppliers/:id/reject { reason }
  if (!reason.trim()) fail("A rejection reason is required — it is shared with the supplier.");
  const before = suppliers.find(id) ?? fail("Supplier not found.");
  const s = suppliers.update(id, { status: "rejected", reviewedAt: nowIso(), reviewedBy: actor.name, rejectionReason: reason.trim() });
  audit({ action: "supplier.rejected", entityType: "supplier", entityId: id, entityLabel: s.name, before: { status: before.status }, after: { status: "rejected", reason: reason.trim() } });
  return delay(s);
}

// ------------------------------------------------------------------ apps

async function listApps(): Promise<MarketplaceApp[]> {
  // BACKEND: GET /admin/apps
  return delay(apps.all());
}

async function saveApp(input: MarketplaceAppInput): Promise<MarketplaceApp> {
  // BACKEND: POST /admin/apps | PATCH /admin/apps/:id
  const name = input.name.trim();
  if (!name) fail("App name is required.");
  const existing = input.id ? apps.find(input.id) : undefined;
  const slug = existing?.slug ?? slugify(name);
  if (!existing && apps.all().some((a) => a.slug === slug)) fail("An app with this name already exists.");
  const app: MarketplaceApp = {
    id: existing?.id ?? uid("app"),
    slug,
    installs: existing?.installs ?? 0,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    name,
    category: input.category,
    description: input.description.trim(),
    status: input.status,
  };
  apps.upsert(app);
  audit({ action: existing ? "app.updated" : "app.created", entityType: "app", entityId: app.id, entityLabel: app.name, before: existing ?? null, after: app });
  return delay(app);
}

async function deleteApp(id: string): Promise<void> {
  // BACKEND: DELETE /admin/apps/:id
  const app = apps.find(id) ?? fail("App not found.");
  apps.remove(id);
  audit({ action: "app.deleted", entityType: "app", entityId: id, entityLabel: app.name, before: app, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ providers

const PROVIDER_PATH: Record<ProviderKind, string> = {
  carrier: "carriers",
  payment: "payment-gateways",
  whatsapp: "whatsapp-numbers",
};

async function listProviders(kind: ProviderKind): Promise<Provider[]> {
  // BACKEND: GET /admin/carriers | GET /admin/payment-gateways | GET /admin/whatsapp-numbers
  void PROVIDER_PATH[kind];
  return delay(providers.all().filter((p) => p.kind === kind));
}

async function setProviderEnabled(id: string, enabled: boolean): Promise<Provider> {
  // BACKEND: PATCH /admin/{carriers|payment-gateways|whatsapp-numbers}/:id { enabled }
  const before = providers.find(id) ?? fail("Provider not found.");
  if (enabled && before.credentialStatus === "missing") fail("Add credentials on the backend before enabling this provider.");
  const p = providers.update(id, { enabled });
  audit({ action: enabled ? "provider.enabled" : "provider.disabled", entityType: "provider", entityId: id, entityLabel: p.name, before: { enabled: before.enabled }, after: { enabled } });
  return delay(p, 150);
}

async function runProviderCheck(id: string): Promise<Provider> {
  // BACKEND: POST /admin/{carriers|payment-gateways|whatsapp-numbers}/:id/health-check
  const p = providers.find(id) ?? fail("Provider not found.");
  const credentialsBad = p.credentialStatus !== "configured";
  const jitter = Math.round((Math.random() - 0.5) * 120);
  const next = providers.update(id, {
    lastCheckAt: nowIso(),
    health: credentialsBad ? "down" : p.health,
    latencyMs: credentialsBad ? 0 : Math.max(60, p.latencyMs + jitter),
    lastError: credentialsBad ? `Credentials ${p.credentialStatus}.` : p.lastError,
  });
  return delay(next, 700);
}

// ------------------------------------------------------------------ risk

async function listFraudSignals(): Promise<FraudSignal[]> {
  // BACKEND: GET /admin/risk/signals?minStores=2
  return delay([...fraudSignals.all()].sort((a, b) => b.storesCount - a.storesCount));
}

async function blockFraudSignal(id: string, reason: string): Promise<FraudSignal> {
  // BACKEND: POST /admin/risk/blocklist { type, value, reason, sourceSignalId }
  const s = fraudSignals.find(id) ?? fail("Signal not found.");
  if (s.blocked) fail("Already on the global blocklist.");
  await saveBlocklistEntry({ type: s.type, value: s.value, reason: reason.trim() || `Seen across ${s.storesCount} stores with ${s.rtoCount} RTO.`, expiresAt: null });
  const next = fraudSignals.update(id, { blocked: true });
  return delay(next, 100);
}

async function listBlocklist(): Promise<BlocklistEntry[]> {
  // BACKEND: GET /admin/risk/blocklist
  return delay([...blocklist.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

function normalizeBlockValue(type: BlocklistEntry["type"], value: string): string {
  const v = value.trim();
  if (type === "email") return v.toLowerCase();
  return v;
}

async function saveBlocklistEntry(input: BlocklistInput): Promise<BlocklistEntry> {
  // BACKEND: POST /admin/risk/blocklist | PATCH /admin/risk/blocklist/:id
  const value = normalizeBlockValue(input.type, input.value);
  if (!value) fail("Value is required.");
  if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail("Enter a valid email address.");
  if (input.type === "ip" && !/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(value)) fail("Enter a valid IPv4 or IPv6 address.");
  if (input.type === "phone" && value.replace(/\D/g, "").length < 8) fail("Enter a full phone number including country code.");
  if (!input.reason.trim()) fail("A reason is required.");
  const clash = blocklist.all().find((b) => b.type === input.type && b.value.replace(/\s/g, "") === value.replace(/\s/g, "") && b.id !== input.id);
  if (clash) fail("This value is already on the blocklist.");
  const existing = input.id ? blocklist.find(input.id) : undefined;
  const entry: BlocklistEntry = {
    id: existing?.id ?? uid("blk"),
    type: input.type,
    value,
    reason: input.reason.trim(),
    expiresAt: input.expiresAt,
    createdBy: existing?.createdBy ?? actor.name,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  blocklist.upsert(entry);
  audit({ action: existing ? "blocklist.entry_updated" : "blocklist.entry_added", entityType: "blocklist_entry", entityId: entry.id, entityLabel: entry.value, before: existing ?? null, after: entry });
  return delay(entry);
}

async function deleteBlocklistEntry(id: string): Promise<void> {
  // BACKEND: DELETE /admin/risk/blocklist/:id
  const entry = blocklist.find(id) ?? fail("Entry not found.");
  blocklist.remove(id);
  const sig = fraudSignals.all().find((s) => s.type === entry.type && s.value === entry.value);
  if (sig) fraudSignals.update(sig.id, { blocked: false });
  audit({ action: "blocklist.entry_removed", entityType: "blocklist_entry", entityId: id, entityLabel: entry.value, before: entry, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ tickets

async function listTickets(): Promise<Ticket[]> {
  // BACKEND: GET /admin/support/tickets?status=&priority=&assigneeId=
  return delay([...tickets.all()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

async function getTicket(id: string): Promise<Ticket | null> {
  // BACKEND: GET /admin/support/tickets/:id
  return delay(tickets.find(id) ?? null);
}

async function replyTicket(id: string, body: string, internal: boolean): Promise<Ticket> {
  // BACKEND: POST /admin/support/tickets/:id/messages { body, internal }
  const text = body.trim();
  if (!text) fail("Write a reply first.");
  const t = tickets.find(id) ?? fail("Ticket not found.");
  const now = nowIso();
  const next = tickets.update(id, {
    messages: [...t.messages, { id: uid("tm"), authorType: "admin", authorName: actor.name, body: text, internal, createdAt: now }],
    status: !internal && t.status === "open" ? "pending" : t.status,
    updatedAt: now,
  });
  audit({ action: internal ? "ticket.note_added" : "ticket.replied", entityType: "ticket", entityId: id, entityLabel: `#${t.number}`, workspaceId: t.workspaceId, workspaceName: t.workspaceName, before: { status: t.status }, after: { status: next.status } });
  return delay(next);
}

async function updateTicket(
  id: string,
  patch: Partial<{ status: TicketStatus; priority: TicketPriority; assigneeId: string | null }>
): Promise<Ticket> {
  // BACKEND: PATCH /admin/support/tickets/:id { status, priority, assigneeId }
  const t = tickets.find(id) ?? fail("Ticket not found.");
  const next = tickets.update(id, { ...patch, updatedAt: nowIso() });
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as Array<keyof typeof patch>) before[k] = t[k];
  audit({ action: "ticket.updated", entityType: "ticket", entityId: id, entityLabel: `#${t.number}`, workspaceId: t.workspaceId, workspaceName: t.workspaceName, before, after: patch });
  return delay(next, 150);
}

// ------------------------------------------------------------------ announcements

function announcementStatus(a: Pick<Announcement, "startsAt" | "endsAt">): "scheduled" | "live" | "ended" {
  const now = Date.now();
  if (new Date(a.startsAt).getTime() > now) return "scheduled";
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return "ended";
  return "live";
}

async function listAnnouncements(): Promise<Announcement[]> {
  // BACKEND: GET /admin/announcements
  return delay([...announcements.all()].sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
}

async function saveAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  // BACKEND: POST /admin/announcements | PATCH /admin/announcements/:id
  if (!input.title.trim()) fail("Title is required.");
  if (!input.body.trim()) fail("Message is required.");
  if (input.audience === "plan" && !input.planId) fail("Pick a plan for this audience.");
  if (input.audience === "workspace" && !input.workspaceId) fail("Pick a workspace for this audience.");
  if (input.endsAt && new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) fail("End time must be after the start time.");
  const existing = input.id ? announcements.find(input.id) : undefined;
  const a: Announcement = {
    ...input,
    title: input.title.trim(),
    body: input.body.trim(),
    planId: input.audience === "plan" ? input.planId : null,
    workspaceId: input.audience === "workspace" ? input.workspaceId : null,
    workspaceName: input.audience === "workspace" ? input.workspaceName : null,
    id: existing?.id ?? uid("ann"),
    createdAt: existing?.createdAt ?? nowIso(),
    createdBy: existing?.createdBy ?? actor.name,
  };
  announcements.upsert(a);
  audit({ action: existing ? "announcement.updated" : "announcement.created", entityType: "announcement", entityId: a.id, entityLabel: a.title, before: existing ?? null, after: a });
  return delay(a);
}

async function deleteAnnouncement(id: string): Promise<void> {
  // BACKEND: DELETE /admin/announcements/:id
  const a = announcements.find(id) ?? fail("Announcement not found.");
  announcements.remove(id);
  audit({ action: "announcement.deleted", entityType: "announcement", entityId: id, entityLabel: a.title, before: a, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ feature flags

async function listFlags(): Promise<FeatureFlag[]> {
  // BACKEND: GET /admin/feature-flags
  return delay([...flags.all()].sort((a, b) => a.key.localeCompare(b.key)));
}

async function saveFlag(input: FeatureFlagInput): Promise<FeatureFlag> {
  // BACKEND: POST /admin/feature-flags | PATCH /admin/feature-flags/:id
  const key = input.key.trim();
  if (!/^[a-z0-9]+([._][a-z0-9]+)*$/.test(key)) fail("Use lowercase letters, numbers, dots and underscores (e.g. checkout.one_page_v2).");
  if (flags.all().some((f) => f.key === key && f.id !== input.id)) fail("A flag with this key already exists.");
  const rollout = Math.min(100, Math.max(0, Math.round(input.rollout)));
  const existing = input.id ? flags.find(input.id) : undefined;
  const flag: FeatureFlag = {
    id: existing?.id ?? uid("flag"),
    key,
    description: input.description.trim(),
    enabled: input.enabled,
    rollout,
    targetWorkspaceIds: Array.from(new Set(input.targetWorkspaceIds)),
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  flags.upsert(flag);
  audit({
    action: existing ? "feature_flag.updated" : "feature_flag.created",
    entityType: "feature_flag",
    entityId: flag.id,
    entityLabel: flag.key,
    before: existing ? { enabled: existing.enabled, rollout: existing.rollout, targetWorkspaceIds: existing.targetWorkspaceIds } : null,
    after: { enabled: flag.enabled, rollout: flag.rollout, targetWorkspaceIds: flag.targetWorkspaceIds },
  });
  return delay(flag, 120);
}

async function deleteFlag(id: string): Promise<void> {
  // BACKEND: DELETE /admin/feature-flags/:id
  const f = flags.find(id) ?? fail("Flag not found.");
  flags.remove(id);
  audit({ action: "feature_flag.deleted", entityType: "feature_flag", entityId: id, entityLabel: f.key, before: f, after: null });
  await delay(null);
}

// ------------------------------------------------------------------ audit / health / admins

async function listAudit(): Promise<AuditEntry[]> {
  // BACKEND: GET /admin/audit-log?actor=&action=&entityType=&workspaceId=&from=&to=&cursor=
  return delay([...auditLog.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

async function listServices(): Promise<ServiceTile[]> {
  // BACKEND: GET /admin/system/services
  return delay(services.all());
}

async function recheckServices(): Promise<ServiceTile[]> {
  // BACKEND: POST /admin/system/services/check
  const next = services.all().map((s) => ({
    ...s,
    lastCheckAt: nowIso(),
    latencyMs: s.latencyMs === null ? null : Math.max(1, Math.round(s.latencyMs * (0.85 + Math.random() * 0.3))),
  }));
  services.save(next);
  return delay(next, 600);
}

async function listAdminUsers(): Promise<AdminUser[]> {
  // BACKEND: GET /admin/users
  return delay(adminUsers.all());
}

async function inviteAdminUser(input: { name: string; email: string; role: AdminRole }): Promise<AdminUser> {
  // BACKEND: POST /admin/users/invitations { name, email, role }
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim()) fail("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.");
  if (adminUsers.all().some((u) => u.email.toLowerCase() === email)) fail("This person already has an admin account or invitation.");
  const user: AdminUser = { id: uid("adm"), name: input.name.trim(), email, role: input.role, status: "invited", mfaEnabled: false, lastActiveAt: null, invitedAt: nowIso() };
  adminUsers.upsert(user);
  audit({ action: "admin_user.invited", entityType: "admin_user", entityId: user.id, entityLabel: user.email, before: null, after: { email, role: user.role } });
  return delay(user);
}

async function updateAdminUser(id: string, patch: Partial<Pick<AdminUser, "role" | "status">>): Promise<AdminUser> {
  // BACKEND: PATCH /admin/users/:id { role, status }
  const before = adminUsers.find(id) ?? fail("Admin user not found.");
  if (before.role === "super_admin" && (patch.role && patch.role !== "super_admin" || patch.status === "disabled")) {
    const others = adminUsers.all().filter((u) => u.id !== id && u.role === "super_admin" && u.status === "active");
    if (others.length === 0) fail("Keep at least one active super admin.");
  }
  const next = adminUsers.update(id, patch);
  audit({ action: "admin_user.updated", entityType: "admin_user", entityId: id, entityLabel: next.email, before: { role: before.role, status: before.status }, after: patch });
  return delay(next, 150);
}

async function resendAdminInvite(id: string): Promise<AdminUser> {
  // BACKEND: POST /admin/users/:id/resend-invitation
  const u = adminUsers.update(id, { invitedAt: nowIso() });
  return delay(u);
}

function resetAllMockData() {
  resetMockData();
  baseCache = null;
}

/** Relative timestamp helper used by a few seeds/pages. */
export const mockClock = { hoursAgo };

export const adminApi = {
  setMockActor,
  // workspaces
  listWorkspaces,
  getWorkspace,
  searchWorkspaces,
  changePlan,
  extendTrial,
  markPaid,
  retryPayment,
  cancelSubscription,
  suspendWorkspace,
  unsuspendWorkspace,
  recheckDomain,
  listWorkspaceActivity,
  // overview
  getOverview,
  // plans & marketplace
  listPlans,
  savePlan,
  deletePlan,
  listTemplates,
  saveTemplate,
  setTemplatePublished,
  addTemplateVersion,
  deleteTemplate,
  listSuppliers,
  approveSupplier,
  rejectSupplier,
  listApps,
  saveApp,
  deleteApp,
  // operations
  listProviders,
  setProviderEnabled,
  runProviderCheck,
  // risk
  listFraudSignals,
  blockFraudSignal,
  listBlocklist,
  saveBlocklistEntry,
  deleteBlocklistEntry,
  // support
  listTickets,
  getTicket,
  replyTicket,
  updateTicket,
  announcementStatus,
  listAnnouncements,
  saveAnnouncement,
  deleteAnnouncement,
  // system
  listFlags,
  saveFlag,
  deleteFlag,
  listAudit,
  listServices,
  recheckServices,
  listAdminUsers,
  inviteAdminUser,
  updateAdminUser,
  resendAdminInvite,
  resetAllMockData,
};
