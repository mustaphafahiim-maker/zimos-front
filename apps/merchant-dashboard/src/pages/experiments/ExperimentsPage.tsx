import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FlaskConical, Pause, Play, Plus, Trash2, Trophy } from "lucide-react";
import { Alert, Button, Card, Input, Label, cn } from "@store-builder/ui";
import type { Experiment, ExperimentVariant } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { uid, nowIso } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { Toggle } from "@store-builder/ui";
import { useToast } from "@/components/Toast";

const STATUS_TONE: Record<Experiment["status"], "neutral" | "info" | "warning" | "success"> = {
  draft: "neutral",
  running: "info",
  paused: "warning",
  completed: "success",
};

const STATUS_LABEL: Record<Locale, Record<Experiment["status"], string>> = {
  en: { draft: "Draft", running: "Running", paused: "Paused", completed: "Completed" },
  ar: { draft: "مسودة", running: "قيد التشغيل", paused: "متوقف مؤقتًا", completed: "مكتمل" },
};

/** Stored target label for the store-page option (kept in English so saved data is locale-independent). */
const PAGE_TARGET_LABEL = "Page (store)";

const STRINGS = {
  en: {
    title: "A/B tests",
    description: "Split traffic between two versions of a funnel step or page and let the numbers decide.",
    newTest: "New test",
    emptyTitle: "No tests yet",
    emptyDescription: "Create a test to compare a headline, an offer price or a checkout layout.",
    modalTitle: "New A/B test",
    modalDescription: "Traffic is split between the two variants from the moment you start the test.",
    confirmTitleNamed: "Delete “{name}”?",
    confirmTitle: "Delete test?",
    confirmDescription: "Results are discarded. The step or page keeps whichever version is currently live.",
    confirmLabel: "Delete test",
    toastStarted: "Test started.",
    toastPaused: "Test paused.",
    toastCompleted: "Test completed.",
    toastWinner: "“{name}” declared the winner.",
    toastDeleted: "“{name}” deleted.",
    toastAutoPauseOn: "Loser will be paused automatically.",
    toastAutoPauseOff: "Auto-pause turned off.",
  },
  ar: {
    title: "اختبارات A/B",
    description: "وزّع الزيارات بين نسختين من خطوة في مسار البيع أو من صفحة، ودع الأرقام تحدد الأفضل.",
    newTest: "اختبار جديد",
    emptyTitle: "لا توجد اختبارات بعد",
    emptyDescription: "أنشئ اختبارًا لمقارنة عنوان أو سعر عرض أو تصميم صفحة إتمام الطلب.",
    modalTitle: "اختبار A/B جديد",
    modalDescription: "تُوزَّع الزيارات بين النسختين بمجرد بدء الاختبار.",
    confirmTitleNamed: "حذف «{name}»؟",
    confirmTitle: "حذف الاختبار؟",
    confirmDescription: "سيتم تجاهل النتائج، وتحتفظ الخطوة أو الصفحة بالنسخة المعروضة حاليًا.",
    confirmLabel: "حذف الاختبار",
    toastStarted: "بدأ الاختبار.",
    toastPaused: "تم إيقاف الاختبار مؤقتًا.",
    toastCompleted: "اكتمل الاختبار.",
    toastWinner: "تم اعتماد «{name}» كنسخة فائزة.",
    toastDeleted: "تم حذف «{name}».",
    toastAutoPauseOn: "سيتم إيقاف النسخة الخاسرة تلقائيًا.",
    toastAutoPauseOff: "تم إيقاف الإيقاف التلقائي.",
  },
} satisfies Messages;

