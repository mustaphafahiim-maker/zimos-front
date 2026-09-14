/**
 * Control-center mock API (localStorage). Every mutation writes an audit entry
 * through the shared `recordAudit` helper. Each function names the endpoint it
 * should become in a `// BACKEND:` comment.
 */
import { adminApi, getMockActor, patchWorkspaceMeta, recordAudit } from "./adminApi";
import { collection, daysFromNow, delay, nowIso, readCollection, uid, writeCollection } from "./store";
import {
  seedApiKeys,
  seedChangelog,
  seedCms,
  seedControl,
  seedCron,
  seedDeliveries,
  seedExportRequests,
  seedFaq,
  seedIntegrations,
  seedInvoices,
  seedJobs,
  seedLegal,
  seedMessageTemplates,
  seedPayouts,
  seedRefunds,
  seedReports,
  seedRoleMatrix,
  seedSettings,
  seedSnapshots,
  seedUsers,
  seedWebhooks,
} from "./controlSeed";
import type { AdminRole, AdminWorkspace, Plan, PlanFeatureKey, WorkspaceMember } from "./types";
import type {
  ApiKey,
  BackgroundJob,
  BackupSnapshot,
  ChangelogPost,
  CmsContent,
  ControlAlert,
  CronSchedule,
  DataExportRequest,
  FaqEntry,
  IntegrationDefault,
  Invoice,
  KycStatus,
  LegalDoc,
  LegalDocKey,
  LimitKey,
  LimitValues,
  MessageTemplate,
  ModerationReport,
  Payout,
  PayoutStatus,
  PermissionKey,
  PlatformSettings,
  PlatformUser,
  PlatformUserStatus,
  Refund,
  ReportStatus,
  RoleMatrix,
  StoreStatus,
  WebhookDelivery,
  WebhookEndpoint,
  WorkspaceControl,
} from "./controlTypes";

function fail(message: string): never {
  throw new Error(message);
}

function actorName() {
  return getMockActor().name;
}

async function rows(): Promise<AdminWorkspace[]> {
  return (await adminApi.listWorkspaces({ force: false })).rows;
}

/** Collection whose seed depends on the current workspace list. */
function rowsCollection<T extends { id: string }>(name: string, seed: (rows: AdminWorkspace[]) => T[]) {
  return async () => {
    const r = await rows();
    return collection<T>(name, () => seed(r));
  };
}

async function requireWs(id: string): Promise<AdminWorkspace> {
  return (await adminApi.getWorkspace(id)) ?? fail("Workspace not found.");
}

function wsAudit(ws: AdminWorkspace, action: string, before: unknown, after: unknown, entityType = "workspace", entityLabel = ws.name) {
  recordAudit({ action, entityType, entityId: ws.id, entityLabel, workspaceId: ws.id, workspaceName: ws.name, before, after });
}

// ================================================================== workspace control

type ControlMap = Record<string, WorkspaceControl>;

function readControls(): ControlMap {
  return readCollection<ControlMap>("wsControl", () => ({}));
}

function controlFor(ws: AdminWorkspace, map: ControlMap): WorkspaceControl {
  if (!map[ws.id]) {
    map[ws.id] = seedControl(ws);
    writeCollection("wsControl", map);
  }
  return map[ws.id];
}

async function getControl(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: GET /admin/workspaces/:id/control (limits, overrides, storefront, payouts, risk, notes)
  const ws = await requireWs(workspaceId);
  return delay(controlFor(ws, readControls()), 120);
}

async function patchControl(ws: AdminWorkspace, patch: Partial<WorkspaceControl>): Promise<WorkspaceControl> {
  const map = readControls();
  const next = { ...controlFor(ws, map), ...patch };
  map[ws.id] = next;
  writeCollection("wsControl", map);
  return delay(next, 150);
}

export const LIMIT_LABELS: Record<LimitKey, string> = {
  ordersPerMonth: "Orders / month",
  products: "Products",
  staffSeats: "Staff seats",
  domains: "Custom domains",
  funnels: "Funnels",
};

export function planDefaultLimits(plan: Plan | null): LimitValues {
  if (!plan) return { ordersPerMonth: 50, products: 25, staffSeats: 1, domains: 0, funnels: 0 };
  const tier = plan.monthlyPrice === 0 ? 0 : plan.monthlyPrice < 500 ? 1 : plan.monthlyPrice < 1500 ? 2 : 3;
  const table: LimitValues[] = [
    { ordersPerMonth: plan.orderQuota, products: 25, staffSeats: 1, domains: 0, funnels: 0 },
    { ordersPerMonth: plan.orderQuota, products: 250, staffSeats: 3, domains: 1, funnels: 2 },
    { ordersPerMonth: plan.orderQuota, products: 2000, staffSeats: 10, domains: 3, funnels: 10 },
    { ordersPerMonth: plan.orderQuota, products: null, staffSeats: null, domains: 10, funnels: null },
  ];
  return table[tier];
}

async function setLimitOverride(workspaceId: string, key: LimitKey, value: number | null | undefined): Promise<WorkspaceControl> {
  // BACKEND: PATCH /admin/workspaces/:id/limits { [key]: value | null (unlimited) } — omit key to inherit plan
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) fail("Limits must be zero or more.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const overrides = { ...ctl.limitOverrides };
  if (value === undefined) delete overrides[key];
  else overrides[key] = value;
  wsAudit(ws, "workspace.limit_overridden", { [key]: ctl.limitOverrides[key] ?? "plan default" }, { [key]: value === undefined ? "plan default" : value }, "workspace_limits");
  return patchControl(ws, { limitOverrides: overrides });
}

async function setFeatureOverride(workspaceId: string, feature: PlanFeatureKey, value: boolean | undefined): Promise<WorkspaceControl> {
  // BACKEND: PATCH /admin/workspaces/:id/features { [feature]: true | false | null (inherit) }
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const overrides = { ...ctl.featureOverrides };
  if (value === undefined) delete overrides[feature];
  else overrides[feature] = value;
  wsAudit(ws, "workspace.feature_overridden", { [feature]: ctl.featureOverrides[feature] ?? "plan default" }, { [feature]: value ?? "plan default" }, "workspace_features");
  return patchControl(ws, { featureOverrides: overrides });
}

