import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, PRODUCT_QUESTION_LIMITS, productQuestionUpdate, type ProductQuestion } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { QUESTION_STRINGS } from "./questionStrings";

const FORM_ID = "question-answer-form";

/**
 * Answering a question, in a sheet over the list: the shopper's words on top,
 * the answer box under them, «انشر» at the foot. Publishing needs an answer;
 * the first published answer emails the asker who left an address — said under
 * the box before it happens. A published answer is edited here too («احفظ
 * الرد»). Closing with something typed asks first (components/Modal.tsx).
 */
export function AnswerSheet({
  question,
  open,
  onClose,
  onSaved,
}: {
  /** The question being answered. It stays here while the sheet closes, so the sheet does not empty on its way out. */
  question: ProductQuestion | null;
  open: boolean;
  onClose: () => void;
  onSaved: (next: ProductQuestion, previous: ProductQuestion) => void;
}) {
  const t = useT(QUESTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const box = useRef<HTMLTextAreaElement>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const id = question?.id;
  const saved = question?.answer ?? "";
  // Every opening starts from the answer as it is saved.
  useEffect(() => {
    if (!open) return;
    setAnswer(saved);
    setBusy(false);
    setFieldError(null);
    setFormError(null);
    // `saved` is read when the sheet opens for this question, not followed while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  if (!question) return null;
  const current = question;
  const published = current.status === "published";
  const typed = answer.trim();
  const changed = typed !== saved.trim();
  const asker = current.askerName?.trim() || t.anonymous;

  function needAnswer() {
    setFieldError(t.answerRequired);
    box.current?.scrollIntoView({ block: "center" });
    box.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!typed) {
      needAnswer();
      return;
    }
    setBusy(true);
    setFieldError(null);
    setFormError(null);
    try {
      const updated = await productQuestionUpdate(apiClient, workspaceId, current.id, { answer: typed, status: "published" });
      toast.success(published ? t.toastSaved : t.toastPublished);
      // The answer keeps the product name the list row came with (the API names it too, when the product still exists).
      onSaved({ ...updated, productName: updated.productName ?? current.productName }, current);
    } catch (err) {
      // 422 ANSWER_REQUIRED: published with the answer taken away (the code is this module's own).
      if (err instanceof ApiError && (err.code as string | undefined) === "ANSWER_REQUIRED") needAnswer();
      else setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={current.answer ? t.editTitle : t.answerTitle}
      description={[current.productName, asker].filter(Boolean).join(" · ")}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full px-5" disabled={busy || (published && !changed)}>
            {busy ? (published ? t.saving : t.publishing) : published ? t.saveAnswer : t.publish}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate className="space-y-4" onSubmit={(event) => void submit(event)}>
        {formError && <Alert variant="danger">{formError}</Alert>}

        <figure data-slot="question-note" className="rounded-2xl bg-paper-sunken px-4 py-3">
          <figcaption className="text-xs leading-4 font-medium text-ink-soft">{t.theQuestion}</figcaption>
          {/* dir="auto": the shopper wrote it in their own language, not the dashboard's. */}
          <blockquote dir="auto" className="mt-1 text-[15px] leading-6 font-medium whitespace-pre-line wrap-anywhere text-ink">
            {current.question}
          </blockquote>
        </figure>

        <Field
          label={t.answerLabel}
          required
          error={fieldError ?? undefined}
          hint={
            current.askerEmail && !current.answeredAt
              ? t.willEmail
              : current.answeredAt
                ? fmt(t.answeredOn, { date: formatDate(current.answeredAt) })
                : t.answerHint
          }
        >
          {({ id: fieldId, ...aria }) => (
            <Textarea
              ref={box}
              id={fieldId}
              {...aria}
              // Typed text sets its own direction; the empty box (its placeholder) follows the dashboard's.
              dir={answer ? "auto" : undefined}
              rows={5}
              maxLength={PRODUCT_QUESTION_LIMITS.answer}
              value={answer}
              disabled={busy}
              placeholder={t.answerPlaceholder}
              onChange={(event) => {
                setAnswer(event.target.value);
                if (fieldError) setFieldError(null);
              }}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
