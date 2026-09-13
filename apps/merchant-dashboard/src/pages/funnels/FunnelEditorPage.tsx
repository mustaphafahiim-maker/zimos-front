import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  FlaskConical,
  GripVertical,
  LayoutTemplate,
  PartyPopper,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  ShoppingBag,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Alert, Button, Input, Label, Spinner, cn } from "@store-builder/ui";
import type { Funnel, FunnelEdge, FunnelEdgeCondition, FunnelStatus, FunnelStep, FunnelStepType } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { uid } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

// ------------------------------------------------------------------ meta --

interface StepTypeMeta {
  label: string;
  icon: LucideIcon;
  /** Default display name for a freshly added step. */
  defaultName: string;
  /** Whether an offer product is mandatory. */
  needsOffer: boolean;
}

export const STEP_TYPES: Record<FunnelStepType, StepTypeMeta> = {
  landing: { label: "Landing page", icon: LayoutTemplate, defaultName: "صفحة الهبوط", needsOffer: false },
  checkout: { label: "Checkout", icon: CreditCard, defaultName: "الدفع", needsOffer: false },
  order_bump: { label: "Order bump", icon: ShoppingBag, defaultName: "Order bump", needsOffer: true },
  upsell: { label: "Upsell", icon: ArrowUpRight, defaultName: "عرض بعد الشراء", needsOffer: true },
  downsell: { label: "Downsell", icon: ArrowDownRight, defaultName: "Downsell", needsOffer: true },
  thank_you: { label: "Thank you", icon: PartyPopper, defaultName: "شكراً لطلبك", needsOffer: false },
};

const STEP_TYPE_ORDER: FunnelStepType[] = ["landing", "checkout", "order_bump", "upsell", "downsell", "thank_you"];

const CONDITIONS: Record<FunnelEdgeCondition, string> = {
  always: "Always",
  completed_checkout: "Completed checkout",
  accepted_offer: "Accepted",
  declined_offer: "Declined",
};

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

const CARD_W = 208;
const CARD_H = 104;

function rate(step: FunnelStep): string {
  if (step.views === 0) return "0%";
  return `${((step.conversions / step.views) * 100).toFixed(1)}%`;
}

function StepIcon({ type, className }: { type: FunnelStepType; className?: string }) {
  const Glyph = STEP_TYPES[type].icon;
  return <Glyph className={className} aria-hidden />;
}

// ------------------------------------------------------------ validation --

export function validateFunnel(funnel: Funnel): string[] {
  const problems: string[] = [];
  const keys = new Set(funnel.steps.map((s) => s.key));
  const entries = funnel.steps.filter((s) => s.type === "landing");
  if (entries.length !== 1) {
    problems.push(entries.length === 0 ? "Add exactly one landing page as the entry step." : `Only one landing page is allowed (found ${entries.length}).`);
  }
  const entry = entries[0] ?? null;

  for (const e of funnel.edges) {
    if (!keys.has(e.fromStepKey) || !keys.has(e.toStepKey)) {
      problems.push(`An edge points to a step that no longer exists (${e.fromStepKey} → ${e.toStepKey}).`);
    }
  }

  if (entry) {
    const seen = new Set<string>([entry.key]);
    const queue = [entry.key];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      for (const e of funnel.edges) {
        if (e.fromStepKey === cur && keys.has(e.toStepKey) && !seen.has(e.toStepKey)) {
          seen.add(e.toStepKey);
          queue.push(e.toStepKey);
        }
      }
    }
    for (const s of funnel.steps) {
      if (!seen.has(s.key)) problems.push(`"${s.name}" can't be reached from the landing page.`);
    }
  }

  for (const s of funnel.steps) {
    if (STEP_TYPES[s.type].needsOffer && !s.offerId) {
      problems.push(`"${s.name}" (${STEP_TYPES[s.type].label}) needs an offer product.`);
    }
    if (s.type !== "thank_you" && !funnel.edges.some((e) => e.fromStepKey === s.key)) {
      problems.push(`"${s.name}" has no outgoing edge — visitors would get stuck.`);
    }
  }
  return problems;
}

// ----------------------------------------------------------------- page --

