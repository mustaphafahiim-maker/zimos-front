import { Link } from "react-router-dom";
import { surveyOrderAnswers, surveySettingsGet, type SurveyAnswer, type SurveyQuestion } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CardFrame } from "@/pages/orders/detail/CardFrame";
import { SURVEY_RESULTS_PATH, SURVEY_STRINGS, surveyTextOf, type SurveyStrings } from "./surveyStrings";

/** An answer in words, or null when it no longer reads against the question (an option the store removed since). */
function answerText(question: SurveyQuestion, answer: SurveyAnswer, t: SurveyStrings): string | null {
  if (question.type === "score") return typeof answer === "number" ? fmt(t.scoreAnswer, { n: answer, max: 10 }) : null;
  if (question.type === "text") return typeof answer === "string" && answer.trim() ? answer : null;
  if (typeof answer === "object" && answer !== null) return answer.other?.trim() ? fmt(t.otherAnswer, { text: answer.other.trim() }) : null;
  const option = typeof answer === "string" ? question.options?.find((o) => o.id === answer) : undefined;
  return option ? surveyTextOf(option.label) || null : null;
}

/**
 * The order page's «استبيان بعد الشراء» card (frontend-handoff 236): what
 * this order's shopper answered on the thank-you page, each answer under its
 * question as the survey words it now. Nothing at all for an order nobody
 * answered for — and while it loads, or when the answers cannot be read
 * (no orders.view, a network failure): the order page does not wait on it.
 */
export function OrderSurveyAnswers({ orderId, frameless }: { orderId: string; /** Inside a folding section of the order page: no card and no title of its own. */ frameless?: boolean }) {
  const t = useT(SURVEY_STRINGS);
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(async () => {
    const answered = await surveyOrderAnswers(apiClient, workspaceId, orderId);
    if (!answered.answers || Object.keys(answered.answers).length === 0) return null;
    // The questions and options the ids stand for.
    const settings = await surveySettingsGet(apiClient, workspaceId);
    return { answers: answered.answers, answeredAt: answered.answeredAt, questions: settings.questions };
  }, [workspaceId, orderId]);

  const data = loaded.data;
  if (!data) return null;
  const rows = data.questions.flatMap((question) => {
    const answer = data.answers[question.id];
    const text = answer === undefined ? null : answerText(question, answer, t);
    return text ? [{ id: question.id, question: surveyTextOf(question.text), text }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <CardFrame frameless={frameless} title={t.orderTitle} description={data.answeredAt ? fmt(t.answeredAt, { date: formatDateTime(data.answeredAt) }) : undefined}>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.id}>
            <dt className="text-xs text-ink-soft">
              <bdi>{row.question}</bdi>
            </dt>
            <dd dir="auto" className="mt-0.5 text-sm font-medium whitespace-pre-line text-ink [overflow-wrap:anywhere]">
              {row.text}
            </dd>
          </div>
        ))}
      </dl>
      <Link to={`${SURVEY_RESULTS_PATH}?range=90d`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
        {t.allResults}
      </Link>
    </CardFrame>
  );
}
