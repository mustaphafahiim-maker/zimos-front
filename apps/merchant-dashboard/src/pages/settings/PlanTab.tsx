import { Check } from "lucide-react";
import { Button, Card, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { PlanInfo } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const PLANS: Array<{ key: PlanInfo["planKey"]; name: string; price: number; features: string[] }> = [
  { key: "starter", name: "Starter", price: 19900, features: ["1 store", "1 custom domain", "1.5% transaction fee", "COD confirmation queue"] },
  { key: "growth", name: "Growth", price: 49900, features: ["1 store + funnels", "3 custom domains", "0.5% transaction fee", "Automations & WhatsApp"] },
  { key: "scale", name: "Scale", price: 99900, features: ["Unlimited stores & domains", "0% COD fee", "Priority support", "Fraud shield & A/B tests"] },
];

const RANK: Record<PlanInfo["planKey"], number> = { starter: 0, growth: 1, scale: 2 };

const STATUS_TONE: Record<PlanInfo["status"], "success" | "info" | "danger"> = { active: "success", trialing: "info", past_due: "danger" };

export function PlanTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const plan = useAsync(() => mockApi.getPlan(workspaceId), [workspaceId]);

  return (
    <DataState loading={plan.loading} error={plan.error} onRetry={() => plan.refresh()}>
      {plan.data && <PlanBody p={plan.data} onUpgrade={(name) => toast.success(`Upgrade to ${name} requested — billing will contact you.`)} />}
    </DataState>
  );
}

function PlanBody({ p, onUpgrade }: { p: PlanInfo; onUpgrade: (name: string) => void }) {
  const usagePct = Math.min(100, Math.round((p.ordersThisMonth / Math.max(p.softOrderQuota, 1)) * 100));
  return (
    <div className="space-y-8">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-xl font-medium text-ink">{p.planName}</p>
              <StatusBadge value={p.status} tone={STATUS_TONE[p.status]} />
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {formatMoney(p.monthlyPriceAmount, p.currency)} / month
              {p.trialEndsAt && ` · trial ends ${formatDate(p.trialEndsAt)}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-ink-soft">Transaction fee</dt>
            <dd className="text-right font-medium text-ink">{formatPercent(p.transactionFeeBasisPoints)}</dd>
            <dt className="text-ink-soft">COD fee</dt>
            <dd className="text-right font-medium text-ink">{formatPercent(p.codFeeBasisPoints)}</dd>
          </dl>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">Orders this month</span>
            <span className="tabular-nums text-ink">
              {p.ordersThisMonth.toLocaleString()} / {p.softOrderQuota.toLocaleString()}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line/60">
            <div className={cn("h-full rounded-full", usagePct >= 90 ? "bg-danger" : usagePct >= 70 ? "bg-accent" : "bg-primary")} style={{ width: `${usagePct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">Soft quota — orders above it are never blocked, we just suggest the next plan.</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((pl) => {
          const current = pl.key === p.planKey;
          const lower = RANK[pl.key] < RANK[p.planKey];
          return (
            <Card key={pl.key} className={cn("flex flex-col p-5", current && "ring-2 ring-primary")}>
              <p className="font-display text-lg font-medium text-ink">{pl.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                <span className="text-2xl font-medium text-ink">{formatMoney(pl.price, "EGP")}</span> / mo
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {pl.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : lower ? (
                  <Button variant="ghost" className="w-full" onClick={() => onUpgrade(pl.name)}>
                    Downgrade
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => onUpgrade(pl.name)}>
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
