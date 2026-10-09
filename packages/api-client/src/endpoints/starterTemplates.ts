/**
 * The starter template gallery (backend: frontend-handoff item 401). Public, no auth.
 *
 *   GET /templates?kind=&category=&price=&rtl=&language=&sort=  → { templates, categories }
 *       kind store|funnel|landing · price free|paid · language ar|en|fr (a template has a
 *       direction: ar is right to left) · sort name (default) | newest | most_used.
 *       An unknown sort or price → 422. `categories` lists every category on the tab whatever
 *       the other filters, so the chips stay put.
 *   POST /workspaces/:ws/funnels { name, subdomain?, templateVersionId } → 201 { funnel, steps }
 *       from a funnel or landing card: its first page becomes the landing step, the others
 *       generic pages; no links are drawn. A store template → 422 TEMPLATE_KIND_MISMATCH; a
 *       version that is gone or switched off → 404.
 */
import type { ApiClient } from "../client";
import type { WebsiteTemplateSummary } from "../types";
import type { FunnelDto, FunnelStepDto } from "./funnels";

export type StarterTemplateKind = "store" | "funnel" | "landing";
export type StarterTemplateSort = "name" | "newest" | "most_used";
export type StarterTemplatePrice = "free" | "paid";
export type StarterTemplateLanguage = "ar" | "en" | "fr";

export interface StarterTemplateCard extends WebsiteTemplateSummary {
  kind?: StarterTemplateKind;
  isFree?: boolean;
  priceAmount?: number;
  rtl?: boolean;
  tags?: string[];
  /** The websites and funnels made from it, not counting the trash. */
  usesCount?: number;
  createdAt?: string;
}

export interface StarterTemplateQuery {
  kind?: StarterTemplateKind;
  category?: string;
  price?: StarterTemplatePrice;
  language?: StarterTemplateLanguage;
  sort?: StarterTemplateSort;
}

export interface StarterTemplateListing {
  templates: StarterTemplateCard[];
  categories: string[];
}

export async function starterTemplatesList(client: ApiClient, query: StarterTemplateQuery = {}): Promise<StarterTemplateListing> {
  const qs = new URLSearchParams();
  if (query.kind) qs.set("kind", query.kind);
  if (query.category) qs.set("category", query.category);
  if (query.price) qs.set("price", query.price);
  if (query.language) qs.set("language", query.language);
  if (query.sort && query.sort !== "name") qs.set("sort", query.sort);
  const text = qs.toString();
  const answer = await client.request<Partial<StarterTemplateListing>>(`/templates${text ? `?${text}` : ""}`, { auth: false });
  return { templates: answer.templates ?? [], categories: answer.categories ?? [] };
}

/** A new funnel from a funnel or landing template's version. */
export function funnelFromStarterTemplate(
  client: ApiClient,
  workspaceId: string,
  body: { name: string; subdomain?: string; templateVersionId: string }
): Promise<{ funnel: FunnelDto; steps: FunnelStepDto[] }> {
  return client.request<{ funnel: FunnelDto; steps: FunnelStepDto[] }>(`/workspaces/${workspaceId}/funnels`, { method: "POST", body });
}
