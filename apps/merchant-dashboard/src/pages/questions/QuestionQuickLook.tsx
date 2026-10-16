import type { ReactNode } from "react";
import type { ProductQuestion } from "@store-builder/api-client";
import { IconChat, IconDelete, IconEdit, IconEye, IconEyeOff } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import type { QuestionMove } from "./QuestionRow";
import { QUESTION_STATUS_TONE, QUESTION_STRINGS } from "./questionStrings";

/** A footer pill takes its share of the row on a phone and its own width from sm. */
const FOOTER_PILL = "max-sm:flex-1";

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

export interface QuestionQuickLookProps {
  /** The question being looked at. Null draws nothing (keep the last one while the panel closes). */
  question: ProductQuestion | null;
  /** In the inbox "open fully" goes to the product; on the product's own page it goes to the inbox. */
  context: "inbox" | "product";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The move on its way to the server for this question, if any. */
  busy: QuestionMove | null;
  onAnswer: () => void;
  onHide: () => void;
  onPublishAgain: () => void;
  onDelete: () => void;
}

/**
 * A question at a glance, without leaving the list: the shopper's words in
 * full, who asked (and the private email the answer goes to), the answer as
 * it stands — and the moves in the footer: answer, hide, publish again.
 */
export function QuestionQuickLook({ question, context, open, onOpenChange, busy, onAnswer, onHide, onPublishAgain, onDelete }: QuestionQuickLookProps) {
  const t = useT(QUESTION_STRINGS);
  if (!question) return null;

  const asker = question.askerName?.trim() || t.anonymous;
  const answered = Boolean(question.answer);
  const acting = busy !== null;
  const hint = question.status === "pending" ? t.hintPending : question.status === "published" ? t.hintPublished : t.hintHidden;
  // A product that was deleted has no page: the way out is the list of products.
  const exit =
    context === "product"
      ? { to: "/questions", label: t.openInbox }
      : question.productName
        ? { to: `/catalog/${question.productId}?tab=questions`, label: t.openProduct }
        : { to: "/catalog", label: t.openProducts };

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{question.productName || t.unknownProduct}</bdi>}
      status={<StatusBadge value={question.status} tone={QUESTION_STATUS_TONE[question.status]} text={t[`status_${question.status}`]} />}
      to={exit.to}
      openLabel={exit.label}
      actions={
        <>
          {question.status !== "hidden" && (
            <RowAction className={FOOTER_PILL} tone="quiet" label={t.hide} icon={IconEyeOff} busy={busy === "hide"} disabled={acting} onClick={onHide} />
          )}
          {question.status === "hidden" && answered && (
            <RowAction className={FOOTER_PILL} tone="quiet" label={t.publishAgain} icon={IconEye} busy={busy === "publish"} disabled={acting} onClick={onPublishAgain} />
          )}
          <RowAction
            className={FOOTER_PILL}
            tone={question.status === "pending" ? "primary" : "quiet"}
            label={answered ? t.editAnswer : t.answer}
            icon={answered ? IconEdit : IconChat}
            disabled={acting}
            onClick={onAnswer}
          />
        </>
      }
    >
      <div data-slot="question-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={question.createdAt} title={formatDateTime(question.createdAt)}>
            {fmt(t.askedWhen, { when: formatRelativeTime(question.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(question.createdAt)}</span>
        </p>

        <section>
          <BlockLabel>{t.theQuestion}</BlockLabel>
          {/* dir="auto": the shopper wrote it in their own language, not the dashboard's. */}
          <blockquote dir="auto" data-slot="question-note" className="rounded-2xl bg-paper-sunken px-4 py-3 text-[15px] leading-6 font-medium whitespace-pre-line wrap-anywhere text-ink">
            {question.question}
          </blockquote>
        </section>

        <section>
          <BlockLabel>
            {t.answerLabel}
            {question.answeredAt && <> · {fmt(t.answeredOn, { date: formatDate(question.answeredAt) })}</>}
          </BlockLabel>
          {question.answer ? (
            <p dir="auto" className="text-sm leading-6 whitespace-pre-line wrap-anywhere text-ink">
              {question.answer}
            </p>
          ) : (
            <p className="text-sm leading-6 text-ink-soft">{t.noAnswerYet}</p>
          )}
        </section>

        <div role="separator" data-slot="question-peek-rule" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.whoAsked}</BlockLabel>
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{asker}</bdi>
          </p>
          {question.askerEmail && (
            <>
              <p className="text-sm leading-5 text-ink-soft">
                <bdi dir="ltr">{question.askerEmail}</bdi>
              </p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                {t.emailPrivate}
                {!question.answeredAt && <> {t.willEmail}</>}
              </p>
            </>
          )}
        </section>

        <p data-slot="question-hint" className="text-[13px] leading-5 text-ink-soft">
          {hint}
        </p>

        <button
          type="button"
          disabled={acting}
          onClick={onDelete}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-danger transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.97] motion-reduce:transition-none"
        >
          <IconDelete className="size-4" aria-hidden />
          {t.removeThis}
        </button>
      </div>
    </QuickLook>
  );
}
