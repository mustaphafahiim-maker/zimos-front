import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowDown, IconArrowUp, IconChart, IconDelete, IconInfo, IconPlus } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ApiError,
  SURVEY_MAX_OPTIONS,
  SURVEY_MAX_QUESTIONS,
  SURVEY_MIN_OPTIONS,
  SURVEY_TEXT_MAX,
  surveySettingsGet,
  surveySettingsSave,
  type SurveyQuestionType,
  type SurveySettings,
  type SurveySettingsInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { SURVEY_RESULTS_PATH, SURVEY_STRINGS, TYPE_HINT_KEY, TYPE_KEY } from "./surveyStrings";

/**
 * Role keys that carry workspace.manage, which saving the survey needs. The
 * dashboard only sees the role key; a 403 on save also turns the form
 * read-only (the same approach as the protection rules).
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

const TYPES: readonly SurveyQuestionType[] = ["choice", "score", "text"];

interface OptionDraft {
  /** Stable for the list while editing. */
  key: number;
  id?: string;
  ar: string;
  en: string;
}

interface QuestionDraft {
  key: number;
  id?: string;
  /** The type it was saved with: under another type its answers would be misread, so it is saved as a new question. */
  savedType?: SurveyQuestionType;
  type: SurveyQuestionType;
  ar: string;
  en: string;
  options: OptionDraft[];
  allowOther: boolean;
  required: boolean;
}

interface Draft {
  enabled: boolean;
  questions: QuestionDraft[];
}

type QuestionErrors = Partial<Record<"text" | "options", string>>;

let nextKey = 1;
const newKey = () => nextKey++;
const blankOption = (): OptionDraft => ({ key: newKey(), ar: "", en: "" });

function draftOf(settings: SurveySettings): Draft {
  return {
    enabled: settings.enabled === true,
    questions: (settings.questions ?? []).map((q) => ({
      key: newKey(),
      id: q.id,
      savedType: q.type,
      type: q.type,
      ar: q.text?.ar ?? "",
      en: q.text?.en ?? "",
      options: (q.options ?? []).map((o) => ({ key: newKey(), id: o.id, ar: o.label?.ar ?? "", en: o.label?.en ?? "" })),
      allowOther: q.allowOther === true,
      required: q.required === true,
    })),
  };
}

const filled = (o: OptionDraft) => o.ar.trim() !== "" || o.en.trim() !== "";

/** What PUT /post-purchase-survey takes: ids kept, empty option rows dropped, no options on a score or a text. */
function bodyOf(draft: Draft): SurveySettingsInput {
  return {
    enabled: draft.enabled,
    questions: draft.questions.map((q) => {
      const same = Boolean(q.id) && q.type === q.savedType;
      const base = { ...(same ? { id: q.id } : {}), type: q.type, text: { ar: q.ar.trim(), en: q.en.trim() }, required: q.required };
      if (q.type !== "choice") return base;
      return {
        ...base,
        options: q.options.filter(filled).map((o) => ({ ...(same && o.id ? { id: o.id } : {}), label: { ar: o.ar.trim(), en: o.en.trim() } })),
        allowOther: q.allowOther,
      };
    }),
  };
}

/** The ready questions offered while there is room: a source question, a recommendation score, an open one. */
function templates(): Array<{ key: "source" | "nps" | "better"; label: { en: string; ar: string }; make: () => QuestionDraft }> {
  const option = (ar: string, en: string): OptionDraft => ({ key: newKey(), ar, en });
  return [
    {
      key: "source",
      label: { en: "How did you hear about us?", ar: "عرفتنا منين؟" },
      make: () => ({
        key: newKey(),
        type: "choice",
        ar: "عرفتنا منين؟",
        en: "How did you hear about us?",
        options: [option("فيسبوك", "Facebook"), option("انستجرام", "Instagram"), option("تيك توك", "TikTok"), option("جوجل", "Google"), option("حد رشّحكم ليا", "A friend told me")],
        allowOther: true,
        required: false,
      }),
    },
    {
      key: "nps",
      label: { en: "Would you recommend us?", ar: "هترشّحنا لصحابك؟" },
      make: () => ({
        key: newKey(),
        type: "score",
        ar: "من ٠ لـ ١٠، قد إيه ممكن ترشّحنا لحد من صحابك؟",
        en: "From 0 to 10, how likely are you to recommend us to a friend?",
        options: [],
        allowOther: false,
        required: false,
      }),
    },
    {
      key: "better",
      label: { en: "What could we do better?", ar: "نقدر نحسّن إيه؟" },
      make: () => ({ key: newKey(), type: "text", ar: "نقدر نحسّن إيه؟", en: "What could we do better?", options: [], allowOther: false, required: false }),
    },
  ];
}

