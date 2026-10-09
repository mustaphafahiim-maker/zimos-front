"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  SURVEY_ANSWER_MAX,
  SURVEY_OTHER_MAX,
  hasSurveyProof,
  isSurveyClosed,
  storefrontSurvey,
  storefrontSurveyAnswerRequest,
  storefrontSurveyState,
  surveyAnswerProblems,
  type StorefrontSurveyQuestion,
  type SurveyAnswerProblem,
  type SurveyAnswered,
  type SurveyAnswers,
  type SurveyProof,
} from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnGhost, btnPrimary, card, input, pill } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { formatNumber } from "@/lib/i18n";
import { getPaymentToken } from "@/lib/payments";
import { useShopperToken } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { relayedPut } from "@/lib/relayedPut";
import { getTrackingToken } from "@/lib/trackingTokens";
import { surveyCopy, surveyText } from "./surveyCopy";

/** The "other" radio of a choice question, beside the store's own option ids (letters, digits, "-" and "_" only). */
const OTHER = "*other";

/** What the shopper has picked or typed so far, per question. */
interface Draft {
  /** choice: an option id, or OTHER. */
  option: string | null;
  /** choice: the free text behind OTHER. text: the answer. */
  text: string;
  /** score. */
  score: number | null;
}

const EMPTY: Draft = { option: null, text: "", score: null };

/** Saved answers as the form holds them, so "change your answers" starts from what was sent. */
function draftsOf(questions: StorefrontSurveyQuestion[], answers: SurveyAnswers | null): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const q of questions) {
    const a = answers?.[q.id];
    if (q.type === "score") drafts[q.id] = { ...EMPTY, score: typeof a === "number" ? a : null };
    else if (q.type === "text") drafts[q.id] = { ...EMPTY, text: typeof a === "string" ? a : "" };
    else if (a && typeof a === "object") drafts[q.id] = { ...EMPTY, option: OTHER, text: a.other };
    else drafts[q.id] = { ...EMPTY, option: typeof a === "string" && (q.options ?? []).some((o) => o.id === a) ? a : null };
  }
  return drafts;
}

/** The draft of one question as the API takes it, or undefined when it says nothing. */
function answerOf(q: StorefrontSurveyQuestion, draft: Draft): SurveyAnswers[string] | undefined {
  if (q.type === "score") return draft.score ?? undefined;
  if (q.type === "text") return draft.text.trim() || undefined;
  if (draft.option === OTHER) return draft.text.trim() ? { other: draft.text.trim() } : undefined;
  return draft.option ?? undefined;
}

const skipKey = (orderId: string) => `zimos_survey_skip_${orderId}`;

/**
 * The store's post-purchase survey on the thank-you page (frontend-handoff
 * 236): up to three questions under the order summary — a choice, a score
 * from 0 to 10, a text — «ابعت», then «شكرًا على رأيك!». It can be skipped,
 * and the answers changed for 7 days.
 *
 * Nothing shows when the store has no survey, or when this device cannot
 * prove the order is the shopper's: the proof is the order's tracking token
 * kept from the checkout (lib/trackingTokens), their sign-in, or an online
 * order's payment token.
 */
