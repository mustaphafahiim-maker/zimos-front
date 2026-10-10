import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import type { ProductQuestionStatus } from "@store-builder/api-client";
import { EmptyState } from "@/components/EmptyState";
import { IconQuestions } from "@/components/icons";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/i18n/LocaleContext";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { QuestionList } from "./QuestionList";
import { QUESTION_STRINGS } from "./questionStrings";
import { useQuestionList } from "./useQuestionList";

/** "all" is the whole inbox — the API then leaves the status out. */
type Filter = "all" | ProductQuestionStatus;

/** Waiting first: this is an inbox before it is an archive. */
const DEFAULT_FILTER: Filter = "pending";

function filterOf(value: string | null): Filter {
  return value === "all" || value === "published" || value === "hidden" ? value : DEFAULT_FILTER;
}

/**
 * Products → Questions (handoff 212, read products.view): what shoppers asked
 * on product pages. It opens on the ones waiting for an answer, with how many
 * there are on their chip. A row opens Quick Look; «رُد» opens the answer
 * sheet, and answering publishes.
 *
 * `?status=` keeps the chosen chip (all, published, hidden; absent = waiting),
 * so a link can open a given one and coming back lands where the merchant was.
 */
export function QuestionsPage() {
  const t = useT(QUESTION_STRINGS);
  const compact = useIsCompact();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const filter = filterOf(params.get("status"));
  const list = useQuestionList({ status: filter === "all" ? undefined : filter });

  function selectFilter(next: Filter) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === DEFAULT_FILTER) out.delete("status");
        else out.set("status", next);
        return out;
      },
      { replace: true }
    );
  }

  // The API counts the waiting ones in the whole store, whatever the filter; the other chips have no figure to show.
  const chips: ChipItem<Filter>[] = [
    { value: "pending", label: t.tabPending, count: list.pending, tone: "attention" },
    { value: "published", label: t.tabPublished },
    { value: "hidden", label: t.tabHidden },
    { value: "all", label: t.tabAll },
  ];

  const seeAll = (
    <Button variant="outline" className="rounded-full px-5" onClick={() => selectFilter("all")}>
      {t.seeAll}
    </Button>
  );
  const empty =
    filter === "pending" ? (
      // The inbox, when clear, says so as good news — and where the answered ones went.
      <EmptyState icon={<IconQuestions aria-hidden />} tone="success" title={t.emptyPending} description={t.emptyPendingBody} action={seeAll} />
    ) : filter === "all" ? (
      <EmptyState icon={<IconQuestions aria-hidden />} title={t.emptyAll} description={t.emptyAllBody} />
    ) : (
      <EmptyState icon={<IconQuestions aria-hidden />} title={filter === "published" ? t.emptyPublished : t.emptyHidden} action={seeAll} />
    );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the questions: the sentence is for wider screens.
        description={phone ? undefined : t.description}
      />

      <div className="flex flex-col gap-3">
        <ChipRow items={chips} value={filter} onChange={selectFilter} label={t.filterLabel} collapseEmpty={false} countsLoading={list.loading} />
        <QuestionList list={list} context="inbox" compact={compact} label={t.title} empty={empty} />
      </div>
    </div>
  );
}
