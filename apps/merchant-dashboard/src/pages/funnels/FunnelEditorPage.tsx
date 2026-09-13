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
  FilePlus2,
  FlaskConical,
  GripVertical,
  History,
  LayoutTemplate,
  Megaphone,
  PartyPopper,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Alert, Button, Input, Label, Spinner, cn } from "@store-builder/ui";
import {
  FUNNEL_OFFER_STEP_TYPES,
  funnelsListRevisions,
  funnelsPause,
  funnelsProblemsOf,
  funnelsPublish,
  funnelsResume,
  funnelsRollback,
  type FunnelRevisionDto,
  type FunnelStatus,
  type Offer,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale } from "@/i18n/LocaleContext";
import {
  CARD_GAP_X,
  funnelPublicUrl,
  loadUiFunnel,
  saveFunnelDiff,
  tempId,
  uniqueStepKey,
  useFunnelErrorMessage,
  type SaveProgress,
  type UiEdge,
  type UiEdgeCondition,
  type UiFunnel,
  type UiStep,
  type UiStepType,
} from "./funnelAdapter";
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
  /** Whether an offer is mandatory (backend OFFER_STEP_TYPES). */
  needsOffer: boolean;
}

export const STEP_TYPES: Record<UiStepType, StepTypeMeta> = {
  landing: { icon: LayoutTemplate, needsOffer: false },
  sales: { icon: Megaphone, needsOffer: false },
  opt_in: { icon: UserPlus, needsOffer: false },
  checkout: { icon: CreditCard, needsOffer: false },
  upsell: { icon: ArrowUpRight, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("upsell") },
  downsell: { icon: ArrowDownRight, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("downsell") },
  thank_you: { icon: PartyPopper, needsOffer: false },
  custom: { icon: FilePlus2, needsOffer: false },
};

const STEP_TYPE_ORDER: UiStepType[] = ["landing", "sales", "opt_in", "checkout", "upsell", "downsell", "thank_you", "custom"];

const CONDITION_ORDER: UiEdgeCondition[] = ["always", "completed_checkout", "accepted_offer", "declined_offer"];

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

const CARD_W = 208;
const CARD_H = 104;

function StepIcon({ type, className }: { type: UiStepType; className?: string }) {
  const Glyph = STEP_TYPES[type].icon;
  return <Glyph className={className} aria-hidden />;
}

/** Entry = the only step with no incoming edge (backend resolveEntry). */
function entryKeysOf(funnel: UiFunnel): string[] {
  const targeted = new Set(funnel.edges.map((e) => e.toStepKey));
  return funnel.steps.filter((s) => !targeted.has(s.key)).map((s) => s.key);
}

// ------------------------------------------------------------ validation --

/** Pre-check mirroring backend funnelGraph.validateGraph. Server problems are authoritative on publish. */
export function validateFunnel(funnel: UiFunnel, locale: Locale = "en"): string[] {
  const v = VALIDATION_STRINGS[locale];
  const typeLabels = STEP_TYPE_LABELS[locale];
  const problems: string[] = [];
  const keys = new Set(funnel.steps.map((s) => s.key));
  const nameOf = (key: string) => funnel.steps.find((s) => s.key === key)?.name ?? key;

  for (const s of funnel.steps) {
    if (STEP_TYPES[s.type].needsOffer && !s.offerId) {
      problems.push(fmt(v.needsOffer, { name: s.name, type: typeLabels[s.type] }));
    }
  }
  for (const e of funnel.edges) {
    if (!keys.has(e.fromStepKey) || !keys.has(e.toStepKey)) {
      problems.push(fmt(v.danglingEdge, { from: e.fromStepKey, to: e.toStepKey }));
    }
  }

  if (funnel.steps.length === 0) {
    problems.push(v.noSteps);
    return problems;
  }
  const entries = entryKeysOf(funnel);
  if (entries.length === 0) {
    problems.push(v.noEntry);
    return problems;
  }
  if (entries.length > 1) {
    problems.push(fmt(v.manyEntries, { n: entries.length, names: entries.map(nameOf).join(", ") }));
    return problems;
  }

  const seen = new Set<string>([entries[0]]);
  const queue = [entries[0]];
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
  return problems;
}

// ---------------------------------------------------------- offer catalog --

