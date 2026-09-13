import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Ban, CircleCheck, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Alert,
  Button,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  buttonVariants,
  cn,
} from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow } from "@/components/Drawer";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ChangePlanModal, ExtendTrialModal } from "@/components/SubscriptionDialogs";
import { WorkspaceStatus, countryName } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { PLAN_FEATURES } from "@/mock/constants";
import type { AdminWorkspace } from "@/mock/types";
import {
  formatBp,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatRelative,
} from "@/lib/format";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "subscription", label: "Subscription" },
  { key: "team", label: "Team" },
  { key: "domains", label: "Domains" },
  { key: "activity", label: "Activity" },
  { key: "danger", label: "Danger zone" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function isTab(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v);
}

export function WorkspaceDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = isTab(tabParam) ? tabParam : "overview";
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.getWorkspace(id), [id]);
  const [version, setVersion] = useState(0);

  const onUpdated = (ws: AdminWorkspace) => {
    setData(ws);
    setVersion((v) => v + 1);
  };

  if (loading || error) {
    return (
      <div>
        <PageHeader title="Workspace" back={{ to: "/workspaces", label: "Workspaces" }} />
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {null}
        </DataState>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Workspace not found" back={{ to: "/workspaces", label: "Workspaces" }} />
        <EmptyBlock
          message={`No workspace with id “${id}” is in the current workspace list.`}
          action={
            <Link to="/workspaces" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to workspaces
            </Link>
          }
        />
      </div>
    );
  }

  const ws = data;

  return (
    <div>
      <PageHeader
        title={ws.name}
        titleBadge={<WorkspaceStatus ws={ws} />}
        description={`${ws.slug} · ${ws.meta.ownerEmail} · ${countryName(ws.meta.country)}`}
        back={{ to: "/workspaces", label: "Workspaces" }}
      />

      {ws.meta.suspended && (
        <Alert variant="danger" className="mb-4">
          This workspace is suspended{ws.meta.suspendedReason ? `: ${ws.meta.suspendedReason}` : "."} Its storefront and dashboard are
          unavailable to the merchant.
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
        <div className="scroll-thin overflow-x-auto border-b border-line">
          <TabsList variant="line" className="h-10">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab ws={ws} />
        </TabsContent>
        <TabsContent value="subscription" className="pt-4">
          <SubscriptionTab ws={ws} onUpdated={onUpdated} />
        </TabsContent>
        <TabsContent value="team" className="pt-4">
          <TeamTab ws={ws} />
        </TabsContent>
        <TabsContent value="domains" className="pt-4">
          <DomainsTab ws={ws} onUpdated={onUpdated} />
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <ActivityTab workspaceId={ws.id} version={version} />
        </TabsContent>
        <TabsContent value="danger" className="pt-4">
          <DangerTab ws={ws} onUpdated={onUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ ws }: { ws: AdminWorkspace }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Orders (30d)" value={formatNumber(ws.meta.ordersLast30d)} hint={`${formatNumber(ws.meta.ordersToday)} today`} />
        <KpiCard label="GMV (30d)" value={formatMoneyCompact(ws.meta.gmvLast30d)} hint={formatMoney(ws.meta.gmvLast30d)} />
        <KpiCard label="MRR" value={formatMoney(ws.mrr)} hint={ws.plan ? `${ws.plan.name} · ${ws.meta.billingCycle}` : "No plan"} />
        <KpiCard label="Delivery rate" value={formatPercent(ws.meta.deliveryRate, 0)} hint="Delivered / shipped, 30d" />
        <KpiCard
          label="RTO rate"
          value={<span className={cn(ws.meta.rtoRate >= 30 && "text-danger")}>{formatPercent(ws.meta.rtoRate, 0)}</span>}
          hint={ws.meta.rtoRate >= 30 ? "Above the 30% attention threshold" : "Returned to origin, 30d"}
        />
        <KpiCard label="Team" value={formatNumber(ws.meta.members.length)} hint={`${ws.meta.domains.length} domain${ws.meta.domains.length === 1 ? "" : "s"}`} />
      </div>
      <Panel title="Details">
        <dl>
          <DetailRow label="Workspace ID">
            <Mono>{ws.id}</Mono>
          </DetailRow>
          <DetailRow label="Slug">{ws.slug}</DetailRow>
          <DetailRow label="Owner">
            {ws.meta.ownerName} · {ws.meta.ownerEmail}
          </DetailRow>
          <DetailRow label="Country">{countryName(ws.meta.country)}</DetailRow>
          <DetailRow label="Store currency">{ws.currency}</DetailRow>
          <DetailRow label="Created">{formatDateTime(ws.createdAt)}</DetailRow>
        </dl>
      </Panel>
    </div>
  );
}

function SubscriptionTab({ ws, onUpdated }: { ws: AdminWorkspace; onUpdated: (ws: AdminWorkspace) => void }) {
  const toast = useToast();
  const plans = useAsync(() => adminApi.listPlans(), []);
  const [changeOpen, setChangeOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [confirm, setConfirm] = useState<"paid" | "cancel" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const status = ws.meta.subscriptionStatus;

  async function retry() {
    setRetrying(true);
    try {
      const { ok, workspace } = await adminApi.retryPayment(ws.id);
      onUpdated(workspace);
      if (ok) toast.success("Payment succeeded — subscription is active.");
      else toast.error("Payment failed again. The card on file was declined.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title="Subscription"
        actions={<Status value={status} />}
      >
        <dl>
          <DetailRow label="Plan">{ws.plan?.name ?? "—"}</DetailRow>
          <DetailRow label="Billing cycle">
            <span className="capitalize">{ws.meta.billingCycle}</span>
          </DetailRow>
          <DetailRow label="Price">
            {ws.plan ? (ws.meta.billingCycle === "yearly" ? `${formatMoney(ws.plan.yearlyPrice)} / year` : `${formatMoney(ws.plan.monthlyPrice)} / month`) : "—"}
          </DetailRow>
          <DetailRow label="MRR contribution">{formatMoney(ws.mrr)}</DetailRow>
          {status === "trialing" && <DetailRow label="Trial ends">{formatDate(ws.meta.trialEndsAt)} ({formatRelative(ws.meta.trialEndsAt)})</DetailRow>}
          {(status === "active" || status === "past_due") && <DetailRow label="Next billing">{formatDate(ws.meta.nextBillingAt)}</DetailRow>}
          {ws.meta.lastPaymentFailedAt && (
            <DetailRow label="Last payment failure">
              <span className="text-danger">{formatDateTime(ws.meta.lastPaymentFailedAt)}</span>
            </DetailRow>
          )}
          {ws.meta.canceledAt && <DetailRow label="Canceled">{formatDateTime(ws.meta.canceledAt)}</DetailRow>}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button onClick={() => setChangeOpen(true)} disabled={plans.loading || !plans.data}>
            Change plan
          </Button>
          <Button variant="outline" onClick={() => setTrialOpen(true)}>
            Extend trial
          </Button>
          {status !== "active" && (
            <Button variant="outline" onClick={() => setConfirm("paid")}>
              <CircleCheck /> Mark paid
            </Button>
          )}
          {status === "past_due" && (
            <Button variant="outline" onClick={retry} disabled={retrying}>
              <RefreshCw className={cn(retrying && "animate-spin")} /> {retrying ? "Retrying…" : "Retry payment"}
            </Button>
          )}
          {status !== "canceled" && (
            <Button variant="destructive" onClick={() => setConfirm("cancel")}>
              Cancel subscription
            </Button>
          )}
        </div>
      </Panel>

      <Panel title="Plan limits">
        {ws.plan ? (
          <dl>
            <DetailRow label="Order quota">{ws.plan.orderQuota === null ? "Unlimited" : `${formatNumber(ws.plan.orderQuota)} / month`}</DetailRow>
            <DetailRow label="Transaction fee">{formatBp(ws.plan.transactionFeeBp)}</DetailRow>
            <DetailRow label="COD fee">{formatBp(ws.plan.codFeeBp)}</DetailRow>
            <DetailRow label="Features">
              <ul className="space-y-0.5">
                {PLAN_FEATURES.filter((f) => ws.plan?.features.includes(f.key)).map((f) => (
                  <li key={f.key} className="text-xs">
                    {f.label}
                  </li>
                ))}
              </ul>
            </DetailRow>
          </dl>
        ) : (
          <p className="text-sm text-ink-soft">This workspace's plan no longer exists.</p>
        )}
      </Panel>

      {plans.data && (
        <ChangePlanModal ws={ws} plans={plans.data} open={changeOpen} onClose={() => setChangeOpen(false)} onDone={onUpdated} />
      )}
      <ExtendTrialModal ws={ws} open={trialOpen} onClose={() => setTrialOpen(false)} onDone={onUpdated} />
      <ConfirmDialog
        open={confirm === "paid"}
        title="Mark subscription as paid?"
        description="Use this when payment was received outside the card processor (e.g. bank transfer). The subscription becomes active and the next billing date moves forward one cycle."
        confirmLabel="Mark paid"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const next = await adminApi.markPaid(ws.id);
          onUpdated(next);
          toast.success("Marked as paid.");
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancel subscription?"
        description={`${ws.name} will lose paid features at the end of the current period. This can be undone by changing plan or marking paid.`}
        confirmLabel="Cancel subscription"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const next = await adminApi.cancelSubscription(ws.id);
          onUpdated(next);
          toast.success("Subscription canceled.");
          setConfirm(null);
        }}
      />
    </div>
  );
}

function TeamTab({ ws }: { ws: AdminWorkspace }) {
  if (ws.meta.members.length === 0) return <EmptyBlock message="No team members." />;
  return (
    <Panel flush title="Members" description={`${ws.meta.members.length} people`}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Last active</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ws.meta.members.map((m) => (
            <TableRow key={m.id}>
              <Td className="font-medium">{m.name}</Td>
              <Td className="text-ink-soft">{m.email}</Td>
              <Td>
                <StatusBadge tone={m.role === "owner" ? "primary" : "neutral"}>{m.role}</StatusBadge>
              </Td>
              <Td className="text-ink-soft">{m.lastActiveAt ? formatRelative(m.lastActiveAt) : "Never"}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function DomainsTab({ ws, onUpdated }: { ws: AdminWorkspace; onUpdated: (ws: AdminWorkspace) => void }) {
  const toast = useToast();
  const [checking, setChecking] = useState<string | null>(null);

  async function recheck(domainId: string, hostname: string) {
    setChecking(domainId);
    try {
      const next = await adminApi.recheckDomain(ws.id, domainId);
      onUpdated(next);
      toast.success(`${hostname} verified.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChecking(null);
    }
  }

  if (ws.meta.domains.length === 0) return <EmptyBlock message="No domains connected." />;
  return (
    <Panel flush title="Domains">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Hostname</Th>
            <Th>Verification</Th>
            <Th>SSL</Th>
            <Th>Added</Th>
            <Th>Last checked</Th>
            <Th className="text-end">Actions</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ws.meta.domains.map((d) => (
            <TableRow key={d.id}>
              <Td className="font-medium">{d.hostname}</Td>
              <Td>
                {d.verified ? (
                  <StatusBadge tone="success" dot>
                    Verified
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning" dot>
                    Unverified
                  </StatusBadge>
                )}
              </Td>
              <Td>
                <StatusBadge tone={d.ssl === "active" ? "success" : d.ssl === "pending" ? "warning" : "danger"}>{d.ssl}</StatusBadge>
              </Td>
              <Td className="text-ink-soft">{formatDate(d.addedAt)}</Td>
              <Td className="text-ink-soft">{formatRelative(d.lastCheckedAt)}</Td>
              <Td className="text-end">
                {!d.verified && (
                  <Button size="sm" variant="outline" onClick={() => recheck(d.id, d.hostname)} disabled={checking === d.id}>
                    <RefreshCw className={cn(checking === d.id && "animate-spin")} /> Re-check DNS
                  </Button>
                )}
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function ActivityTab({ workspaceId, version }: { workspaceId: string; version: number }) {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaceActivity(workspaceId), [workspaceId, version]);
  return (
    <DataState
      loading={loading}
      error={error}
      onRetry={() => void refresh()}
      empty={!!data && data.length === 0}
      emptyMessage="No admin activity recorded for this workspace."
    >
      <Panel flush title="Admin activity" description="Actions taken by the ZIMOS team on this workspace.">
        <ul className="divide-y divide-line">
          {(data ?? []).map((e) => (
            <li key={e.id} className="px-5 py-3">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                  <Mono>{e.action}</Mono>
                  <span className="text-sm text-ink">{e.entityLabel}</span>
                  <span className="text-xs text-ink-soft">by {e.actorName}</span>
                  <span className="ms-auto text-xs text-ink-soft" title={formatDateTime(e.createdAt)}>
                    {formatRelative(e.createdAt)}
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-soft">Before</p>
                    <JsonBlock value={e.before} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-soft">After</p>
                    <JsonBlock value={e.after} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Panel>
    </DataState>
  );
}

function DangerTab({ ws, onUpdated }: { ws: AdminWorkspace; onUpdated: (ws: AdminWorkspace) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      <Panel className="border-danger/30" title="Danger zone">
        <div className="divide-y divide-line">
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{ws.meta.suspended ? "Unsuspend workspace" : "Suspend workspace"}</p>
              <p className="text-sm text-ink-soft">
                {ws.meta.suspended
                  ? "Restore access to the storefront and dashboard."
                  : "Takes the storefront offline and blocks dashboard access. Data is kept."}
              </p>
            </div>
            <Button
              variant={ws.meta.suspended ? "outline" : "destructive"}
              onClick={() => {
                setReason("");
                setOpen(true);
              }}
            >
              {ws.meta.suspended ? <ShieldCheck /> : <Ban />}
              {ws.meta.suspended ? "Unsuspend" : "Suspend"}
            </Button>
          </div>
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Impersonate owner</p>
              <p className="text-sm text-ink-soft">Open the merchant dashboard as {ws.meta.ownerEmail} for support. Every session is audited.</p>
            </div>
            <Button variant="outline" onClick={() => toast.info("Impersonation requires backend support")}>
              <Eye /> Impersonate
            </Button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={open}
        title={ws.meta.suspended ? `Unsuspend ${ws.name}?` : `Suspend ${ws.name}?`}
        description={
          ws.meta.suspended
            ? "The merchant regains access immediately."
            : "The storefront goes offline and the team is signed out. The owner is notified by email."
        }
        confirmLabel={ws.meta.suspended ? "Unsuspend" : "Suspend workspace"}
        destructive={!ws.meta.suspended}
        confirmDisabled={!ws.meta.suspended && !reason.trim()}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const next = ws.meta.suspended ? await adminApi.unsuspendWorkspace(ws.id) : await adminApi.suspendWorkspace(ws.id, reason);
          onUpdated(next);
          toast.success(next.meta.suspended ? "Workspace suspended." : "Workspace unsuspended.");
          setOpen(false);
        }}
      >
        {!ws.meta.suspended && (
          <div className="space-y-1.5">
            <label htmlFor="suspend-reason" className="text-sm font-medium text-ink">
              Reason <span className="text-danger">*</span>
            </label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Chargeback investigation, terms violation…"
            />
            <p className="text-xs text-ink-soft">Recorded in the audit log.</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
