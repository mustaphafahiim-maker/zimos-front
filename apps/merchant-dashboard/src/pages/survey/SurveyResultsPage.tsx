import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  surveyReport,
  surveySettingsGet,
  type SurveyReportChoice,
  type SurveyReportQuestion,
  type SurveyReportScore,
  type SurveyReportText,
} from "@store-builder/api-client";
import { EmptyState } from "@/components/EmptyState";
import { IconClipboard, IconMessage, IconMoreReports, IconSliders, IconStar, IconTrendUp } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { ReportKpiStrip, ReportLinks, ReportTab, ReportTabState, ReportTakeaway } from "@/components/report";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { formatCount, formatWindow } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatDate, formatPercentValue } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { resolveReportRange, useReport, useReportRange, type ReportPreset } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { SplitBar } from "@/pages/analytics/reports/parts";
import { StoreReportCard, StoreReportRangeBar, type StoreReportRangeState } from "@/pages/analytics/storeReports/storeReportParts";
import { STORE_REPORT_STRINGS, STORE_REPORTS_INDEX } from "@/pages/analytics/storeReports/storeReportStrings";
import { REPORT_TAB_LABELS, REPORT_TAB_PATHS } from "@/pages/reports/reportTabs";
import { SURVEY_SETTINGS_PATH, SURVEY_STRINGS, surveyTextOf, type SurveyStrings } from "./surveyStrings";

/** The window the page opens on when its address names none: the API's own default. */
const DEFAULT_RANGE = "range=90d";

/** The parts of the page share one column and one gap, like a tab of the reports hub. */
const COLUMN = "flex min-w-0 flex-col gap-[var(--bento-gap)]";

/**
 * Analytics → Survey results (frontend-handoff 236, orders.view): what
 * shoppers answered on the thank-you page in a date range, on the report kit —
 * the question as the heading, the responses (and the first score's average
 * and NPS) as stat cards, then a card per question: a bar per option of a
 * choice (and what they wrote under "other"), the average and NPS of a score
 * with how the scores spread, the latest texts each with its order. The
 * questions are the survey's own as they are now; the range lives in the
 * address like the other reports'.
 */
