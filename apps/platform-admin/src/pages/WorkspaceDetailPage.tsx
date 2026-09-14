import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CircleCheck, RefreshCw } from "lucide-react";
import {
  Alert,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonVariants,
  cn,
} from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow } from "@/components/Drawer";
import { JsonBlock, Mono, Panel } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ChangePlanModal, ExtendTrialModal } from "@/components/SubscriptionDialogs";
import { WorkspaceStatus, countryName } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { PLAN_FEATURES } from "@/mock/constants";
import type { AdminWorkspace } from "@/mock/types";
import { controlApi } from "@/mock/controlApi";
import type { WorkspaceControl } from "@/mock/controlTypes";
import {
  DangerControlTab,
  LimitsTab,
  NotesTab,
  PaymentsTab,
  RealOverviewStrip,
  RiskTab,
  StorefrontTab,
  SubscriptionExtras,
  TeamControlTab,
} from "@/pages/workspace/ControlTabs";
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
  { key: "limits", label: "Limits & features" },
  { key: "team", label: "Team" },
  { key: "storefront", label: "Storefront" },
  { key: "payments", label: "Payments & payouts" },
  { key: "risk", label: "Risk" },
  { key: "notes", label: "Notes" },
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
  const rawTab = params.get("tab");
  // Older links (overview attention list) use ?tab=domains.
  const tabParam = rawTab === "domains" ? "storefront" : rawTab;
  const tab: TabKey = isTab(tabParam) ? tabParam : "overview";
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.getWorkspace(id), [id]);
  const control = useAsync(() => controlApi.getControl(id), [id]);
  const [version, setVersion] = useState(0);

  const onUpdated = (ws: AdminWorkspace) => {
    setData(ws);
    setVersion((v) => v + 1);
  };
  const onCtl = (c: WorkspaceControl) => {
    control.setData(c);
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
  const ctl = control.data;

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
        <TabsContent value="overview" className="space-y-4 pt-4">
          <RealOverviewStrip ws={ws} />
          <OverviewTab ws={ws} />
        </TabsContent>
        <TabsContent value="subscription" className="pt-4">
          <SubscriptionTab ws={ws} onUpdated={onUpdated} />
          {ctl && <SubscriptionExtras ws={ws} ctl={ctl} onCtl={onCtl} />}
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <ActivityTab workspaceId={ws.id} version={version} />
        </TabsContent>
        {tab !== "overview" && tab !== "subscription" && tab !== "activity" && (
          <DataState loading={control.loading} error={control.error} onRetry={() => void control.refresh()}>
            {ctl && (
              <>
                <TabsContent value="limits" className="pt-4"><LimitsTab ws={ws} ctl={ctl} onCtl={onCtl} /></TabsContent>
                <TabsContent value="team" className="pt-4"><TeamControlTab ws={ws} onWs={onUpdated} onCtl={onCtl} /></TabsContent>
                <TabsContent value="storefront" className="pt-4"><StorefrontTab ws={ws} ctl={ctl} onCtl={onCtl} onWs={onUpdated} /></TabsContent>
                <TabsContent value="payments" className="pt-4"><PaymentsTab ws={ws} ctl={ctl} onCtl={onCtl} /></TabsContent>
                <TabsContent value="risk" className="pt-4"><RiskTab ws={ws} ctl={ctl} onCtl={onCtl} /></TabsContent>
                <TabsContent value="notes" className="pt-4"><NotesTab ws={ws} ctl={ctl} onCtl={onCtl} /></TabsContent>
                <TabsContent value="danger" className="pt-4"><DangerControlTab ws={ws} ctl={ctl} onCtl={onCtl} onWs={onUpdated} /></TabsContent>
              </>
            )}
          </DataState>
        )}
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
