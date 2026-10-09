import type { ComponentType } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useT } from "@/i18n/LocaleContext";
import { CartOffersReport } from "./CartOffersReport";
import { InventoryValueReport } from "./InventoryValueReport";
import { OrderTimesReport } from "./OrderTimesReport";
import { ReturnsReport } from "./ReturnsReport";
import { SalesByCollectionReport } from "./SalesByCollectionReport";
import { SalesByOptionReport } from "./SalesByOptionReport";
import { SlowStockReport } from "./SlowStockReport";
import { StoreReportsList } from "./StoreReportsMenu";
import { STORE_REPORT_STRINGS, type StoreReportSlug } from "./storeReportStrings";
import { TaxReport } from "./TaxReport";

const REPORTS: Record<StoreReportSlug, ComponentType> = {
  tax: TaxReport,
  "order-times": OrderTimesReport,
  "sales-by-collection": SalesByCollectionReport,
  "sales-by-option": SalesByOptionReport,
  returns: ReturnsReport,
  "inventory-value": InventoryValueReport,
  "slow-stock": SlowStockReport,
  "cart-offers": CartOffersReport,
};

/**
 * /analytics/reports and /analytics/reports/:report — the store reports
 * (handoff 238–242, 245–247, 256). Without a name it lists them by subject;
 * with one it is that report's page. One route and one chunk for the family.
 */
export function StoreReportPage() {
  const t = useT(STORE_REPORT_STRINGS);
  const { report } = useParams<{ report?: string }>();
  const phone = useMediaQuery(PHONE_QUERY);

  if (!report) {
    return (
      <div className="min-w-0 max-w-5xl">
        {/* A phone keeps the first screen for the list: the sentence is for wider screens. */}
        <PageHeader title={t.moreReports} description={phone ? undefined : t.moreReportsHint} back={{ to: "/analytics", label: t.back }} />
        <StoreReportsList />
      </div>
    );
  }

  const Report = Object.prototype.hasOwnProperty.call(REPORTS, report) ? REPORTS[report as StoreReportSlug] : null;
  // The key gives each report its own state when the address moves from one to another.
  return Report ? <Report key={report} /> : <NotFoundPage />;
}
