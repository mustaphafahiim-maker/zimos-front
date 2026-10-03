import type { AdminWorkspaceFeature, PlanFeatureCatalogEntry, PlanFeatureKey } from "@store-builder/api-client";

/**
 * The feature catalogue lives in the backend (billing/featureCatalog.js) and
 * reaches the console with the plans (`GET /admin/plans` → featureCatalog) and
 * with a store's features (`GET /admin/workspaces/:id/features`). There is no
 * list of keys or names here: these helpers only read what the API sent.
 */

/** A feature's console name from the catalogue the page loaded; the key itself if it isn't there. */
export function featureLabelIn(catalog: readonly PlanFeatureCatalogEntry[] | undefined, key: string): string {
  return catalog?.find((f) => f.key === key)?.label.en ?? key;
}

/** The catalogue as a store's feature table carries it (a server from before the catalogue sends no names). */
export function catalogFromFeatureTable(features: readonly AdminWorkspaceFeature[]): PlanFeatureCatalogEntry[] {
  return features.map((f) => ({
    key: f.key as PlanFeatureKey,
    type: "boolean",
    available: f.available ?? true,
    label: f.label ?? { en: f.key, ar: f.key },
  }));
}
