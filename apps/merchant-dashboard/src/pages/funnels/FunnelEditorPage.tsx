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
import { fmt, useCommon, useLocale, useT, type Locale } from "@/i18n/LocaleContext";
import {
  CANVAS_STRINGS,
  CONDITION_LABELS,
  EDITOR_STRINGS,
  INSPECTOR_STRINGS,
  LIST_STRINGS,
  STATUS_LABELS,
  STEP_DEFAULT_NAMES,
  STEP_TYPE_LABELS,
  VALIDATION_STRINGS,
} from "./FunnelEditorPage.strings";

// ------------------------------------------------------------------ meta --

interface StepTypeMeta {
  icon: LucideIcon;
  /** Whether an offer product is mandatory. */
  needsOffer: boolean;
}

export const STEP_TYPES: Record<FunnelStepType, StepTypeMeta> = {
  landing: { icon: LayoutTemplate, needsOffer: false },
  checkout: { icon: CreditCard, needsOffer: false },
  order_bump: { icon: ShoppingBag, needsOffer: true },
  upsell: { icon: ArrowUpRight, needsOffer: true },
  downsell: { icon: ArrowDownRight, needsOffer: true },
  thank_you: { icon: PartyPopper, needsOffer: false },
};

const STEP_TYPE_ORDER: FunnelStepType[] = ["landing", "checkout", "order_bump", "upsell", "downsell", "thank_you"];

const CONDITION_ORDER: FunnelEdgeCondition[] = ["always", "completed_checkout", "accepted_offer", "declined_offer"];

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

const CARD_W = 208;
const CARD_H = 104;

function rate(step: FunnelStep, intlLocale: string): string {
  const value = step.views === 0 ? 0 : step.conversions / step.views;
  return new Intl.NumberFormat(intlLocale, {
    style: "percent",
    minimumFractionDigits: step.views === 0 ? 0 : 1,
    maximumFractionDigits: step.views === 0 ? 0 : 1,
  }).format(value);
}

function StepIcon({ type, className }: { type: FunnelStepType; className?: string }) {
  const Glyph = STEP_TYPES[type].icon;
  return <Glyph className={className} aria-hidden />;
}

// ------------------------------------------------------------ validation --

