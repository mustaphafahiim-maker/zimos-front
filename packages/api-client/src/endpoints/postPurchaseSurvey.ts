/**
 * Post-purchase survey (backend: frontend-handoff item 236, src/modules/postPurchaseSurvey).
 *
 * Up to three questions on the thank-you page: a choice (2–12 options, with an
 * optional free-text "other"), a score from 0 to 10, or a text. One set of
 * answers per order, changeable for 7 days.
 *
 * Dashboard, /workspaces/:ws/post-purchase-survey (read orders.view, save workspace.manage):
 *   GET  /                 → SurveySettings
 *   PUT  / SurveySettingsInput → SurveySettings. Ids are made by the server and must be sent
 *        back on later saves, so the answers keep pointing at their question and option.
 *        422 on `questions` when the survey is switched on with no question.
 *   GET  /orders/:orderId  → SurveyOrderAnswers (the order page)
 *   GET  /report?from=&to= → SurveyReport (the last 90 days by default)
 *
 * Storefront (public), /store/:ws/survey:
 *   GET  /                 → { questions } or 404 while the survey is off
 *   GET  /orders/:orderId?token= → { answered, answers, open }
 *   PUT  /orders/:orderId { token, answers } → { answered: true, answers } (a browser sends it through
 *        the storefront's own server while the API's CORS policy has no PUT: storefrontSurveyAnswerRequest)
 *   The shopper proves the order is theirs with its tracking token (the checkout's
 *   `trackingToken`), their sign-in (X-Shopper-Token), or an online order's payment token
 *   (X-Payment-Token); without proof the order answers 404.
 *   409 SURVEY_CLOSED after 7 days. 422 VALIDATION_ERROR per question on `answers.<questionId>`:
 *   "Required", "Pick one of the options", "A score from 0 to 10".
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

export type SurveyQuestionType = "choice" | "score" | "text";

/** A text in the store's two languages; one of them may be empty. */
export interface SurveyTexts {
  ar?: string;
  en?: string;
}

export interface SurveyOption {
  id: string;
  label: SurveyTexts;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: SurveyTexts;
  /** Choice questions only. */
  options?: SurveyOption[];
  /** Choice questions only: a free-text "other" beside the options. */
  allowOther?: boolean;
  required: boolean;
}

export interface SurveySettings {
  enabled: boolean;
  questions: SurveyQuestion[];
}

/** A question as it is saved: a new one, or a new option, has no id yet. */
export interface SurveyQuestionInput {
  id?: string;
  type: SurveyQuestionType;
  text: SurveyTexts;
  /** Required for a choice (2–12); must be left out for the other types. */
  options?: Array<{ id?: string; label: SurveyTexts }>;
  allowOther?: boolean;
  required?: boolean;
}

export interface SurveySettingsInput {
  enabled: boolean;
  questions: SurveyQuestionInput[];
}

export const SURVEY_MAX_QUESTIONS = 3;
export const SURVEY_MIN_OPTIONS = 2;
export const SURVEY_MAX_OPTIONS = 12;
/** A question's and an option's text, per language. */
export const SURVEY_TEXT_MAX = 200;
/** A shopper's free-text "other". */
export const SURVEY_OTHER_MAX = 200;
/** A shopper's answer to a text question. */
export const SURVEY_ANSWER_MAX = 1000;
/** Days after the order during which its answers can still be given or changed. */
export const SURVEY_WINDOW_DAYS = 7;

/** An option's id, a free-text "other", a score from 0 to 10, or a text. */
export type SurveyAnswer = string | number | { other: string };
export type SurveyAnswers = Record<string, SurveyAnswer>;

export interface SurveyOrderAnswers {
  /** Null when the shopper did not answer. */
  answers: SurveyAnswers | null;
  answeredAt: string | null;
}

export interface SurveyReportChoice {
  id: string;
  type: "choice";
  text: SurveyTexts;
  /** How many shoppers answered this question. */
  answers: number;
  options: Array<{ id: string; label: SurveyTexts; count: number }>;
  /** How many wrote their own answer. */
  other: number;
  /** Up to 20 of them, newest first. */
  otherTexts: string[];
}

export interface SurveyReportScore {
  id: string;
  type: "score";
  text: SurveyTexts;
  answers: number;
  /** One decimal; null with no answers. */
  average: number | null;
  /** Promoters (9–10) minus detractors (0–6), as a whole percentage; null with no answers. */
  nps: number | null;
  /** How many gave each score: index 0 … 10. */
  distribution: number[];
}

export interface SurveyReportText {
  id: string;
  type: "text";
  text: SurveyTexts;
  answers: number;
  /** The newest 50. */
  latest: Array<{ text: string; orderNumber: string; at: string }>;
}

export type SurveyReportQuestion = SurveyReportChoice | SurveyReportScore | SurveyReportText;