export function SurveyResultsPage() {
  const t = useT(SURVEY_STRINGS);
  const c = useT(STORE_REPORT_STRINGS);
  const tabs = useT(REPORT_TAB_LABELS);
  const workspaceId = useWorkspaceId();
  const phone = useMediaQuery(PHONE_QUERY);
  const [params, setParams] = useSearchParams();
  const picked = useReportRange();
  const fallback = useMemo(() => resolveReportRange(new URLSearchParams(DEFAULT_RANGE)), []);
  const range = params.has("range") || params.has("from") ? picked.range : fallback;

  const state = useReport(
    async () => {
      const [report, settings] = await Promise.all([
        surveyReport(apiClient, workspaceId, { from: range.from, to: range.to }),
        surveySettingsGet(apiClient, workspaceId),
      ]);
      return { report, settings };
    },
    [workspaceId, range.from, range.to]
  );

  /** The shared range hook reads "no range" as its own 30 days; here that means 90, so 30 is always written out. */
  function choosePreset(preset: ReportPreset) {
    if (preset === "custom") return picked.setDays(range.fromDay, range.toDay);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("from");
        next.delete("to");
        next.set("range", preset);
        return next;
      },
      { replace: true }
    );
  }

  // The period control of the side reports (44px under a thumb), fed by this page's own range.
  const rangeBar: StoreReportRangeState = {
    preset: range.preset,
    fromDay: range.fromDay,
    toDay: range.toDay,
    invalid: false,
    days: { from: range.fromDay, to: range.toDay },
    setPreset: choosePreset,
    // A start after the end would fall back to another window: it waits in the field instead.
    setDays: (fromDay, toDay) => {
      if (fromDay <= toDay) picked.setDays(fromDay, toDay);
    },
  };

  const data = state.data;
  const denied = isPermissionError(state.error);
  const hasSurvey = (data?.settings.questions.length ?? 0) > 0;
  const firstScore = data?.report.questions.find((question): question is SurveyReportScore => question.type === "score" && question.answers > 0);
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(getIntlLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  return (
    <div className="min-w-0 max-w-4xl">
      <PageHeader
        title={t.resultsTitle}
        description={phone ? undefined : fmt(t.resultsDescription, { window: formatWindow(range.from, range.to) })}
        // The customers tab of the reports hub is where the link to this page lives.
        back={{ to: REPORT_TAB_PATHS.customers, label: tabs.customers }}
        actions={
          <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-4 pointer-fine:h-10">
            <ViewLink to={SURVEY_SETTINGS_PATH}>
              <IconSliders className="size-4" aria-hidden />
              {t.editQuestions}
            </ViewLink>
          </Button>
        }
      />

      {!denied && (
        <div className="mb-4">
          <StoreReportRangeBar range={rangeBar} />
        </div>
      )}

      <ReportTab question={t.resultsQuestion} note={denied ? undefined : t.resultsHint}>
        <ReportTabState loading={state.loading && !data} error={state.error} onRetry={state.reload}>
          {data &&
            (!hasSurvey ? (
              <EmptyState
                icon={<IconClipboard aria-hidden />}
                tone="attention"
                title={t.notSetTitle}
                description={t.notSetHint}
                action={
                  <Button asChild className="min-h-11 rounded-full px-5">
                    <ViewLink to={SURVEY_SETTINGS_PATH}>{t.setUp}</ViewLink>
                  </Button>
                }
              />
            ) : (
              <div
                aria-busy={state.loading || undefined}
                className={cn(COLUMN, "transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", state.loading && "opacity-60")}
              >
                {!data.settings.enabled && <ReportTakeaway tone="warn" action={{ label: t.editQuestions, to: SURVEY_SETTINGS_PATH }}>{t.surveyOff}</ReportTakeaway>}

                <ReportKpiStrip sparkline={false}>
                  <KpiCard label={t.responses} value={formatCount(data.report.responses)} hint={t.responsesHint} icon={<IconMessage />} />
                  {firstScore && firstScore.average !== null && (
                    <KpiCard
                      label={t.average}
                      value={
                        <>
                          {number(firstScore.average, 1)} <span className="text-sm font-normal text-ink-soft">{fmt(t.outOf, { max: 10 })}</span>
                        </>
                      }
                      hint={t.scoreKpiHint}
                      icon={<IconStar />}
                    />
                  )}
                  {firstScore && firstScore.nps !== null && (
                    <KpiCard label={t.nps} value={number(firstScore.nps, 0)} hint={t.npsHint} icon={<IconTrendUp />} />
                  )}
                </ReportKpiStrip>

                {data.report.responses === 0 ? (
                  <EmptyState
                    icon={<IconMessage aria-hidden />}
                    title={t.emptyTitle}
                    description={t.emptyHint}
                    action={
                      range.preset === "12m" ? undefined : (
                        <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => choosePreset("12m")}>
                          {t.showPeriod}
                        </Button>
                      )
                    }
                  />
                ) : (
                  <section aria-label={t.questionsLabel} className={COLUMN}>
                    {data.report.questions.map((question) => (
                      <QuestionResult key={question.id} question={question} t={t} />
                    ))}
                  </section>
                )}
              </div>
            ))}
        </ReportTabState>

        <ReportLinks
          items={[
            { to: SURVEY_SETTINGS_PATH, title: t.editQuestions, description: t.settingsHint, icon: IconSliders },
            { to: STORE_REPORTS_INDEX, title: c.moreReports, description: c.moreReportsHint, icon: IconMoreReports },
          ]}
        />
      </ReportTab>
    </div>
  );
}

function QuestionResult({ question, t }: { question: SurveyReportQuestion; t: SurveyStrings }) {
  return (
    <StoreReportCard title={surveyTextOf(question.text) || "—"} note={pluralOf(t, "answers", question.answers)}>
      {question.answers === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">{t.noAnswers}</p>
      ) : question.type === "choice" ? (
        <ChoiceResult question={question} t={t} />
      ) : question.type === "score" ? (
        <ScoreResult question={question} t={t} />
      ) : (
        <TextResult question={question} t={t} />
      )}
    </StoreReportCard>
  );
}