/**
 * Store settings → Post-purchase survey (frontend-handoff 236): whether the
 * thank-you page asks, and up to three questions — a choice with its options
 * and an optional "other", a score from 0 to 10, or a text — each required or
 * not. Read with orders.view (without it the GET answers 403 and DataState
 * draws the no-permission card); saved with workspace.manage.
 */
export function SurveySettingsTab() {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => surveySettingsGet(apiClient, workspaceId), [workspaceId]);
  return (
    <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()}>
      {loaded.data && <SurveyForm settings={loaded.data} onSaved={loaded.setData} />}
    </DataState>
  );
}

function SurveyForm({ settings, onSaved }: { settings: SurveySettings; onSaved: (next: SurveySettings) => void }) {
  const t = useT(SURVEY_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings));
  const [errors, setErrors] = useState<Record<number, QuestionErrors>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  // The body the saved settings would send: what the draft is compared with.
  const savedBody = useMemo(() => JSON.stringify(bodyOf(draftOf(settings))), [settings]);

  // A save brings the server's view back, with the ids it made.
  useEffect(() => {
    setDraft(draftOf(settings));
    setErrors({});
  }, [settings]);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const disabled = !editable || saving;
  const dirty = editable && JSON.stringify(bodyOf(draft)) !== savedBody;
  useReportDirty(dirty);

  const full = draft.questions.length >= SURVEY_MAX_QUESTIONS;

  function change(next: (prev: Draft) => Draft) {
    setDraft(next);
    setError(null);
  }
  const setQuestion = (key: number, patch: Partial<QuestionDraft>) => {
    change((prev) => ({ ...prev, questions: prev.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: {} } : prev));
  };
  const setOption = (question: QuestionDraft, optionKey: number, patch: Partial<OptionDraft>) =>
    setQuestion(question.key, { options: question.options.map((o) => (o.key === optionKey ? { ...o, ...patch } : o)) });

  function setType(question: QuestionDraft, type: SurveyQuestionType) {
    // A choice starts with two empty rows to fill in.
    const options = type === "choice" && question.options.length < SURVEY_MIN_OPTIONS ? [...question.options, ...Array.from({ length: SURVEY_MIN_OPTIONS - question.options.length }, blankOption)] : question.options;
    setQuestion(question.key, { type, options });
  }

  function addQuestion(question?: QuestionDraft) {
    change((prev) =>
      prev.questions.length >= SURVEY_MAX_QUESTIONS
        ? prev
        : {
            ...prev,
            questions: [
              ...prev.questions,
              question ?? { key: newKey(), type: "choice", ar: "", en: "", options: [blankOption(), blankOption()], allowOther: false, required: false },
            ],
          }
    );
  }

  function move(index: number, by: -1 | 1) {
    change((prev) => {
      const next = [...prev.questions];
      const other = index + by;
      if (other < 0 || other >= next.length) return prev;
      [next[index], next[other]] = [next[other], next[index]];
      return { ...prev, questions: next };
    });
  }

  function check(): { found: Record<number, QuestionErrors>; top: string | null } {
    const found: Record<number, QuestionErrors> = {};
    for (const q of draft.questions) {
      const problems: QuestionErrors = {};
      if (!q.ar.trim() && !q.en.trim()) problems.text = t.needText;
      if (q.type === "choice" && q.options.filter(filled).length < SURVEY_MIN_OPTIONS) problems.options = t.needOptions;
      if (problems.text || problems.options) found[q.key] = problems;
    }
    if (Object.keys(found).length > 0) return { found, top: t.fix };
    if (draft.enabled && draft.questions.length === 0) return { found, top: t.needQuestion };
    return { found, top: null };
  }

  async function save() {
    if (saving) return;
    const { found, top } = check();
    setErrors(found);
    if (top) {
      setError(top);
      const first = draft.questions.find((q) => found[q.key]);
      if (first) document.getElementById(`${ids}-q${first.key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await surveySettingsSave(apiClient, workspaceId, bodyOf(draft));
      onSaved(next);
      toast.success(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setDraft(draftOf(settings));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(draftOf(settings));
    setErrors({});
    setError(null);
  }

  return (
    <div className="space-y-5">
      {!editable && (
        <Alert>
          <p className="font-medium">{t.readOnlyTitle}</p>
          <p>{t.readOnly}</p>
        </Alert>
      )}

      <Section
        title={t.title}
        description={t.description}
        actions={<StatusBadge value={settings.enabled ? "on" : "off"} tone={settings.enabled ? "success" : "neutral"} text={settings.enabled ? t.on : t.off} />}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                role="switch"
                className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                checked={draft.enabled}
                aria-describedby={`${ids}-enabled-hint`}
                disabled={disabled}
                onChange={(e) => change((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              {t.enabled}
            </label>
            <p id={`${ids}-enabled-hint`} className="text-xs text-ink-soft">
              {t.enabledHint}
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 md:min-h-9">
            <Link to={`${SURVEY_RESULTS_PATH}?range=90d`}>
              <IconChart className="size-4" aria-hidden />
              {t.seeResults}
            </Link>
          </Button>
        </div>
      </Section>

      <Section title={t.questions} description={fmt(t.questionsHint, { max: SURVEY_MAX_QUESTIONS })}>
        <div className="space-y-4">
          {draft.questions.length === 0 && <p className="text-sm text-ink-soft">{t.noQuestions}</p>}

          <ol className="space-y-4">
            {draft.questions.map((question, index) => {
              const n = index + 1;
              const problems = errors[question.key] ?? {};
              const typeChanged = Boolean(question.id) && question.type !== question.savedType;
              return (
                <li key={question.key} id={`${ids}-q${question.key}`} className="space-y-4 rounded-[var(--radius)] border border-line p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{fmt(t.question, { n })}</p>
                    {editable && (
                      <span className="flex gap-0.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-11 md:size-8"
                          aria-label={fmt(t.moveUp, { n })}
                          title={fmt(t.moveUp, { n })}
                          disabled={saving || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <IconArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-11 md:size-8"
                          aria-label={fmt(t.moveDown, { n })}
                          title={fmt(t.moveDown, { n })}
                          disabled={saving || index === draft.questions.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <IconArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-11 text-danger hover:bg-danger-soft hover:text-danger md:size-8"
                          aria-label={fmt(t.removeQuestion, { n })}
                          title={fmt(t.removeQuestion, { n })}
                          disabled={saving}
                          onClick={() => change((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.key !== question.key) }))}
                        >
                          <IconDelete className="size-4" aria-hidden />
                        </Button>
                      </span>
                    )}
                  </div>

                  <Field label={t.type} hint={t[TYPE_HINT_KEY[question.type]]} className="max-w-xs">
                    {(props) => (
                      <Select {...props} value={question.type} disabled={disabled} className="min-h-11" onChange={(e) => setType(question, e.target.value as SurveyQuestionType)}>
                        {TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t[TYPE_KEY[type]]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  {typeChanged && (
                    <p className="flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2.5 text-sm text-accent-dark">
                      <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {t.typeChanged}
                    </p>
                  )}

                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t.textAr}>
                        {(props) => (
                          <Input
                            {...props}
                            dir="rtl"
                            maxLength={SURVEY_TEXT_MAX}
                            value={question.ar}
                            aria-invalid={problems.text ? true : undefined}
                            disabled={disabled}
                            onChange={(e) => setQuestion(question.key, { ar: e.target.value })}
                            className="min-h-11"
                          />
                        )}
                      </Field>
                      <Field label={t.textEn}>
                        {(props) => (
                          <Input
                            {...props}
                            dir="ltr"
                            maxLength={SURVEY_TEXT_MAX}
                            value={question.en}
                            aria-invalid={problems.text ? true : undefined}
                            disabled={disabled}
                            onChange={(e) => setQuestion(question.key, { en: e.target.value })}
                            className="min-h-11 text-start"
                          />
                        )}
                      </Field>
                    </div>
                    {problems.text && <p className="mt-1.5 text-xs font-medium text-danger">{problems.text}</p>}
                  </div>

                  {question.type === "choice" && (
                    <fieldset className="space-y-2" disabled={disabled}>
                      <legend className="mb-1.5 text-sm font-medium text-ink">{t.options}</legend>
                      <ul className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <li key={option.key} className="flex items-start gap-2">
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                              <Input
                                dir="rtl"
                                aria-label={fmt(t.optionAr, { n: optionIndex + 1 })}
                                placeholder={fmt(t.optionAr, { n: optionIndex + 1 })}
                                maxLength={SURVEY_TEXT_MAX}
                                value={option.ar}
                                onChange={(e) => setOption(question, option.key, { ar: e.target.value })}
                                className="min-h-11"
                              />
                              <Input
                                dir="ltr"
                                aria-label={fmt(t.optionEn, { n: optionIndex + 1 })}
                                placeholder={fmt(t.optionEn, { n: optionIndex + 1 })}
                                maxLength={SURVEY_TEXT_MAX}
                                value={option.en}
                                onChange={(e) => setOption(question, option.key, { en: e.target.value })}
                                className="min-h-11 text-start"
                              />
                            </div>
                            {editable && (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="size-11 shrink-0 text-ink-soft hover:text-danger"
                                aria-label={fmt(t.removeOption, { n: optionIndex + 1 })}
                                title={fmt(t.removeOption, { n: optionIndex + 1 })}
                                onClick={() => setQuestion(question.key, { options: question.options.filter((o) => o.key !== option.key) })}
                              >
                                <IconDelete className="size-4" aria-hidden />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {problems.options ? (
                        <p className="text-xs font-medium text-danger">{problems.options}</p>
                      ) : (
                        <p className="text-xs text-ink-soft">{fmt(t.optionsHint, { min: SURVEY_MIN_OPTIONS, max: SURVEY_MAX_OPTIONS })}</p>
                      )}
                      {editable && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 md:min-h-9"
                          disabled={question.options.length >= SURVEY_MAX_OPTIONS}
                          onClick={() => setQuestion(question.key, { options: [...question.options, blankOption()] })}
                        >
                          <IconPlus className="size-4" aria-hidden />
                          {t.addOption}
                        </Button>
                      )}
                      <div className="pt-1">
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                            checked={question.allowOther}
                            aria-describedby={`${ids}-q${question.key}-other`}
                            onChange={(e) => setQuestion(question.key, { allowOther: e.target.checked })}
                          />
                          <bdi>{t.allowOther}</bdi>
                        </label>
                        <p id={`${ids}-q${question.key}-other`} className="text-xs text-ink-soft">
                          {t.allowOtherHint}
                        </p>
                      </div>
                    </fieldset>
                  )}

                  <div>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                        checked={question.required}
                        aria-describedby={`${ids}-q${question.key}-required`}
                        disabled={disabled}
                        onChange={(e) => setQuestion(question.key, { required: e.target.checked })}
                      />
                      {t.required}
                    </label>
                    <p id={`${ids}-q${question.key}-required`} className="text-xs text-ink-soft">
                      {t.requiredHint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {editable && !full && (
            <div className="space-y-3">
              <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={saving} onClick={() => addQuestion()}>
                <IconPlus className="size-4" aria-hidden />
                {t.addQuestion}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-ink-soft">{t.templates}</p>
                {templates().map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    disabled={saving}
                    onClick={() => addQuestion(template.make())}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-ink ring-1 ring-line ring-inset transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary md:min-h-8"
                  >
                    {template.label[locale]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {error && !dirty && <Alert variant="danger">{error}</Alert>}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={discard}
        message={
          error ? (
            <span role="alert" className="text-danger">
              {error}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