export interface SurveyReport {
  from: string;
  to: string;
  /** Orders answered in the window. */
  responses: number;
  /** The survey's questions as they are now, each with its answers. */
  questions: SurveyReportQuestion[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/post-purchase-survey`;

export function surveySettingsGet(client: ApiClient, workspaceId: string): Promise<SurveySettings> {
  return client.request<SurveySettings>(base(workspaceId));
}

export function surveySettingsSave(client: ApiClient, workspaceId: string, body: SurveySettingsInput): Promise<SurveySettings> {
  return client.request<SurveySettings>(base(workspaceId), { method: "PUT", body });
}

export function surveyOrderAnswers(client: ApiClient, workspaceId: string, orderId: string): Promise<SurveyOrderAnswers> {
  return client.request<SurveyOrderAnswers>(`${base(workspaceId)}/orders/${orderId}`);
}

/** `from` / `to`: ISO instants; left out, the API reports the last 90 days. */
export function surveyReport(client: ApiClient, workspaceId: string, range: { from?: string; to?: string } = {}): Promise<SurveyReport> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const s = qs.toString();
  return client.request<SurveyReport>(`${base(workspaceId)}/report${s ? `?${s}` : ""}`);
}

// ----------------------------------------------------------- storefront --

/** A question as the shopper gets it. */
export interface StorefrontSurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: SurveyTexts;
  options?: SurveyOption[];
  allowOther?: boolean;
  required: boolean;
}

export interface StorefrontSurveyState {
  answered: boolean;
  answers: SurveyAnswers | null;
  /** Still inside the 7 days. */
  open: boolean;
}

/**
 * What proves the order is this shopper's: any one is enough. The tracking
 * token rides in the query / body, the other two as headers.
 */
export interface SurveyProof {
  trackingToken?: string | null;
  shopperToken?: string | null;
  paymentToken?: string | null;
}

/** Whether there is anything to prove the order with at all. */
export function hasSurveyProof(proof: SurveyProof): boolean {
  return Boolean(proof.trackingToken || proof.shopperToken || proof.paymentToken);
}

const proofHeaders = (proof: SurveyProof): Record<string, string> => ({
  ...(proof.shopperToken ? { "X-Shopper-Token": proof.shopperToken } : {}),
  ...(proof.paymentToken ? { "X-Payment-Token": proof.paymentToken } : {}),
});

/** The store's survey, or null while it is off (404). Any other failure is thrown. */
export async function storefrontSurvey(client: ApiClient, workspaceRef: string): Promise<StorefrontSurveyQuestion[] | null> {
  try {
    const { questions } = await client.request<{ questions: StorefrontSurveyQuestion[] }>(`/store/${workspaceRef}/survey`, { auth: false });
    return questions;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function storefrontSurveyState(client: ApiClient, workspaceRef: string, orderId: string, proof: SurveyProof): Promise<StorefrontSurveyState> {
  const query = proof.trackingToken ? `?token=${encodeURIComponent(proof.trackingToken)}` : "";
  return client.request<StorefrontSurveyState>(`/store/${workspaceRef}/survey/orders/${encodeURIComponent(orderId)}${query}`, {
    auth: false,
    headers: proofHeaders(proof),
  });
}

export interface SurveyAnswered {
  answered: true;
  answers: SurveyAnswers;
}

/**
 * The answer's PUT in pieces — the path under /store/:ws/, its headers and its
 * body — for a caller that cannot send the PUT to the API itself: a browser,
 * while the API's CORS policy for the storefront does not allow PUT, sends
 * them through its own server instead.
 */
export function storefrontSurveyAnswerRequest(
  orderId: string,
  proof: SurveyProof,
  answers: SurveyAnswers
): { path: string; headers: Record<string, string>; body: { token?: string; answers: SurveyAnswers } } {
  return {
    path: `survey/orders/${encodeURIComponent(orderId)}`,
    headers: proofHeaders(proof),
    body: { ...(proof.trackingToken ? { token: proof.trackingToken } : {}), answers },
  };
}

export function storefrontSurveyAnswer(
  client: ApiClient,
  workspaceRef: string,
  orderId: string,
  proof: SurveyProof,
  answers: SurveyAnswers
): Promise<SurveyAnswered> {
  const { path, headers, body } = storefrontSurveyAnswerRequest(orderId, proof, answers);
  return client.request<SurveyAnswered>(`/store/${workspaceRef}/${path}`, { method: "PUT", auth: false, headers, body });
}

/** Why an answer was refused, per question. */
export type SurveyAnswerProblem = "required" | "option" | "score" | "invalid";

/**
 * The questions a 422 named, by question id. "all" is the answer set itself
 * (nothing was answered).
 */
export function surveyAnswerProblems(err: unknown): Record<string, SurveyAnswerProblem> {
  const out: Record<string, SurveyAnswerProblem> = {};
  for (const problem of apiFieldProblems(err)) {
    if (problem.field === "answers") {
      out.all = "required";
      continue;
    }
    if (!problem.field.startsWith("answers.")) continue;
    const id = problem.field.slice("answers.".length);
    const text = problem.message.toLowerCase();
    out[id] = /required/.test(text) ? "required" : /option/.test(text) ? "option" : /score/.test(text) ? "score" : "invalid";
  }
  return out;
}

/** The 7 days are over for this order. */
export function isSurveyClosed(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.code === "SURVEY_CLOSED";
}
