import { Check } from "lucide-react";
import { Button, Card, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { PlanInfo } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type PlanKey = PlanInfo["planKey"];

const PLANS: Array<{ key: PlanKey; price: number }> = [
  { key: "starter", price: 19900 },
  { key: "growth", price: 49900 },
  { key: "scale", price: 99900 },
];

const PLAN_TEXT: Record<Locale, Record<PlanKey, { name: string; features: string[] }>> = {
  en: {
    starter: { name: "Starter", features: ["1 store", "1 custom domain", "1.5% transaction fee", "COD confirmation queue"] },
    growth: { name: "Growth", features: ["1 store + funnels", "3 custom domains", "0.5% transaction fee", "Automations & WhatsApp"] },
    scale: { name: "Scale", features: ["Unlimited stores & domains", "0% COD fee", "Priority support", "Fraud shield & A/B tests"] },
  },
  ar: {
    starter: { name: "Starter", features: ["متجر واحد", "نطاق مخصص واحد", "رسوم معاملات 1.5%", "قائمة تأكيد طلبات الدفع عند الاستلام"] },
    growth: { name: "Growth", features: ["متجر واحد + مسارات مبيعات", "3 نطاقات مخصصة", "رسوم معاملات 0.5%", "الأتمتة و WhatsApp"] },
    scale: { name: "Scale", features: ["متاجر ونطاقات بلا حدود", "0% رسوم الدفع عند الاستلام", "دعم فني ذو أولوية", "الحماية من الاحتيال واختبارات A/B"] },
  },
};

const RANK: Record<PlanKey, number> = { starter: 0, growth: 1, scale: 2 };

type Tone = "success" | "info" | "danger";
const STATUS_TONE: Record<PlanInfo["status"], Tone> = { active: "success", trialing: "info", past_due: "danger" };
const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/25",
  info: "bg-info-soft text-info border-info/25",
  danger: "bg-danger-soft text-danger border-danger/25",
};
const STATUS_LABEL: Record<Locale, Record<PlanInfo["status"], string>> = {
  en: { active: "Active", trialing: "Trial", past_due: "Past due" },
  ar: { active: "نشطة", trialing: "فترة تجريبية", past_due: "متأخرة السداد" },
};

const STRINGS = {
  en: {
    upgradeRequested: "Upgrade to {name} requested — billing will contact you.",
    perMonth: "/ month",
    perMo: "/ mo",
    trialEnds: "Trial ends {date}",
    transactionFee: "Transaction fee",
    codFee: "COD fee",
    ordersThisMonth: "Orders this month",
    softQuota: "Soft quota — orders above it are never blocked, we just suggest the next plan.",
    currentPlan: "Current plan",
    downgrade: "Downgrade",
    upgrade: "Upgrade",
  },
  ar: {
    upgradeRequested: "تم طلب الترقية إلى {name} — سيتواصل معك فريق الفوترة.",
    perMonth: "/ شهريًا",
    perMo: "/ شهريًا",
    trialEnds: "تنتهي الفترة التجريبية في {date}",
    transactionFee: "رسوم المعاملات",
    codFee: "رسوم الدفع عند الاستلام",
    ordersThisMonth: "طلبات هذا الشهر",
    softQuota: "حد مرن — لن يتم إيقاف الطلبات التي تتجاوزه أبدًا، سنقترح عليك الخطة التالية فقط.",
    currentPlan: "خطتك الحالية",
    downgrade: "تخفيض الخطة",
    upgrade: "ترقية",
  },
} satisfies Messages;

export function PlanTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const plan = useAsync(() => mockApi.getPlan(workspaceId), [workspaceId]);

  return (
    <DataState loading={plan.loading} error={plan.error} onRetry={() => plan.refresh()}>
      {plan.data && (
        <PlanBody p={plan.data} onUpgrade={(name) => toast.success(fmt(t.upgradeRequested, { name }))} />
      )}
    </DataState>
  );
}

function PlanBody({ p, onUpgrade }: { p: PlanInfo; onUpgrade: (name: string) => void }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const usagePct = Math.min(100, Math.round((p.ordersThisMonth / Math.max(p.softOrderQuota, 1)) * 100));
  return (
    <div className="space-y-8">
      <Card className="rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-semibold text-ink">{p.planName}</p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  TONE_CLASS[STATUS_TONE[p.status]]
                )}
              >
                {STATUS_LABEL[locale][p.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              <bdi dir="ltr">{formatMoney(p.monthlyPriceAmount, p.currency)}</bdi> {t.perMonth}
              {p.trialEndsAt && <> · {fmt(t.trialEnds, { date: formatDate(p.trialEndsAt) })}</>}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-ink-soft">{t.transactionFee}</dt>
            <dd className="text-end font-medium text-ink">
              <bdi dir="ltr">{formatPercent(p.transactionFeeBasisPoints)}</bdi>
            </dd>
            <dt className="text-ink-soft">{t.codFee}</dt>
            <dd className="text-end font-medium text-ink">
              <bdi dir="ltr">{formatPercent(p.codFeeBasisPoints)}</bdi>
            </dd>
          </dl>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{t.ordersThisMonth}</span>
            <span className="tabular-nums text-ink" dir="ltr">
              {formatNumber(p.ordersThisMonth)} / {formatNumber(p.softOrderQuota)}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zimos-ice">
            <div
              className={cn("h-full rounded-full", usagePct >= 90 ? "bg-danger" : usagePct >= 70 ? "bg-warning" : "bg-primary")}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft">{t.softQuota}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((pl) => {
          const text = PLAN_TEXT[locale][pl.key];
          const current = pl.key === p.planKey;
          const lower = RANK[pl.key] < RANK[p.planKey];
          return (
            <Card key={pl.key} className={cn("flex flex-col rounded-2xl p-5", current && "ring-2 ring-primary")}>
              <p className="font-display text-lg font-semibold text-ink">{text.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                <bdi dir="ltr" className="text-2xl font-semibold text-ink">
                  {formatMoney(pl.price, "EGP")}
                </bdi>{" "}
                {t.perMo}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {text.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {current ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t.currentPlan}
                  </Button>
                ) : lower ? (
                  <Button variant="ghost" className="w-full" onClick={() => onUpgrade(text.name)}>
                    {t.downgrade}
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => onUpgrade(text.name)}>
                    {t.upgrade}
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
