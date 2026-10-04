import type { PageTree } from "@store-builder/api-client";
import type { UiEdge, UiFunnel, UiStep } from "./funnelAdapter";

/**
 * A funnel's generic pages (SPEC §9.2: contact us, about us, policies — "in a
 * sidebar, not on the map"; backend funnels/genericPages.js): a `custom` step
 * no edge touches. It is off the path — never the start, never "unreachable"
 * — and opens at its own address, /f/<funnel>/p/<key>, from any link on the
 * funnel's pages. Linking it into the map makes it an ordinary step.
 */

type EdgeLike = Pick<UiEdge, "fromStepKey" | "toStepKey">;

export function isGenericStep(step: Pick<UiStep, "key" | "type">, edges: EdgeLike[]): boolean {
  return step.type === "custom" && !edges.some((e) => e.fromStepKey === step.key || e.toStepKey === step.key);
}

/** The steps on the path; all of them when every step is generic (a one-page funnel). */
export function flowSteps<T extends Pick<UiStep, "key" | "type">>(steps: T[], edges: EdgeLike[]): T[] {
  const flow = steps.filter((s) => !isGenericStep(s, edges));
  return flow.length > 0 ? flow : steps;
}

/** Where a generic page opens: store-relative, as a merchant writes a link, and in full for sharing. */
export function genericPagePath(funnel: Pick<UiFunnel, "id" | "subdomain">, key: string): string {
  return `/f/${funnel.subdomain || funnel.id}/p/${key}`;
}

export type GenericPreset = "contact" | "about" | "policies" | "blank";

/** A new generic page's starting content: a heading and the words to replace, and a form on "contact us". */
export function genericPageTree(preset: GenericPreset, name: string, body: string): PageTree {
  const id = (part: string) => `gp-${part}-${Math.random().toString(36).slice(2, 8)}`;
  const elements: Array<{ id: string; type: string; props: Record<string, unknown> }> = [{ id: id("h"), type: "heading", props: { text: name, level: 1 } }];
  if (preset !== "blank") elements.push({ id: id("t"), type: "rich_text", props: { text: body } });
  if (preset === "contact") elements.push({ id: id("f"), type: "form", props: { title: "", submitLabel: "" } });
  return {
    version: 1,
    sections: [{ id: id("s"), type: "section", rows: [{ id: id("r"), type: "row", columns: [{ id: id("c"), type: "column", span: 12, elements }] }] }],
  } as PageTree;
}