export function PostPurchaseSurvey({
  workspaceId,
  orderId,
  headingLevel: Heading = "h2",
}: {
  workspaceId: string;
  orderId: string;
  /** The card's title, at the level the page around it is on (a funnel's thank-you step sits one deeper). */
  headingLevel?: "h2" | "h3";
}) {
  const { locale, store } = useStore();
  const c = surveyCopy(locale);
  const ids = useId();
  const shopperToken = useShopperToken(store?.id);
  const basePath = useStoreBasePath();
  const client = useMemo(() => createStorefrontApiClient({ locale }), [locale]);

  const [questions, setQuestions] = useState<StorefrontSurveyQuestion[]>([]);
  const [proof, setProof] = useState<SurveyProof | null>(null);
  const [phase, setPhase] = useState<"hidden" | "form" | "thanks">("hidden");
  const [canChange, setCanChange] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [problems, setProblems] = useState<Record<string, SurveyAnswerProblem>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const found: SurveyProof = {
      trackingToken: getTrackingToken(workspaceId, orderId),
      shopperToken,
      paymentToken: getPaymentToken(workspaceId, orderId),
    };
    if (!hasSurveyProof(found)) return;
    (async () => {
      const list = await storefrontSurvey(client, workspaceId);
      if (cancelled || !list || list.length === 0) return;
      const state = await storefrontSurveyState(client, workspaceId, orderId, found);
      if (cancelled) return;
      setQuestions(list);
      setProof(found);
      setDrafts(draftsOf(list, state.answers));
      setCanChange(state.open);
      if (state.answered) setPhase("thanks");
      else if (state.open && !skipped(orderId)) setPhase("form");
    })().catch(() => {
      // Off, a locked store, an order this device cannot prove: the page simply has no survey.
    });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, orderId, shopperToken]);

  if (phase === "hidden" || !proof) return null;

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY), ...patch } }));
    setProblems((prev) => {
      if (!prev[id] && !prev.all) return prev;
      const next = { ...prev };
      delete next[id];
      delete next.all;
      return next;
    });
    setFailure(null);
  };

  const problemText = (problem: SurveyAnswerProblem | undefined) =>
    problem === "required" ? c.required : problem === "option" ? c.option : problem === "score" ? c.score : problem ? c.required : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending || !proof) return;
    const answers: SurveyAnswers = {};
    const found: Record<string, SurveyAnswerProblem> = {};
    for (const q of questions) {
      const answer = answerOf(q, drafts[q.id] ?? EMPTY);
      if (answer !== undefined) answers[q.id] = answer;
      else if (q.required) found[q.id] = "required";
    }
    if (Object.keys(found).length === 0 && Object.keys(answers).length === 0) found.all = "required";
    setProblems(found);
    if (Object.keys(found).length > 0) {
      const first = questions.find((q) => found[q.id]);
      if (first) document.getElementById(`${ids}-${first.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      // A PUT, which the browser may not send to the API itself yet: it goes through the store's own server (lib/relayedPut).
      const saved = await relayedPut<SurveyAnswered>({ basePath, locale, ...storefrontSurveyAnswerRequest(orderId, proof, answers) });
      setDrafts(draftsOf(questions, saved.answers));
      setPhase("thanks");
    } catch (err) {
      const refused = surveyAnswerProblems(err);
      if (Object.keys(refused).length > 0) setProblems(refused);
      else if (isSurveyClosed(err)) {
        setCanChange(false);
        setFailure(c.closed);
      } else setFailure(c.failed);
    } finally {
      setSending(false);
    }
  }

  function skip() {
    try {
      window.sessionStorage.setItem(skipKey(orderId), "1");
    } catch {
      /* storage blocked: it is hidden for this view all the same */
    }
    setPhase("hidden");
  }

  if (phase === "thanks") {
    return (
      <section className={`${card} mt-6 flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6`} aria-live="polite">
        <p className="flex items-center gap-2.5 text-base font-semibold text-ink">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckIcon size={18} />
          </span>
          {c.thanks}
        </p>
        {canChange && (
          <button type="button" onClick={() => setPhase("form")} className={btnGhost}>
            {c.change}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby={`${ids}-title`}>
      <Heading id={`${ids}-title`} className="text-lg font-semibold text-ink">
        {c.title}
      </Heading>
      <p className="mt-1 text-sm text-ink-soft">{c.hint}</p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-6">
        {questions.map((q) => {
          const draft = drafts[q.id] ?? EMPTY;
          const problem = problemText(problems[q.id]);
          const labelId = `${ids}-${q.id}`;
          const errorId = `${labelId}-error`;
          return (
            <div key={q.id}>
              <p id={labelId} className="text-sm font-semibold text-ink">
                <bdi>{surveyText(q.text, locale)}</bdi>
                {q.required ? <span className="text-danger"> *</span> : <span className="ms-1 text-xs font-normal text-ink-soft">({c.optional})</span>}
              </p>

              {q.type === "choice" && (
                <div role="radiogroup" aria-labelledby={labelId} aria-describedby={problem ? errorId : undefined} className="mt-2.5 space-y-2">
                  {(q.options ?? []).map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 text-sm text-ink transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                        draft.option === option.id ? "border-primary bg-primary-soft" : "border-line hover:border-primary"
                      }`}
                    >
                      <input
                        type="radio"
                        name={labelId}
                        checked={draft.option === option.id}
                        onChange={() => setDraft(q.id, { option: option.id })}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                      />
                      <bdi className="min-w-0">{surveyText(option.label, locale)}</bdi>
                    </label>
                  ))}
                  {q.allowOther && (
                    <>
                      <label
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 text-sm text-ink transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                          draft.option === OTHER ? "border-primary bg-primary-soft" : "border-line hover:border-primary"
                        }`}
                      >
                        <input
                          type="radio"
                          name={labelId}
                          checked={draft.option === OTHER}
                          onChange={() => setDraft(q.id, { option: OTHER })}
                          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                        />
                        {c.other}
                      </label>
                      {draft.option === OTHER && (
                        <input
                          type="text"
                          autoFocus
                          aria-label={c.otherLabel}
                          maxLength={SURVEY_OTHER_MAX}
                          placeholder={c.otherPlaceholder}
                          value={draft.text}
                          onChange={(e) => setDraft(q.id, { text: e.target.value })}
                          className={input}
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {q.type === "score" && (
                // The scale reads in the page's own direction: 0 first, at the start edge.
                <div role="radiogroup" aria-labelledby={labelId} aria-describedby={problem ? errorId : undefined} className="mt-2.5 flex flex-wrap gap-1.5">
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={draft.score === n}
                      aria-label={c.scoreOf(n)}
                      onClick={() => setDraft(q.id, { score: n })}
                      className={`${pill(draft.score === n)} px-0 tabular-nums`}
                    >
                      {formatNumber(n, locale)}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "text" && (
                <textarea
                  rows={3}
                  aria-labelledby={labelId}
                  aria-describedby={problem ? errorId : undefined}
                  aria-invalid={problem ? true : undefined}
                  maxLength={SURVEY_ANSWER_MAX}
                  placeholder={c.textPlaceholder}
                  value={draft.text}
                  onChange={(e) => setDraft(q.id, { text: e.target.value })}
                  className={`${input} mt-2.5`}
                />
              )}

              {problem && (
                <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
                  {problem}
                </p>
              )}
            </div>
          );
        })}

        <div aria-live="polite" className="empty:hidden">
          {(problems.all || failure) && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{failure ?? c.answerOne}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={sending} className={btnPrimary}>
            {sending ? c.sending : c.send}
          </button>
          <button type="button" onClick={skip} disabled={sending} className={btnGhost}>
            {c.skip}
          </button>
        </div>
      </form>
    </section>
  );
}

function skipped(orderId: string): boolean {
  try {
    return window.sessionStorage.getItem(skipKey(orderId)) === "1";
  } catch {
    return false;
  }
}
