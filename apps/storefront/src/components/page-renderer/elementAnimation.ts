import type { CSSProperties } from "react";
import type { PageElement, PageTree } from "@store-builder/api-client";

/**
 * An element's entrance animation (backend modules/pages/elementAnimation.js):
 * `settings.animation = { type, duration, delay }`. The element's wrapper gets
 * `data-za="<type>"` and its timing as CSS variables; EntranceAnimations.tsx
 * reveals it when it first scrolls into view. Values are re-checked here:
 * the type comes from a fixed list and the times are clamped numbers.
 */

const TYPES = new Set(["fade", "slide-up", "slide-down", "slide-start", "slide-end", "zoom-in", "zoom-out"]);

export interface EntranceAnimation {
  type: string;
  duration: number;
  delay: number;
}

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function animationOf(element: PageElement): EntranceAnimation | null {
  const settings = element.settings && typeof element.settings === "object" && !Array.isArray(element.settings) ? (element.settings as Record<string, unknown>) : null;
  const raw = settings?.animation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.type !== "string" || !TYPES.has(a.type)) return null;
  return { type: a.type, duration: clamp(a.duration, 100, 3000, 600), delay: clamp(a.delay, 0, 5000, 0) };
}

/** The wrapper's attributes for an animated element. */
export function animationAttributes(animation: EntranceAnimation): { "data-za": string; style: CSSProperties } {
  return {
    "data-za": animation.type,
    style: { "--za-d": `${animation.duration}ms`, "--za-w": `${animation.delay}ms` } as CSSProperties,
  };
}

/** Whether any element of the page animates, so the observer is only shipped where needed. */
export function pageHasAnimation(tree: PageTree | null): boolean {
  for (const section of tree?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      for (const column of row?.columns ?? []) {
        for (const element of column?.elements ?? []) if (animationOf(element)) return true;
      }
    }
  }
  return false;
}
