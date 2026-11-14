import type { ReactNode } from "react";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Page performance",
    description: "Each page's visits, how many moved on (CTR), and how many did what the page is for (CR): ordered on a checkout or sales page, took the offer on an upsell, signed up on an opt-in.",
    page: "Page",
    visits: "Visits",
    views: "Page views",
    ctr: "CTR",
    cr: "CR",
    optIns: "Opt-ins",
  },
  ar: {
    title: "أداء الصفحات",
    description: "زيارات كل صفحة، وكام واحد كمّل بعدها (نسبة النقر)، وكام واحد عمل اللي الصفحة معمولة له (نسبة التحويل): طلب في صفحة الدفع أو البيع، قبل العرض في الـ upsell، سجّل في صفحة جمع البيانات.",
    page: "الصفحة",
    visits: "الزيارات",
    views: "مشاهدات الصفحة",
    ctr: "نسبة النقر",
    cr: "نسبة التحويل",
    optIns: "التسجيلات",
  },
} satisfies Messages;

export type StepPerformance = {
  key: string;
  name: string;
  visits?: number;
  views?: number;
  ctr?: number | null;
  cr?: number | null;
  optIns?: number | null;
};

/** The funnel's "Page performance" table (funnel analytics: analytics/funnelStepMetrics.js). */
export function FunnelPagePerformance({
  steps,
  count,
  percent,
}: {
  steps: StepPerformance[];
  count: (n: number) => ReactNode;
  percent: (v: number | null) => ReactNode;
}) {
  const t = useT(STRINGS);
  if (!steps.some((s) => s.visits !== undefined)) return null;
  const dash = <span className="text-ink-soft">—</span>;
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5 lg:col-span-2">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line text-start text-xs text-ink-soft">
              <th scope="col" className="py-2 pe-3 text-start font-medium">{t.page}</th>
              <th scope="col" className="py-2 pe-3 text-end font-medium">{t.visits}</th>
              <th scope="col" className="py-2 pe-3 text-end font-medium">{t.views}</th>
              <th scope="col" className="py-2 pe-3 text-end font-medium">{t.ctr}</th>
              <th scope="col" className="py-2 pe-3 text-end font-medium">{t.cr}</th>
              <th scope="col" className="py-2 text-end font-medium">{t.optIns}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.key} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pe-3 text-start font-normal text-ink" dir="auto">
                  {s.name}
                </th>
                <td className="py-2 pe-3 text-end tabular-nums">{count(s.visits ?? 0)}</td>
                <td className="py-2 pe-3 text-end tabular-nums">{count(s.views ?? 0)}</td>
                <td className="py-2 pe-3 text-end tabular-nums">{s.ctr == null ? dash : percent(s.ctr)}</td>
                <td className="py-2 pe-3 text-end tabular-nums">{s.cr == null ? dash : percent(s.cr)}</td>
                <td className="py-2 text-end tabular-nums">{s.optIns == null ? dash : count(s.optIns)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
