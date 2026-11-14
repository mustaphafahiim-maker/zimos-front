/**
 * A store's suggestions to the platform (backend: modules/suggestions),
 * mounted at /workspaces/:workspaceId/suggestions — any member of the store.
 * 429 when one client sends too many in an hour.
 */
import type { ApiClient } from "../client";

export type SuggestionCategory = "feature" | "bug" | "improvement";
export type SuggestionStatus = "new" | "under_review" | "planned" | "done";

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  contact: string | null;
  status: SuggestionStatus;
  /** The platform team's answer, or null. */
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface SuggestionInput {
  /** 3–150 characters. */
  title: string;
  /** 10–4000 characters. */
  description: string;
  category: SuggestionCategory;
  /** How to reach the sender, if not the account's own email. */
  contact?: string | null;
}

export const SUGGESTION_LIMITS = { title: 150, description: 4000, contact: 200 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/suggestions`;

export async function suggestionsList(client: ApiClient, workspaceId: string): Promise<Suggestion[]> {
  const { suggestions } = await client.request<{ suggestions: Suggestion[] }>(base(workspaceId));
  return suggestions;
}

export async function suggestionCreate(client: ApiClient, workspaceId: string, input: SuggestionInput): Promise<Suggestion> {
  const { suggestion } = await client.request<{ suggestion: Suggestion }>(base(workspaceId), { method: "POST", body: input });
  return suggestion;
}
