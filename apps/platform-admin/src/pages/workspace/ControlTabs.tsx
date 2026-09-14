/** Workspace control-center tabs (limits, storefront, payments, risk, notes, danger zone). */
import { useState } from "react";
import { Ban, Download, ExternalLink, Eye, LogOut, Paintbrush, Pin, RefreshCw, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Alert, Button, SegmentedControl, Table, TableBody, TableHeader, TableRow, Textarea, cn } from "@store-builder/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { NativeSelect, TextField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, humanize, type Tone } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { SettingRow, useAction } from "@/components/controls";
import { Known, LOCAL_ONLY_LABEL, LocalOnlyNote, NOT_EXPOSED_MESSAGE, UNKNOWN_HINT } from "@/components/workspace";
import { openInvoiceWindow } from "@/pages/FinancePage";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { fetchWorkspaceCounts, getCachedOverviewRow } from "@/lib/realAdmin";
import { adminApi } from "@/mock/adminApi";
import { LIMIT_LABELS, controlApi, planDefaultLimits } from "@/mock/controlApi";
import { PLAN_FEATURES } from "@/mock/constants";
import type { AdminWorkspace, PlanFeatureKey, WorkspaceMember } from "@/mock/types";
import type { KycStatus, LimitKey, StoreStatus, WorkspaceControl } from "@/mock/controlTypes";

type WsProps = { ws: AdminWorkspace; ctl: WorkspaceControl; onCtl: (c: WorkspaceControl) => void; onWs: (w: AdminWorkspace) => void };

export const MERCHANT_DASHBOARD_URL = "http://localhost:5173";

// ------------------------------------------------------------------ overview (real)

