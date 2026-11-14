import { AI_DIALECTS, ApiError, aiStart, aiWaitForJob, type AiDialect, type AiFeature, type AiInputs, type AiJob } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * One AI generation outside the AI Studio (the product form's "Write with
 * AI", the funnel wizard's AI template): start it, wait for it, and say what
 * went wrong in the merchant's words.
 */

const STRINGS = {
  en: {
    failed: "The AI couldn't write this: {error}",
    timeout: "The AI is taking too long. Try again in a moment.",
    limitHour: "Too many AI requests in the last hour. Try again later.",
    limitMonth: "This month's AI requests on your plan are used up.",
    dialect_egyptian: "Egyptian Arabic",
    dialect_gulf: "Gulf Arabic",
    dialect_msa: "Standard Arabic",
    dialect_english: "English",
    dialect_french: "French",
  },
  ar: {
    failed: "الذكاء الاصطناعي لم يستطع الكتابة: {error}",
    timeout: "الذكاء الاصطناعي يأخذ وقتًا طويلًا. حاول بعد قليل.",
    limitHour: "طلبات ذكاء اصطناعي كثيرة في الساعة الأخيرة. حاول لاحقًا.",
    limitMonth: "استُهلكت طلبات الذكاء الاصطناعي في باقتك لهذا الشهر.",
    dialect_egyptian: "عامية مصرية",
    dialect_gulf: "لهجة خليجية",
    dialect_msa: "عربية فصحى",
    dialect_english: "الإنجليزية",
    dialect_french: "الفرنسية",
  },
} satisfies Messages;

export class AiRunError extends Error {}

/** Starts a generation and waits for it; throws AiRunError (or the API's error) when there is no result. */
export async function runAiJob<F extends AiFeature>(workspaceId: string, feature: F, input: AiInputs[F]): Promise<AiJob<F>> {
  const started = await aiStart(apiClient, workspaceId, feature, input);
  const finished = await aiWaitForJob<F>(apiClient, workspaceId, started.id);
  if (finished.status === "failed") throw new AiRunError(finished.error ?? "");
  if (finished.status !== "succeeded") throw new AiRunError("timeout");
  return finished;
}

/** The merchant-facing message for whatever runAiJob (or the apply after it) threw. */
export function useAiErrorText() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  return (err: unknown): string => {
    if (err instanceof AiRunError) return err.message === "timeout" ? t.timeout : fmt(t.failed, { error: err.message });
    if (err instanceof ApiError && err.code === "AI_LIMIT_REACHED") {
      return (err.details as { scope?: string } | undefined)?.scope === "hour" ? t.limitHour : t.limitMonth;
    }
    return errorMessage(err);
  };
}

/** The dialects with their names, for a select. */
export function useAiDialects(): Array<{ value: AiDialect; label: string }> {
  const t = useT(STRINGS);
  return AI_DIALECTS.map((value) => ({ value, label: t[`dialect_${value}`] }));
}