const CARD_STRINGS = {
  en: {
    winnerNamed: "Winner: {name}",
    funnelStep: "Funnel step",
    page: "Page",
    pageStore: "Page (store)",
    startedOn: "started {date}",
    createdOn: "created {date}",
    resume: "Resume",
    start: "Start",
    pause: "Pause",
    complete: "Complete",
    deleteTest: "Delete test",
    colVariant: "Variant",
    colTraffic: "Traffic",
    colVisitors: "Visitors",
    colConversions: "Conversions",
    colRate: "Rate",
    winner: "Winner",
    leading: "Leading",
    declareWinner: "Declare winner",
    lift: "Lift (B vs A)",
    confidence: "Confidence",
    significant: "Statistically significant (≥ 95%).",
    keepCollecting: "Keep collecting data — aim for 95%.",
    autoPause: "Auto-pause loser",
    autoPauseDescription: "Stop sending traffic to the losing variant once significance is reached.",
  },
  ar: {
    winnerNamed: "الفائز: {name}",
    funnelStep: "خطوة في مسار البيع",
    page: "صفحة",
    pageStore: "صفحة (المتجر)",
    startedOn: "بدأ في {date}",
    createdOn: "أُنشئ في {date}",
    resume: "استئناف",
    start: "بدء",
    pause: "إيقاف مؤقت",
    complete: "إنهاء",
    deleteTest: "حذف الاختبار",
    colVariant: "النسخة",
    colTraffic: "توزيع الزيارات",
    colVisitors: "الزوار",
    colConversions: "التحويلات",
    colRate: "معدل التحويل",
    winner: "الفائز",
    leading: "في الصدارة",
    declareWinner: "اعتماد كفائز",
    lift: "التحسّن (B مقابل A)",
    confidence: "الدلالة الإحصائية",
    significant: "النتيجة ذات دلالة إحصائية (≥ 95%).",
    keepCollecting: "استمر في جمع البيانات حتى تصل إلى 95%.",
    autoPause: "إيقاف النسخة الخاسرة تلقائيًا",
    autoPauseDescription: "إيقاف إرسال الزيارات إلى النسخة الخاسرة بمجرد الوصول إلى الدلالة الإحصائية.",
  },
} satisfies Messages;

const FORM_STRINGS = {
  en: {
    name: "Name",
    namePlaceholder: "Headline: discount vs free shipping",
    target: "Target",
    pageStore: "Page (store)",
    variantA: "Variant A",
    variantB: "Variant B",
    defaultA: "A — Control",
    defaultB: "B — Variant",
    trafficSplit: "Traffic split",
    creating: "Creating…",
    createTest: "Create test",
    errName: "Give the test a name.",
    toastCreated: "“{name}” created. Start it when you're ready.",
  },
  ar: {
    name: "الاسم",
    namePlaceholder: "العنوان: خصم مقابل شحن مجاني",
    target: "الهدف",
    pageStore: "صفحة (المتجر)",
    variantA: "النسخة A",
    variantB: "النسخة B",
    defaultA: "A — النسخة الأصلية",
    defaultB: "B — النسخة البديلة",
    trafficSplit: "توزيع الزيارات",
    creating: "جارٍ الإنشاء…",
    createTest: "إنشاء الاختبار",
    errName: "أدخل اسمًا للاختبار.",
    toastCreated: "تم إنشاء «{name}». ابدأه عندما تكون جاهزًا.",
  },
} satisfies Messages;

// ------------------------------------------------------------- statistics --

/** Standard normal CDF via the Abramowitz–Stegun erf approximation. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function convRate(v: ExperimentVariant): number {
  return v.visitors > 0 ? v.conversions / v.visitors : 0;
}

interface Stats {
  /** Relative lift of B over A, as a fraction (0.11 = +11%). Null when A has no data. */
  lift: number | null;
  /** Two-sided confidence that the two rates differ, 0–100. */
  confidence: number;
}

/** Two-proportion z-test between the first two variants. */
function computeStats(a: ExperimentVariant | undefined, b: ExperimentVariant | undefined): Stats {
  if (!a || !b || a.visitors === 0 || b.visitors === 0) return { lift: null, confidence: 0 };
  const pa = convRate(a);
  const pb = convRate(b);
  const pooled = (a.conversions + b.conversions) / (a.visitors + b.visitors);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.visitors + 1 / b.visitors));
  const z = se > 0 ? (pb - pa) / se : 0;
  const confidence = Math.max(0, Math.min(100, (2 * normalCdf(Math.abs(z)) - 1) * 100));
  return { lift: pa > 0 ? (pb - pa) / pa : null, confidence };
}

// ------------------------------------------------------------------ page --