/** One bar per option, as a share of the shoppers who answered the question; "other" last, with what they wrote. */
function ChoiceResult({ question, t }: { question: SurveyReportChoice; t: SurveyStrings }) {
  const rows = [
    ...question.options.map((option) => ({ key: option.id, label: surveyTextOf(option.label) || "—", count: option.count })),
    ...(question.other > 0 ? [{ key: "*other", label: t.other, count: question.other }] : []),
  ];
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {rows.map((row) => {
          const share = question.answers > 0 ? row.count / question.answers : 0;
          return (
            <li key={row.key} title={`${row.label}: ${formatCount(row.count)} (${formatPercentValue(share)})`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">
                  <bdi>{row.label}</bdi>
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="font-semibold text-ink">{formatCount(row.count)}</span>
                  <bdi dir="ltr" className="w-12 text-end text-xs text-ink-soft">
                    {formatPercentValue(share)}
                  </bdi>
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-sunken">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {question.otherTexts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink-soft">{t.otherTexts}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {question.otherTexts.map((text, i) => (
              <li key={i} className="max-w-full rounded-2xl bg-paper-sunken px-3 py-1 text-sm leading-6 text-ink">
                <bdi className="wrap-anywhere">{text}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The average and the NPS as figures, the three NPS groups as one split bar, and how the scores spread from 0 to 10. */
function ScoreResult({ question, t }: { question: SurveyReportScore; t: SurveyStrings }) {
  const locale = getIntlLocale();
  const spread = Array.from({ length: 11 }, (_, score) => question.distribution[score] ?? 0);
  const peak = Math.max(1, ...spread);
  const sum = (from: number, to: number) => spread.slice(from, to + 1).reduce((total, n) => total + n, 0);
  const average = question.average === null ? "—" : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(question.average);
  const nps = question.nps === null ? "—" : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(question.nps);
  const digit = (n: number) => new Intl.NumberFormat(locale).format(n);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-paper-sunken p-3">
          <p className="text-xs font-medium text-ink-soft">{t.average}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">
            {average} <span className="text-sm font-normal text-ink-soft">{fmt(t.outOf, { max: 10 })}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-paper-sunken p-3">
          <p className="text-xs font-medium text-ink-soft">{t.nps}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">
            <bdi>{nps}</bdi>
          </p>
          <p className="mt-0.5 text-xs leading-4 text-ink-soft">{t.npsHint}</p>
        </div>
      </div>

      <SplitBar
        parts={[
          { label: t.promoters, value: sum(9, 10), display: formatCount(sum(9, 10)), className: "bg-success" },
          { label: t.passives, value: sum(7, 8), display: formatCount(sum(7, 8)), className: "bg-line-strong" },
          { label: t.detractors, value: sum(0, 6), display: formatCount(sum(0, 6)), className: "bg-danger" },
        ]}
      />

      <div>
        <p className="text-xs font-medium text-ink-soft">{t.distribution}</p>
        {/* A score axis runs 0 → 10 left to right in Arabic too. */}
        <ol dir="ltr" className="mt-2 flex items-end gap-1 sm:gap-1.5">
          {spread.map((count, score) => {
            const label = fmt(t.scoreCount, { score: digit(score), count: formatCount(count) });
            return (
              <li key={score} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={label}>
                <span className="sr-only">{label}</span>
                <span aria-hidden className="flex h-16 w-full items-end justify-center">
                  {/* A thin column, rounded at its data end and standing on the axis line. */}
                  <span className="w-full max-w-6 rounded-t-[4px] bg-primary" style={{ height: count > 0 ? `${Math.max(6, (count / peak) * 100)}%` : "0%" }} />
                </span>
                <span aria-hidden className="h-px w-full bg-line" />
                <span aria-hidden className="text-xs text-ink-soft tabular-nums">
                  {digit(score)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** The newest answers in the shoppers' own words, each with its order. */
function TextResult({ question, t }: { question: SurveyReportText; t: SurveyStrings }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-soft">{t.latest}</p>
      <ul className="mt-2 divide-y divide-line">
        {question.latest.map((answer, i) => (
          <li key={i} className="py-2.5 first:pt-0 last:pb-0">
            <p dir="auto" className="text-sm leading-6 wrap-anywhere whitespace-pre-line text-ink">
              {answer.text}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
              <ViewLink
                to={`/orders?q=${encodeURIComponent(answer.orderNumber)}`}
                className="inline-flex min-h-11 items-center rounded-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0"
              >
                <bdi>{fmt(t.order, { number: answer.orderNumber })}</bdi>
              </ViewLink>
              <span aria-hidden>·</span>
              <span>{formatDate(answer.at)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
