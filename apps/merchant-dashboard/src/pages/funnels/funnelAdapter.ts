/**
 * Maps the real funnels API (packages/api-client/src/endpoints/funnels.ts) onto
 * the editor's UI model, and implements the multi-request flows the backend has
 * no single endpoint for: diff-save, duplicate and create-from-starter.
 *
 * CANVAS POSITIONS: backend steps have no x/y columns, but `seo` is validated
 * with Joi `.unknown(true)` and stored as JSONB, so node position and list order
 * are persisted server-side in `step.seo.zimosCanvas = { x, y, order }`
 * (not localStorage). `builderData` is deep-validated as a page tree, so it is
 * never used for editor metadata.
 *
 * STEP CONTENT: each step's `builderData` is a page tree, edited in the funnel
 * editor's page view with the website editor's block library and inspector.
 * It is carried on `UiStep.tree` (normalised; the rest of the tree is kept
 * verbatim) and sent on update only when it actually changed, so a save that
 * only moves a card never rewrites a page. New steps start from their step
 * type's starting page (funnelPages.ts), which always passes the publish check.
 */
import {
  ApiError,
  funnelsCreate,
  funnelsCreateEdge,
  funnelsCreateStep,
  funnelsDeleteEdge,
  funnelsDeleteStep,
  funnelsGet,
  funnelsUpdate,
  funnelsUpdateEdge,
  funnelsUpdateStep,
  type FunnelDetailDto,
  type FunnelDto,
  type FunnelEdgeConditionType,
  type FunnelEdgeUpdatePayload,
  type FunnelStatus,
  type FunnelStepTypeDto,
  type FunnelStepUpdatePayload,
  type PageTree,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { normalizeTree } from "../website/editor/blocks";
import { layoutFlow } from "./funnelFlow";
import { stepPageTree, type StepPageVariant } from "./funnelPages";

// ---------------------------------------------------------------- UI types --

export type { FunnelStatus };
export type UiStepType = FunnelStepTypeDto;
export type UiEdgeCondition = FunnelEdgeConditionType;

export interface UiStep {
  /** Server id; null until the step is created on save. */
  id: string | null;
  /** Client-chosen, immutable after create, referenced by edges. */
  key: string;
  name: string;
  type: UiStepType;
  offerId: string | null;
  experimentId: string | null;
  /** Server seo object minus our canvas metadata. Round-tripped untouched. */
  seo: Record<string, unknown>;
  /** The step's page (`builderData`), normalised to a tree with a sections array. */
  tree: PageTree;
  x: number;
  y: number;
}

export interface UiEdge {
  /** Stable React/UI id: the server id, or a temp id for unsaved edges. */
  id: string;
  serverId: string | null;
  fromStepKey: string;
  toStepKey: string;
  condition: UiEdgeCondition;
  priority: number;
}

export interface UiFunnel {
  id: string;
  name: string;
  subdomain: string | null;
  status: FunnelStatus;
  publishedRevisionId: string | null;
  publishedRevisionNumber: number | null;
  steps: UiStep[];
  edges: UiEdge[];
  createdAt: string;
  updatedAt: string;
}

export const CARD_GAP_X = 340;
const CANVAS_KEY = "zimosCanvas";

interface CanvasMeta {
  x: number;
  y: number;
  order: number;
}

function readCanvas(seo: Record<string, unknown> | null | undefined): CanvasMeta | null {
  const raw = seo?.[CANVAS_KEY] as Partial<CanvasMeta> | undefined;
  if (!raw || typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  return { x: raw.x, y: raw.y, order: typeof raw.order === "number" ? raw.order : Number.MAX_SAFE_INTEGER };
}

function stripCanvas(seo: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const { [CANVAS_KEY]: _omit, ...rest } = seo ?? {};
  return rest;
}

function withCanvas(step: UiStep, order: number): Record<string, unknown> {
  return { ...step.seo, [CANVAS_KEY]: { x: Math.round(step.x), y: Math.round(step.y), order } };
}

export function tempId(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Minimal non-empty page tree, same shape as the backend integration tests. */
export function starterTree(text: string) {
  return {
    version: 1,
    sections: [
      {
        id: "s1",
        type: "section",
        settings: {},
        rows: [
          {
            id: "r1",
            type: "row",
            settings: {},
            columns: [{ id: "c1", type: "column", span: 12, settings: {}, elements: [{ id: "e1", type: "text", props: { text } }] }],
          },
        ],
      },
    ],
  };
}

// ----------------------------------------------------------------- mapping --

export function toUiFunnel(dto: FunnelDetailDto): UiFunnel {
  const steps = dto.steps
    .map((s, i) => {
      const canvas = readCanvas(s.seo);
      return {
        order: canvas?.order ?? Number.MAX_SAFE_INTEGER,
        index: i,
        step: {
          id: s.id,
          key: s.key,
          name: s.name,
          type: s.stepType,
          offerId: s.offerId,
          experimentId: s.abTestExperimentId,
          seo: stripCanvas(s.seo),
          tree: normalizeTree(s.builderData),
          x: canvas?.x ?? 40 + i * CARD_GAP_X,
          y: canvas?.y ?? 120,
        } satisfies UiStep,
      };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((e) => e.step);

  return {
    ...funnelBase(dto.funnel),
    publishedRevisionNumber: dto.publishedRevision?.revisionNumber ?? null,
    steps,
    edges: dto.edges.map((e) => ({
      id: e.id,
      serverId: e.id,
      fromStepKey: e.fromStepKey,
      toStepKey: e.toStepKey,
      // The runtime treats a null condition as "always".
      condition: e.condition?.type ?? "always",
      priority: e.priority,
    })),
  };
}

export function funnelBase(f: FunnelDto) {
  return {
    id: f.id,
    name: f.name,
    subdomain: f.subdomain,
    status: f.status,
    publishedRevisionId: f.publishedRevisionId,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export async function loadUiFunnel(workspaceId: string, funnelId: string): Promise<UiFunnel | null> {
  try {
    return toUiFunnel(await funnelsGet(apiClient, workspaceId, funnelId));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Public URL of a funnel. No app in this repo serves funnels by subdomain yet,
 * so a link is only built when VITE_FUNNEL_PUBLIC_BASE_URL is configured
 * (e.g. "https://{subdomain}.zimos.app"). Otherwise returns null and the UI hides the action.
 */
export function funnelPublicUrl(subdomain: string | null): string | null {
  const template = import.meta.env.VITE_FUNNEL_PUBLIC_BASE_URL as string | undefined;
  if (!template || !subdomain) return null;
  return template.includes("{subdomain}") ? template.replace("{subdomain}", subdomain) : `${template.replace(/\/$/, "")}/${subdomain}`;
}

/** Slug a key that is unique against every key in `taken`. */
export function uniqueStepKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "") || "step";
  let key = root;
  let n = 2;
  while (used.has(key)) key = `${root}-${n++}`;
  return key;
}

// -------------------------------------------------------------- save diff --

export interface SaveProgress {
  done: number;
  total: number;
}

/**
 * Pushes `draft` to the server as a sequence of requests, in this order:
 * funnel rename -> create new steps -> update changed steps -> delete removed
 * edges -> update changed edges -> create new edges -> delete removed steps.
 * Stops (throws) on the first failing request. The caller reloads afterwards.
 */
export async function saveFunnelDiff(workspaceId: string, baseline: UiFunnel, draft: UiFunnel, onProgress?: (p: SaveProgress) => void) {
  const ops: Array<() => Promise<unknown>> = [];
  const fid = draft.id;

  if (draft.name.trim() && draft.name.trim() !== baseline.name) {
    ops.push(() => funnelsUpdate(apiClient, workspaceId, fid, { name: draft.name.trim() }));
  }

  const baseSteps = new Map(baseline.steps.filter((s) => s.id).map((s) => [s.id as string, s]));
  const baseOrder = new Map(baseline.steps.map((s, i) => [s.key, i]));

  draft.steps.forEach((s, order) => {
    if (!s.id) {
      ops.push(() =>
        funnelsCreateStep(apiClient, workspaceId, fid, {
          key: s.key,
          stepType: s.type,
          name: s.name.trim() || s.key,
          builderData: s.tree.sections.length > 0 ? s.tree : starterTree(s.name.trim() || s.key),
          ...(s.offerId ? { offerId: s.offerId } : {}),
          seo: withCanvas(s, order),
        })
      );
      return;
    }
    const before = baseSteps.get(s.id);
    if (!before) return;
    const patch: FunnelStepUpdatePayload = {};
    if (s.name !== before.name) patch.name = s.name.trim() || s.key;
    if (s.type !== before.type) patch.stepType = s.type;
    if (s.offerId !== before.offerId) patch.offerId = s.offerId;
    if (JSON.stringify(s.tree) !== JSON.stringify(before.tree)) patch.builderData = s.tree;
    if (s.x !== before.x || s.y !== before.y || order !== baseOrder.get(s.key)) patch.seo = withCanvas(s, order);
    if (Object.keys(patch).length > 0) {
      const id = s.id;
      ops.push(() => funnelsUpdateStep(apiClient, workspaceId, fid, id, patch));
    }
  });

  const draftStepIds = new Set(draft.steps.map((s) => s.id).filter(Boolean));
  const removedSteps = baseline.steps.filter((s) => s.id && !draftStepIds.has(s.id));
  const removedKeys = new Set(removedSteps.map((s) => s.key));

  const draftEdgeIds = new Set(draft.edges.map((e) => e.serverId).filter(Boolean));
  for (const e of baseline.edges) {
    // Edges into a removed step are deleted by the server along with the step.
    if (e.serverId && !draftEdgeIds.has(e.serverId) && !removedKeys.has(e.fromStepKey) && !removedKeys.has(e.toStepKey)) {
      const id = e.serverId;
      ops.push(() => funnelsDeleteEdge(apiClient, workspaceId, fid, id));
    }
  }

  const baseEdges = new Map(baseline.edges.map((e) => [e.serverId, e]));
  for (const e of draft.edges) {
    if (!e.serverId) {
      ops.push(() =>
        funnelsCreateEdge(apiClient, workspaceId, fid, {
          fromStepKey: e.fromStepKey,
          toStepKey: e.toStepKey,
          condition: { type: e.condition },
          priority: e.priority,
        })
      );
      continue;
    }
    const before = baseEdges.get(e.serverId);
    if (!before) continue;
    const patch: FunnelEdgeUpdatePayload = {};
    if (e.fromStepKey !== before.fromStepKey) patch.fromStepKey = e.fromStepKey;
    if (e.toStepKey !== before.toStepKey) patch.toStepKey = e.toStepKey;
    if (e.condition !== before.condition) patch.condition = { type: e.condition };
    if (e.priority !== before.priority) patch.priority = e.priority;
    if (Object.keys(patch).length > 0) {
      const id = e.serverId;
      ops.push(() => funnelsUpdateEdge(apiClient, workspaceId, fid, id, patch));
    }
  }

  for (const s of removedSteps) {
    const id = s.id as string;
    ops.push(() => funnelsDeleteStep(apiClient, workspaceId, fid, id));
  }

  // Edge creates must run after new steps exist but before steps are deleted;
  // re-order so every createEdge sits after all step creates/updates (already true)
  // and step deletes run last (already true). Execute sequentially.
  let done = 0;
  onProgress?.({ done, total: ops.length });
  for (const op of ops) {
    await op();
    onProgress?.({ done: ++done, total: ops.length });
  }
  return ops.length;
}

// ------------------------------------------------- create / duplicate flows --

export type StarterTemplateId = "blank" | "cod-single" | "cod-upsell" | "cod-bundle" | "upsell-downsell" | "lead-magnet";

export const STARTER_TEMPLATE_IDS: StarterTemplateId[] = ["blank", "cod-single", "cod-upsell", "cod-bundle", "upsell-downsell", "lead-magnet"];

interface StarterStep {
  key: string;
  type: UiStepType;
  name: Record<Locale, string>;
  /** A different starting page than the step type's default (funnelPages.ts). */
  page?: StepPageVariant;
}

interface StarterEdge {
  from: string;
  to: string;
  condition: UiEdgeCondition;
  priority?: number;
}

const N = (en: string, ar: string) => ({ en, ar });

const STARTERS: Record<StarterTemplateId, { steps: StarterStep[]; edges: StarterEdge[] }> = {
  blank: {
    steps: [
      { key: "landing", type: "landing", name: N("Landing page", "صفحة الهبوط") },
      { key: "checkout", type: "checkout", name: N("Checkout", "الدفع") },
      { key: "thank-you", type: "thank_you", name: N("Thank you", "شكراً لطلبك") },
    ],
    edges: [
      { from: "landing", to: "checkout", condition: "always" },
      { from: "checkout", to: "thank-you", condition: "completed_checkout" },
    ],
  },
  "cod-single": {
    steps: [
      { key: "sales", type: "sales", name: N("Sales page", "صفحة البيع") },
      { key: "checkout", type: "checkout", name: N("Cash on delivery checkout", "الدفع عند الاستلام") },
      { key: "thank-you", type: "thank_you", name: N("Thank you", "شكراً لطلبك") },
    ],
    edges: [
      { from: "sales", to: "checkout", condition: "always" },
      { from: "checkout", to: "thank-you", condition: "completed_checkout" },
    ],
  },
  // Egyptian COD: one product, a cash-on-delivery checkout, then a one-click
  // extra offer. Accepting and declining both end on the thank-you page. The
  // upsell's offer is picked in the editor — publish is blocked until it is.
  "cod-upsell": {
    steps: [
      { key: "product", type: "landing", name: N("Product page", "صفحة المنتج") },
      { key: "checkout", type: "checkout", name: N("Cash on delivery checkout", "الدفع عند الاستلام") },
      { key: "upsell", type: "upsell", name: N("One-click extra offer", "عرض إضافي بضغطة") },
      { key: "thank-you", type: "thank_you", name: N("Thank you", "شكراً لطلبك") },
    ],
    edges: [
      { from: "product", to: "checkout", condition: "always" },
      { from: "checkout", to: "upsell", condition: "completed_checkout" },
      { from: "upsell", to: "thank-you", condition: "accepted_offer", priority: 1 },
      { from: "upsell", to: "thank-you", condition: "declined_offer" },
    ],
  },
  // Egyptian COD bundle: a landing page that sells a bundle (a product grid the
  // merchant points at the bundle's products), then checkout and thank-you.
  "cod-bundle": {
    steps: [
      { key: "bundle", type: "landing", name: N("Bundle page", "صفحة الباقة"), page: "bundle" },
      { key: "checkout", type: "checkout", name: N("Cash on delivery checkout", "الدفع عند الاستلام") },
      { key: "thank-you", type: "thank_you", name: N("Thank you", "شكراً لطلبك") },
    ],
    edges: [
      { from: "bundle", to: "checkout", condition: "always" },
      { from: "checkout", to: "thank-you", condition: "completed_checkout" },
    ],
  },
  "upsell-downsell": {
    steps: [
      { key: "landing", type: "landing", name: N("Landing page", "صفحة الهبوط") },
      { key: "checkout", type: "checkout", name: N("Checkout", "الدفع") },
      { key: "upsell", type: "upsell", name: N("Upsell", "عرض بعد الشراء") },
      { key: "downsell", type: "downsell", name: N("Downsell", "عرض بديل") },
      { key: "thank-you", type: "thank_you", name: N("Thank you", "شكراً لطلبك") },
    ],
    edges: [
      { from: "landing", to: "checkout", condition: "always" },
      { from: "checkout", to: "upsell", condition: "completed_checkout" },
      { from: "upsell", to: "thank-you", condition: "accepted_offer", priority: 1 },
      { from: "upsell", to: "downsell", condition: "declined_offer" },
      { from: "downsell", to: "thank-you", condition: "always" },
    ],
  },
  "lead-magnet": {
    steps: [
      { key: "opt-in", type: "opt_in", name: N("Opt-in", "تسجيل البيانات") },
      { key: "thank-you", type: "thank_you", name: N("Thank you + offer", "شكراً + عرض") },
    ],
    edges: [{ from: "opt-in", to: "thank-you", condition: "always" }],
  },
};

export interface StarterPlan {
  steps: Array<{ key: string; type: UiStepType; name: string; tree: PageTree; x: number; y: number }>;
  edges: Array<{ from: string; to: string; condition: UiEdgeCondition; priority: number }>;
}

/**
 * A starter as plain data: the steps it creates (with their starting pages and
 * a tidy canvas position) and its edges. Used by create-from-starter, by the
 * editor's "start from a template" on an empty funnel, and by the tests that
 * hold every starter to the backend's publish rules.
 */
export function starterPlan(templateId: StarterTemplateId, locale: Locale): StarterPlan {
  const starter = STARTERS[templateId];
  const edges = starter.edges.map((e) => ({ from: e.from, to: e.to, condition: e.condition, priority: e.priority ?? 0 }));
  const positions = layoutFlow(
    starter.steps.map((s) => s.key),
    edges.map((e) => ({ fromStepKey: e.from, toStepKey: e.to, condition: e.condition, priority: e.priority }))
  );
  return {
    steps: starter.steps.map((s, i) => ({
      key: s.key,
      type: s.type,
      name: s.name[locale],
      tree: stepPageTree(s.type, locale, s.page),
      ...(positions.get(s.key) ?? { x: 40 + i * CARD_GAP_X, y: 120 }),
    })),
    edges,
  };
}

/** Create a funnel, then its starter steps and edges (sequential). If a later call fails it throws with `partialFunnelId` attached. */
export async function createFunnelFromStarter(workspaceId: string, name: string, templateId: StarterTemplateId, locale: Locale): Promise<FunnelDto> {
  const funnel = await funnelsCreate(apiClient, workspaceId, { name });
  const plan = starterPlan(templateId, locale);
  try {
    for (const [i, s] of plan.steps.entries()) {
      await funnelsCreateStep(apiClient, workspaceId, funnel.id, {
        key: s.key,
        stepType: s.type,
        name: s.name,
        builderData: s.tree,
        seo: { [CANVAS_KEY]: { x: s.x, y: s.y, order: i } },
      });
    }
    for (const e of plan.edges) {
      await funnelsCreateEdge(apiClient, workspaceId, funnel.id, {
        fromStepKey: e.from,
        toStepKey: e.to,
        condition: { type: e.condition },
        priority: e.priority,
      });
    }
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { partialFunnelId: funnel.id });
  }
  return funnel;
}

/**
 * Client-side duplicate (no backend endpoint): create funnel, copy every step
 * (including its builderData tree and seo), then every edge. If a step's offer
 * is no longer active the copy is created without it rather than failing.
 */
export async function duplicateFunnel(workspaceId: string, sourceId: string, copyName: (name: string) => string): Promise<FunnelDto> {
  const src = await funnelsGet(apiClient, workspaceId, sourceId);
  const copy = await funnelsCreate(apiClient, workspaceId, { name: copyName(src.funnel.name).slice(0, 200) });
  try {
    for (const s of src.steps) {
      const payload = { key: s.key, stepType: s.stepType, name: s.name, builderData: s.builderData, seo: s.seo ?? {} };
      try {
        await funnelsCreateStep(apiClient, workspaceId, copy.id, s.offerId ? { ...payload, offerId: s.offerId } : payload);
      } catch (err) {
        if (s.offerId && err instanceof ApiError && err.status === 422) {
          await funnelsCreateStep(apiClient, workspaceId, copy.id, payload);
        } else {
          throw err;
        }
      }
    }
    // Server lists edges priority DESC; recreate in that order.
    for (const e of src.edges) {
      await funnelsCreateEdge(apiClient, workspaceId, copy.id, {
        fromStepKey: e.fromStepKey,
        toStepKey: e.toStepKey,
        condition: e.condition,
        priority: e.priority,
      });
    }
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { partialFunnelId: copy.id });
  }
  return copy;
}

// ------------------------------------------------------------------ errors --

const ERROR_STRINGS = {
  en: {
    permission: "You don't have permission to manage or publish funnels. Ask a workspace owner to update your role.",
    subscription: "This workspace needs an active subscription to create or publish funnels. Update your plan in Billing.",
    notPublished: "Publish this funnel before pausing or resuming it.",
    keyTaken: "A step with this key already exists in the funnel. Reload and try again.",
  },
  ar: {
    permission: "ليست لديك صلاحية لإدارة مسارات البيع أو نشرها. اطلب من مالك مساحة العمل تحديث دورك.",
    subscription: "تحتاج مساحة العمل إلى اشتراك نشط لإنشاء مسارات البيع أو نشرها. حدّث خطتك من صفحة الفواتير.",
    notPublished: "انشر مسار البيع أولًا قبل إيقافه مؤقتًا أو استئنافه.",
    keyTaken: "توجد خطوة بنفس المعرّف في مسار البيع. أعد التحميل وحاول مرة أخرى.",
  },
} satisfies Messages;

export function isSubscriptionError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "SUBSCRIPTION_REQUIRED" || err.status === 402);
}

/** Bilingual message for funnel API errors (403 permission, 402 subscription, known 409s). */
export function useFunnelErrorMessage(): (err: unknown) => string {
  const t = useT(ERROR_STRINGS);
  return (err: unknown) => {
    if (isSubscriptionError(err)) return t.subscription;
    if (err instanceof ApiError) {
      if (err.status === 403) return t.permission;
      if (err.code === "FUNNEL_NOT_PUBLISHED") return t.notPublished;
      if (err.code === "FUNNEL_STEP_KEY_TAKEN") return t.keyTaken;
    }
    return getErrorMessage(err);
  };
}
