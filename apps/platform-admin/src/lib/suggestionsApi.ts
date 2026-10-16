import { apiClient } from "@/lib/apiClient";

/** Merchants' suggestions (backend modules/suggestions): support.view to read, support.manage to answer. */
export type SuggestionStatus = "new" | "under_review" | "planned" | "done";
export type SuggestionCategory = "feature" | "bug" | "improvement";

export const SUGGESTION_STATUSES: SuggestionStatus[] = ["new", "under_review", "planned", "done"];
export const SUGGESTION_CATEGORIES: SuggestionCategory[] = ["feature", "bug", "improvement"];

export interface AdminSuggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  contact: string | null;
  status: SuggestionStatus;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name?: string; slug?: string };
  user: { id: string; fullName: string | null; email: string } | null;
}

export interface SuggestionPage {
  suggestions: AdminSuggestion[];
  total: number;
  counts: Record<SuggestionStatus, number>;
}

export async function listSuggestions(params: { status?: SuggestionStatus; category?: SuggestionCategory; q?: string; offset?: number; limit?: number }) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") search.set(k, String(v));
  const qs = search.toString();
  return apiClient.request<SuggestionPage>(`/admin/suggestions${qs ? `?${qs}` : ""}`);
}

export async function updateSuggestion(id: string, body: { status?: SuggestionStatus; adminReply?: string | null }) {
  return (await apiClient.request<{ suggestion: AdminSuggestion }>(`/admin/suggestions/${id}`, { method: "PATCH", body })).suggestion;
}