export function validateFunnel(funnel: Funnel, locale: Locale = "en"): string[] {
  const v = VALIDATION_STRINGS[locale];
  const typeLabels = STEP_TYPE_LABELS[locale];
  const problems: string[] = [];
  const keys = new Set(funnel.steps.map((s) => s.key));
  const entries = funnel.steps.filter((s) => s.type === "landing");
  if (entries.length !== 1) {
    problems.push(entries.length === 0 ? v.noLanding : fmt(v.manyLanding, { n: entries.length }));
  }
  const entry = entries[0] ?? null;

  for (const e of funnel.edges) {
    if (!keys.has(e.fromStepKey) || !keys.has(e.toStepKey)) {
      problems.push(fmt(v.danglingEdge, { from: e.fromStepKey, to: e.toStepKey }));
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
      if (!seen.has(s.key)) problems.push(fmt(v.unreachable, { name: s.name }));
    }
  }

  for (const s of funnel.steps) {
    if (STEP_TYPES[s.type].needsOffer && !s.offerId) {
      problems.push(fmt(v.needsOffer, { name: s.name, type: typeLabels[s.type] }));
    }
    if (s.type !== "thank_you" && !funnel.edges.some((e) => e.fromStepKey === s.key)) {
      problems.push(fmt(v.noOutgoing, { name: s.name }));
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
  const t = useT(EDITOR_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();

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
        name: STEP_DEFAULT_NAMES[locale][type],
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
      toast.success(t.toastSaved);
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
    const found = validateFunnel(funnel, locale);
    setProblems(found);
    if (found.length > 0) {
      toast.error(t.toastFixProblems);
      return;
    }
    const saved = dirty ? await save() : funnel;
    if (!saved) return;
    await mockApi.setFunnelStatus(workspaceId, saved.id, "published");
    const next: Funnel = { ...saved, status: "published", publishedAt: new Date().toISOString() };
    setFunnel(next);
    setBaseline(JSON.stringify(next));
    toast.success(t.toastPublished);
  }

  async function setStatus(status: FunnelStatus) {
    if (!funnel) return;
    await mockApi.setFunnelStatus(workspaceId, funnel.id, status);
    const next: Funnel = { ...funnel, status };
    setFunnel(next);
    setBaseline(JSON.stringify(next));
    toast.success(status === "paused" ? t.toastPaused : t.toastResumed);
  }

  function preview() {
    if (!funnel) return;
    window.open(`https://${funnel.slug}.zimos.test/`, "_blank", "noopener");
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-3">
        <DataState loading={loaded.loading} error={loaded.error} empty={!loaded.loading && !loaded.data} emptyMessage={t.notFound} onRetry={() => loaded.refresh()}>
          {funnel && (
            <>
              <Link to="/funnels" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-primary">
                <span aria-hidden className="inline-block rtl:rotate-180">
                  ←
                </span>
                {t.backToFunnels}
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {editingName ? (
                    <Input
                      autoFocus
                      dir="auto"
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
                      title={t.clickToRename}
                      dir="auto"
                      className="cursor-pointer truncate rounded px-1 font-display text-xl font-semibold text-ink hover:bg-paper"
                    >
                      {funnel.name}
                    </button>
                  )}
                  <StatusBadge value={STATUS_LABELS[locale][funnel.status]} tone={STATUS_TONE[funnel.status]} />
                  {dirty && <span className="text-xs text-ink-soft">{t.unsavedChanges}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={preview}>
                    <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden /> {t.preview}
                  </Button>
                  <Button onClick={() => void save()} disabled={!dirty || saving}>
                    {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                    {saving ? c.saving : c.save}
                  </Button>
                  {funnel.status === "published" ? (
                    <Button variant="outline" onClick={() => void setStatus("paused")}>
                      <Pause className="size-4" aria-hidden /> {t.pause}
                    </Button>
                  ) : funnel.status === "paused" ? (
                    <Button variant="outline" onClick={() => void setStatus("published")}>
                      <Play className="size-4" aria-hidden /> {t.resume}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void publish()} disabled={saving}>
                      <Rocket className="size-4" aria-hidden /> {t.publish}
                    </Button>
                  )}
                </div>
              </div>
              {problems.length > 0 && (
                <Alert variant="danger" className="mt-3">
                  <p className="font-medium">{t.cantPublish}</p>
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
          <aside className="flex w-64 shrink-0 flex-col border-e border-line bg-paper-raised">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.steps}</span>
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

          <aside className="w-80 shrink-0 overflow-y-auto border-s border-line bg-paper-raised">
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
              <p className="px-4 py-6 text-sm text-ink-soft">{t.selectHint}</p>
            )}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteStepTitle}
        description={pendingDelete ? fmt(t.deleteStepDescription, { name: pendingDelete.name }) : undefined}
        confirmLabel={t.deleteStep}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteStep(pendingDelete)}
      />

      {loaded.error === null && !loaded.loading && !loaded.data && (
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/funnels")}>
            {t.backToFunnels}
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- left pane --

function AddStepMenu({ onAdd }: { onAdd: (type: FunnelStepType) => void }) {
  const [open, setOpen] = useState(false);
  const t = useT(LIST_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  return (
    <div className="relative">
      <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-3" aria-hidden /> {t.addStep}
      </Button>
      {open && (
        <>
          <button type="button" aria-label={c.close} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <ul className="absolute end-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-line bg-paper-raised py-1 shadow-lg">
            {STEP_TYPE_ORDER.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(type);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-sm text-ink hover:bg-zimos-ice"
                >
                  <StepIcon type={type} className="size-4 text-primary" />
                  {STEP_TYPE_LABELS[locale][type]}
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
  const t = useT(LIST_STRINGS);
  const { locale } = useLocale();
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-xl border bg-paper-raised pe-1 transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-line hover:border-primary/50",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={fmt(t.reorder, { name: step.name })}
        className="cursor-grab rounded p-1.5 text-ink-soft hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-start">
        <StepIcon type={step.type} className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink" dir="auto">
            {step.name}
          </span>
          <span className="block text-[11px] text-ink-soft">{STEP_TYPE_LABELS[locale][step.type]}</span>
        </span>
      </button>
      <button type="button" onClick={onDelete} aria-label={fmt(t.deleteNamed, { name: step.name })} className="cursor-pointer rounded p-1.5 text-ink-soft hover:bg-danger-soft hover:text-danger">
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
  const t = useT(CANVAS_STRINGS);
  const { locale, dir, intlLocale } = useLocale();
  const numberFmt = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale]);

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
    <main ref={containerRef} dir="ltr" aria-label={EDITOR_STRINGS[locale].canvasLabel} className="relative min-w-0 flex-1 overflow-auto bg-paper" style={{ backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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
            const label = CONDITION_LABELS[locale][e.condition];
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
                "absolute cursor-grab select-none rounded-2xl border bg-paper-raised p-3 shadow-sm transition-shadow active:cursor-grabbing",
                isSelected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-line hover:border-primary/50"
              )}
            >
              <div dir={dir} className="flex items-center gap-2">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", isSelected ? "bg-primary text-white" : "bg-primary-soft text-primary-dark")}>
                  <StepIcon type={s.type} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink" dir="auto">
                    {s.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    {STEP_TYPE_LABELS[locale][s.type]}
                    {isEntry && ` · ${t.entry}`}
                  </span>
                </span>
                {s.experimentId && <FlaskConical className="ms-auto size-3.5 shrink-0 text-accent-dark" aria-label={t.abRunning} />}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                <span className="text-ink-soft">
                  {numberFmt.format(s.views)} → {numberFmt.format(s.conversions)}
                </span>
                <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">{rate(s, intlLocale)}</span>
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
  const t = useT(INSPECTOR_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
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
          <span className="text-sm font-semibold text-ink">{t.stepSettings}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={t.closeInspector} title={c.close} className="cursor-pointer rounded p-1 text-ink-soft hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="step-name">{t.name}</Label>
          <Input id="step-name" dir="auto" value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-type">{t.type}</Label>
          <Select id="step-type" value={step.type} onChange={(e) => onChange({ type: e.target.value as FunnelStepType })}>
            {STEP_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {STEP_TYPE_LABELS[locale][type]}
              </option>
            ))}
          </Select>
        </div>

        {needsOffer && (
          <div className="space-y-3 rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.offer}</p>
            <div className="space-y-1.5">
              <Label htmlFor="step-offer">{t.product}</Label>
              {products.loading ? (
                <Spinner className="size-4" />
              ) : (
                <Select id="step-offer" value={step.offerId ?? ""} onChange={(e) => pickOffer(e.target.value)}>
                  <option value="">{t.pickProduct}</option>
                  {(products.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
              {!step.offerId && <p className="text-xs text-danger">{t.required}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-price">{t.offerPrice}</Label>
              <div className="relative">
                <Input id="step-price" type="number" dir="ltr" min={0} step="0.01" value={price} onChange={(e) => commitPrice(e.target.value)} className="pe-12 text-start" />
                <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-xs text-ink-soft" dir="ltr">
                  {funnel.currency}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-paper p-3">
          <Toggle
            label={t.abTest}
            description={abEnabled ? t.abOn : t.abOff}
            checked={abEnabled}
            onChange={(next) => onChange({ experimentId: next ? `exp-${step.key}-${uid().slice(0, 6)}` : null })}
          />
          {abEnabled && (
            <Link to="/experiments" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <FlaskConical className="size-3.5" aria-hidden /> {t.manageExperiments}
            </Link>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.edges}</p>
            <Button size="xs" variant="outline" onClick={addEdge} disabled={others.length === 0}>
              <Plus className="size-3" aria-hidden /> {c.add}
            </Button>
          </div>
          {outgoing.length === 0 ? (
            <p className="text-xs text-ink-soft">{step.type === "thank_you" ? t.thankYouEnds : t.noEdges}</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((e) => (
                <li key={e.id} className="space-y-2 rounded-xl border border-line bg-paper p-2">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Select value={e.toStepKey} onChange={(ev) => updateEdge(e.id, { toStepKey: ev.target.value })} className="h-8 text-xs" aria-label={t.toStep}>
                      {others.map((s) => (
                        <option key={s.key} value={s.key}>
                          {fmt(t.toStepOption, { name: s.name })}
                        </option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => removeEdge(e.id)} aria-label={t.removeEdge} className="cursor-pointer rounded p-1 text-ink-soft hover:bg-danger-soft hover:text-danger">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_64px] gap-2">
                    <Select value={e.condition} onChange={(ev) => updateEdge(e.id, { condition: ev.target.value as FunnelEdgeCondition })} className="h-8 text-xs" aria-label={t.condition}>
                      {CONDITION_ORDER.map((cond) => (
                        <option key={cond} value={cond}>
                          {CONDITION_LABELS[locale][cond]}
                        </option>
                      ))}
                    </Select>
                    <Input type="number" dir="ltr" min={1} value={e.priority} onChange={(ev) => updateEdge(e.id, { priority: Math.max(1, Math.floor(Number(ev.target.value)) || 1) })} className="h-8 text-xs" aria-label={t.priority} title={t.priority} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden /> {EDITOR_STRINGS[locale].deleteStep}
          </Button>
        </div>
      </div>
    </div>
  );
}
