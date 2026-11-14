import type { PlanFeatureKey } from "@store-builder/api-client";
import { planFeatureGated, planFeatureHeld, workspacePlanFeatures } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";

/**
 * The current store's plan features (GET /workspaces/:id/plan-features), for
 * a screen that shows itself locked before the server refuses a write.
 *
 * Until the answer is in — and if it never comes — nothing is locked: the
 * screen looks as it always did and the server still refuses what it must,
 * which the usual error message then explains.
 */
export function usePlanFeatures() {
  const workspaceId = useWorkspaceId();
  const state = useAsync(() => workspacePlanFeatures(apiClient, workspaceId), [workspaceId]);
  return {
    loading: state.loading,
    /** A gated write would be refused: the gate is on and the key is missing. */
    gated: (key: PlanFeatureKey) => (state.data ? planFeatureGated(state.data, key) : false),
    /** The store holds the key; for a benefit that follows the keys alone. */
    held: (key: PlanFeatureKey) => (state.data ? planFeatureHeld(state.data, key) : true),
  };
}
