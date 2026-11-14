import { IconBoxes, IconClock, IconHourglass, IconReceipt, IconReturns, IconRuler, IconTree, type IconComponent } from "@/components/icons";
import { ReportLinks } from "@/components/report";
import { useT } from "@/i18n/LocaleContext";
import { STORE_REPORT_STRINGS, storeReportPath, type StoreReportKey, type StoreReportSlug } from "./storeReportStrings";

const ICONS: Record<StoreReportKey, IconComponent> = {
  tax: IconReceipt,
  orderTimes: IconClock,
  collections: IconTree,
  options: IconRuler,
  returns: IconReturns,
  inventoryValue: IconBoxes,
  slowStock: IconHourglass,
};

/** The side reports by subject: what the merchant is asking about, not the order they were built in. */
const GROUPS: ReadonlyArray<{ title: "groupMoney" | "groupOrders" | "groupStock"; reports: ReadonlyArray<{ slug: StoreReportSlug; key: StoreReportKey }> }> = [
  {
    title: "groupMoney",
    reports: [{ slug: "tax", key: "tax" }],
  },
  {
    title: "groupOrders",
    reports: [
      { slug: "order-times", key: "orderTimes" },
      { slug: "returns", key: "returns" },
    ],
  },
  {
    title: "groupStock",
    reports: [
      { slug: "sales-by-collection", key: "collections" },
      { slug: "sales-by-option", key: "options" },
      { slug: "inventory-value", key: "inventoryValue" },
      { slug: "slow-stock", key: "slowStock" },
    ],
  },
];

/**
 * The side reports as a grid of link cards, one card per subject: each row is
 * a report — its icon, its name, one line on what it answers — and opens its
 * own page.
 */
export function StoreReportsList() {
  const t = useT(STORE_REPORT_STRINGS);
  return (
    <div className="grid min-w-0 items-start gap-[var(--bento-gap)] md:grid-cols-2">
      {GROUPS.map((group) => (
        <ReportLinks
          key={group.title}
          title={t[group.title]}
          items={group.reports.map(({ slug, key }) => ({ to: storeReportPath(slug), title: t[key], description: t[`${key}Hint`], icon: ICONS[key] }))}
        />
      ))}
    </div>
  );
}

/**
 * «تقارير تانية» at the foot of the Reports page: the accounting and stock
 * reports that have their own pages.
 */
export function StoreReportsMenu() {
  const t = useT(STORE_REPORT_STRINGS);
  return (
    <section aria-labelledby="more-reports-title" className="mt-8">
      <h2 id="more-reports-title" className="text-[15px] leading-6 font-semibold text-ink">
        {t.moreReports}
      </h2>
      <p className="mt-0.5 mb-3 text-[13px] leading-5 text-ink-soft">{t.moreReportsHint}</p>
      <StoreReportsList />
    </section>
  );
}
