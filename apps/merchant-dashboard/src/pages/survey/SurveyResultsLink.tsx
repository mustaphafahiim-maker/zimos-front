import { IconClipboard } from "@/components/icons";
import { ReportLinks } from "@/components/report";
import { useT } from "@/i18n/LocaleContext";
import { SURVEY_RESULTS_PATH, SURVEY_STRINGS } from "./surveyStrings";

/**
 * «نتائج الاستبيان» as one link card of the report kit: the way into the
 * survey results without a sidebar entry of its own. Kept apart from the page
 * it opens, so whoever shows the link does not load the page until it is
 * followed.
 */
export function SurveyResultsLink() {
  const t = useT(SURVEY_STRINGS);
  return (
    <ReportLinks
      className="mt-3"
      title={t.title}
      items={[{ to: `${SURVEY_RESULTS_PATH}?range=90d`, title: t.resultsTitle, description: t.resultsHint, icon: IconClipboard }]}
    />
  );
}
