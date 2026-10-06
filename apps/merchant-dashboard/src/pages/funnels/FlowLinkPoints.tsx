import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@store-builder/ui";
import type { PageElement, PageTree } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { tempId, type UiEdge, type UiEdgeCondition, type UiFunnel, type UiStep } from "./funnelAdapter";

/**
 * Link points on a funnel map card (SPEC §9.2): every way out of the step's
 * page — each button that moves the shopper on, the order form, an offer's
 * "Yes" and "No" — is a dot on the card's edge. Dragging from a dot to
 * another card draws that path; pressing it (or Enter) lists the steps to
 * pick from instead. A button's path is `clicked_through` with its element id
 * (funnels/funnelRouting.js follows it only for that button); the others are
 * the step's own outcomes.
 */

const STRINGS = {
  en: {
    order: "Order placed",
    yes: "Yes, add it",
    no: "No, thanks",
    next: "Continue",
    link: "Link “{label}” to another step",
    linkTo: "“{label}” goes to…",
    linked: "goes to {name}",
    newStep: "A new step…",
  },
  ar: {
    order: "اتطلب",
    yes: "أيوه، ضيفه",
    no: "لا، شكرًا",
    next: "متابعة",
    link: "اربط «{label}» بخطوة تانية",
    linkTo: "«{label}» يروح على…",
    linked: "بيروح على {name}",
    newStep: "خطوة جديدة…",
  },
} satisfies Messages;

/** The labels of a card's own outcomes (order, yes, no, continue). */
export function useLinkLabels() {
  return useT(STRINGS);
}

export type LinkPoint = { id: string; label: string; condition: UiEdgeCondition; sourceElementId: string | null };

const MAX_POINTS = 5;
export const POINT_TOP = 44;
export const POINT_GAP = 22;
export const pointY = (index: number) => POINT_TOP + index * POINT_GAP;