export function FunnelEditorPage() {
  const { funnelId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();

  const loaded = useAsync(() => mockApi.getFunnel(workspaceId, funnelId), [workspaceId, funnelId]);

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [baseline, setBaseline] = useState("");
  const [seededId, setSeededId] = useState<string | null>(null);
  if (loaded.data && loaded.data.id !== seededId) {
    setSeededId(loaded.data.id);
    setFunnel(loaded.data);
    setBaseline(JSON.stringify(loaded.data));
  }

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FunnelStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);

  const dirty = funnel !== null && JSON.stringify(funnel) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = funnel?.steps.find((s) => s.key === selectedKey) ?? null;

  const patch = useCallback((updater: (f: Funnel) => Funnel) => {
    setFunnel((prev) => (prev ? updater(prev) : prev));
  }, []);

  const updateStep = useCallback(
    (key: string, changes: Partial<FunnelStep>) => {
      patch((f) => ({ ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, ...changes } : s)) }));
    },
    [patch]
  );

  function addStep(type: FunnelStepType) {
    patch((f) => {
      const base: string = type;
      let key: string = base;
      let n = 2;
      while (f.steps.some((s) => s.key === key)) key = `${base}-${n++}`;
      const last = f.steps[f.steps.length - 1];
      const step: FunnelStep = {
        id: uid(),
        key,
        name: STEP_TYPES[type].defaultName,
        type,
        offerId: null,
        offerName: null,
        priceAmount: null,
        experimentId: null,
        views: 0,
        conversions: 0,
        x: last ? last.x + 280 : 40,
        y: last ? last.y : 120,
      };
      setSelectedKey(key);
      return { ...f, steps: [...f.steps, step] };
    });
  }

  function deleteStep(step: FunnelStep) {
    patch((f) => ({
      ...f,
      steps: f.steps.filter((s) => s.key !== step.key),
      edges: f.edges.filter((e) => e.fromStepKey !== step.key && e.toStepKey !== step.key),
      entryStepKey: f.entryStepKey === step.key ? null : f.entryStepKey,
    }));
    setSelectedKey((k) => (k === step.key ? null : k));
    setPendingDelete(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onSortEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      patch((f) => {
        const from = f.steps.findIndex((s) => s.key === active.id);
        const to = f.steps.findIndex((s) => s.key === over.id);
        return { ...f, steps: arrayMove(f.steps, from, to) };
      });
    },
    [patch]
  );

  async function save(): Promise<Funnel | null> {
    if (!funnel) return null;
    setSaving(true);
    try {
      const entry = funnel.steps.find((s) => s.type === "landing");
      const next = await mockApi.saveFunnel(workspaceId, { ...funnel, entryStepKey: entry?.key ?? null });
      setFunnel(next);
      setBaseline(JSON.stringify(next));
      loaded.setData(next);
      toast.success("Funnel saved.");
      return next;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!funnel) return;
    const found = validateFunnel(funnel);
    setProblems(found);
    if (found.length > 0) {
      toast.error("Fix the problems below before publishing.");
      return;
    }
    const saved = dirty ? await save() : funnel;
    if (!saved) return;
    await mockApi.setFunnelStatus(workspaceId, saved.id, "published");
    const next: Funnel = { ...saved, status: "published", publishedAt: new Date().toISOString() };
    setFunnel(next);
    setBaseline(JSON.stringify(next));
    toast.success("Funnel published.");
  }

  async function setStatus(status: FunnelStatus) {
    if (!funnel) return;
    await mockApi.setFunnelStatus(workspaceId, funnel.id, status);
    const next: Funnel = { ...funnel, status };
    setFunnel(next);
    setBaseline(JSON.stringify(next));
    toast.success(status === "paused" ? "Funnel paused." : "Funnel resumed.");
  }

  function preview() {
    if (!funnel) return;
    window.open(`https://${funnel.slug}.zimos.test/`, "_blank", "noopener");
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-3">
        <DataState loading={loaded.loading} error={loaded.error} empty={!loaded.loading && !loaded.data} emptyMessage="This funnel doesn't exist." onRetry={() => loaded.refresh()}>
          {funnel && (
            <>
              <Link to="/funnels" className="mb-1 inline-block text-sm text-ink-soft transition-colors hover:text-primary">
                ← Back to funnels
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {editingName ? (
                    <Input
                      autoFocus
                      value={funnel.name}
                      onChange={(e) => patch((f) => ({ ...f, name: e.target.value }))}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                      }}
                      className="h-9 w-80 max-w-full font-display text-lg"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      title="Click to rename"
                      className="cursor-pointer truncate rounded px-1 font-display text-xl font-medium text-ink hover:bg-paper"
                    >
                      {funnel.name}
                    </button>
                  )}
                  <StatusBadge value={funnel.status} tone={STATUS_TONE[funnel.status]} />
                  {dirty && <span className="text-xs text-ink-soft">Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={preview}>
                    <ExternalLink className="size-4" aria-hidden /> Preview
                  </Button>
                  <Button onClick={() => void save()} disabled={!dirty || saving}>
                    {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  {funnel.status === "published" ? (
                    <Button variant="outline" onClick={() => void setStatus("paused")}>
                      <Pause className="size-4" aria-hidden /> Pause
                    </Button>
                  ) : funnel.status === "paused" ? (
                    <Button variant="outline" onClick={() => void setStatus("published")}>
                      <Play className="size-4" aria-hidden /> Resume
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void publish()} disabled={saving}>
                      <Rocket className="size-4" aria-hidden /> Publish
                    </Button>
                  )}
                </div>
              </div>
              {problems.length > 0 && (
                <Alert variant="danger" className="mt-3">
                  <p className="font-medium">This funnel can&rsquo;t be published yet:</p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5">
                    {problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </DataState>
      </div>

      {funnel && (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-paper-raised">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">Steps</span>
              <AddStepMenu onAdd={addStep} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onSortEnd}>
                <SortableContext items={funnel.steps.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1">
                    {funnel.steps.map((s) => (
                      <SortableStepRow key={s.key} step={s} selected={s.key === selectedKey} onSelect={() => setSelectedKey(s.key)} onDelete={() => setPendingDelete(s)} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          </aside>

          <FlowCanvas funnel={funnel} selectedKey={selectedKey} onSelect={setSelectedKey} onMove={(key, x, y) => updateStep(key, { x, y })} />

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-paper-raised">
            {selected ? (
              <StepInspector
                key={selected.key}
                funnel={funnel}
                step={selected}
                onChange={(changes) => updateStep(selected.key, changes)}
                onEdgesChange={(edges) => patch((f) => ({ ...f, edges }))}
                onDelete={() => setPendingDelete(selected)}
                onClose={() => setSelectedKey(null)}
              />
            ) : (
              <p className="px-4 py-6 text-sm text-ink-soft">Select a step on the canvas or in the list to edit it.</p>
            )}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this step?"
        description={pendingDelete ? `"${pendingDelete.name}" and every edge connected to it will be removed. Nothing is deleted until you save.` : undefined}
        confirmLabel="Delete step"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteStep(pendingDelete)}
      />

      {loaded.error === null && !loaded.loading && !loaded.data && (
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/funnels")}>
            Back to funnels
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- left pane --

function AddStepMenu({ onAdd }: { onAdd: (type: FunnelStepType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-3" aria-hidden /> Add step
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised py-1 shadow-lg">
            {STEP_TYPE_ORDER.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(t);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-paper"
                >
                  <StepIcon type={t} className="size-4 text-primary" />
                  {STEP_TYPES[t].label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SortableStepRow({ step, selected, onSelect, onDelete }: { step: FunnelStep; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-[0.5rem] border bg-paper-raised pr-1 transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-line hover:border-primary/50",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${step.name}`}
        className="cursor-grab rounded p-1.5 text-ink-soft hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-left">
        <StepIcon type={step.type} className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{step.name}</span>
          <span className="block text-[11px] text-ink-soft">{STEP_TYPES[step.type].label}</span>
        </span>
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${step.name}`} className="cursor-pointer rounded p-1.5 text-ink-soft hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- canvas --

function FlowCanvas({
  funnel,
  selectedKey,
  onSelect,
  onMove,
}: {
  funnel: Funnel;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
}) {
  const drag = useRef<{ key: string; dx: number; dy: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const byKey = useMemo(() => new Map(funnel.steps.map((s) => [s.key, s])), [funnel.steps]);
  const width = Math.max(900, ...funnel.steps.map((s) => s.x + CARD_W + 80));
  const height = Math.max(520, ...funnel.steps.map((s) => s.y + CARD_H + 80));

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, step: FunnelStep) {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const px = e.clientX - (rect?.left ?? 0) + scrollLeft;
    const py = e.clientY - (rect?.top ?? 0) + scrollTop;
    drag.current = { key: step.key, dx: px - step.x, dy: py - step.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(step.key);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const px = e.clientX - (rect?.left ?? 0) + scrollLeft;
    const py = e.clientY - (rect?.top ?? 0) + scrollTop;
    d.moved = true;
    onMove(d.key, Math.max(0, Math.round(px - d.dx)), Math.max(0, Math.round(py - d.dy)));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  return (
    <main ref={containerRef} className="relative min-w-0 flex-1 overflow-auto bg-paper" style={{ backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
      <div className="relative" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          <defs>
            <marker id="funnel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" />
            </marker>
          </defs>
          {funnel.edges.map((e) => {
            const from = byKey.get(e.fromStepKey);
            const to = byKey.get(e.toStepKey);
            if (!from || !to) return null;
            const x1 = from.x + CARD_W;
            const y1 = from.y + CARD_H / 2;
            const x2 = to.x;
            const y2 = to.y + CARD_H / 2;
            const bend = Math.max(40, Math.abs(x2 - x1) / 2);
            const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const active = e.fromStepKey === selectedKey || e.toStepKey === selectedKey;
            const label = CONDITIONS[e.condition];
            const lw = label.length * 6.2 + 14;
            return (
              <g key={e.id}>
                <path d={d} fill="none" stroke={active ? "var(--color-primary)" : "var(--color-ink-soft)"} strokeOpacity={active ? 1 : 0.5} strokeWidth={active ? 2 : 1.5} markerEnd="url(#funnel-arrow)" />
                <rect x={mx - lw / 2} y={my - 10} width={lw} height={20} rx={10} fill="var(--color-paper-raised)" stroke="var(--color-line)" />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        {funnel.steps.map((s) => {
          const isSelected = s.key === selectedKey;
          const isEntry = s.type === "landing";
          return (
            <div
              key={s.key}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => onPointerDown(e, s)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(s.key);
              }}
              style={{ left: s.x, top: s.y, width: CARD_W, height: CARD_H }}
              className={cn(
                "absolute cursor-grab select-none rounded-[var(--radius-card)] border bg-paper-raised p-3 shadow-sm transition-shadow active:cursor-grabbing",
                isSelected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-line hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", isSelected ? "bg-primary text-white" : "bg-primary-soft text-primary-dark")}>
                  <StepIcon type={s.type} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                  <span className="block text-[11px] text-ink-soft">
                    {STEP_TYPES[s.type].label}
                    {isEntry && " · entry"}
                  </span>
                </span>
                {s.experimentId && <FlaskConical className="ml-auto size-3.5 shrink-0 text-accent-dark" aria-label="A/B test running" />}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                <span className="text-ink-soft">
                  {s.views.toLocaleString()} → {s.conversions.toLocaleString()}
                </span>
                <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">{rate(s)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

// ------------------------------------------------------------- inspector --

function StepInspector({
  funnel,
  step,
  onChange,
  onEdgesChange,
  onDelete,
  onClose,
}: {
  funnel: Funnel;
  step: FunnelStep;
  onChange: (changes: Partial<FunnelStep>) => void;
  onEdgesChange: (edges: FunnelEdge[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const products = useAsync(() => mockApi.demoProducts(), []);
  const [price, setPrice] = useState(minorToMajorInput(step.priceAmount));
  const needsOffer = STEP_TYPES[step.type].needsOffer;
  const outgoing = funnel.edges.filter((e) => e.fromStepKey === step.key).sort((a, b) => a.priority - b.priority);
  const others = funnel.steps.filter((s) => s.key !== step.key);

  function commitPrice(value: string) {
    setPrice(value);
    const minor = majorToMinor(value);
    onChange({ priceAmount: Number.isFinite(minor) && minor >= 0 ? String(minor) : null });
  }

  function pickOffer(productId: string) {
    const p = (products.data ?? []).find((x) => x.id === productId);
    if (!p) {
      onChange({ offerId: null, offerName: null });
      return;
    }
    onChange({ offerId: p.id, offerName: p.name, priceAmount: step.priceAmount ?? String(p.price) });
    if (!step.priceAmount) setPrice(minorToMajorInput(p.price));
  }

  function updateEdge(id: string, changes: Partial<FunnelEdge>) {
    onEdgesChange(funnel.edges.map((e) => (e.id === id ? { ...e, ...changes } : e)));
  }

  function addEdge() {
    const target = others[0];
    if (!target) return;
    onEdgesChange([...funnel.edges, { id: uid(), fromStepKey: step.key, toStepKey: target.key, condition: "always", priority: outgoing.length + 1 }]);
  }

  function removeEdge(id: string) {
    onEdgesChange(funnel.edges.filter((e) => e.id !== id));
  }

  const abEnabled = step.experimentId !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <StepIcon type={step.type} className="size-4 text-primary" />
          <span className="text-sm font-medium text-ink">Step settings</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector" className="cursor-pointer rounded p-1 text-ink-soft hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="step-name">Name</Label>
          <Input id="step-name" value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-type">Type</Label>
          <Select id="step-type" value={step.type} onChange={(e) => onChange({ type: e.target.value as FunnelStepType })}>
            {STEP_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {STEP_TYPES[t].label}
              </option>
            ))}
          </Select>
        </div>

        {needsOffer && (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-paper p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Offer</p>
            <div className="space-y-1.5">
              <Label htmlFor="step-offer">Product</Label>
              {products.loading ? (
                <Spinner className="size-4" />
              ) : (
                <Select id="step-offer" value={step.offerId ?? ""} onChange={(e) => pickOffer(e.target.value)}>
                  <option value="">— Pick a product —</option>
                  {(products.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
              {!step.offerId && <p className="text-xs text-danger">Required before publishing.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-price">Offer price</Label>
              <div className="relative">
                <Input id="step-price" type="number" min={0} step="0.01" value={price} onChange={(e) => commitPrice(e.target.value)} className="pr-12" />
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-ink-soft">{funnel.currency}</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[var(--radius-card)] border border-line bg-paper p-3">
          <Toggle
            label="A/B test this step"
            description={abEnabled ? "Traffic is split between variants." : "Compare two versions of this step."}
            checked={abEnabled}
            onChange={(next) => onChange({ experimentId: next ? `exp-${step.key}-${uid().slice(0, 6)}` : null })}
          />
          {abEnabled && (
            <Link to="/experiments" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <FlaskConical className="size-3.5" aria-hidden /> Manage in Experiments
            </Link>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Edges</p>
            <Button size="xs" variant="outline" onClick={addEdge} disabled={others.length === 0}>
              <Plus className="size-3" aria-hidden /> Add
            </Button>
          </div>
          {outgoing.length === 0 ? (
            <p className="text-xs text-ink-soft">{step.type === "thank_you" ? "The thank-you page ends the funnel." : "No outgoing edges yet."}</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((e) => (
                <li key={e.id} className="space-y-2 rounded-[0.5rem] border border-line bg-paper p-2">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Select value={e.toStepKey} onChange={(ev) => updateEdge(e.id, { toStepKey: ev.target.value })} className="h-8 text-xs" aria-label="To step">
                      {others.map((s) => (
                        <option key={s.key} value={s.key}>
                          → {s.name}
                        </option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => removeEdge(e.id)} aria-label="Remove edge" className="cursor-pointer rounded p-1 text-ink-soft hover:bg-danger-soft hover:text-danger">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_64px] gap-2">
                    <Select value={e.condition} onChange={(ev) => updateEdge(e.id, { condition: ev.target.value as FunnelEdgeCondition })} className="h-8 text-xs" aria-label="Condition">
                      {(Object.keys(CONDITIONS) as FunnelEdgeCondition[]).map((c) => (
                        <option key={c} value={c}>
                          {CONDITIONS[c]}
                        </option>
                      ))}
                    </Select>
                    <Input type="number" min={1} value={e.priority} onChange={(ev) => updateEdge(e.id, { priority: Math.max(1, Math.floor(Number(ev.target.value)) || 1) })} className="h-8 text-xs" aria-label="Priority" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden /> Delete step
          </Button>
        </div>
      </div>
    </div>
  );
}
