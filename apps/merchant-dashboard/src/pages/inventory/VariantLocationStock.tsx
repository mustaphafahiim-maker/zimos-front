import { Link } from "react-router-dom";
import { BY_VARIANT_MAX_IDS, stockLocationsByVariant, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";
import { formatOptions } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { IconInventory } from "@/components/icons";
import { ProductPageCard } from "@/pages/catalog/components/ProductPageCard";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { num } from "./inventoryText";

/**
 * The product page's «المخزون في كل مخزن» / "Stock by location" (handoff 206,
 * GET /stock-locations/by-variant): under each variant, what every location
 * has on hand and what its orders hold there; a location with more reserved
 * than on hand says «محتاج نقل مخزون».
 *
 * Nothing is drawn for a store with fewer than two locations (the split would
 * only repeat the variant's own stock), without `inventory.view`, or when the
 * counts can't be read — the variants table above already shows the totals.
 */
export function VariantLocationStock({ variants }: { variants: Variant[] }) {
  const t = useT(INVENTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const active = variants.filter((v) => v.status === "active");
  const ids = active.slice(0, BY_VARIANT_MAX_IDS).map((v) => v.id);
  // Read again when a variant's stock changes on this page (an edit, a restock).
  const stamp = active.map((v) => `${v.id}:${v.stockOnHand}:${v.reservedStock}`).join(",");
  // A role known to lack `inventory.view` is not sent to a read that would refuse it.
  const canView = !NO_INVENTORY_ROLES.has(currentWorkspace?.role ?? "");
  const counts = useAsync(
    () => (canView ? stockLocationsByVariant(apiClient, workspaceId, ids).catch(() => []) : Promise.resolve([])),
    [workspaceId, stamp, canView]
  );

  const byVariant = new Map((counts.data ?? []).map((entry) => [entry.variantId, entry.locations]));
  const locationCount = counts.data?.[0]?.locations.length ?? 0;
  if (locationCount < 2) return null;

  return (
    <ProductPageCard title={t.byLocationTitle} description={t.byLocationDescription} icon={IconInventory}>
      <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
        {active.slice(0, BY_VARIANT_MAX_IDS).map((variant) => {
          const locations = byVariant.get(variant.id);
          if (!locations) return null;
          return (
            <li key={variant.id} className="px-3 py-3">
              <p className="text-sm font-medium text-ink">
                <bdi>{formatOptions(variant.optionValues) || variant.sku || t.singleVariant}</bdi>
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {locations.map((location) => (
                  <li key={location.locationId} className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-ink">
                        <bdi>{location.name}</bdi>
                      </span>
                      <bdi dir="ltr" className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                        {num(location.onHand)}
                      </bdi>
                    </div>
                    {(location.reserved > 0 || location.available < 0) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        {location.reserved > 0 && <span>{fmt(t.reservedNote, { n: location.reserved })}</span>}
                        {location.available < 0 && <StatusBadge value="needs_transfer" tone="danger" text={t.needsTransfer} />}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {active.length > BY_VARIANT_MAX_IDS ? (
          <p className="text-xs text-ink-soft">{fmt(t.moreVariants, { n: BY_VARIANT_MAX_IDS })}</p>
        ) : (
          <span />
        )}
        <Link to="/inventory/locations" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
          {t.manageLocations}
        </Link>
      </div>
    </ProductPageCard>
  );
}