function elementsOf(tree: PageTree): PageElement[] {
  return tree.sections.flatMap((s) => (s.rows ?? []).flatMap((r) => (r.columns ?? []).flatMap((c) => c.elements ?? [])));
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The step's ways out, in the order they are drawn. */
export function linkPointsOf(step: UiStep, labels: { order: string; yes: string; no: string; next: string }): LinkPoint[] {
  const points: LinkPoint[] = [];
  const elements = elementsOf(step.tree);
  if (step.type === "checkout" || elements.some((e) => e.type === "cod_form")) {
    points.push({ id: "order", label: labels.order, condition: "completed_checkout", sourceElementId: null });
  }
  if (step.type === "upsell" || step.type === "downsell") {
    points.push({ id: "yes", label: labels.yes, condition: "accepted_offer", sourceElementId: null });
    points.push({ id: "no", label: labels.no, condition: "declined_offer", sourceElementId: null });
  }
  // A button with no link of its own moves the shopper on (PageRenderer, funnel mode).
  for (const el of elements) {
    if (el.type !== "button") continue;
    const props = (el.props ?? {}) as Record<string, unknown>;
    if (str(props.href) || !str(props.label)) continue;
    points.push({ id: el.id, label: str(props.label), condition: "clicked_through", sourceElementId: el.id });
  }
  if (points.length === 0 && step.type !== "thank_you") {
    points.push({ id: "next", label: labels.next, condition: "always", sourceElementId: null });
  }
  return points.slice(0, MAX_POINTS);
}

/** Which point an edge leaves from, if any. */
export function pointOfEdge(points: LinkPoint[], edge: UiEdge): number {
  return points.findIndex((p) =>
    p.condition === "clicked_through" ? edge.condition === "clicked_through" && edge.sourceElementId === p.sourceElementId : edge.condition === p.condition
  );
}

/**
 * The funnel with `point` of `fromKey` leading to `toKey`: the point's
 * previous path is replaced (one arrow per point). A button's path outranks
 * the step's general ones, so that button follows it.
 */
export function linkPoint(f: UiFunnel, fromKey: string, toKey: string, point: LinkPoint): UiFunnel {
  const same = (e: UiEdge) =>
    e.fromStepKey === fromKey &&
    (point.condition === "clicked_through"
      ? e.condition === "clicked_through" && e.sourceElementId === point.sourceElementId
      : e.condition === point.condition && !e.sourceElementId);
  const existing = f.edges.find(same);
  const priority = point.sourceElementId ? 2 : point.condition === "accepted_offer" ? 1 : 0;
  const next: UiEdge = existing
    ? { ...existing, toStepKey: toKey }
    : { id: tempId(), serverId: null, fromStepKey: fromKey, toStepKey: toKey, condition: point.condition, sourceElementId: point.sourceElementId, priority };
  return { ...f, edges: existing ? f.edges.map((e) => (e === existing ? next : e)) : [...f.edges, next] };
}

export type LinkDrag = { fromKey: string; point: LinkPoint; x1: number; y1: number; x2: number; y2: number };

/** A card's dots, on its end edge. Drag one to a card, or press it to pick a step. */
export function LinkPoints({
  step,
  steps,
  edges,
  cardWidth,
  toMap,
  onDrag,
  onDrop,
  onPick,
}: {
  step: UiStep;
  steps: UiStep[];
  edges: UiEdge[];
  cardWidth: number;
  toMap: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  onDrag: (drag: LinkDrag | null) => void;
  onDrop: (drag: LinkDrag) => void;
  onPick: (point: LinkPoint, toKey: string | null) => void;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<LinkDrag | null>(null);
  const points = linkPointsOf(step, t);

  const start = (e: ReactPointerEvent<HTMLButtonElement>, point: LinkPoint, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = toMap(e);
    const next = { fromKey: step.key, point, x1: step.x + cardWidth, y1: step.y + pointY(index), x2: at.x, y2: at.y };
    setDrag(next);
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const at = toMap(e);
    const next = { ...drag, x2: at.x, y2: at.y };
    setDrag(next);
    if (Math.abs(next.x2 - next.x1) + Math.abs(next.y2 - next.y1) > 8) onDrag(next);
  };
  const end = (e: ReactPointerEvent<HTMLButtonElement>, point: LinkPoint) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const moved = Math.abs(drag.x2 - drag.x1) + Math.abs(drag.y2 - drag.y1) > 8;
    setDrag(null);
    onDrag(null);
    if (moved) onDrop(drag);
    else setOpen((o) => (o === point.id ? null : point.id));
  };

  return (
    <>
      {points.map((point, index) => {
        const edge = edges.find((e) => e.fromStepKey === step.key && pointOfEdge([point], e) === 0);
        const target = edge ? steps.find((s) => s.key === edge.toStepKey) : undefined;
        const label = fmt(t.link, { label: point.label });
        return (
          <div key={point.id} className="absolute z-[4]" style={{ left: step.x + cardWidth - 6, top: step.y + pointY(index) - 6 }}>
            <button
              type="button"
              aria-label={label}
              title={target ? `${point.label} — ${fmt(t.linked, { name: target.name })}` : label}
              aria-expanded={open === point.id}
              onPointerDown={(e) => start(e, point, index)}
              onPointerMove={move}
              onPointerUp={(e) => end(e, point)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => (o === point.id ? null : point.id));
                }
              }}
              className={cn(
                "block size-3 cursor-crosshair rounded-full border-2 bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                target ? "border-primary" : "border-ink-soft"
              )}
            />
            <span className="pointer-events-none absolute end-4 top-1/2 max-w-24 -translate-y-1/2 truncate rounded bg-paper-raised/90 px-1 text-[10px] leading-4 text-ink-soft" dir="auto">
              {point.label}
            </span>
            {open === point.id && (
              <div className="absolute start-5 top-0 z-30 w-48 overflow-hidden rounded-xl border border-line bg-paper-raised text-sm shadow-lg">
                <p className="border-b border-line px-3 py-1.5 text-xs font-semibold text-ink-soft" dir="auto">
                  {fmt(t.linkTo, { label: point.label })}
                </p>
                <ul className="max-h-48 overflow-y-auto py-1">
                  {steps
                    .filter((s) => s.key !== step.key)
                    .map((s) => (
                      <li key={s.key}>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-start hover:bg-paper"
                          dir="auto"
                          onClick={() => {
                            setOpen(null);
                            onPick(point, s.key);
                          }}
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  <li>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-start text-primary hover:bg-paper"
                      onClick={() => {
                        setOpen(null);
                        onPick(point, null);
                      }}
                    >
                      {t.newStep}
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
