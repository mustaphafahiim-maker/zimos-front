import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FlaskConical, Pause, Play, Plus, Trash2, Trophy } from "lucide-react";
import { Alert, Button, Card, Input, Label, cn } from "@store-builder/ui";
import type { Experiment, ExperimentVariant } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { uid, nowIso } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

const STATUS_TONE: Record<Experiment["status"], "neutral" | "info" | "warning" | "success"> = {
  draft: "neutral",
  running: "info",
  paused: "warning",
  completed: "success",
};

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
    const message = status === "running" ? "Test started." : status === "paused" ? "Test paused." : "Test completed.";
    void persist(next, message);
  }

  function declareWinner(exp: Experiment, variant: ExperimentVariant) {
    void persist({ ...exp, winnerVariantId: variant.id, status: "completed" }, `"${variant.name}" declared the winner.`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteExperiment(workspaceId, deleting.id);
    toast.success(`"${deleting.name}" deleted.`);
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="A/B tests"
        description="Split traffic between two versions of a funnel step or page and let the numbers decide."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New test
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {experiments.length === 0 ? (
          <EmptyState
            icon={<FlaskConical />}
            title="No tests yet"
            description="Create a test to compare a headline, an offer price or a checkout layout."
            action={<Button onClick={() => setCreating(true)}>New test</Button>}
          />
        ) : (
          <div className="space-y-4">
            {experiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                exp={exp}
                onStatus={(s) => setStatus(exp, s)}
                onWinner={(v) => declareWinner(exp, v)}
                onAutoPause={(next) => void persist({ ...exp, autoPauseLoser: next }, next ? "Loser will be paused automatically." : "Auto-pause turned off.")}
                onDelete={() => setDeleting(exp)}
              />
            ))}
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title="New A/B test" description="Traffic is split between the two variants from the moment you start the test.">
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
        title={deleting ? `Delete "${deleting.name}"?` : "Delete test?"}
        description="Results are discarded. The step or page keeps whichever version is currently live."
        confirmLabel="Delete test"
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
  const [a, b] = exp.variants;
  const stats = useMemo(() => computeStats(a, b), [a, b]);
  const significant = stats.confidence >= 95;
  const leader = exp.variants.reduce<ExperimentVariant | null>((best, v) => (best === null || convRate(v) > convRate(best) ? v : best), null);

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-medium text-ink">{exp.name}</h3>
            <StatusBadge value={exp.status} tone={STATUS_TONE[exp.status]} />
            {exp.winnerVariantId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
                <Trophy className="size-3" aria-hidden /> Winner: {exp.variants.find((v) => v.id === exp.winnerVariantId)?.name ?? "—"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {exp.targetType === "funnel_step" ? "Funnel step" : "Page"} · {exp.targetLabel}
            {exp.startedAt ? ` · started ${formatDate(exp.startedAt)}` : ` · created ${formatDate(exp.createdAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {exp.status !== "completed" && exp.status !== "running" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("running")}>
              <Play className="size-3.5" aria-hidden /> {exp.status === "paused" ? "Resume" : "Start"}
            </Button>
          )}
          {exp.status === "running" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("paused")}>
              <Pause className="size-3.5" aria-hidden /> Pause
            </Button>
          )}
          {exp.status !== "completed" && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("completed")}>
              <CheckCircle2 className="size-3.5" aria-hidden /> Complete
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" aria-label="Delete test" title="Delete" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="pb-2 font-medium">Variant</th>
                <th className="pb-2 font-medium">Traffic</th>
                <th className="pb-2 text-right font-medium">Visitors</th>
                <th className="pb-2 text-right font-medium">Conversions</th>
                <th className="pb-2 text-right font-medium">Rate</th>
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
                            <Trophy className="size-3" aria-hidden /> Winner
                          </span>
                        )}
                        {isLeader && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-dark">Leading</span>}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line/60">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${v.trafficPercent}%` }} />
                        </span>
                        <span className="tabular-nums text-ink-soft">{v.trafficPercent}%</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-soft">{v.visitors.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-soft">{v.conversions.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-ink">{(convRate(v) * 100).toFixed(2)}%</td>
                    <td className="py-2.5 text-right">
                      {!exp.winnerVariantId && (
                        <Button size="xs" variant="ghost" onClick={() => onWinner(v)}>
                          Declare winner
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Lift (B vs A)</p>
            <p className={cn("mt-0.5 font-display text-2xl font-medium", stats.lift === null ? "text-ink-soft" : stats.lift >= 0 ? "text-success" : "text-danger")}>
              {stats.lift === null ? "—" : `${stats.lift >= 0 ? "+" : ""}${(stats.lift * 100).toFixed(1)}%`}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Confidence</p>
            <p className={cn("mt-0.5 font-display text-2xl font-medium", significant ? "text-success" : "text-ink")}>{stats.confidence.toFixed(1)}%</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
              <div className={cn("h-full rounded-full", significant ? "bg-success" : "bg-accent")} style={{ width: `${stats.confidence}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">{significant ? "Statistically significant (≥ 95%)." : "Keep collecting data — aim for 95%."}</p>
          </div>
          <div className="border-t border-line pt-3">
            <Toggle label="Auto-pause loser" description="Stop sending traffic to the losing variant once significance is reached." checked={exp.autoPauseLoser} onChange={onAutoPause} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ form --

type TargetOption = { value: string; label: string; type: Experiment["targetType"] };

function NewExperimentForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const funnels = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);

  const targets = useMemo<TargetOption[]>(() => {
    const out: TargetOption[] = [{ value: "page", label: "Page (store)", type: "page" }];
    for (const f of funnels.data ?? []) {
      for (const s of f.steps) out.push({ value: `${f.id}:${s.key}`, label: `${f.name} — ${s.name}`, type: "funnel_step" });
    }
    return out;
  }, [funnels.data]);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("page");
  const [nameA, setNameA] = useState("A — Control");
  const [nameB, setNameB] = useState("B — Variant");
  const [split, setSplit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the test a name.");
      return;
    }
    const opt = targets.find((t) => t.value === target) ?? targets[0];
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
      toast.success(`"${exp.name}" created. Start it when you're ready.`);
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
        <Label htmlFor="exp-name">Name</Label>
        <Input id="exp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Headline: discount vs free shipping" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-target">Target</Label>
        <Select id="exp-target" value={target} onChange={(e) => setTarget(e.target.value)} disabled={funnels.loading}>
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-a">Variant A</Label>
          <Input id="exp-a" value={nameA} onChange={(e) => setNameA(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-b">Variant B</Label>
          <Input id="exp-b" value={nameB} onChange={(e) => setNameB(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-split">Traffic split</Label>
        <input id="exp-split" type="range" min={10} max={90} step={5} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
        <div className="flex justify-between text-xs tabular-nums text-ink-soft">
          <span>
            A · <span className="font-medium text-ink">{split}%</span>
          </span>
          <span>
            B · <span className="font-medium text-ink">{100 - split}%</span>
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create test"}
        </Button>
      </div>
    </form>
  );
}
