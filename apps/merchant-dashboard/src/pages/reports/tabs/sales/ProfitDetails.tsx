import { profitPerOrderFeeOf } from "@store-builder/api-client";
import { useMemo, useState } from "react";
import type { ProfitRow, ProfitStatement } from "@store-builder/api-client";
import { ReportTable, type ReportColumn } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatAxisDate, formatCount, percentToRatio } from "@/lib/analytics";
import { formatPercentValue } from "@/lib/format";
import { ProfitBarsChart } from "./ProfitBarsChart";
import { AmountList, Fact, Num, fill, useSalesMoney, type AmountRow } from "./SalesParts";
import { outOf, statementCosts, type ProfitAnswer, type ProfitReading, type ProfitVersion } from "./salesData";
import { SALES_STRINGS, type SalesKey } from "./salesStrings";

type CostKey = "goods" | "shipping" | "fees" | "ads" | "zimos";

const COST_LABEL: Record<CostKey, SalesKey> = {
  goods: "costGoods",
  shipping: "costShipping",
  fees: "costFees",
  ads: "costAds",
  zimos: "costZimos",
};

const LINK =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold text-primary ring-1 ring-line-strong transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/**
 * «الربح بالتفصيل» — everything the old profit page (pages/profit/RealProfitPage.tsx)
 * showed for the whole store: the actual / projected switch and its hint, the
 * answer in words (what was kept, and the biggest cost), margin, the most an ad
 * may cost per order, the delivery rate, the statement from delivered revenue
 * down to net profit, net profit per day as a chart, and the same per day as a
 * table. It reads the P&L the tab already loaded for its KPI — no request of
 * its own. The per-product and per-campaign views stay on `/profit`.
 *
 * Under the cost-coverage floor (`reading.state === "floor"`) nothing here is
 * called profit: the statement stops at "left before product cost", and the
 * margin, the ad ceiling and the per-day figures are left out.
 */
