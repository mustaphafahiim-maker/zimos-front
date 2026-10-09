import { useNavigate, useParams } from "react-router-dom";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { LocationsSection } from "./LocationsSection";
import { TransfersTab } from "./TransfersTab";
import { PurchaseOrdersTab } from "./PurchaseOrdersTab";
import { SuppliersTab } from "./SuppliersTab";
import { StockCountsTab } from "./StockCountsTab";
// Stock forecast (handoff 224) and lots with expiry dates (handoff 230).
import { StockForecastTab } from "./forecast/StockForecastTab";
import { StockLotsTab } from "./lots/StockLotsTab";
// Stock movement history (handoff 389).
import { StockMovementsTab } from "./movements/StockMovementsTab";

/** The URL segment of each tab, and its label key. */
const TABS = [
  { value: "locations", label: "tab_locations" },
  { value: "transfers", label: "tab_transfers" },
  { value: "purchase-orders", label: "tab_purchaseOrders" },
  { value: "suppliers", label: "tab_suppliers" },
  { value: "stock-counts", label: "tab_stockCounts" },
  { value: "forecast", label: "tab_forecast" },
  { value: "lots", label: "tab_lots" },
  { value: "movements", label: "tab_movements" },
] as const;
type TabKey = (typeof TABS)[number]["value"];

/**
 * Products → Inventory (handoff 206/207): where the stock is (locations and
 * transfers between them), what is coming (suppliers and purchase orders) and
 * checking the shelf (stock counts). One tab per URL — /inventory/<tab> — so a
 * tab can be linked to and the browser's Back moves between them.
 *
 * The seven sections are one row of chips that scrolls sideways on a phone;
 * under it each tab is a list on the list pattern (search, chips, cards on a
 * phone and a sheet of rows on a desktop), with its one creation action at the
 * end of its toolbar — above the dock on a phone.
 */
export function InventoryPage() {
  const t = useT(INVENTORY_STRINGS);
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const phone = useIsPhone();
  const { tab } = useParams<{ tab?: string }>();
  const active: TabKey = TABS.find((entry) => entry.value === tab)?.value ?? "locations";
  const chips: ChipItem<TabKey>[] = TABS.map((entry) => ({ value: entry.value, label: t[entry.label] }));

  return (
    <div className="max-w-6xl">
      {/* A phone keeps the first screen for the list: the sentence is for wider screens. */}
      <PageHeader title={t.pageTitle} description={phone ? undefined : t.pageDescription} />
      <ChipRow items={chips} value={active} onChange={(next) => navigate(`/inventory/${next}`)} label={t.tabsLabel} collapseEmpty={false} />

      {/* Keyed on the workspace so switching stores resets every tab's local state. */}
      <div className="pt-4">
        {active === "locations" && <LocationsSection key={workspaceId} />}
        {active === "transfers" && <TransfersTab key={workspaceId} />}
        {active === "purchase-orders" && <PurchaseOrdersTab key={workspaceId} />}
        {active === "suppliers" && <SuppliersTab key={workspaceId} />}
        {active === "stock-counts" && <StockCountsTab key={workspaceId} />}
        {active === "forecast" && <StockForecastTab key={workspaceId} />}
        {active === "lots" && <StockLotsTab key={workspaceId} />}
        {active === "movements" && <StockMovementsTab key={workspaceId} />}
      </div>
    </div>
  );
}