export function RealOverviewStrip({ ws }: { ws: AdminWorkspace }) {
  const counts = useAsync(() => fetchWorkspaceCounts(ws.id), [ws.id]);
  const row = getCachedOverviewRow(ws.id);
  const fmt = (c: { count: number; more: boolean } | null) => (c ? `${formatNumber(c.count)}${c.more ? "+" : ""}` : "—");
  return (
    <Panel
      title="Live from backend"
      description="Merchant endpoints (orders, products) and the /admin/workspaces row for this workspace."
      actions={counts.data && <StatusBadge tone={counts.data.status.state === "ok" ? "success" : "warning"} dot>{counts.data.status.state === "ok" ? "Real" : "Mock fallback"}</StatusBadge>}
    >
      {counts.loading ? (
        <p className="text-sm text-ink-soft">Loading real counts…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Orders (real)" value={row ? formatNumber(row.orderCount) : fmt(counts.data?.orders ?? null)} hint={row ? "orderCount from /admin/workspaces" : "listOrders, first page"} />
            <KpiCard label="Products (real)" value={fmt(counts.data?.products ?? null)} hint="listProducts, first page" />
            <KpiCard label="Subscription (real)" value={row ? humanize(row.status) : "—"} hint={row ? `Plan: ${row.plan}` : "Not in real admin list"} />
            <KpiCard label="Period end (real)" value={row ? formatDate(row.currentPeriodEnd ?? row.trialEndsAt) : "—"} hint={row?.trialEndsAt ? "Trial end" : "Current period end"} />
          </div>
          {counts.data && counts.data.status.state !== "ok" && (
            <p className="mt-3 text-xs text-ink-soft">{counts.data.status.message} Figures below come from the mock layer.</p>
          )}
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ subscription extras

export function SubscriptionExtras({ ws, ctl, onCtl }: Omit<WsProps, "onWs">) {
  const toast = useToast();
  const invoices = useAsync(() => controlApi.listWorkspaceInvoices(ws.id), [ws.id]);
  const [modal, setModal] = useState<"comp" | "discount" | "removeDiscount" | "refund" | null>(null);
  const [months, setMonths] = useState("1");
  const [percent, setPercent] = useState("20");
  const [reason, setReason] = useState("");
  const [refundId, setRefundId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const refundInv = invoices.data?.find((i) => i.id === refundId) ?? null;

  const open = (m: typeof modal) => {
    setReason("");
    setModal(m);
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel title="Credits & discounts">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Comped months</dt><dd className="tabular">{ctl.compMonths}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Discount</dt><dd>{ctl.discount ? `${ctl.discount.percent}% × ${ctl.discount.months} mo` : "None"}</dd></div>
          {ctl.discount && <p className="text-xs text-ink-soft">“{ctl.discount.reason}” · {formatRelative(ctl.discount.appliedAt)}</p>}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="outline" size="sm" onClick={() => { setMonths("1"); open("comp"); }}>Comp months</Button>
          <Button variant="outline" size="sm" onClick={() => { setPercent("20"); setMonths("3"); open("discount"); }}>{ctl.discount ? "Change discount" : "Apply discount"}</Button>
          {ctl.discount && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setModal("removeDiscount")}>Remove discount</Button>}
        </div>
      </Panel>
      <Panel flush className="xl:col-span-2" title="Invoices">
        <DataState loading={invoices.loading} error={invoices.error} onRetry={() => void invoices.refresh()} empty={!!invoices.data && invoices.data.length === 0} emptyMessage="No invoices for this workspace.">
          {blocked && <p className="px-5 pt-3 text-xs text-danger">Pop-up blocked — allow pop-ups to open invoices.</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><Th>Invoice</Th><Th>Amount</Th><Th>Status</Th><Th>Issued</Th><Th className="text-end">Actions</Th></TableRow></TableHeader>
              <TableBody>
                {(invoices.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <Td className="font-medium">{i.number}</Td>
                    <Td className="tabular">{formatMoney(i.amount)}</Td>
                    <Td><StatusBadge tone={i.status === "paid" ? "success" : i.status === "open" ? "warning" : "info"} dot>{humanize(i.status)}</StatusBadge></Td>
                    <Td className="text-ink-soft">{formatDate(i.issuedAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setBlocked(!openInvoiceWindow(i))}>View</Button>
                        {i.status === "open" && <Button size="sm" variant="outline" onClick={async () => { try { await controlApi.markInvoicePaid(i.id); toast.success("Invoice marked paid."); void invoices.refresh({ silent: true }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}>Mark paid</Button>}
                        {i.status === "paid" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => { setRefundId(i.id); open("refund"); }}>Refund</Button>}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataState>
      </Panel>

      <ConfirmDialog open={modal === "comp"} title="Comp free months?" description="Pushes the next billing date forward; any past-due balance is cleared." confirmLabel="Comp months" confirmDisabled={!reason.trim()} onCancel={() => setModal(null)}
        onConfirm={async () => { onCtl(await controlApi.compMonths(ws.id, Number(months), reason)); toast.success(`${months} month(s) comped.`); setModal(null); }}>
        <div className="space-y-3">
          <TextField label="Months (1–12)" type="number" min={1} max={12} value={months} onChange={(e) => setMonths(e.target.value)} />
          <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Outage compensation" />
        </div>
      </ConfirmDialog>
      <ConfirmDialog open={modal === "discount"} title="Apply discount" description="Applies to the next invoices for the chosen duration." confirmLabel="Apply discount" confirmDisabled={!reason.trim()} onCancel={() => setModal(null)}
        onConfirm={async () => { onCtl(await controlApi.applyDiscount(ws.id, Number(percent), Number(months), reason)); toast.success("Discount applied."); setModal(null); }}>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Percent" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
          <TextField label="Months" type="number" min={1} max={24} value={months} onChange={(e) => setMonths(e.target.value)} />
          <TextField label="Reason" className="col-span-2" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </ConfirmDialog>
      <ConfirmDialog open={modal === "removeDiscount"} title="Remove discount?" description="Next invoices are billed at the full plan price." confirmLabel="Remove" destructive onCancel={() => setModal(null)}
        onConfirm={async () => { onCtl(await controlApi.removeDiscount(ws.id)); setModal(null); }} />
      <ConfirmDialog open={modal === "refund" && !!refundInv} title={`Refund ${refundInv?.number ?? ""}?`} description={`Refunds ${refundInv ? formatMoney(refundInv.amount) : ""} to the original payment method.`} confirmLabel="Refund" destructive confirmDisabled={!reason.trim()} onCancel={() => setModal(null)}
        onConfirm={async () => { if (!refundInv) return; await controlApi.refundInvoice(refundInv.id, refundInv.amount, reason); toast.success("Refunded."); setModal(null); void invoices.refresh({ silent: true }); }}>
        <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------------ limits & features

export function LimitsTab({ ws, ctl, onCtl }: Omit<WsProps, "onWs">) {
  const defaults = planDefaultLimits(ws.plan);
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<LimitKey | null>(null);
  const [value, setValue] = useState("");
  const [unlimited, setUnlimited] = useState(false);

  const fmt = (v: number | null) => (v === null ? "Unlimited" : formatNumber(v));

  return (
    <>
    <LocalOnlyNote />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel flush title="Limits" description={`Plan defaults from ${ws.plan?.name ?? "no plan"}; overrides apply to this workspace only.`}>
        <ul className="divide-y divide-line">
          {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => {
            const overridden = k in ctl.limitOverrides;
            const effective = overridden ? (ctl.limitOverrides[k] ?? null) : defaults[k];
            return (
              <li key={k} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{LIMIT_LABELS[k]}</p>
                  <p className="text-xs text-ink-soft">Plan default: {fmt(defaults[k])}</p>
                </div>
                <span className="tabular text-sm font-semibold text-ink">{fmt(effective)}</span>
                {overridden && <StatusBadge tone="primary">Override</StatusBadge>}
                <Button size="sm" variant="outline" onClick={() => { setEditing(k); setUnlimited(effective === null); setValue(effective === null ? "" : String(effective)); }}>Edit</Button>
                {overridden && (
                  <Button size="sm" variant="ghost" disabled={busy === k} onClick={() => void run(k, () => controlApi.setLimitOverride(ws.id, k, undefined), "Reverted to plan default.").then((c) => c && onCtl(c))}>Reset</Button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel flush title="Feature flags" description="Force a feature on or off regardless of plan.">
        <ul className="divide-y divide-line">
          {PLAN_FEATURES.map((f) => {
            const inPlan = !!ws.plan?.features.includes(f.key);
            const override = ctl.featureOverrides[f.key];
            const mode: "inherit" | "on" | "off" = override === undefined ? "inherit" : override ? "on" : "off";
            const effective = override ?? inPlan;
            return (
              <li key={f.key} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{f.label}</p>
                  <p className="text-xs text-ink-soft">Plan: {inPlan ? "included" : "not included"} · effective: <span className={cn(effective ? "text-success" : "text-ink-soft")}>{effective ? "on" : "off"}</span></p>
                </div>
                <SegmentedControl<"inherit" | "on" | "off">
                  size="sm"
                  ariaLabel={`${f.label} override`}
                  value={mode}
                  onChange={(m) => void run(f.key, () => controlApi.setFeatureOverride(ws.id, f.key as PlanFeatureKey, m === "inherit" ? undefined : m === "on"), "Feature override saved.").then((c) => c && onCtl(c))}
                  options={[{ value: "inherit", label: "Plan" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]}
                />
              </li>
            );
          })}
        </ul>
      </Panel>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Override ${LIMIT_LABELS[editing]}` : ""}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy === "save" || (!unlimited && value === "")} onClick={() => {
          if (!editing) return;
          void run("save", () => controlApi.setLimitOverride(ws.id, editing, unlimited ? null : Number(value)), "Limit override saved.").then((c) => { if (c) { onCtl(c); setEditing(null); } });
        }}>Save override</Button></>}>
        <div className="space-y-3">
          <Toggle label="Unlimited" checked={unlimited} onChange={setUnlimited} />
          {!unlimited && <TextField label="Limit" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />}
        </div>
      </Modal>
    </div>
    </>
  );
}

// ------------------------------------------------------------------ team

export function TeamControlTab({ ws, onWs, onCtl }: Omit<WsProps, "ctl">) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [owner, setOwner] = useState<WorkspaceMember | null>(null);
  const [logout, setLogout] = useState<WorkspaceMember | "all" | null>(null);

  if (!ws.meta.membersKnown) {
    return (
      <Panel
        title="Members"
        actions={<Button size="sm" variant="outline" disabled title={NOT_EXPOSED_MESSAGE}><LogOut /> Force logout everyone</Button>}
      >
        <EmptyBlock message={NOT_EXPOSED_MESSAGE} />
        <p className="mt-3 text-xs text-ink-soft">Role changes, ownership transfer and forced logout are disabled until the admin API exposes members.</p>
      </Panel>
    );
  }
  if (ws.meta.members.length === 0) return <EmptyBlock message="No team members." />;
  return (
    <Panel flush title="Members" description={`${ws.meta.members.length} people`} actions={<Button size="sm" variant="outline" className="text-danger" onClick={() => setLogout("all")}><LogOut /> Force logout everyone</Button>}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="hover:bg-transparent"><Th>Member</Th><Th>Role</Th><Th>Last active</Th><Th className="text-end">Actions</Th></TableRow></TableHeader>
          <TableBody>
            {ws.meta.members.map((m) => (
              <TableRow key={m.id}>
                <Td><span className="block font-medium">{m.name}</span><span className="text-xs text-ink-soft">{m.email}</span></Td>
                <Td>
                  {m.role === "owner" ? <StatusBadge tone="primary">owner</StatusBadge> : (
                    <NativeSelect aria-label={`Role for ${m.name}`} className="h-8 w-28 text-xs" value={m.role} disabled={busy === m.id}
                      onChange={(e) => void run(m.id, () => controlApi.changeMemberRole(ws.id, m.id, e.target.value as WorkspaceMember["role"]), "Role updated.").then((w) => w && onWs(w))}>
                      <option value="admin">admin</option><option value="staff">staff</option>
                    </NativeSelect>
                  )}
                </Td>
                <Td className="text-ink-soft">{m.lastActiveAt ? formatRelative(m.lastActiveAt) : "Never"}</Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    {m.role !== "owner" && <Button size="sm" variant="outline" onClick={() => setOwner(m)}><UserCog /> Make owner</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setLogout(m)}><LogOut /> Log out</Button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog open={!!owner} title={`Make ${owner?.name ?? ""} the owner?`} description="The current owner becomes an admin. Ownership controls billing and can delete the workspace." confirmLabel="Transfer ownership" destructive onCancel={() => setOwner(null)}
        onConfirm={async () => { if (!owner) return; onWs(await controlApi.transferOwnership(ws.id, owner.id)); toast.success("Owner reset."); setOwner(null); }} />
      <ConfirmDialog open={!!logout} title={logout === "all" ? "Force logout every member?" : `Force logout ${logout?.name ?? ""}?`} description="All active sessions are revoked; they need to sign in again." confirmLabel="Force logout" destructive onCancel={() => setLogout(null)}
        onConfirm={async () => { if (!logout) return; onCtl(await controlApi.forceLogout(ws.id, logout === "all" ? undefined : logout.id)); toast.success("Sessions revoked."); setLogout(null); }} />
    </Panel>
  );
}

// ------------------------------------------------------------------ storefront

const STORE_TONE: Record<StoreStatus, Tone> = { live: "success", maintenance: "warning", suspended: "danger" };

export function StorefrontTab({ ws, ctl, onCtl, onWs }: WsProps) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [nextStatus, setNextStatus] = useState<StoreStatus | null>(null);
  const [message, setMessage] = useState(ctl.maintenanceMessage);
  const [removing, setRemoving] = useState<string | null>(null);
  const [themeReset, setThemeReset] = useState(false);
  const removingDomain = ws.meta.domains.find((d) => d.id === removing);

  return (
    <div className="space-y-4">
      <LocalOnlyNote>Store status and theme reset are {LOCAL_ONLY_LABEL.toLowerCase()}.</LocalOnlyNote>
      <Panel title="Store status" actions={<StatusBadge tone={STORE_TONE[ctl.storeStatus]} dot>{humanize(ctl.storeStatus)}</StatusBadge>}>
        <SegmentedControl<StoreStatus> ariaLabel="Store status" value={ctl.storeStatus} onChange={(v) => { if (v !== ctl.storeStatus) { setMessage(ctl.maintenanceMessage); setNextStatus(v); } }}
          options={[{ value: "live", label: "Live" }, { value: "maintenance", label: "Maintenance" }, { value: "suspended", label: "Suspended" }]} />
        {ctl.storeStatus === "maintenance" && ctl.maintenanceMessage && <p className="mt-3 text-sm text-ink-soft">Shoppers see: “{ctl.maintenanceMessage}”</p>}
        <SettingRow className="mt-3 border-t" label="Reset theme" description={ctl.themeResetAt ? `Last reset ${formatRelative(ctl.themeResetAt)}` : "Restores the default template and clears custom CSS."}>
          {ws.meta.domainsKnown ? (
            <a href={`https://${ws.meta.domains[0]?.hostname ?? `${ws.slug}.zimos.store`}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-sm hover:border-line-strong"><ExternalLink className="size-3.5" /> Visit store</a>
          ) : (
            <Button size="sm" variant="outline" disabled title={NOT_EXPOSED_MESSAGE}><ExternalLink /> Visit store</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setThemeReset(true)}><Paintbrush /> Reset theme</Button>
        </SettingRow>
      </Panel>

      <Panel flush title="Custom domains">
        {!ws.meta.domainsKnown ? (
          <div className="p-4">
            <EmptyBlock message={NOT_EXPOSED_MESSAGE} />
            <p className="mt-3 text-xs text-ink-soft">Verify and remove are disabled until the admin API exposes domains.</p>
          </div>
        ) : ws.meta.domains.length === 0 ? <div className="p-4"><EmptyBlock message="No domains connected." /></div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><Th>Hostname</Th><Th>Verification</Th><Th>SSL</Th><Th>Last checked</Th><Th className="text-end">Actions</Th></TableRow></TableHeader>
              <TableBody>
                {ws.meta.domains.map((d) => (
                  <TableRow key={d.id}>
                    <Td className="font-medium">{d.hostname}</Td>
                    <Td>{d.verified ? <StatusBadge tone="success" dot>Verified</StatusBadge> : <StatusBadge tone="warning" dot>Unverified</StatusBadge>}</Td>
                    <Td><StatusBadge tone={d.ssl === "active" ? "success" : d.ssl === "pending" ? "warning" : "danger"}>{d.ssl}</StatusBadge></Td>
                    <Td className="text-ink-soft">{formatRelative(d.lastCheckedAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {!d.verified && <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => void run(d.id, () => controlApi.verifyDomain(ws.id, d.id), `${d.hostname} verified.`).then((w) => w && onWs(w))}><RefreshCw className={cn(busy === d.id && "animate-spin")} /> Verify</Button>}
                        {!d.hostname.endsWith(".zimos.store") && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(d.id)}><Trash2 /> Remove</Button>}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <ConfirmDialog open={!!nextStatus} title={`Set store to ${humanize(nextStatus ?? "")}?`}
        description={nextStatus === "live" ? "The storefront goes back online." : nextStatus === "maintenance" ? "Shoppers see your maintenance message; the merchant dashboard stays available." : "The storefront goes offline for shoppers. Use Danger zone to suspend the whole workspace."}
        confirmLabel="Change status" destructive={nextStatus !== "live"} confirmDisabled={nextStatus === "maintenance" && !message.trim()} onCancel={() => setNextStatus(null)}
        onConfirm={async () => { if (!nextStatus) return; onCtl(await controlApi.setStoreStatus(ws.id, nextStatus, nextStatus === "maintenance" ? message : "")); toast.success("Store status updated."); setNextStatus(null); }}>
        {nextStatus === "maintenance" && <TextField label="Message for shoppers" required value={message} onChange={(e) => setMessage(e.target.value)} />}
      </ConfirmDialog>
      <ConfirmDialog open={!!removingDomain} title={`Remove ${removingDomain?.hostname ?? ""}?`} description="The domain stops serving this store immediately. The merchant must re-add and re-verify it." confirmLabel="Remove domain" destructive onCancel={() => setRemoving(null)}
        onConfirm={async () => { if (!removing) return; onWs(await controlApi.removeDomain(ws.id, removing)); toast.success("Domain removed."); setRemoving(null); }} />
      <ConfirmDialog open={themeReset} title="Reset storefront theme?" description="Custom sections, colors and CSS are discarded and the default template is restored." confirmLabel="Reset theme" destructive onCancel={() => setThemeReset(false)}
        onConfirm={async () => { onCtl(await controlApi.resetTheme(ws.id)); toast.success("Theme reset."); setThemeReset(false); }} />
    </div>
  );
}

// ------------------------------------------------------------------ payments & payouts

export function PaymentsTab({ ws, ctl, onCtl }: Omit<WsProps, "onWs">) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [adjOpen, setAdjOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      {ctl.payoutHold && <Alert variant="warning">Payouts are on hold{ctl.payoutHoldReason ? `: ${ctl.payoutHoldReason}` : "."}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Balance owed to merchant" value={formatMoney(ctl.balance)} hint="Unsettled COD minus fees, plus adjustments" />
        <KpiCard label="Held settlements" value={formatNumber(ctl.settlements.filter((s) => s.status === "held").length)} />
        <KpiCard label="Adjustments" value={formatNumber(ctl.adjustments.length)} />
      </div>
      <Panel title="Payouts">
        <SettingRow label="Payout hold" description="Stops all automatic payouts to this merchant.">
          <Toggle label="Payout hold" hideLabel checked={ctl.payoutHold} onChange={(v) => { setHoldReason(""); if (v) setHoldOpen(true); else void run("hold", () => controlApi.setPayoutHold(ws.id, false, ""), "Payouts released.").then((c) => c && onCtl(c)); }} />
        </SettingRow>
        <SettingRow label="Balance adjustment" description="Credit or debit the merchant balance with a reason.">
          <Button size="sm" variant="outline" onClick={() => { setAmount(""); setReason(""); setAdjOpen(true); }}>Adjust balance</Button>
        </SettingRow>
      </Panel>
      <Panel flush title="COD settlements">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><Th>Carrier</Th><Th>Period end</Th><Th>COD collected</Th><Th>Fees</Th><Th>Status</Th><Th className="text-end">Actions</Th></TableRow></TableHeader>
            <TableBody>
              {ctl.settlements.map((s) => (
                <TableRow key={s.id}>
                  <Td className="font-medium">{s.carrier}</Td>
                  <Td className="text-ink-soft">{formatDate(s.periodEnd)}</Td>
                  <Td className="tabular">{formatMoney(s.codCollected)}</Td>
                  <Td className="tabular text-ink-soft">−{formatMoney(s.fees)}</Td>
                  <Td><StatusBadge tone={s.status === "settled" ? "success" : s.status === "held" ? "danger" : "warning"} dot>{humanize(s.status)}</StatusBadge></Td>
                  <Td className="text-end">
                    {s.status !== "settled" && (
                      <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => void run(s.id, () => controlApi.setSettlementHold(ws.id, s.id, s.status !== "held"), s.status === "held" ? "Settlement released." : "Settlement held.").then((c) => c && onCtl(c))}>
                        {s.status === "held" ? "Release" : "Hold"}
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      {ctl.adjustments.length > 0 && (
        <Panel flush title="Adjustment history">
          <ul className="divide-y divide-line">
            {ctl.adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className={cn("tabular font-medium", a.amount > 0 ? "text-success" : "text-danger")}>{a.amount > 0 ? "+" : ""}{formatMoney(a.amount)}</span>
                <span className="text-ink">{a.reason}</span>
                <span className="ms-auto text-xs text-ink-soft">{a.actorName} · {formatRelative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <ConfirmDialog open={holdOpen} title="Hold all payouts?" description="The merchant is notified that payouts are paused pending review." confirmLabel="Hold payouts" destructive confirmDisabled={!holdReason.trim()} onCancel={() => setHoldOpen(false)}
        onConfirm={async () => { onCtl(await controlApi.setPayoutHold(ws.id, true, holdReason)); toast.success("Payouts held."); setHoldOpen(false); }}>
        <TextField label="Reason" required value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={adjOpen} title="Adjust balance" description="Use a negative amount to debit. Recorded in the audit log." confirmLabel="Apply adjustment" confirmDisabled={!reason.trim() || !Number(amount)} onCancel={() => setAdjOpen(false)}
        onConfirm={async () => { onCtl(await controlApi.adjustBalance(ws.id, Number(amount), reason)); toast.success("Balance adjusted."); setAdjOpen(false); }}>
        <div className="space-y-3">
          <TextField label="Amount (EGP)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-250 or 500" />
          <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------------ risk

const KYC_TONE: Record<KycStatus, Tone> = { not_submitted: "neutral", pending: "warning", approved: "success", rejected: "danger" };

export function RiskTab({ ws, ctl, onCtl }: Omit<WsProps, "onWs">) {
  const toast = useToast();
  const [kyc, setKyc] = useState<"approved" | "rejected" | null>(null);
  const [block, setBlock] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const scoreTone = ctl.fraudScore >= 70 ? "text-danger" : ctl.fraudScore >= 40 ? "text-warning" : "text-success";

  return (
    <div className="space-y-4">
      <LocalOnlyNote>Block and KYC decisions are {LOCAL_ONLY_LABEL.toLowerCase()}.{ws.origin === "api" ? " Fraud score and KYC history are mock values." : ""}</LocalOnlyNote>
      {ctl.blocked && <Alert variant="danger">Blocked from new orders{ctl.blockedReason ? `: ${ctl.blockedReason}` : "."}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Fraud score" value={<span className={scoreTone}>{ctl.fraudScore}/100</span>} hint="RTO rate, blocklist hits, velocity" />
        <KpiCard label="RTO rate (30d)" value={<Known value={ws.meta.rtoRate} format={(v) => `${v}%`} />} hint={ws.meta.rtoRate === null ? UNKNOWN_HINT : undefined} />
        <KpiCard label="KYC" value={<StatusBadge tone={KYC_TONE[ctl.kycStatus]} dot>{humanize(ctl.kycStatus)}</StatusBadge>} />
      </div>
      <Panel title="Controls">
        <SettingRow label={ctl.blocked ? "Unblock workspace" : "Block workspace"} description="Blocked workspaces can't accept new orders; the storefront stays visible.">
          <Button size="sm" variant={ctl.blocked ? "outline" : "destructive"} onClick={() => { setNote(""); setBlock(!ctl.blocked); }}>{ctl.blocked ? <><ShieldCheck /> Unblock</> : <><Ban /> Block</>}</Button>
        </SettingRow>
        <SettingRow label="KYC decision" description="Approve or reject submitted identity & commercial register documents.">
          <Button size="sm" variant="outline" disabled={ctl.kycStatus === "approved" || ctl.kycStatus === "not_submitted"} onClick={() => { setNote(""); setKyc("approved"); }}>Approve</Button>
          <Button size="sm" variant="ghost" className="text-danger" disabled={ctl.kycStatus === "rejected" || ctl.kycStatus === "not_submitted"} onClick={() => { setNote(""); setKyc("rejected"); }}>Reject</Button>
        </SettingRow>
      </Panel>
      <Panel flush title="KYC history">
        {ctl.kycHistory.length === 0 ? <div className="p-4"><EmptyBlock message="No KYC submissions." /></div> : (
          <ul className="divide-y divide-line">
            {ctl.kycHistory.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <StatusBadge tone={KYC_TONE[e.status]}>{humanize(e.status)}</StatusBadge>
                <span className="text-ink">{e.note || "—"}</span>
                <span className="ms-auto text-xs text-ink-soft">{e.actorName} · {formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ConfirmDialog open={kyc !== null} title={kyc === "approved" ? "Approve KYC?" : "Reject KYC?"} description={kyc === "approved" ? "Payouts become eligible for this merchant." : "The merchant is asked to resubmit. Your note is shared with them."}
        confirmLabel={kyc === "approved" ? "Approve" : "Reject"} destructive={kyc === "rejected"} confirmDisabled={kyc === "rejected" && !note.trim()} onCancel={() => setKyc(null)}
        onConfirm={async () => { if (!kyc) return; onCtl(await controlApi.decideKyc(ws.id, kyc, note)); toast.success(`KYC ${kyc}.`); setKyc(null); }}>
        <label htmlFor="kyc-note" className="text-sm font-medium text-ink">Notes {kyc === "rejected" && <span className="text-danger">*</span>}</label>
        <Textarea id="kyc-note" className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={block !== null} title={block ? `Block ${ws.name}?` : `Unblock ${ws.name}?`} description={block ? "New orders are rejected at checkout." : "The workspace can accept orders again."}
        confirmLabel={block ? "Block" : "Unblock"} destructive={!!block} confirmDisabled={!!block && !note.trim()} onCancel={() => setBlock(null)}
        onConfirm={async () => { if (block === null) return; onCtl(await controlApi.setBlocked(ws.id, block, note)); toast.success(block ? "Workspace blocked." : "Workspace unblocked."); setBlock(null); }}>
        {block && <TextField label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} />}
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------------ notes

export function NotesTab({ ws, ctl, onCtl }: Omit<WsProps, "onWs">) {
  const [body, setBody] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { busy, run } = useAction();
  const notes = [...ctl.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <Panel title="Add internal note" description={`Visible to ZIMOS staff only. ${LOCAL_ONLY_LABEL}.`}>
        <form onSubmit={(e) => { e.preventDefault(); void run("add", () => controlApi.addNote(ws.id, body), "Note added.").then((c) => { if (c) { onCtl(c); setBody(""); } }); }}>
          <Textarea aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Context for the next person handling this merchant…" />
          <div className="mt-2 flex justify-end"><Button type="submit" disabled={!body.trim() || busy === "add"}>Add note</Button></div>
        </form>
      </Panel>
      {notes.length === 0 ? <EmptyBlock message="No notes yet." /> : (
        <ol className="relative space-y-3 border-s border-line ps-5">
          {notes.map((n) => (
            <li key={n.id} className="relative">
              <span className={cn("absolute -start-[1.6rem] top-4 size-2.5 rounded-full border-2 border-paper", n.pinned ? "bg-primary" : "bg-line-strong")} aria-hidden />
              <Panel>
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-line text-sm text-ink">{n.body}</p>
                  <Button size="icon-sm" variant="ghost" aria-label={n.pinned ? "Unpin" : "Pin"} className={cn(n.pinned && "text-primary")} onClick={() => void run(n.id, () => controlApi.toggleNotePin(ws.id, n.id)).then((c) => c && onCtl(c))}><Pin /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete note" className="text-danger" onClick={() => setDeleting(n.id)}><Trash2 /></Button>
                </div>
                <p className="mt-2 text-xs text-ink-soft">{n.authorName} · {formatDateTime(n.createdAt)}{n.pinned && " · pinned"}</p>
              </Panel>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog open={!!deleting} title="Delete note?" confirmLabel="Delete" destructive onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (!deleting) return; onCtl(await controlApi.deleteNote(ws.id, deleting)); setDeleting(null); }} />
    </div>
  );
}

// ------------------------------------------------------------------ danger zone

type DangerAction = "suspend" | "reactivate" | "export" | "delete" | "cancelDelete" | "impersonate";

export function DangerControlTab({ ws, ctl, onCtl, onWs }: WsProps) {
  const toast = useToast();
  const [action, setAction] = useState<DangerAction | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [impersonated, setImpersonated] = useState(false);

  const rows: Array<{ key: DangerAction; title: string; body: string; label: string; destructive: boolean; icon: typeof Ban; hidden?: boolean }> = [
    { key: "suspend", title: "Suspend workspace", body: "Storefront offline, dashboard blocked, team signed out. Data is kept.", label: "Suspend", destructive: true, icon: Ban, hidden: ws.meta.suspended },
    { key: "reactivate", title: "Reactivate workspace", body: "Lift suspension and put the storefront back live.", label: "Reactivate", destructive: false, icon: ShieldCheck, hidden: !ws.meta.suspended && ctl.storeStatus !== "suspended" },
    { key: "export", title: "Export data", body: ctl.lastExportAt ? `Last export requested ${formatRelative(ctl.lastExportAt)}.` : "Queue a full export (orders, customers, products, settings).", label: "Export data", destructive: false, icon: Download },
    { key: "impersonate", title: "Log in as merchant", body: `Open the merchant dashboard as ${ws.meta.ownerEmail ?? "the workspace owner (email not provided by the API yet)"}. Every session is audited.`, label: "Impersonate", destructive: false, icon: Eye },
    ctl.deletionScheduledAt
      ? { key: "cancelDelete", title: "Deletion scheduled", body: `Permanent deletion on ${formatDateTime(ctl.deletionScheduledAt)}. Cancel to keep the workspace.`, label: "Cancel deletion", destructive: false, icon: RefreshCw }
      : { key: "delete", title: "Schedule deletion", body: "Deletes the workspace and all data after a 7-day grace period.", label: "Schedule deletion", destructive: true, icon: Trash2 },
  ];

  const openAction = (a: DangerAction) => {
    setReason("");
    setTyped("");
    setAction(a);
  };

  return (
    <div className="space-y-4">
      <LocalOnlyNote>Suspension, export and deletion scheduling are {LOCAL_ONLY_LABEL.toLowerCase()} and written to the audit log.</LocalOnlyNote>
      {ctl.deletionScheduledAt &&<Alert variant="danger">This workspace will be permanently deleted {formatRelative(ctl.deletionScheduledAt)}.</Alert>}
      {impersonated && (
        <Alert variant="warning">
          The merchant dashboard opened in a new tab at {MERCHANT_DASHBOARD_URL}. Real impersonation needs backend support (a short-lived token scoped to {ws.meta.ownerEmail ?? "the workspace owner"}); until then the tab opens with your own session or the login screen. The attempt was recorded in the audit log.
        </Alert>
      )}
      <Panel className="border-danger/30" title="Danger zone">
        <div className="divide-y divide-line">
          {rows.filter((r) => !r.hidden).map((r) => (
            <div key={r.key} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{r.title}</p>
                <p className="text-sm text-ink-soft">{r.body}</p>
              </div>
              <Button variant={r.destructive ? "destructive" : "outline"} onClick={() => openAction(r.key)}><r.icon /> {r.label}</Button>
            </div>
          ))}
        </div>
      </Panel>

      <ConfirmDialog open={action === "suspend"} title={`Suspend ${ws.name}?`} description="The storefront goes offline and the team is signed out. The owner is notified by email." confirmLabel="Suspend workspace" destructive confirmDisabled={!reason.trim()} onCancel={() => setAction(null)}
        onConfirm={async () => { onWs(await adminApi.suspendWorkspace(ws.id, reason)); onCtl(await controlApi.setStoreStatus(ws.id, "suspended", "")); toast.success("Workspace suspended."); setAction(null); }}>
        <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Chargeback investigation" />
      </ConfirmDialog>
      <ConfirmDialog open={action === "reactivate"} title={`Reactivate ${ws.name}?`} description="The merchant regains access and the storefront goes live." confirmLabel="Reactivate" onCancel={() => setAction(null)}
        onConfirm={async () => { onWs(await controlApi.reactivateWorkspace(ws.id)); onCtl(await controlApi.getControl(ws.id)); toast.success("Workspace reactivated."); setAction(null); }} />
      <ConfirmDialog open={action === "export"} title="Export workspace data?" description="A full export is queued; it appears under Data & backups when ready." confirmLabel="Queue export" onCancel={() => setAction(null)}
        onConfirm={async () => { onCtl(await controlApi.exportWorkspaceData(ws.id)); toast.success("Export queued."); setAction(null); }} />
      <ConfirmDialog open={action === "impersonate"} title={`Log in as ${ws.meta.ownerEmail ?? "the workspace owner"}?`} description={`Opens ${MERCHANT_DASHBOARD_URL} in a new tab. Real impersonation is not implemented on the backend yet.`} confirmLabel="Open merchant dashboard" onCancel={() => setAction(null)}
        onConfirm={async () => { await controlApi.logImpersonation(ws.id); window.open(`${MERCHANT_DASHBOARD_URL}/?impersonate=${encodeURIComponent(ws.id)}`, "_blank", "noopener,noreferrer"); setImpersonated(true); setAction(null); }} />
      <ConfirmDialog open={action === "delete"} title={`Schedule deletion of ${ws.name}?`} description="After 7 days all data is permanently deleted. You can cancel during the grace period." confirmLabel="Schedule deletion" destructive confirmDisabled={typed !== ws.slug} onCancel={() => setAction(null)}
        onConfirm={async () => { onCtl(await controlApi.scheduleDeletion(ws.id)); toast.success("Deletion scheduled in 7 days."); setAction(null); }}>
        <TextField label={`Type the workspace slug (${ws.slug}) to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <p className="mt-2 text-xs text-ink-soft">Slug: <Mono>{ws.slug}</Mono></p>
      </ConfirmDialog>
      <ConfirmDialog open={action === "cancelDelete"} title="Cancel scheduled deletion?" confirmLabel="Keep workspace" onCancel={() => setAction(null)}
        onConfirm={async () => { onCtl(await controlApi.cancelDeletion(ws.id)); toast.success("Deletion canceled."); setAction(null); }} />
    </div>
  );
}