export function ProfitDetails({
  answer,
  reading,
  range,
}: {
  answer: ProfitAnswer;
  reading: ProfitReading;
  range: { fromDay: string; toDay: string };
}) {
  const t = useT(SALES_STRINGS);
  const { pnl } = answer;
  const { money, signed, major } = useSalesMoney(pnl.currency);
  // Opens on the statement the KPI above shows.
  const [version, setVersion] = useState<ProfitVersion>(reading.version);
  const totals = pnl.totals;
  const statement = totals[version];
  const floor = reading.state === "floor";
  const percent = (value: number | null) => formatPercentValue(percentToRatio(value));

  const hint =
    version === "actual"
      ? t.actualHint
      : pnl.projectionDeliveryRate === null
        ? t.projectedNoHistory
        : fmt(t.projectedHint, { rate: percent(pnl.projectionDeliveryRate) });

  // Every cost the page lets the merchant set is zero: the profit is flattered until they are entered.
  const noCosts = statement.revenue > 0 && statement.shipping === 0 && statement.fees === 0;

  const statementRows: AmountRow[] = [
    { key: "revenue", label: t.stRevenue, value: money(statement.revenue), strong: false },
    floor
      ? { key: "goods", label: t.stGoodsMissing, value: t.stMissing, muted: true }
      : { key: "goods", label: t.stGoods, value: signed(-statement.costOfGoods) },
    { key: "shipping", label: t.stShipping, value: signed(-statement.shipping) },
    { key: "return", label: t.stReturn, value: signed(-statement.returnShipping) },
    { key: "fees", label: t.stFees, value: signed(-statement.fees) },
    { key: "ads", label: t.stAds, value: signed(-statement.adSpend) },
    // handoff 397: a pay-per-order store pays ZIMOS from its prepaid balance, not by percentage.
    { key: "zimos", label: t.stZimos, sub: profitPerOrderFeeOf(pnl) ? t.stZimosPerOrder : undefined, value: signed(-statement.zimosFees) },
    floor
      ? { key: "net", label: t.stBeforeCost, value: signed(statement.netProfit + statement.costOfGoods), strong: true }
      : {
          key: "net",
          label: t.stNet,
          value: signed(statement.netProfit),
          strong: true,
          tone: statement.netProfit < 0 ? "bad" : "good",
        },
  ];

  const days = pnl.rows;
  const chartPoints = useMemo(
    () => days.map((row) => ({ label: formatAxisDate(row.key), value: row[version].netProfit })),
    [days, version]
  );
  const chartFlat = chartPoints.every((point) => point.value === 0);

  const columns = useMemo<ReportColumn<ProfitRow>[]>(() => {
    const of = (row: ProfitRow): ProfitStatement => row[version];
    return [
      {
        key: "day",
        header: t.colDay,
        cell: (row) => formatAxisDate(row.key),
        sortValue: (row) => Date.parse(row.key),
        csv: (row) => row.key,
      },
      {
        key: "net",
        header: t.colNet,
        align: "end",
        cell: (row) => (
          <bdi dir="ltr" className={of(row).netProfit < 0 ? "font-medium text-danger" : "font-medium"}>
            {signed(of(row).netProfit)}
          </bdi>
        ),
        sortValue: (row) => of(row).netProfit,
        csv: (row) => major(of(row).netProfit),
      },
      {
        key: "margin",
        header: t.colMargin,
        hint: t.marginHint,
        align: "end",
        cell: (row) => percent(of(row).margin),
        sortValue: (row) => of(row).margin,
        csv: (row) => of(row).margin,
      },
      {
        key: "revenue",
        header: t.colRevenue,
        align: "end",
        cell: (row) => money(of(row).revenue),
        sortValue: (row) => of(row).revenue,
        csv: (row) => major(of(row).revenue),
      },
      {
        key: "costs",
        header: t.colCosts,
        hint: t.colCostsHint,
        align: "end",
        cell: (row) => money(statementCosts(of(row))),
        sortValue: (row) => statementCosts(of(row)),
        csv: (row) => major(statementCosts(of(row))),
      },
      {
        key: "ads",
        header: t.colAds,
        align: "end",
        cell: (row) => money(of(row).adSpend),
        sortValue: (row) => of(row).adSpend,
        csv: (row) => major(of(row).adSpend),
      },
      {
        key: "delivered",
        header: t.colDeliveredOrders,
        align: "end",
        cell: (row) => formatCount(Math.round(row.orders.delivered)),
        sortValue: (row) => row.orders.delivered,
        csv: (row) => Math.round(row.orders.delivered),
      },
      {
        key: "returned",
        header: t.colReturnedOrders,
        align: "end",
        cell: (row) => formatCount(Math.round(row.orders.returned)),
        sortValue: (row) => row.orders.returned,
        csv: (row) => Math.round(row.orders.returned),
      },
    ];
    // `money`, `signed` and `major` change together, with the report currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, version, money]);

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Segmented
            size="sm"
            value={version}
            onChange={setVersion}
            label={t.versionLabel}
            options={[
              { value: "actual", label: t.actual },
              { value: "projected", label: t.projected },
            ]}
          />
          <p className="min-w-0 flex-1 basis-56 text-[13px] leading-5 text-pretty text-ink-soft">{hint}</p>
        </div>

        {floor ? (
          <p className="text-[15px] leading-6 font-semibold text-pretty text-ink">{t.noRealProfit}</p>
        ) : (
          <ProfitAnswerLines statement={statement} money={money} />
        )}

        {noCosts && (
          <div role="note" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 basis-56 text-[13px] leading-5 text-pretty text-ink-soft">{t.noCostsSet}</p>
            <ViewLink to="/profit/costs" className={LINK}>
              {t.setCosts}
            </ViewLink>
          </div>
        )}
        {!floor && reading.incomplete && reading.coverage !== null && (
          <p role="note" className="text-[13px] leading-5 text-pretty text-ink-soft">
            {fill(t.coveragePartial, { pct: <Num>{formatPercentValue(reading.coverage / 100, 0)}</Num> })}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {!floor && <Fact label={t.margin} value={percent(statement.margin)} hint={t.marginHint} />}
          {!floor && <Fact label={t.maxCpa} value={totals.maxCpa === null ? "—" : money(totals.maxCpa)} hint={t.maxCpaHint} />}
          <Fact
            label={t.deliveryRate}
            value={percent(totals.deliveryRate)}
            hint={fmt(t.deliveryCounts, {
              delivered: formatCount(Math.round(totals.orders.delivered)),
              returned: formatCount(Math.round(totals.orders.returned)),
              open: formatCount(Math.round(totals.orders.open)),
            })}
          />
        </dl>

        <div>
          <h4 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.statement}</h4>
          <AmountList rows={statementRows} className="mt-1" />
        </div>

        {!floor && (
          <div>
            <h4 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.perDay}</h4>
            {chartFlat ? (
              <p className="mt-2 text-sm leading-6 text-ink-soft">{t.perDayEmpty}</p>
            ) : (
              <>
                <p className="text-xs leading-5 text-ink-soft">{t.perDayNote}</p>
                <ProfitBarsChart points={chartPoints} format={signed} height={180} summary={t.perDay} className="mt-2" />
              </>
            )}
          </div>
        )}
      </div>

      {!floor && (
        <div className="border-t border-line">
          <ReportTable
            embedded
            columns={columns}
            rows={days}
            rowKey={(row) => row.key || "none"}
            defaultSort={{ key: "day", dir: "desc" }}
            exportName="zimos-profit-by-day"
            range={range}
            caption={t.dayTable}
            empty={t.dayEmpty}
            pageSize={7}
          />
        </div>
      )}
    </>
  );
}

/** The old page's answer: what was kept (or lost), and the biggest cost as a share of sales. */
function ProfitAnswerLines({ statement, money }: { statement: ProfitStatement; money: (minor: number) => string }) {
  const t = useT(SALES_STRINGS);
  if (statement.revenue <= 0) return <p className="text-[15px] leading-6 text-pretty text-ink-soft">{t.answerNone}</p>;

  const costs: Record<CostKey, number> = {
    goods: statement.costOfGoods,
    shipping: statement.shipping + statement.returnShipping,
    fees: statement.fees,
    ads: statement.adSpend,
    zimos: statement.zimosFees,
  };
  const biggest = (Object.keys(costs) as CostKey[]).reduce((a, b) => (costs[b] > costs[a] ? b : a));
  const loss = statement.netProfit < 0;
  const kept = outOf((Math.max(0, statement.netProfit) / statement.revenue) * 100);
  const eaten = outOf((costs[biggest] / statement.revenue) * 100);

  return (
    <div>
      <p className={loss ? "text-[15px] leading-6 font-semibold text-pretty text-danger" : "text-[15px] leading-6 font-semibold text-pretty text-ink"}>
        {fill(loss ? t.answerDown : t.answerUp, {
          amount: <Num>{money(Math.abs(statement.netProfit))}</Num>,
          n: fmt("{n}", { n: kept.n }),
          of: fmt("{n}", { n: kept.of }),
        })}
      </p>
      {costs[biggest] > 0 && (
        <p className="mt-1 text-sm leading-6 text-pretty text-ink">
          {fill(t.answerBiggest, {
            cost: t[COST_LABEL[biggest]],
            n: fmt("{n}", { n: eaten.n }),
            of: fmt("{n}", { n: eaten.of }),
          })}
        </p>
      )}
    </div>
  );
}