interface CatalogEntry {
  product: Product;
  /** Active offers only — the backend rejects inactive ones. */
  offers: Offer[];
}

async function loadOfferCatalog(workspaceId: string): Promise<CatalogEntry[]> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await apiClient.listProducts(workspaceId, { limit: 100, cursor });
    products.push(...res.products);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  const out: CatalogEntry[] = [];
  for (const product of products) {
    const offers = product.offers ?? (await apiClient.listOffers(workspaceId, product.id));
    out.push({ product, offers: offers.filter((o) => o.status === "active") });
  }
  return out;
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
  const describeError = useFunnelErrorMessage();

  const loaded = useAsync(() => loadUiFunnel(workspaceId, funnelId), [workspaceId, funnelId]);
  const catalog = useAsync(() => loadOfferCatalog(workspaceId), [workspaceId]);

  const [funnel, setFunnel] = useState<UiFunnel | null>(null);
  const [baseline, setBaseline] = useState<UiFunnel | null>(null);
  const [seeded, setSeeded] = useState<UiFunnel | null>(null);
  if (loaded.data && loaded.data !== seeded) {
    setSeeded(loaded.data);
    setFunnel(loaded.data);
    setBaseline(loaded.data);
  }

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UiStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const baselineJson = useMemo(() => (baseline ? JSON.stringify(baseline) : ""), [baseline]);
  const dirty = funnel !== null && JSON.stringify(funnel) !== baselineJson;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = funnel?.steps.find((s) => s.key === selectedKey) ?? null;
  const entryKeys = useMemo(() => (funnel ? entryKeysOf(funnel) : []), [funnel]);
  const publicUrl = funnel ? funnelPublicUrl(funnel.subdomain) : null;

  const patch = useCallback((updater: (f: UiFunnel) => UiFunnel) => {
    setFunnel((prev) => (prev ? updater(prev) : prev));
  }, []);

  const updateStep = useCallback(
    (key: string, changes: Partial<UiStep>) => {
      patch((f) => ({ ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, ...changes } : s)) }));
    },
    [patch]
  );

  /** Replace draft + baseline with fresh server state. */
  const adopt = useCallback(
    (fresh: UiFunnel) => {
      setSeeded(fresh);
      setFunnel(fresh);
      setBaseline(fresh);
      loaded.setData(fresh);
    },
    [loaded]
  );

  function addStep(type: UiStepType) {
    patch((f) => {
      // Keys are immutable server-side and deletes run last on save, so avoid
      // reusing a key that still exists in the saved state too.
      const key = uniqueStepKey(type.replace(/_/g, "-"), [...f.steps.map((s) => s.key), ...(baseline?.steps.map((s) => s.key) ?? [])]);
      const last = f.steps[f.steps.length - 1];
      const step: UiStep = {
        id: null,
        key,
        name: STEP_DEFAULT_NAMES[locale][type],
        type,
        offerId: null,
        experimentId: null,
        seo: {},
        x: last ? last.x + CARD_GAP_X : 40,
        y: last ? last.y : 120,
      };
      setSelectedKey(key);
      return { ...f, steps: [...f.steps, step] };
    });
  }

  function deleteStep(step: UiStep) {
    patch((f) => ({
      ...f,
      steps: f.steps.filter((s) => s.key !== step.key),
      edges: f.edges.filter((e) => e.fromStepKey !== step.key && e.toStepKey !== step.key),
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

  async function reloadFromServer(): Promise<UiFunnel | null> {
    const fresh = await loadUiFunnel(workspaceId, funnelId);
    if (fresh) adopt(fresh);
    return fresh;
  }

  async function save(): Promise<UiFunnel | null> {
    if (!funnel || !baseline) return null;
    if (!dirty) return funnel;
    setSaving(true);
    setSaveError(null);
    try {
      await saveFunnelDiff(workspaceId, baseline, funnel, setProgress);
    } catch (err) {
      const message = describeError(err);
      setSaveError(fmt(t.saveFailed, { message }));
      toast.error(message);
      setSaving(false);
      setProgress(null);
      return null;
    }
    try {
      const fresh = await reloadFromServer();
      toast.success(t.toastSaved);
      return fresh;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setSaving(false);
      setProgress(null);
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
    const saved = await save();
    if (!saved) return;
    setStatusBusy(true);
    try {
      await funnelsPublish(apiClient, workspaceId, saved.id);
      await reloadFromServer();
      setHistoryVersion((n) => n + 1);
      toast.success(t.toastPublished);
    } catch (err) {
      const serverProblems = funnelsProblemsOf(err);
      if (serverProblems.length > 0) {
        setProblems(serverProblems.map((p) => p.message));
        toast.error(t.toastFixProblems);
      } else {
        toast.error(describeError(err));
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function setStatus(status: "paused" | "published") {
    if (!funnel) return;
    setStatusBusy(true);
    try {
      const next = status === "paused" ? await funnelsPause(apiClient, workspaceId, funnel.id) : await funnelsResume(apiClient, workspaceId, funnel.id);
      setFunnel((f) => (f ? { ...f, status: next.status } : f));
      setBaseline((b) => (b ? { ...b, status: next.status } : b));
      toast.success(status === "paused" ? t.toastPaused : t.toastResumed);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setStatusBusy(false);
    }
  }

  function preview() {
    if (publicUrl) window.open(publicUrl, "_blank", "noopener");
  }

  const busy = saving || statusBusy;

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col md:-m-6 lg:-m-8">
      <div className="border-b border-line bg-paper-raised px-4 py-3 md:px-6">
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
                      maxLength={200}
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
                  {funnel.publishedRevisionNumber !== null && (
                    <span className="text-xs text-ink-soft">{fmt(t.publishedRevision, { n: funnel.publishedRevisionNumber })}</span>
                  )}
                  {dirty && <span className="text-xs text-ink-soft">{t.unsavedChanges}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <HistoryMenu
                    workspaceId={workspaceId}
                    funnel={funnel}
                    version={historyVersion}
                    onRolledBack={() => {
                      void reloadFromServer().catch((err) => toast.error(describeError(err)));
                    }}
                  />
                  {publicUrl && (
                    <Button variant="outline" onClick={preview}>
                      <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden /> {t.preview}
                    </Button>
                  )}
                  <Button onClick={() => void save()} disabled={!dirty || busy}>
                    {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                    {saving ? (progress && progress.total > 0 ? fmt(t.savingProgress, { done: progress.done, total: progress.total }) : c.saving) : c.save}
                  </Button>
                  {funnel.status === "published" ? (
                    <Button variant="outline" onClick={() => void setStatus("paused")} disabled={busy}>
                      <Pause className="size-4" aria-hidden /> {t.pause}
                    </Button>
                  ) : funnel.status === "paused" ? (
                    <Button variant="outline" onClick={() => void setStatus("published")} disabled={busy}>
                      <Play className="size-4" aria-hidden /> {t.resume}
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => void publish()} disabled={busy}>
                    {statusBusy ? <Spinner className="size-4" /> : <Rocket className="size-4" aria-hidden />}
                    {funnel.status === "draft" ? t.publish : t.republish}
                  </Button>
                </div>
              </div>
              {saveError && (
                <Alert variant="danger" className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span>{saveError}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSaveError(null);
                      void reloadFromServer().catch((err) => toast.error(describeError(err)));
                    }}
                  >
                    {t.reload}
                  </Button>
                </Alert>
              )}
              {problems.length > 0 && (
                <Alert variant="danger" className="mt-3">
                  <p className="font-medium">{t.cantPublish}</p>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5">
                    {problems.map((p, i) => (
                      <li key={i} dir="auto">
                        {p}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </DataState>
      </div>

      {funnel && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <aside className="flex max-h-60 w-full shrink-0 flex-col border-b border-line bg-paper-raised lg:max-h-none lg:w-64 lg:border-b-0 lg:border-e">
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

          <FlowCanvas funnel={funnel} entryKey={entryKeys.length === 1 ? entryKeys[0] : null} selectedKey={selectedKey} onSelect={setSelectedKey} onMove={(key, x, y) => updateStep(key, { x, y })} />

          <aside className="w-full shrink-0 border-t border-line bg-paper-raised lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-s">
            {selected ? (
              <StepInspector
                key={selected.key}
                funnel={funnel}
                step={selected}
                catalog={catalog.data}
                catalogLoading={catalog.loading}
                catalogError={catalog.error}
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

// --------------------------------------------------------------- history --

function HistoryMenu({ workspaceId, funnel, version, onRolledBack }: { workspaceId: string; funnel: UiFunnel; version: number; onRolledBack: () => void }) {
  const t = useT(EDITOR_STRINGS);
  const c = useCommon();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<FunnelRevisionDto | null>(null);
  const revisions = useAsync<FunnelRevisionDto[] | null>(
    () => (open ? funnelsListRevisions(apiClient, workspaceId, funnel.id) : Promise.resolve(null)),
    [open, workspaceId, funnel.id, funnel.publishedRevisionId, version]
  );

  async function confirmRollback() {
    if (!target) return;
    try {
      await funnelsRollback(apiClient, workspaceId, funnel.id, target.id);
    } catch (err) {
      // ConfirmDialog shows the thrown message inline.
      throw new Error(describeError(err));
    }
    toast.success(fmt(t.toastRolledBack, { n: target.revisionNumber }));
    setTarget(null);
    setOpen(false);
    onRolledBack();
  }

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <History className="size-4" aria-hidden /> {t.history}
      </Button>
      {open && (
        <>
          <button type="button" aria-label={c.close} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-1 w-80 overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-lg">
            <p className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.historyTitle}</p>
            <div className="max-h-80 overflow-y-auto p-2">
              <DataState
                loading={revisions.loading}
                error={revisions.error}
                empty={!revisions.loading && (revisions.data?.length ?? 0) === 0}
                emptyMessage={t.historyEmpty}
                onRetry={() => revisions.refresh()}
              >
                <ul className="space-y-1">
                  {(revisions.data ?? []).map((r) => {
                    const live = r.id === funnel.publishedRevisionId;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-paper">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {fmt(t.revisionLabel, { n: r.revisionNumber })}
                            {live && <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">{t.revisionLive}</span>}
                          </p>
                          <p className="truncate text-xs text-ink-soft">
                            {formatDate(r.createdAt)} · {fmt(t.revisionSteps, { n: r.stepCount })}
                            {r.note ? ` · ${r.note}` : ""}
                          </p>
                        </div>
                        {!live && (
                          <Button size="xs" variant="outline" onClick={() => setTarget(r)}>
                            {t.rollback}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </DataState>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={target !== null}
        title={target ? fmt(t.rollbackTitle, { n: target.revisionNumber }) : t.history}
        description={target ? fmt(t.rollbackDescription, { n: target.revisionNumber }) : undefined}
        confirmLabel={t.rollback}
        onCancel={() => setTarget(null)}
        onConfirm={confirmRollback}
      />
    </div>
  );
}

// ------------------------------------------------------------- left pane --

function AddStepMenu({ onAdd }: { onAdd: (type: UiStepType) => void }) {
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

function SortableStepRow({ step, selected, onSelect, onDelete }: { step: UiStep; selected: boolean; onSelect: () => void; onDelete: () => void }) {
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
  entryKey,
  selectedKey,
  onSelect,
  onMove,
}: {
  funnel: UiFunnel;
  entryKey: string | null;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
}) {
  const drag = useRef<{ key: string; dx: number; dy: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT(CANVAS_STRINGS);
  const { locale, dir } = useLocale();

  const byKey = useMemo(() => new Map(funnel.steps.map((s) => [s.key, s])), [funnel.steps]);
  const width = Math.max(900, ...funnel.steps.map((s) => s.x + CARD_W + 80));
  const height = Math.max(520, ...funnel.steps.map((s) => s.y + CARD_H + 80));

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, step: UiStep) {
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
    <main ref={containerRef} dir="ltr" aria-label={EDITOR_STRINGS[locale].canvasLabel} className="relative min-h-[380px] min-w-0 flex-1 shrink-0 overflow-auto bg-paper lg:min-h-0 lg:shrink" style={{ backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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
          const isEntry = s.key === entryKey;
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
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums" title={t.statsUnavailable}>
                <span className="text-ink-soft">— → —</span>
                <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-ink-soft">—</span>
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
  catalog,
  catalogLoading,
  catalogError,
  onChange,
  onEdgesChange,
  onDelete,
  onClose,
}: {
  funnel: UiFunnel;
  step: UiStep;
  catalog: CatalogEntry[] | null;
  catalogLoading: boolean;
  catalogError: unknown;
  onChange: (changes: Partial<UiStep>) => void;
  onEdgesChange: (edges: UiEdge[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT(INSPECTOR_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const needsOffer = STEP_TYPES[step.type].needsOffer;
  const outgoing = funnel.edges.filter((e) => e.fromStepKey === step.key).sort((a, b) => b.priority - a.priority);
  const others = funnel.steps.filter((s) => s.key !== step.key);

  const entries = catalog ?? [];
  const owner = step.offerId ? entries.find((e) => e.offers.some((o) => o.id === step.offerId)) ?? null : null;
  const [productId, setProductId] = useState<string>(owner?.product.id ?? "");
  const chosen = entries.find((e) => e.product.id === (owner?.product.id ?? productId)) ?? null;
  const currentOffer = owner?.offers.find((o) => o.id === step.offerId) ?? null;

  function pickProduct(id: string) {
    setProductId(id);
    if (step.offerId && owner?.product.id !== id) onChange({ offerId: null });
  }

  function updateEdge(id: string, changes: Partial<UiEdge>) {
    onEdgesChange(funnel.edges.map((e) => (e.id === id ? { ...e, ...changes } : e)));
  }

  function addEdge() {
    const target = others[0];
    if (!target) return;
    onEdgesChange([...funnel.edges, { id: tempId(), serverId: null, fromStepKey: step.key, toStepKey: target.key, condition: "always", priority: 0 }]);
  }

  function removeEdge(id: string) {
    onEdgesChange(funnel.edges.filter((e) => e.id !== id));
  }

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
          <Input id="step-name" dir="auto" maxLength={200} value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
          <p className="text-xs text-ink-soft">
            {t.key}: <bdi dir="ltr">{step.key}</bdi>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-type">{t.type}</Label>
          <Select id="step-type" value={step.type} onChange={(e) => onChange({ type: e.target.value as UiStepType })}>
            {STEP_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {STEP_TYPE_LABELS[locale][type]}
              </option>
            ))}
          </Select>
        </div>

        {(needsOffer || step.offerId) && (
          <div className="space-y-3 rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.offer}</p>
            {catalogLoading ? (
              <Spinner className="size-4" />
            ) : catalogError ? (
              <p className="text-xs text-danger">{t.offersError}</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-ink-soft">{t.noProducts}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="step-product">{t.product}</Label>
                  <Select id="step-product" value={chosen?.product.id ?? ""} onChange={(e) => pickProduct(e.target.value)}>
                    <option value="">{t.pickProduct}</option>
                    {entries.map((e) => (
                      <option key={e.product.id} value={e.product.id}>
                        {e.product.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {chosen && (
                  <div className="space-y-1.5">
                    <Label htmlFor="step-offer">{t.offerLabel}</Label>
                    {chosen.offers.length === 0 ? (
                      <p className="text-xs text-ink-soft">{t.noOffers}</p>
                    ) : (
                      <Select id="step-offer" value={step.offerId ?? ""} onChange={(e) => onChange({ offerId: e.target.value || null })}>
                        <option value="">{t.pickOffer}</option>
                        {chosen.offers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}
                {currentOffer && (
                  <p className="text-xs text-ink-soft">
                    {t.offerPrice}:{" "}
                    {currentOffer.priceAmount !== null ? <bdi dir="ltr">{formatMoney(currentOffer.priceAmount, currentOffer.currency)}</bdi> : t.offerPriceNone}
                  </p>
                )}
              </>
            )}
            {needsOffer && !step.offerId && <p className="text-xs text-danger">{t.required}</p>}
          </div>
        )}

        {step.experimentId && (
          <div className="rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs text-ink-soft">{t.abRunning}</p>
            <Link to="/experiments" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <FlaskConical className="size-3.5" aria-hidden /> {t.manageExperiments}
            </Link>
          </div>
        )}

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
                    <Select value={e.condition} onChange={(ev) => updateEdge(e.id, { condition: ev.target.value as UiEdgeCondition })} className="h-8 text-xs" aria-label={t.condition}>
                      {CONDITION_ORDER.map((cond) => (
                        <option key={cond} value={cond}>
                          {CONDITION_LABELS[locale][cond]}
                        </option>
                      ))}
                    </Select>
                    <Input type="number" dir="ltr" min={0} value={e.priority} onChange={(ev) => updateEdge(e.id, { priority: Math.max(0, Math.floor(Number(ev.target.value)) || 0) })} className="h-8 text-xs" aria-label={t.priority} title={t.priority} />
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