async function compMonths(workspaceId: string, months: number, reason: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/subscription/comp { months, reason }
  if (!Number.isInteger(months) || months < 1 || months > 12) fail("Comp 1 to 12 months.");
  if (!reason.trim()) fail("A reason is required.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const base = ws.meta.nextBillingAt && new Date(ws.meta.nextBillingAt).getTime() > Date.now() ? new Date(ws.meta.nextBillingAt) : new Date();
  base.setMonth(base.getMonth() + months);
  patchWorkspaceMeta(ws.id, { nextBillingAt: base.toISOString(), subscriptionStatus: ws.meta.subscriptionStatus === "canceled" ? "active" : ws.meta.subscriptionStatus === "past_due" ? "active" : ws.meta.subscriptionStatus, lastPaymentFailedAt: null });
  wsAudit(ws, "subscription.comped", { compMonths: ctl.compMonths, nextBillingAt: ws.meta.nextBillingAt }, { compMonths: ctl.compMonths + months, nextBillingAt: base.toISOString(), reason: reason.trim() }, "subscription");
  return patchControl(ws, { compMonths: ctl.compMonths + months });
}

async function applyDiscount(workspaceId: string, percent: number, months: number, reason: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/subscription/discount { percent, months, reason }
  if (!(percent > 0 && percent <= 100)) fail("Discount must be between 1% and 100%.");
  if (!Number.isInteger(months) || months < 1 || months > 24) fail("Duration must be 1 to 24 months.");
  if (!reason.trim()) fail("A reason is required.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const discount = { percent, months, reason: reason.trim(), appliedAt: nowIso() };
  wsAudit(ws, "subscription.discount_applied", ctl.discount, discount, "subscription");
  return patchControl(ws, { discount });
}

async function removeDiscount(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: DELETE /admin/workspaces/:id/subscription/discount
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  wsAudit(ws, "subscription.discount_removed", ctl.discount, null, "subscription");
  return patchControl(ws, { discount: null });
}

async function changeMemberRole(workspaceId: string, memberId: string, role: WorkspaceMember["role"]): Promise<AdminWorkspace> {
  // BACKEND: PATCH /admin/workspaces/:id/members/:memberId { role }
  const ws = await requireWs(workspaceId);
  const member = ws.meta.members.find((m) => m.id === memberId) ?? fail("Member not found.");
  if (member.role === "owner") fail("Use “Make owner” on another member to change the owner.");
  if (role === "owner") fail("Use “Make owner” to transfer ownership.");
  patchWorkspaceMeta(ws.id, { members: ws.meta.members.map((m) => (m.id === memberId ? { ...m, role } : m)) });
  wsAudit(ws, "workspace.member_role_changed", { member: member.email, role: member.role }, { member: member.email, role }, "workspace_member", member.email);
  return requireWs(workspaceId);
}

async function transferOwnership(workspaceId: string, memberId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/owner { memberId } (reset owner)
  const ws = await requireWs(workspaceId);
  const target = ws.meta.members.find((m) => m.id === memberId) ?? fail("Member not found.");
  const prev = ws.meta.members.find((m) => m.role === "owner");
  const members = ws.meta.members.map((m) => (m.id === memberId ? { ...m, role: "owner" as const } : m.role === "owner" ? { ...m, role: "admin" as const } : m));
  patchWorkspaceMeta(ws.id, { members, ownerName: target.name, ownerEmail: target.email });
  wsAudit(ws, "workspace.owner_reset", { owner: prev?.email ?? null }, { owner: target.email }, "workspace_member", target.email);
  return requireWs(workspaceId);
}

async function forceLogout(workspaceId: string, memberId?: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/sessions/revoke { memberId? }
  const ws = await requireWs(workspaceId);
  const who = memberId ? ws.meta.members.find((m) => m.id === memberId)?.email ?? memberId : "all members";
  wsAudit(ws, "workspace.sessions_revoked", null, { target: who });
  return patchControl(ws, { forcedLogoutAt: nowIso() });
}

async function setStoreStatus(workspaceId: string, status: StoreStatus, message: string): Promise<WorkspaceControl> {
  // BACKEND: PATCH /admin/workspaces/:id/storefront { status, maintenanceMessage }
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  if (status === "maintenance" && !message.trim()) fail("Add a message shoppers will see during maintenance.");
  wsAudit(ws, "storefront.status_changed", { status: ctl.storeStatus }, { status, message: message.trim() }, "storefront");
  return patchControl(ws, { storeStatus: status, maintenanceMessage: message.trim() });
}

async function verifyDomain(workspaceId: string, domainId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/domains/:domainId/verify
  const ws = await requireWs(workspaceId);
  const d = ws.meta.domains.find((x) => x.id === domainId) ?? fail("Domain not found.");
  const next = await adminApi.recheckDomain(workspaceId, domainId);
  wsAudit(ws, "domain.verified", { hostname: d.hostname, verified: d.verified }, { hostname: d.hostname, verified: true }, "domain", d.hostname);
  return next;
}

async function removeDomain(workspaceId: string, domainId: string): Promise<AdminWorkspace> {
  // BACKEND: DELETE /admin/workspaces/:id/domains/:domainId
  const ws = await requireWs(workspaceId);
  const d = ws.meta.domains.find((x) => x.id === domainId) ?? fail("Domain not found.");
  if (d.hostname.endsWith(".zimos.store")) fail("The default zimos.store subdomain can't be removed.");
  patchWorkspaceMeta(ws.id, { domains: ws.meta.domains.filter((x) => x.id !== domainId) });
  wsAudit(ws, "domain.removed", d, null, "domain", d.hostname);
  return requireWs(workspaceId);
}

async function resetTheme(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/storefront/theme-reset
  const ws = await requireWs(workspaceId);
  wsAudit(ws, "storefront.theme_reset", null, { resetAt: nowIso() }, "storefront");
  return patchControl(ws, { themeResetAt: nowIso() });
}

async function setPayoutHold(workspaceId: string, hold: boolean, reason: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/payouts/hold { hold, reason }
  if (hold && !reason.trim()) fail("A reason is required to hold payouts.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  wsAudit(ws, hold ? "payouts.held" : "payouts.released", { payoutHold: ctl.payoutHold }, { payoutHold: hold, reason: reason.trim() || null }, "payouts");
  return patchControl(ws, { payoutHold: hold, payoutHoldReason: hold ? reason.trim() : null });
}

async function setSettlementHold(workspaceId: string, settlementId: string, hold: boolean): Promise<WorkspaceControl> {
  // BACKEND: PATCH /admin/workspaces/:id/settlements/:settlementId { status: "held" | "pending" }
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const s = ctl.settlements.find((x) => x.id === settlementId) ?? fail("Settlement not found.");
  if (s.status === "settled") fail("Settled batches can't be held.");
  const status = hold ? ("held" as const) : ("pending" as const);
  wsAudit(ws, hold ? "settlement.held" : "settlement.released", { id: s.id, status: s.status }, { id: s.id, status }, "settlement", `${s.carrier} settlement`);
  return patchControl(ws, { settlements: ctl.settlements.map((x) => (x.id === settlementId ? { ...x, status } : x)) });
}

async function adjustBalance(workspaceId: string, amount: number, reason: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/balance/adjustments { amount, reason }
  if (!Number.isFinite(amount) || amount === 0) fail("Enter a non-zero amount (negative to debit).");
  if (!reason.trim()) fail("A reason is required.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const adj = { id: uid("adj"), amount, reason: reason.trim(), actorName: actorName(), createdAt: nowIso() };
  wsAudit(ws, "balance.adjusted", { balance: ctl.balance }, { balance: ctl.balance + amount, amount, reason: adj.reason }, "balance");
  return patchControl(ws, { balance: ctl.balance + amount, adjustments: [adj, ...ctl.adjustments] });
}

async function setBlocked(workspaceId: string, blocked: boolean, reason: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/risk/block { blocked, reason }
  if (blocked && !reason.trim()) fail("A reason is required.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  wsAudit(ws, blocked ? "risk.workspace_blocked" : "risk.workspace_unblocked", { blocked: ctl.blocked }, { blocked, reason: reason.trim() || null }, "risk");
  return patchControl(ws, { blocked, blockedReason: blocked ? reason.trim() : null });
}

async function decideKyc(workspaceId: string, status: Extract<KycStatus, "approved" | "rejected">, note: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/kyc/decision { status, note }
  if (status === "rejected" && !note.trim()) fail("Explain why KYC was rejected — the merchant sees this note.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const ev = { id: uid("kyc"), status, note: note.trim(), actorName: actorName(), createdAt: nowIso() };
  wsAudit(ws, `kyc.${status}`, { kycStatus: ctl.kycStatus }, { kycStatus: status, note: ev.note }, "kyc");
  return patchControl(ws, { kycStatus: status, kycHistory: [ev, ...ctl.kycHistory] });
}

async function addNote(workspaceId: string, body: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/notes { body }
  if (!body.trim()) fail("Write a note first.");
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const note = { id: uid("note"), body: body.trim(), authorName: actorName(), pinned: false, createdAt: nowIso() };
  wsAudit(ws, "workspace.note_added", null, { body: note.body }, "note");
  return patchControl(ws, { notes: [note, ...ctl.notes] });
}

async function toggleNotePin(workspaceId: string, noteId: string): Promise<WorkspaceControl> {
  // BACKEND: PATCH /admin/workspaces/:id/notes/:noteId { pinned }
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const n = ctl.notes.find((x) => x.id === noteId) ?? fail("Note not found.");
  wsAudit(ws, "workspace.note_pinned", { pinned: n.pinned }, { pinned: !n.pinned }, "note");
  return patchControl(ws, { notes: ctl.notes.map((x) => (x.id === noteId ? { ...x, pinned: !x.pinned } : x)) });
}

async function deleteNote(workspaceId: string, noteId: string): Promise<WorkspaceControl> {
  // BACKEND: DELETE /admin/workspaces/:id/notes/:noteId
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  const n = ctl.notes.find((x) => x.id === noteId) ?? fail("Note not found.");
  wsAudit(ws, "workspace.note_deleted", n, null, "note");
  return patchControl(ws, { notes: ctl.notes.filter((x) => x.id !== noteId) });
}

async function exportWorkspaceData(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/exports { scope: "full" }
  const ws = await requireWs(workspaceId);
  const exportsCol = await exportRequestsCol();
  exportsCol.upsert({ id: uid("exp"), workspaceId: ws.id, workspaceName: ws.name, requestedBy: actorName(), scope: "full", status: "processing", createdAt: nowIso(), completedAt: null });
  wsAudit(ws, "workspace.export_requested", null, { scope: "full" });
  return patchControl(ws, { lastExportAt: nowIso() });
}

async function scheduleDeletion(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: POST /admin/workspaces/:id/deletion { graceDays: 7 }
  const ws = await requireWs(workspaceId);
  const at = daysFromNow(7);
  wsAudit(ws, "workspace.deletion_scheduled", { deletionScheduledAt: null }, { deletionScheduledAt: at });
  return patchControl(ws, { deletionScheduledAt: at });
}

async function cancelDeletion(workspaceId: string): Promise<WorkspaceControl> {
  // BACKEND: DELETE /admin/workspaces/:id/deletion
  const ws = await requireWs(workspaceId);
  const ctl = controlFor(ws, readControls());
  wsAudit(ws, "workspace.deletion_canceled", { deletionScheduledAt: ctl.deletionScheduledAt }, { deletionScheduledAt: null });
  return patchControl(ws, { deletionScheduledAt: null });
}

async function reactivateWorkspace(workspaceId: string): Promise<AdminWorkspace> {
  // BACKEND: POST /admin/workspaces/:id/reactivate (unsuspend + storefront live)
  const ws = await requireWs(workspaceId);
  if (ws.meta.suspended) await adminApi.unsuspendWorkspace(workspaceId);
  const ctl = controlFor(ws, readControls());
  if (ctl.storeStatus === "suspended") await patchControl(ws, { storeStatus: "live" });
  wsAudit(ws, "workspace.reactivated", { suspended: ws.meta.suspended, storeStatus: ctl.storeStatus }, { suspended: false, storeStatus: "live" });
  return requireWs(workspaceId);
}

async function logImpersonation(workspaceId: string): Promise<void> {
  // BACKEND: POST /admin/workspaces/:id/impersonate → short-lived merchant token (not implemented server-side)
  const ws = await requireWs(workspaceId);
  wsAudit(ws, "workspace.impersonation_started", null, { owner: ws.meta.ownerEmail, note: "UI-only; backend support required" });
}

async function listWorkspaceInvoices(workspaceId: string): Promise<Invoice[]> {
  // BACKEND: GET /admin/invoices?workspaceId=:id
  const col = await invoicesCol();
  return delay(col.all().filter((i) => i.workspaceId === workspaceId));
}

// ================================================================== users

const usersCol = rowsCollection<PlatformUser>("platformUsers", seedUsers);

async function listUsers(): Promise<PlatformUser[]> {
  // BACKEND: GET /admin/users?status=&platformAdmin=&search=
  return delay((await usersCol()).all());
}

async function updateUser(id: string, patch: Partial<PlatformUser>, action: string): Promise<PlatformUser> {
  const col = await usersCol();
  const before = col.find(id) ?? fail("User not found.");
  const next = col.update(id, patch);
  const b: Record<string, unknown> = {};
  (Object.keys(patch) as Array<keyof PlatformUser>).forEach((k) => (b[k] = before[k]));
  recordAudit({ action, entityType: "user", entityId: id, entityLabel: before.email, before: b, after: patch });
  return delay(next, 150);
}

async function verifyUserEmail(id: string) {
  // BACKEND: POST /admin/users/:id/verify-email
  return updateUser(id, { emailVerified: true, status: "active" }, "user.email_verified");
}

async function sendPasswordReset(id: string) {
  // BACKEND: POST /admin/users/:id/password-reset (emails a reset link)
  return updateUser(id, { passwordResetSentAt: nowIso() }, "user.password_reset_sent");
}

async function setUserStatus(id: string, status: PlatformUserStatus) {
  // BACKEND: POST /admin/users/:id/suspend | /unsuspend
  return updateUser(id, { status }, status === "suspended" ? "user.suspended" : "user.reactivated");
}

async function setPlatformAdmin(id: string, platformAdmin: boolean) {
  // BACKEND: PATCH /admin/users/:id { platformAdmin } — no backend route yet; mock only
  const col = await usersCol();
  const u = col.find(id) ?? fail("User not found.");
  if (!platformAdmin && u.email.toLowerCase() === getMockActor().email.toLowerCase()) fail("You can't revoke your own platform admin access.");
  return updateUser(id, { platformAdmin }, platformAdmin ? "user.platform_admin_granted" : "user.platform_admin_revoked");
}

// ================================================================== settings

async function getSettings(): Promise<PlatformSettings> {
  // BACKEND: GET /admin/settings
  const plans = await adminApi.listPlans();
  return delay(readCollection<PlatformSettings>("platformSettings", () => seedSettings(plans[0]?.id ?? "")));
}

async function saveSettings<K extends keyof Omit<PlatformSettings, "updatedAt">>(section: K, value: PlatformSettings[K]): Promise<PlatformSettings> {
  // BACKEND: PATCH /admin/settings/:section
  const current = await getSettings();
  if (section === "platform") {
    const p = value as PlatformSettings["platform"];
    if (!p.name.trim()) fail("Platform name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.supportEmail)) fail("Enter a valid support email.");
    if (p.maintenanceMode && !p.maintenanceMessage.trim()) fail("Maintenance mode needs a message.");
  }
  if (section === "signup") {
    const s = value as PlatformSettings["signup"];
    if (s.defaultTrialDays < 0 || s.defaultTrialDays > 90) fail("Trial days must be 0–90.");
    if (s.allowedCountries.length === 0) fail("Allow at least one country.");
  }
  if (section === "commerce") {
    const c = value as PlatformSettings["commerce"];
    if (c.minOrderValue < 0 || c.maxOrderValue <= c.minOrderValue) fail("Max order value must be above the minimum.");
    if (c.defaultCodFee < 0) fail("COD fee can't be negative.");
    if (c.governorates.length === 0) fail("Select at least one governorate.");
  }
  if (section === "localization") {
    const l = value as PlatformSettings["localization"];
    if (l.enabledLocales.length === 0) fail("Enable at least one locale.");
    if (!l.enabledLocales.includes(l.defaultLocale)) fail("The default locale must be enabled.");
  }
  const next: PlatformSettings = { ...current, [section]: value, updatedAt: nowIso() };
  writeCollection("platformSettings", next);
  recordAudit({ action: `settings.${section}_updated`, entityType: "settings", entityId: section, entityLabel: `Settings · ${section}`, before: current[section], after: value });
  return delay(next);
}

async function setMaintenanceMode(on: boolean): Promise<PlatformSettings> {
  const s = await getSettings();
  return saveSettings("platform", { ...s.platform, maintenanceMode: on });
}

const legalCol = collection<LegalDoc>("legalDocs", seedLegal);

async function listLegal(): Promise<LegalDoc[]> {
  // BACKEND: GET /admin/legal
  return delay(legalCol.all());
}

async function publishLegal(id: LegalDocKey, body: string): Promise<LegalDoc> {
  // BACKEND: POST /admin/legal/:id/versions { body }
  if (!body.trim()) fail("Document can't be empty.");
  const doc = legalCol.find(id) ?? fail("Document not found.");
  if (doc.body === body) fail("No changes to publish.");
  const version = doc.version + 1;
  const next = legalCol.update(id, { body, version, updatedAt: nowIso(), history: [...doc.history, { version, body, publishedAt: nowIso(), publishedBy: actorName() }] });
  recordAudit({ action: "legal.version_published", entityType: "legal_doc", entityId: id, entityLabel: doc.title, before: { version: doc.version }, after: { version } });
  return delay(next);
}

const templatesCol = collection<MessageTemplate>("messageTemplates", seedMessageTemplates);

async function listMessageTemplates(): Promise<MessageTemplate[]> {
  // BACKEND: GET /admin/message-templates
  return delay(templatesCol.all());
}

async function saveMessageTemplate(t: MessageTemplate): Promise<MessageTemplate> {
  // BACKEND: PATCH /admin/message-templates/:id { ar, en }
  const before = templatesCol.find(t.id) ?? fail("Template not found.");
  if (!t.en.body.trim() || !t.ar.body.trim()) fail("Both Arabic and English bodies are required.");
  if (t.channel === "email" && (!t.en.subject.trim() || !t.ar.subject.trim())) fail("Email templates need subjects in both languages.");
  const next = templatesCol.update(t.id, { ar: t.ar, en: t.en, updatedAt: nowIso() });
  recordAudit({ action: "message_template.updated", entityType: "message_template", entityId: t.id, entityLabel: t.name, before: { ar: before.ar, en: before.en }, after: { ar: t.ar, en: t.en } });
  return delay(next);
}

async function sendTestMessage(id: string, to: string, locale: "ar" | "en"): Promise<void> {
  // BACKEND: POST /admin/message-templates/:id/test { to, locale }
  const t = templatesCol.find(id) ?? fail("Template not found.");
  if (!to.trim()) fail(t.channel === "email" ? "Enter an email address." : "Enter a phone number.");
  recordAudit({ action: "message_template.test_sent", entityType: "message_template", entityId: id, entityLabel: t.name, before: null, after: { to: to.trim(), locale } });
  await delay(null, 500);
}

const apiKeysCol = collection<ApiKey>("apiKeys", seedApiKeys);

async function listApiKeys(): Promise<ApiKey[]> {
  // BACKEND: GET /admin/api-keys
  return delay(apiKeysCol.all());
}

async function createApiKey(name: string, scopes: string[]): Promise<{ key: ApiKey; secret: string }> {
  // BACKEND: POST /admin/api-keys { name, scopes } → secret shown once
  if (!name.trim()) fail("Name the key.");
  if (scopes.length === 0) fail("Pick at least one scope.");
  const rand = uid("x").slice(2) + Math.random().toString(36).slice(2, 18);
  const secret = `zk_live_${rand}`;
  const key: ApiKey = { id: uid("key"), name: name.trim(), prefix: secret.slice(0, 12), scopes, createdAt: nowIso(), createdBy: actorName(), lastUsedAt: null, revokedAt: null };
  apiKeysCol.upsert(key);
  recordAudit({ action: "api_key.created", entityType: "api_key", entityId: key.id, entityLabel: key.name, before: null, after: { prefix: key.prefix, scopes } });
  return delay({ key, secret });
}

async function revokeApiKey(id: string): Promise<ApiKey> {
  // BACKEND: POST /admin/api-keys/:id/revoke
  const k = apiKeysCol.find(id) ?? fail("Key not found.");
  const next = apiKeysCol.update(id, { revokedAt: nowIso() });
  recordAudit({ action: "api_key.revoked", entityType: "api_key", entityId: id, entityLabel: k.name, before: { revokedAt: null }, after: { revokedAt: next.revokedAt } });
  return delay(next);
}

const webhooksCol = collection<WebhookEndpoint>("webhooks", seedWebhooks);
const deliveriesCol = collection<WebhookDelivery>("webhookDeliveries", seedDeliveries);

async function listWebhooks(): Promise<{ endpoints: WebhookEndpoint[]; deliveries: WebhookDelivery[] }> {
  // BACKEND: GET /admin/webhooks and GET /admin/webhooks/deliveries
  return delay({ endpoints: webhooksCol.all(), deliveries: [...deliveriesCol.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

async function saveWebhook(input: Omit<WebhookEndpoint, "id" | "createdAt"> & { id?: string }): Promise<WebhookEndpoint> {
  // BACKEND: POST /admin/webhooks | PATCH /admin/webhooks/:id
  if (!/^https:\/\/\S+$/.test(input.url.trim())) fail("Webhook URLs must start with https://");
  if (input.events.length === 0) fail("Subscribe to at least one event.");
  const existing = input.id ? webhooksCol.find(input.id) : undefined;
  const ep: WebhookEndpoint = { ...input, url: input.url.trim(), id: existing?.id ?? uid("wh"), createdAt: existing?.createdAt ?? nowIso() };
  webhooksCol.upsert(ep);
  recordAudit({ action: existing ? "webhook.updated" : "webhook.created", entityType: "webhook", entityId: ep.id, entityLabel: ep.url, before: existing ?? null, after: ep });
  return delay(ep);
}

async function deleteWebhook(id: string): Promise<void> {
  // BACKEND: DELETE /admin/webhooks/:id
  const ep = webhooksCol.find(id) ?? fail("Endpoint not found.");
  webhooksCol.remove(id);
  recordAudit({ action: "webhook.deleted", entityType: "webhook", entityId: id, entityLabel: ep.url, before: ep, after: null });
  await delay(null);
}

async function sendTestWebhook(id: string): Promise<WebhookDelivery> {
  // BACKEND: POST /admin/webhooks/:id/test
  const ep = webhooksCol.find(id) ?? fail("Endpoint not found.");
  const d: WebhookDelivery = { id: uid("whd"), endpointId: id, event: "ping", statusCode: Math.random() < 0.85 ? 200 : 502, durationMs: Math.round(100 + Math.random() * 600), createdAt: nowIso() };
  deliveriesCol.upsert(d);
  recordAudit({ action: "webhook.test_sent", entityType: "webhook", entityId: id, entityLabel: ep.url, before: null, after: { statusCode: d.statusCode } });
  return delay(d, 500);
}

const integrationsCol = collection<IntegrationDefault>("integrationDefaults", seedIntegrations);

async function listIntegrations(): Promise<IntegrationDefault[]> {
  // BACKEND: GET /admin/integrations
  return delay(integrationsCol.all());
}

async function setIntegrationEnabled(id: string, enabled: boolean): Promise<IntegrationDefault> {
  // BACKEND: PATCH /admin/integrations/:id { enabled }
  const i = integrationsCol.find(id) ?? fail("Integration not found.");
  const next = integrationsCol.update(id, { enabled });
  recordAudit({ action: enabled ? "integration.enabled" : "integration.disabled", entityType: "integration", entityId: id, entityLabel: i.name, before: { enabled: i.enabled }, after: { enabled } });
  return delay(next, 120);
}

// ================================================================== roles

async function getRoleMatrix(): Promise<RoleMatrix> {
  // BACKEND: GET /admin/roles
  return delay(readCollection<RoleMatrix>("roleMatrix", seedRoleMatrix));
}

async function setRolePermission(role: AdminRole, perm: PermissionKey, granted: boolean): Promise<RoleMatrix> {
  // BACKEND: PATCH /admin/roles/:role { permissions }
  if (role === "super_admin") fail("Super admin always has every permission.");
  const m = readCollection<RoleMatrix>("roleMatrix", seedRoleMatrix);
  const current = m.permissions[role];
  const nextPerms = granted ? Array.from(new Set([...current, perm])) : current.filter((p) => p !== perm);
  const next: RoleMatrix = { ...m, permissions: { ...m.permissions, [role]: nextPerms }, updatedAt: nowIso() };
  writeCollection("roleMatrix", next);
  recordAudit({ action: granted ? "role.permission_granted" : "role.permission_revoked", entityType: "admin_role", entityId: role, entityLabel: role, before: { permission: perm, granted: !granted }, after: { permission: perm, granted } });
  return delay(next, 100);
}

async function setRequire2fa(on: boolean): Promise<RoleMatrix> {
  // BACKEND: PATCH /admin/security { require2fa }
  const m = readCollection<RoleMatrix>("roleMatrix", seedRoleMatrix);
  const next = { ...m, require2fa: on, updatedAt: nowIso() };
  writeCollection("roleMatrix", next);
  recordAudit({ action: "admin_security.require_2fa_changed", entityType: "admin_security", entityId: "2fa", entityLabel: "Require 2FA", before: { require2fa: m.require2fa }, after: { require2fa: on } });
  return delay(next, 100);
}

// ================================================================== finance

const invoicesCol = rowsCollection<Invoice>("invoices", seedInvoices);
const refundsCol = collection<Refund>("refunds", seedRefunds);
const payoutsCol = rowsCollection<Payout>("payouts", seedPayouts);

export interface FinanceSummary {
  mrr: number;
  arr: number;
  arpu: number;
  churnRate: number;
  payingCount: number;
  canceledCount: number;
  transactionFees30d: number;
  codFees30d: number;
  refundsTotal: number;
  invoices: Invoice[];
  refunds: Refund[];
  payouts: Payout[];
}

async function getFinance(): Promise<FinanceSummary> {
  // BACKEND: GET /admin/finance/summary, /admin/invoices, /admin/refunds, /admin/payouts
  const r = await rows();
  const paying = r.filter((w) => w.mrr > 0);
  const canceled = r.filter((w) => w.meta.subscriptionStatus === "canceled");
  const mrr = paying.reduce((s, w) => s + w.mrr, 0);
  // Unknown GMV (api rows) contributes nothing rather than an invented amount.
  const transactionFees30d = Math.round(r.reduce((s, w) => s + ((w.meta.gmvLast30d ?? 0) * (w.plan?.transactionFeeBp ?? 0)) / 10_000, 0));
  const codFees30d = Math.round(r.reduce((s, w) => s + ((w.meta.gmvLast30d ?? 0) * (w.plan?.codFeeBp ?? 0)) / 10_000, 0));
  const refunds = refundsCol.all();
  return delay({
    mrr,
    arr: mrr * 12,
    arpu: paying.length ? Math.round(mrr / paying.length) : 0,
    churnRate: r.length ? (canceled.length / r.length) * 100 : 0,
    payingCount: paying.length,
    canceledCount: canceled.length,
    transactionFees30d,
    codFees30d,
    refundsTotal: refunds.reduce((s, x) => s + x.amount, 0),
    invoices: (await invoicesCol()).all(),
    refunds,
    payouts: (await payoutsCol()).all(),
  });
}

async function markInvoicePaid(id: string): Promise<Invoice> {
  // BACKEND: POST /admin/invoices/:id/mark-paid
  const col = await invoicesCol();
  const inv = col.find(id) ?? fail("Invoice not found.");
  if (inv.status !== "open") fail("Only open invoices can be marked paid.");
  const next = col.update(id, { status: "paid", paidAt: nowIso() });
  recordAudit({ action: "invoice.marked_paid", entityType: "invoice", entityId: id, entityLabel: inv.number, workspaceId: inv.workspaceId, workspaceName: inv.workspaceName, before: { status: inv.status }, after: { status: "paid" } });
  return delay(next);
}

async function refundInvoice(id: string, amount: number, reason: string): Promise<Invoice> {
  // BACKEND: POST /admin/invoices/:id/refund { amount, reason }
  const col = await invoicesCol();
  const inv = col.find(id) ?? fail("Invoice not found.");
  if (inv.status !== "paid") fail("Only paid invoices can be refunded.");
  if (!(amount > 0 && amount <= inv.amount)) fail(`Refund between 1 and ${inv.amount}.`);
  if (!reason.trim()) fail("A reason is required.");
  refundsCol.upsert({ id: uid("rf"), invoiceId: id, invoiceNumber: inv.number, workspaceName: inv.workspaceName, amount, reason: reason.trim(), createdAt: nowIso(), createdBy: actorName() });
  const next = col.update(id, { status: "refunded" });
  recordAudit({ action: "invoice.refunded", entityType: "invoice", entityId: id, entityLabel: inv.number, workspaceId: inv.workspaceId, workspaceName: inv.workspaceName, before: { status: inv.status }, after: { status: "refunded", amount, reason: reason.trim() } });
  return delay(next);
}

async function decidePayout(id: string, status: Extract<PayoutStatus, "approved" | "held" | "pending">, note: string): Promise<Payout> {
  // BACKEND: POST /admin/payouts/:id/approve | /hold { note }
  const col = await payoutsCol();
  const p = col.find(id) ?? fail("Payout not found.");
  if (status === "held" && !note.trim()) fail("A reason is required to hold a payout.");
  const next = col.update(id, { status, decidedAt: nowIso(), note: note.trim() || null });
  recordAudit({ action: `payout.${status === "pending" ? "released" : status}`, entityType: "payout", entityId: id, entityLabel: `${p.workspaceName} payout`, workspaceId: p.workspaceId, workspaceName: p.workspaceName, before: { status: p.status }, after: { status, note: note.trim() || null } });
  return delay(next, 150);
}

// ================================================================== content

async function getCms(): Promise<CmsContent> {
  // BACKEND: GET /admin/cms
  const plans = await adminApi.listPlans();
  const cms = readCollection<CmsContent>("cms", () => seedCms(plans.map((p) => p.id)));
  const known = new Set(cms.planDisplay.map((p) => p.planId));
  const merged = [...cms.planDisplay.filter((p) => plans.some((x) => x.id === p.planId)), ...plans.filter((p) => !known.has(p.id)).map((p) => ({ planId: p.id, visible: false, highlighted: false }))];
  return delay({ ...cms, planDisplay: merged });
}

async function saveCms(next: CmsContent, section: string): Promise<CmsContent> {
  // BACKEND: PATCH /admin/cms { ...section }
  const before = await getCms();
  const value = { ...next, updatedAt: nowIso() };
  writeCollection("cms", value);
  recordAudit({ action: `cms.${section}_updated`, entityType: "cms", entityId: section, entityLabel: `Marketing site · ${section}`, before, after: value });
  return delay(value);
}

const faqCol = collection<FaqEntry>("faq", seedFaq);

async function listFaq(): Promise<FaqEntry[]> {
  // BACKEND: GET /admin/cms/faq
  return delay([...faqCol.all()].sort((a, b) => a.order - b.order));
}

async function saveFaq(input: Omit<FaqEntry, "id"> & { id?: string }): Promise<FaqEntry> {
  // BACKEND: POST /admin/cms/faq | PATCH /admin/cms/faq/:id
  if (!input.questionEn.trim() || !input.questionAr.trim()) fail("Question is required in Arabic and English.");
  if (!input.answerEn.trim() || !input.answerAr.trim()) fail("Answer is required in Arabic and English.");
  const existing = input.id ? faqCol.find(input.id) : undefined;
  const entry: FaqEntry = { ...input, id: existing?.id ?? uid("faq") };
  faqCol.upsert(entry);
  recordAudit({ action: existing ? "faq.updated" : "faq.created", entityType: "faq", entityId: entry.id, entityLabel: entry.questionEn, before: existing ?? null, after: entry });
  return delay(entry);
}

async function deleteFaq(id: string): Promise<void> {
  // BACKEND: DELETE /admin/cms/faq/:id
  const f = faqCol.find(id) ?? fail("Entry not found.");
  faqCol.remove(id);
  recordAudit({ action: "faq.deleted", entityType: "faq", entityId: id, entityLabel: f.questionEn, before: f, after: null });
  await delay(null);
}

const changelogCol = collection<ChangelogPost>("changelog", seedChangelog);

async function listChangelog(): Promise<ChangelogPost[]> {
  // BACKEND: GET /admin/cms/changelog
  return delay([...changelogCol.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

async function saveChangelog(input: Omit<ChangelogPost, "id" | "createdAt" | "publishedAt"> & { id?: string }): Promise<ChangelogPost> {
  // BACKEND: POST /admin/cms/changelog | PATCH /admin/cms/changelog/:id
  if (!input.title.trim()) fail("Title is required.");
  if (!input.body.trim()) fail("Body is required.");
  const existing = input.id ? changelogCol.find(input.id) : undefined;
  const post: ChangelogPost = {
    ...input,
    id: existing?.id ?? uid("cl"),
    createdAt: existing?.createdAt ?? nowIso(),
    publishedAt: input.published ? (existing?.publishedAt ?? nowIso()) : null,
  };
  changelogCol.upsert(post);
  recordAudit({ action: existing ? "changelog.updated" : "changelog.created", entityType: "changelog", entityId: post.id, entityLabel: post.title, before: existing ?? null, after: post });
  return delay(post);
}

async function deleteChangelog(id: string): Promise<void> {
  // BACKEND: DELETE /admin/cms/changelog/:id
  const p = changelogCol.find(id) ?? fail("Post not found.");
  changelogCol.remove(id);
  recordAudit({ action: "changelog.deleted", entityType: "changelog", entityId: id, entityLabel: p.title, before: p, after: null });
  await delay(null);
}

// ================================================================== moderation

const reportsCol = rowsCollection<ModerationReport>("moderationReports", seedReports);

async function listReports(): Promise<ModerationReport[]> {
  // BACKEND: GET /admin/moderation/reports?status=
  return delay([...(await reportsCol()).all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

async function resolveReport(id: string, action: Exclude<ReportStatus, "open">, note: string): Promise<ModerationReport> {
  // BACKEND: POST /admin/moderation/reports/:id/resolve { action, note }
  const col = await reportsCol();
  const r = col.find(id) ?? fail("Report not found.");
  if (r.status !== "open") fail("This report was already resolved.");
  if ((action === "warned" || action === "suspended") && !note.trim()) fail("Add a note — it is included in the merchant notice.");
  if (action === "suspended") await adminApi.suspendWorkspace(r.workspaceId, `Moderation: ${note.trim()}`).catch(() => undefined);
  const next = col.update(id, { status: action, resolvedAt: nowIso(), resolvedBy: actorName() });
  recordAudit({ action: `moderation.${action}`, entityType: "moderation_report", entityId: id, entityLabel: r.targetName, workspaceId: r.workspaceId, workspaceName: r.workspaceName, before: { status: r.status }, after: { status: action, note: note.trim() || null } });
  return delay(next);
}

// ================================================================== jobs

const jobsCol = collection<BackgroundJob>("jobs", seedJobs);
const cronCol = collection<CronSchedule>("cron", seedCron);

async function listJobs(): Promise<BackgroundJob[]> {
  // BACKEND: GET /admin/jobs?status=&type=
  return delay([...jobsCol.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

async function retryJob(id: string): Promise<BackgroundJob> {
  // BACKEND: POST /admin/jobs/:id/retry
  const j = jobsCol.find(id) ?? fail("Job not found.");
  if (j.status !== "failed" && j.status !== "canceled") fail("Only failed or canceled jobs can be retried.");
  const next = jobsCol.update(id, { status: "queued", attempts: 0, lastError: null, updatedAt: nowIso() });
  recordAudit({ action: "job.retried", entityType: "job", entityId: id, entityLabel: j.label, before: { status: j.status }, after: { status: "queued" } });
  return delay(next, 150);
}

async function cancelJob(id: string): Promise<BackgroundJob> {
  // BACKEND: POST /admin/jobs/:id/cancel
  const j = jobsCol.find(id) ?? fail("Job not found.");
  if (j.status !== "queued" && j.status !== "running") fail("Only queued or running jobs can be canceled.");
  const next = jobsCol.update(id, { status: "canceled", updatedAt: nowIso() });
  recordAudit({ action: "job.canceled", entityType: "job", entityId: id, entityLabel: j.label, before: { status: j.status }, after: { status: "canceled" } });
  return delay(next, 150);
}

async function listCron(): Promise<CronSchedule[]> {
  // BACKEND: GET /admin/cron
  return delay(cronCol.all());
}

async function setCronEnabled(id: string, enabled: boolean): Promise<CronSchedule> {
  // BACKEND: PATCH /admin/cron/:id { enabled }
  const c = cronCol.find(id) ?? fail("Schedule not found.");
  const next = cronCol.update(id, { enabled, nextRunAt: enabled ? daysFromNow(1) : null });
  recordAudit({ action: enabled ? "cron.enabled" : "cron.disabled", entityType: "cron", entityId: id, entityLabel: c.name, before: { enabled: c.enabled }, after: { enabled } });
  return delay(next, 120);
}

async function runCronNow(id: string): Promise<CronSchedule> {
  // BACKEND: POST /admin/cron/:id/run
  const c = cronCol.find(id) ?? fail("Schedule not found.");
  const next = cronCol.update(id, { lastRunAt: nowIso(), lastStatus: "succeeded" });
  recordAudit({ action: "cron.run_manually", entityType: "cron", entityId: id, entityLabel: c.name, before: { lastRunAt: c.lastRunAt }, after: { lastRunAt: next.lastRunAt } });
  return delay(next, 600);
}

// ================================================================== backups

const snapshotsCol = collection<BackupSnapshot>("snapshots", seedSnapshots);
const exportRequestsCol = rowsCollection<DataExportRequest>("exportRequests", seedExportRequests);

async function listBackups(): Promise<{ snapshots: BackupSnapshot[]; exports: DataExportRequest[] }> {
  // BACKEND: GET /admin/backups and GET /admin/data-exports
  return delay({
    snapshots: [...snapshotsCol.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    exports: [...(await exportRequestsCol()).all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

async function createSnapshot(label: string): Promise<BackupSnapshot> {
  // BACKEND: POST /admin/backups { label }
  const snap: BackupSnapshot = { id: uid("snap"), label: label.trim() || `Manual ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, kind: "manual", sizeMb: 4210, status: "completed", createdAt: nowIso(), createdBy: actorName(), restoredAt: null };
  snapshotsCol.upsert(snap);
  recordAudit({ action: "backup.snapshot_created", entityType: "backup", entityId: snap.id, entityLabel: snap.label, before: null, after: snap });
  return delay(snap, 900);
}

async function restoreSnapshot(id: string, confirmText: string): Promise<BackupSnapshot> {
  // BACKEND: POST /admin/backups/:id/restore { confirm } — destructive, requires super_admin
  const s = snapshotsCol.find(id) ?? fail("Snapshot not found.");
  if (s.status !== "completed") fail("Only completed snapshots can be restored.");
  if (confirmText.trim() !== "RESTORE") fail("Type RESTORE to confirm.");
  const next = snapshotsCol.update(id, { restoredAt: nowIso() });
  recordAudit({ action: "backup.restored", entityType: "backup", entityId: id, entityLabel: s.label, before: null, after: { restoredAt: next.restoredAt } });
  return delay(next, 1200);
}

async function decideExport(id: string, approve: boolean): Promise<DataExportRequest> {
  // BACKEND: POST /admin/data-exports/:id/approve | /reject
  const col = await exportRequestsCol();
  const e = col.find(id) ?? fail("Request not found.");
  if (e.status !== "pending") fail("Only pending requests can be decided.");
  const next = col.update(id, { status: approve ? "processing" : "rejected", completedAt: approve ? null : nowIso() });
  recordAudit({ action: approve ? "data_export.approved" : "data_export.rejected", entityType: "data_export", entityId: id, entityLabel: `${e.workspaceName} ${e.scope} export`, workspaceId: e.workspaceId, workspaceName: e.workspaceName, before: { status: e.status }, after: { status: next.status } });
  return delay(next);
}

// ================================================================== control tower

async function getControlAlerts(): Promise<ControlAlert[]> {
  // BACKEND: GET /admin/alerts
  const r = await rows();
  const map = readControls();
  const controls = r.map((w) => controlFor(w, map));
  const settings = await getSettings();
  const jobs = jobsCol.all();
  const reports = (await reportsCol()).all();
  const payouts = (await payoutsCol()).all();
  const out: ControlAlert[] = [];
  const add = (a: ControlAlert) => a.count > 0 && out.push(a);
  if (settings.platform.maintenanceMode) out.push({ id: "maint", kind: "maintenance", title: "Maintenance mode is ON", detail: "Merchants and shoppers see the maintenance page.", count: 1, to: "/settings?tab=platform", severity: "danger" });
  const pastDue = r.filter((w) => w.meta.subscriptionStatus === "past_due").length;
  add({ id: "pd", kind: "past_due", title: `${pastDue} past-due subscription${pastDue === 1 ? "" : "s"}`, detail: "Renewal payment failed.", count: pastDue, to: "/subscriptions", severity: "warning" });
  const suspended = r.filter((w) => w.meta.suspended).length;
  add({ id: "susp", kind: "suspended", title: `${suspended} suspended workspace${suspended === 1 ? "" : "s"}`, detail: "Storefront and dashboard offline.", count: suspended, to: "/workspaces", severity: "info" });
  const kyc = controls.filter((c) => c.kycStatus === "pending").length;
  add({ id: "kyc", kind: "kyc_pending", title: `${kyc} KYC review${kyc === 1 ? "" : "s"} pending`, detail: "Payouts wait on KYC approval.", count: kyc, to: "/workspaces", severity: "warning" });
  const failed = jobs.filter((j) => j.status === "failed").length;
  add({ id: "jobs", kind: "failed_jobs", title: `${failed} failed background job${failed === 1 ? "" : "s"}`, detail: "Exhausted retries.", count: failed, to: "/jobs", severity: "danger" });
  const open = reports.filter((x) => x.status === "open").length;
  add({ id: "mod", kind: "moderation", title: `${open} open moderation report${open === 1 ? "" : "s"}`, detail: "Reported storefronts and products.", count: open, to: "/moderation", severity: "warning" });
  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
  add({ id: "po", kind: "payout_queue", title: `${pendingPayouts} payout${pendingPayouts === 1 ? "" : "s"} awaiting approval`, detail: "Merchant COD payouts queue.", count: pendingPayouts, to: "/finance?tab=payouts", severity: "info" });
  const deletions = controls.filter((c) => c.deletionScheduledAt).length;
  add({ id: "del", kind: "deletion_scheduled", title: `${deletions} workspace deletion${deletions === 1 ? "" : "s"} scheduled`, detail: "Within the 7-day grace period.", count: deletions, to: "/workspaces", severity: "danger" });
  const rank = { danger: 0, warning: 1, info: 2 } as const;
  return delay(out.sort((a, b) => rank[a.severity] - rank[b.severity]));
}

export const controlApi = {
  // workspace control
  getControl,
  setLimitOverride,
  setFeatureOverride,
  compMonths,
  applyDiscount,
  removeDiscount,
  changeMemberRole,
  transferOwnership,
  forceLogout,
  setStoreStatus,
  verifyDomain,
  removeDomain,
  resetTheme,
  setPayoutHold,
  setSettlementHold,
  adjustBalance,
  setBlocked,
  decideKyc,
  addNote,
  toggleNotePin,
  deleteNote,
  exportWorkspaceData,
  scheduleDeletion,
  cancelDeletion,
  reactivateWorkspace,
  logImpersonation,
  listWorkspaceInvoices,
  // users
  listUsers,
  verifyUserEmail,
  sendPasswordReset,
  setUserStatus,
  setPlatformAdmin,
  // settings
  getSettings,
  saveSettings,
  setMaintenanceMode,
  listLegal,
  publishLegal,
  listMessageTemplates,
  saveMessageTemplate,
  sendTestMessage,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listWebhooks,
  saveWebhook,
  deleteWebhook,
  sendTestWebhook,
  listIntegrations,
  setIntegrationEnabled,
  // roles
  getRoleMatrix,
  setRolePermission,
  setRequire2fa,
  // finance
  getFinance,
  markInvoicePaid,
  refundInvoice,
  decidePayout,
  // content
  getCms,
  saveCms,
  listFaq,
  saveFaq,
  deleteFaq,
  listChangelog,
  saveChangelog,
  deleteChangelog,
  // moderation
  listReports,
  resolveReport,
  // jobs
  listJobs,
  retryJob,
  cancelJob,
  listCron,
  setCronEnabled,
  runCronNow,
  // backups
  listBackups,
  createSnapshot,
  restoreSnapshot,
  decideExport,
  // tower
  getControlAlerts,
};
