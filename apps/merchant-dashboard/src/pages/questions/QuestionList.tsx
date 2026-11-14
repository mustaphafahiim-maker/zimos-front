import { useState, type ReactNode } from "react";
import { productQuestionDelete, productQuestionUpdate, type ProductQuestion, type ProductQuestionUpdate } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { AnswerSheet } from "./AnswerSheet";
import { QuestionQuickLook } from "./QuestionQuickLook";
import { QUESTION_COLUMNS, QuestionRow, type QuestionMove } from "./QuestionRow";
import { QUESTION_STRINGS } from "./questionStrings";
import type { QuestionListState } from "./useQuestionList";

/** A question kept by id while its sheet closes, so the sheet does not empty on its way out. */
type Held = { id: string; open: boolean } | null;

const close = (held: Held): Held => (held ? { ...held, open: false } : held);

/**
 * The questions of one filter as a list, with everything a row can do: the
 * cards (or the sheet of rows from a wide screen), load more, Quick Look, the
 * answer sheet and the delete question. The Questions inbox and the product
 * page's section both draw this, each over its own `useQuestionList`.
 *
 * Hide and publish-again are taken at once and undone from the toast; an
 * answer is published from its sheet (the first one emails the asker, so it is
 * not something to undo); delete asks first.
 */
export function QuestionList({
  list,
  context,
  compact,
  label,
  empty,
}: {
  list: QuestionListState;
  /** The inbox shows each question's product; the product page's section does not, and its rows are always cards. */
  context: "inbox" | "product";
  /** Cards (narrow screens) or the sheet of rows. */
  compact: boolean;
  /** Names the list for screen readers. */
  label: string;
  /** What stands in for the list when the filter holds nothing. */
  empty: ReactNode;
}) {
  const t = useT(QUESTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const showProduct = context === "inbox";

  const [peek, setPeek] = useState<Held>(null);
  const [answering, setAnswering] = useState<Held>(null);
  const [removing, setRemoving] = useState<Held>(null);
  const [busy, setBusy] = useState<Record<string, QuestionMove>>({});
  // A question that left this filter (answered from «مستنية رد», say) is kept for the sheet it was in while that closes.
  const [last, setLast] = useState<Record<string, ProductQuestion>>({});

  const find = (held: Held) => (held ? (list.questions.find((q) => q.id === held.id) ?? last[held.id] ?? null) : null);
  const peeked = find(peek);
  const answered = find(answering);
  const removed = find(removing);

  /** One PATCH, merged into the list. The product name the row came with is kept (the API names it too, while the product exists). */
  async function update(question: ProductQuestion, body: ProductQuestionUpdate): Promise<ProductQuestion> {
    const updated = await productQuestionUpdate(apiClient, workspaceId, question.id, body);
    const next = { ...updated, productName: updated.productName ?? question.productName };
    setLast((prev) => ({ ...prev, [next.id]: next }));
    list.onChanged(next, question);
    return next;
  }

  /** Hide, or put a hidden answer back on the product page — at once, with the way back in the toast. */
  function move(question: ProductQuestion, action: QuestionMove) {
    if (busy[question.id]) return;
    setBusy((prev) => ({ ...prev, [question.id]: action }));
    // Publishing again sends the answer with the status, as publishing always has.
    const body: ProductQuestionUpdate = action === "hide" ? { status: "hidden" } : { answer: question.answer, status: "published" };
    void update(question, body)
      .then((next) => {
        // The opposite call puts it exactly where it was.
        toast.undo(action === "hide" ? t.toastHidden : t.toastPublished, async () => {
          await update(next, { status: question.status });
        });
      })
      .catch((err: unknown) => toast.error(errorMessage(err)))
      .finally(() => {
        setBusy((prev) => {
          const rest = { ...prev };
          delete rest[question.id];
          return rest;
        });
      });
  }

  /** The answer sheet and the delete question take the place of Quick Look: two sheets are never stacked. */
  function openAnswer(question: ProductQuestion) {
    setPeek(close);
    setLast((prev) => ({ ...prev, [question.id]: question }));
    setAnswering({ id: question.id, open: true });
  }
  function askDelete(question: ProductQuestion) {
    setPeek(close);
    setLast((prev) => ({ ...prev, [question.id]: question }));
    setRemoving({ id: question.id, open: true });
  }

  const rows = list.questions.map((question) => (
    <QuestionRow
      key={question.id}
      question={question}
      showProduct={showProduct}
      compact={compact}
      busy={busy[question.id] ?? null}
      current={peek?.open === true && peek.id === question.id}
      onPeek={() => {
        setLast((prev) => ({ ...prev, [question.id]: question }));
        setPeek({ id: question.id, open: true });
      }}
      onAnswer={() => openAnswer(question)}
      onHide={() => move(question, "hide")}
      onPublishAgain={() => move(question, "publish")}
      onDelete={() => askDelete(question)}
    />
  ));

  return (
    <>
      <DataState
        loading={list.loading}
        // A refresh that failed behind rows already on screen leaves them there.
        error={list.questions.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={context === "product" ? 2 : 5} />}
      >
        {list.questions.length === 0 ? (
          empty
        ) : compact ? (
          <ul aria-label={label} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={QUESTION_COLUMNS}
            label={label}
            head={[{ label: t.colQuestion }, { label: t.colStatus }, { label: t.colAge }, { label: t.colAction, end: true }]}
          >
            {rows}
          </DeskList>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <QuestionQuickLook
        question={peeked}
        context={context}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        busy={peeked ? (busy[peeked.id] ?? null) : null}
        onAnswer={() => {
          if (peeked) openAnswer(peeked);
        }}
        onHide={() => {
          if (peeked) move(peeked, "hide");
        }}
        onPublishAgain={() => {
          if (peeked) move(peeked, "publish");
        }}
        onDelete={() => {
          if (peeked) askDelete(peeked);
        }}
      />

      <AnswerSheet
        question={answered}
        open={Boolean(answering?.open)}
        onClose={() => setAnswering(close)}
        onSaved={(next, previous) => {
          setLast((prev) => ({ ...prev, [next.id]: next }));
          list.onChanged(next, previous);
          setAnswering(close);
        }}
      />

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={t.deleteTitle}
        description={t.deleteBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setRemoving(close)}
        onConfirm={async () => {
          if (!removed) return;
          try {
            await productQuestionDelete(apiClient, workspaceId, removed.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRemoving(close);
          toast.success(t.toastDeleted);
          list.onDeleted(removed);
        }}
      />
    </>
  );
}
