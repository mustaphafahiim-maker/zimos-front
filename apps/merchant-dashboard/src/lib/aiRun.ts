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
    dialect_egyptian: "Egyptian Arabic",
    dialect_gulf: "Gulf Arabic",
    dialect_msa: "Standard Arabic",
    dialect_english: "English",
    dialect_french: "French",
  },
  ar: {
    failed: "الذكاء الاصطناعي لم يستطع الكتابة: {error}",
    timeout: "الذكاء الاصطناعي يأخذ وقتًا طويلًا. حاول بعد قليل.",
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
  const jobFailure = useAiJobFailure();
  return (err: unknown): string => {
    if (err instanceof AiRunError) return err.message === "timeout" ? t.timeout : (jobFailure(err.message) ?? fmt(t.failed, { error: err.message }));
    // AI_LIMIT_REACHED (by its scope), AI_PROVIDER_UNAVAILABLE and AI_NOT_CONFIGURED are worded in lib/errorMessages.
    return errorMessage(err);
  };
}

/**
 * A failed job keeps only the provider's English sentence, not its code
 * (ai/providers/anthropic.js): the ones that mean "busy" or "not available"
 * get the same wording as the live errors. null for any other failure.
 */
const JOB_FAILURES: Array<[RegExp, string, number]> = [
  [/provider is busy|took too long|not answering|AI request failed/i, "AI_PROVIDER_UNAVAILABLE", 503],
  [/AI is not available|not available yet|could not take this request/i, "AI_NOT_CONFIGURED", 503],
];

export function useAiJobFailure() {
  const errorMessage = useErrorMessage();
  return (error: string | null | undefined): string | null => {
    const known = JOB_FAILURES.find(([pattern]) => pattern.test(error ?? ""));
    return known ? errorMessage(new ApiError(error ?? "", known[2], known[1], null)) : null;
  };
}

/** The dialects with their names, for a select. */
export function useAiDialects(): Array<{ value: AiDialect; label: string }> {
  const t = useT(STRINGS);
  return AI_DIALECTS.map((value) => ({ value, label: t[`dialect_${value}`] }));
}
