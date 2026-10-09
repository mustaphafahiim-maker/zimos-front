import { IconBoxes, IconClipboard, IconClock, IconGift, IconHourglass, IconReceipt, IconReturns, IconRuler, IconTree, type IconComponent } from "@/components/icons";
import { ReportLinks, type ReportLinkItem } from "@/components/report";
import { useT } from "@/i18n/LocaleContext";
import { SURVEY_RESULTS_PATH, SURVEY_STRINGS } from "@/pages/survey/surveyStrings";
import { STORE_REPORT_STRINGS, storeReportPath, type StoreReportKey, type StoreReportSlug } from "./storeReportStrings";

const ICONS: Record<StoreReportKey, IconComponent> = {
  tax: IconReceipt,
  orderTimes: IconClock,
  collections: IconTree,
  options: IconRuler,
  returns: IconReturns,
  inventoryValue: IconBoxes,
  slowStock: IconHourglass,
  cartOffers: IconGift,
};

/** The side reports by subject: what the merchant is asking about, not the order they were built in. */
const GROUPS: ReadonlyArray<{ title: "groupMoney" | "groupOrders" | "groupStock"; reports: ReadonlyArray<{ slug: StoreReportSlug; key: StoreReportKey }> }> = [
  {
    title: "groupMoney",
    reports: [
      { slug: "tax", key: "tax" },
      { slug: "cart-offers", key: "cartOffers" },
    ],
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
 * own page. The survey results, which have no entry in the side menu, close
 * the grid.
 */
export function StoreReportsList() {
  const t = useT(STORE_REPORT_STRINGS);
  const survey = useT(SURVEY_STRINGS);
  const customers: ReportLinkItem[] = [
    { to: `${SURVEY_RESULTS_PATH}?range=90d`, title: survey.resultsTitle, description: survey.resultsHint, icon: IconClipboard },
  ];
  return (
    <div className="grid min-w-0 items-start gap-[var(--bento-gap)] md:grid-cols-2">
      {GROUPS.map((group) => (
        <ReportLinks
          key={group.title}
          title={t[group.title]}
          items={group.reports.map(({ slug, key }) => ({ to: storeReportPath(slug), title: t[key], description: t[`${key}Hint`], icon: ICONS[key] }))}
        />
      ))}
      <ReportLinks title={t.groupCustomers} items={customers} />
    </div>
  );
}

/**
 * «تقارير تانية» at the foot of the Reports page: the accounting and stock
 * reports that have their own pages (handoff 238–242, 245–247, 256).
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
