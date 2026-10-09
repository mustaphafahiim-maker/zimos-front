import { useEffect, useId, useState } from "react";
import { IconPlace } from "@/components/icons";
import {
  orderStockLocationSet,
  stockLocationsList,
  type Order,
  type OrderStockLocationField,
  type StockLocation,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { NO_INVENTORY_ROLES, canManageOrders } from "@/lib/inventoryAccess";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CardFrame } from "@/pages/orders/detail/CardFrame";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { INVENTORY_STRINGS } from "./inventoryStrings";

/**
 * The order page's «بيتشحن من» / "Ships from" (handoff 206): the location the
 * order's items leave from, chosen from the store's locations
 * (PUT /stock-locations/orders/:orderId, orders.manage). A new order is
 * assigned on its own — the first active location, by priority, that has
 * every line — so this is for moving it.
 *
 * Nothing is drawn for a store with fewer than two locations (there is
 * nothing to choose), or when the locations can't be read (no
 * `inventory.view`).
 */
export function OrderShipsFrom({ order, onChanged, frameless }: { order: Order; onChanged: () => void; /** Inside a folding section of the order page: no card and no title of its own. */ frameless?: boolean }) {
  const t = useT(INVENTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canChange = canManageOrders(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const selectId = useId();
  const hintId = useId();
  const [saving, setSaving] = useState(false);
  // What was just chosen, shown until the reloaded order carries it.
  const [chosen, setChosen] = useState<string | null>(null);
  const orderLocationId = (order as Order & OrderStockLocationField).stockLocationId ?? null;
  useEffect(() => {
    setChosen(null);
  }, [orderLocationId]);

  // A role known to lack `inventory.view` is not sent to a list that would refuse it.
  const canView = !NO_INVENTORY_ROLES.has(currentWorkspace?.role ?? "");
  const list = useAsync(
    () =>
      canView
        ? stockLocationsList(apiClient, workspaceId)
            .then((r) => r.locations)
            .catch(() => [] as StockLocation[])
        : Promise.resolve([] as StockLocation[]),
    [workspaceId, canView]
  );
  const locations = list.data ?? [];
  if (locations.length < 2) return null;

  const defaultLocation = locations.find((l) => l.isDefault) ?? null;
  // An order without a location of its own ships from the default.
  const saved = orderLocationId ?? defaultLocation?.id ?? "";
  const current = chosen ?? saved;
  // Locations that are off stay out of the choices, except the one the order is on now.
  const choices = locations.filter((l) => l.isActive || l.id === current);
  const label = (l: StockLocation) => (!l.isActive ? fmt(t.shipsFromOff, { name: l.name }) : l.isDefault ? fmt(t.shipsFromDefault, { name: l.name }) : l.name);

  async function change(locationId: string) {
    if (!locationId || locationId === current) return;
    setSaving(true);
    setChosen(locationId);
    try {
      const { location } = await orderStockLocationSet(apiClient, workspaceId, order.id, locationId);
      toast.success(fmt(t.shipsFromSaved, { name: location.name }));
      onChanged();
    } catch (err) {
      setChosen(null);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CardFrame frameless={frameless} title={t.shipsFrom}>
      <div className="flex items-center gap-2">
        <IconPlace className="size-4 shrink-0 text-ink-soft" aria-hidden />
        <label htmlFor={selectId} className="sr-only">
          {t.shipsFrom}
        </label>
        <Select
          id={selectId}
          className="h-11"
          value={current}
          disabled={saving || !canChange}
          aria-describedby={hintId}
          onChange={(e) => void change(e.target.value)}
        >
          {choices.map((l) => (
            <option key={l.id} value={l.id}>
              {label(l)}
            </option>
          ))}
        </Select>
      </div>
      <p id={hintId} className="mt-2 text-xs text-ink-soft">
        {canChange ? t.shipsFromHint : t.shipsFromViewOnly}
      </p>
    </CardFrame>
  );
}