export function ExperimentsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listExperiments(workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Experiment | null>(null);

  const experiments = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  async function persist(next: Experiment, message: string) {
    try {
      await mockApi.saveExperiment(workspaceId, next);
      list.setData((prev) => (prev ?? []).map((e) => (e.id === next.id ? next : e)));
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function setStatus(exp: Experiment, status: Experiment["status"]) {
    const next: Experiment = { ...exp, status, startedAt: status === "running" && !exp.startedAt ? nowIso() : exp.startedAt };
    const message = status === "running" ? t.toastStarted : status === "paused" ? t.toastPaused : t.toastCompleted;
    void persist(next, message);
  }

  function declareWinner(exp: Experiment, variant: ExperimentVariant) {
    void persist({ ...exp, winnerVariantId: variant.id, status: "completed" }, fmt(t.toastWinner, { name: variant.name }));
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteExperiment(workspaceId, deleting.id);
    toast.success(fmt(t.toastDeleted, { name: deleting.name }));
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> {t.newTest}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {experiments.length === 0 ? (
          <EmptyState
            icon={<FlaskConical />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setCreating(true)}>{t.newTest}</Button>}
          />
        ) : (
          <div className="space-y-4">
            {experiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                exp={exp}
                onStatus={(s) => setStatus(exp, s)}
                onWinner={(v) => declareWinner(exp, v)}
                onAutoPause={(next) => void persist({ ...exp, autoPauseLoser: next }, next ? t.toastAutoPauseOn : t.toastAutoPauseOff)}
                onDelete={() => setDeleting(exp)}
              />
            ))}
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.modalTitle} description={t.modalDescription}>
        {creating && (
          <NewExperimentForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.confirmTitleNamed, { name: deleting.name }) : t.confirmTitle}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ------------------------------------------------------------------ card --

function ExperimentCard({
  exp,
  onStatus,
  onWinner,
  onAutoPause,
  onDelete,
}: {
  exp: Experiment;
  onStatus: (s: Experiment["status"]) => void;
  onWinner: (v: ExperimentVariant) => void;
  onAutoPause: (next: boolean) => void;
  onDelete: () => void;
}) {
  const t = useT(CARD_STRINGS);
  const { locale } = useLocale();
  const [a, b] = exp.variants;
  const stats = useMemo(() => computeStats(a, b), [a, b]);
  const significant = stats.confidence >= 95;
  const leader = exp.variants.reduce<ExperimentVariant | null>((best, v) => (best === null || convRate(v) > convRate(best) ? v : best), null);
  const targetLabel = exp.targetLabel === PAGE_TARGET_LABEL ? t.pageStore : exp.targetLabel;
  const dateText = exp.startedAt ? fmt(t.startedOn, { date: formatDate(exp.startedAt) }) : fmt(t.createdOn, { date: formatDate(exp.createdAt) });

  return (
    <Card className="rounded-2xl p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-ink">{exp.name}</h3>
            <StatusBadge value={STATUS_LABEL[locale][exp.status]} tone={STATUS_TONE[exp.status]} />
            {exp.winnerVariantId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                <Trophy className="size-3" aria-hidden />
                {fmt(t.winnerNamed, { name: exp.variants.find((v) => v.id === exp.winnerVariantId)?.name ?? "—" })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {exp.targetType === "funnel_step" ? t.funnelStep : t.page} · {targetLabel} · {dateText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {exp.status !== "completed" && exp.status !== "running" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("running")}>
              <Play className="size-3.5" aria-hidden /> {exp.status === "paused" ? t.resume : t.start}
            </Button>
          )}
          {exp.status === "running" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("paused")}>
              <Pause className="size-3.5" aria-hidden /> {t.pause}
            </Button>
          )}
          {exp.status !== "completed" && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("completed")}>
              <CheckCircle2 className="size-3.5" aria-hidden /> {t.complete}
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" aria-label={t.deleteTest} title={t.deleteTest} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="pb-2 text-start font-medium">{t.colVariant}</th>
                <th className="pb-2 text-start font-medium">{t.colTraffic}</th>
                <th className="pb-2 text-end font-medium">{t.colVisitors}</th>
                <th className="pb-2 text-end font-medium">{t.colConversions}</th>
                <th className="pb-2 text-end font-medium">{t.colRate}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {exp.variants.map((v) => {
                const isWinner = exp.winnerVariantId === v.id;
                const isLeader = leader?.id === v.id && !exp.winnerVariantId && v.visitors > 0;
                return (
                  <tr key={v.id} className="border-t border-line">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-ink">{v.name}</span>
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                            <Trophy className="size-3" aria-hidden /> {t.winner}
                          </span>
                        )}
                        {isLeader && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-dark">{t.leading}</span>}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line/60">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${v.trafficPercent}%` }} />
                        </span>
                        <span className="tabular-nums text-ink-soft" dir="ltr">
                          {v.trafficPercent}%
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 text-end tabular-nums text-ink-soft">
                      <bdi>{v.visitors.toLocaleString()}</bdi>
                    </td>
                    <td className="py-2.5 text-end tabular-nums text-ink-soft">
                      <bdi>{v.conversions.toLocaleString()}</bdi>
                    </td>
                    <td className="py-2.5 text-end tabular-nums font-medium text-ink">
                      <span dir="ltr">{(convRate(v) * 100).toFixed(2)}%</span>
                    </td>
                    <td className="py-2.5 text-end">
                      {!exp.winnerVariantId && (
                        <Button size="xs" variant="ghost" onClick={() => onWinner(v)}>
                          {t.declareWinner}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.lift}</p>
            <p className={cn("mt-0.5 font-display text-2xl font-semibold", stats.lift === null ? "text-ink-soft" : stats.lift >= 0 ? "text-success" : "text-danger")}>
              <span dir="ltr">{stats.lift === null ? "—" : `${stats.lift >= 0 ? "+" : ""}${(stats.lift * 100).toFixed(1)}%`}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.confidence}</p>
            <p className={cn("mt-0.5 font-display text-2xl font-semibold", significant ? "text-success" : "text-ink")}>
              <span dir="ltr">{stats.confidence.toFixed(1)}%</span>
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
              <div className={cn("h-full rounded-full", significant ? "bg-success" : "bg-warning")} style={{ width: `${stats.confidence}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">{significant ? t.significant : t.keepCollecting}</p>
          </div>
          <div className="border-t border-line pt-3">
            <Toggle label={t.autoPause} description={t.autoPauseDescription} checked={exp.autoPauseLoser} onChange={onAutoPause} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ form --

type TargetOption = { value: string; label: string; type: Experiment["targetType"] };

function NewExperimentForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const funnels = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);

  const targets = useMemo<TargetOption[]>(() => {
    const out: TargetOption[] = [{ value: "page", label: PAGE_TARGET_LABEL, type: "page" }];
    for (const f of funnels.data ?? []) {
      for (const s of f.steps) out.push({ value: `${f.id}:${s.key}`, label: `${f.name} — ${s.name}`, type: "funnel_step" });
    }
    return out;
  }, [funnels.data]);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("page");
  const [nameA, setNameA] = useState(t.defaultA);
  const [nameB, setNameB] = useState(t.defaultB);
  const [split, setSplit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.errName);
      return;
    }
    const opt = targets.find((x) => x.value === target) ?? targets[0];
    const exp: Experiment = {
      id: uid(),
      workspaceId,
      name: name.trim(),
      targetType: opt.type,
      targetLabel: opt.label,
      status: "draft",
      winnerVariantId: null,
      autoPauseLoser: true,
      variants: [
        { id: uid(), name: nameA.trim() || "A", trafficPercent: split, visitors: 0, conversions: 0 },
        { id: uid(), name: nameB.trim() || "B", trafficPercent: 100 - split, visitors: 0, conversions: 0 },
      ],
      startedAt: null,
      createdAt: nowIso(),
    };
    setSaving(true);
    setError(null);
    try {
      await mockApi.saveExperiment(workspaceId, exp);
      toast.success(fmt(t.toastCreated, { name: exp.name }));
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="exp-name">{t.name}</Label>
        <Input id="exp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-target">{t.target}</Label>
        <Select id="exp-target" value={target} onChange={(e) => setTarget(e.target.value)} disabled={funnels.loading}>
          {targets.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value === "page" ? t.pageStore : opt.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-a">{t.variantA}</Label>
          <Input id="exp-a" value={nameA} onChange={(e) => setNameA(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-b">{t.variantB}</Label>
          <Input id="exp-b" value={nameB} onChange={(e) => setNameB(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-split">{t.trafficSplit}</Label>
        <input id="exp-split" type="range" min={10} max={90} step={5} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
        <div className="flex justify-between text-xs tabular-nums text-ink-soft">
          <span>
            A · <span className="font-medium text-ink" dir="ltr">{split}%</span>
          </span>
          <span>
            B · <span className="font-medium text-ink" dir="ltr">{100 - split}%</span>
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.creating : t.createTest}
        </Button>
      </div>
    </form>
  );
}
