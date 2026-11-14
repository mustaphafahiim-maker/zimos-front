import { useCallback, useEffect, useRef, useState } from "react";
import {
  productQuestionsList,
  type ProductQuestion,
  type ProductQuestionPage,
  type ProductQuestionStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useToast } from "@/components/Toast";

const PAGE_SIZE = 50;

/**
 * The first page of every filter looked at this session, by store, status and
 * product: coming back to the inbox (or to another chip of it) shows what was
 * there at once and refreshes behind, instead of a skeleton again.
 */
const firstPages = new Map<string, ProductQuestionPage>();
const MAX_KEPT = 40;

function keep(key: string, page: ProductQuestionPage) {
  firstPages.delete(key);
  firstPages.set(key, page);
  if (firstPages.size > MAX_KEPT) firstPages.delete(firstPages.keys().next().value as string);
}

interface FirstPage {
  key: string;
  page: ProductQuestionPage | null;
  error: unknown;
}

const kept = (key: string): FirstPage => ({ key, page: firstPages.get(key) ?? null, error: null });

/** Newest first, as the API lists them: a row that comes back takes the place its date gives it. */
function insertByDate(rows: ProductQuestion[], row: ProductQuestion): ProductQuestion[] {
  const at = rows.findIndex((q) => q.createdAt < row.createdAt);
  return at < 0 ? [...rows, row] : [...rows.slice(0, at), row, ...rows.slice(at)];
}

/**
 * The questions of one filter (a status, a product, both or neither), newest
 * first, fifty at a time — the API pages by offset. A row that was answered,
 * hidden or deleted is patched in place: it leaves the list when it no longer
 * matches the status shown, comes back to its place when that is undone, and
 * the store-wide "waiting" count follows.
 */
export function useQuestionList(filter: { status?: ProductQuestionStatus; productId?: string }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const key = `${workspaceId}:${filter.status ?? ""}:${filter.productId ?? ""}`;

  const [state, setState] = useState<FirstPage>(() => kept(key));
  // Another filter: what is kept of it shows in this very render, never the rows of the filter before.
  if (state.key !== key) setState(kept(key));
  const first = state.key === key ? state : kept(key);

  const request = useRef(0);
  const query = useRef({ key, workspaceId, status: filter.status, productId: filter.productId });
  query.current = { key, workspaceId, status: filter.status, productId: filter.productId };

  const refresh = useCallback(async () => {
    const asked = query.current;
    const id = ++request.current;
    // A retry: the message gives way to the skeleton (or to the rows that are kept).
    setState((prev) => (prev.key === asked.key && prev.error ? { ...prev, error: null } : prev));
    try {
      const page = await productQuestionsList(apiClient, asked.workspaceId, { status: asked.status, productId: asked.productId, limit: PAGE_SIZE });
      keep(asked.key, page);
      if (id === request.current) setState({ key: asked.key, page, error: null });
    } catch (err) {
      if (id === request.current) setState((prev) => ({ key: asked.key, page: prev.key === asked.key ? prev.page : (firstPages.get(asked.key) ?? null), error: err }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  // Later pages, kept only for the filter they were loaded under.
  const [more, setMore] = useState<{ key: string; items: ProductQuestion[] }>({ key, items: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more.key === key ? more.items : [];

  const firstRows = first.page?.questions ?? [];
  const seen = new Set(firstRows.map((q) => q.id));
  const questions = [...firstRows, ...extra.filter((q) => !seen.has(q.id))];
  const total = first.page?.total ?? 0;

  // What is on screen now, for a patch that arrives late (an Undo pressed from a toast of an earlier render).
  const live = useRef({ status: filter.status, ids: new Set<string>() });
  live.current = { status: filter.status, ids: new Set(questions.map((q) => q.id)) };

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await productQuestionsList(apiClient, workspaceId, { ...filter, limit: PAGE_SIZE, offset: questions.length });
      setMore({ key, items: [...extra, ...page.questions] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  /** Puts `next` in place of the row it replaces — or back in the list if it had left — or drops the row (`next` null). */
  function patch(previous: ProductQuestion, next: ProductQuestion | null) {
    const { status, ids } = live.current;
    const shown = ids.has(previous.id);
    const stays = next !== null && (!status || next.status === status);
    const drop = (rows: ProductQuestion[]) => rows.filter((q) => q.id !== previous.id);
    const waitingBefore = previous.status === "pending" ? 1 : 0;
    const waitingAfter = next?.status === "pending" ? 1 : 0;
    setState((prev) => {
      const page = prev.page ?? { questions: [], total: 0, pending: 0 };
      const rows =
        next === null || !stays
          ? drop(page.questions)
          : shown
            ? page.questions.map((q) => (q.id === previous.id ? next : q))
            : insertByDate(page.questions, next);
      const delta = stays ? (shown ? 0 : 1) : shown ? -1 : 0;
      const patched: ProductQuestionPage = {
        questions: rows,
        total: Math.max(0, page.total + delta),
        pending: Math.max(0, page.pending - waitingBefore + waitingAfter),
      };
      keep(prev.key, patched);
      return { ...prev, page: patched };
    });
    setMore((prev) => ({
      key: prev.key,
      items: next === null || !stays ? drop(prev.items) : prev.items.map((q) => (q.id === previous.id ? next : q)),
    }));
  }

  return {
    questions,
    total,
    /** Questions waiting for an answer in the whole store. */
    pending: first.page?.pending ?? 0,
    /** True only while there is nothing to show: a kept page shows at once and refreshes behind. */
    loading: first.page === null && first.error == null,
    error: first.error,
    refresh,
    hasMore: questions.length < total,
    loadingMore,
    loadMore: () => void loadMore(),
    onChanged: (next: ProductQuestion, previous: ProductQuestion) => patch(previous, next),
    onDeleted: (question: ProductQuestion) => patch(question, null),
  };
}

export type QuestionListState = ReturnType<typeof useQuestionList>;
