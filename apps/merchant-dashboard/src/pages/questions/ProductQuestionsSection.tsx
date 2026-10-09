import { useEffect, useRef } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { IconQuestions } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ProductPageCard, useProductCardFrame } from "@/pages/catalog/components/ProductPageCard";
import { QuestionList } from "./QuestionList";
import { QUESTION_STRINGS } from "./questionStrings";
import { useQuestionList } from "./useQuestionList";

/**
 * The product page's «أسئلة» (handoff 212): this product's questions as the
 * same rows as the inbox — a card each, with Quick Look and the answer sheet.
 * The page has no tabs, so `?tab=questions` — where the "new question"
 * notification points — brings this section into view instead. A product
 * nobody asked about shows nothing, unless the link asked for the section.
 */
export function ProductQuestionsSection({ productId }: { productId: string }) {
  const t = useT(QUESTION_STRINGS);
  const [params] = useSearchParams();
  const asked = params.get("tab") === "questions";
  const list = useQuestionList({ productId });
  const section = useRef<HTMLElement>(null);
  // Where the product page put the section: on its own (the default), or as a part of a group.
  const frame = useProductCardFrame();

  const ready = !list.loading;
  useEffect(() => {
    // Inside a group the frame draws the element: it is found by its id, once the group has opened.
    if (asked && ready) requestAnimationFrame(() => (section.current ?? document.getElementById("questions"))?.scrollIntoView({ block: "start" }));
  }, [asked, ready]);

  if (!asked && (list.loading || list.questions.length === 0)) return null;

  const waiting = list.questions.filter((q) => q.status === "pending").length;

  if (frame !== "card") {
    return (
      <ProductPageCard
        id="questions"
        className="scroll-mt-24"
        title={t.productTitle}
        description={t.productHint}
        badge={waiting > 0 ? <StatusBadge value="pending" tone="warning" text={fmt(t.pendingBadge, { count: waiting })} /> : undefined}
        actions={
          <ViewLink
            to="/questions"
            className="inline-flex min-h-11 items-center rounded-full text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.openInbox}
          </ViewLink>
        }
      >
        <QuestionList
          list={list}
          context="product"
          compact
          label={t.productTitle}
          empty={<EmptyState icon={<IconQuestions aria-hidden />} title={t.productEmpty} description={t.productEmptyBody} className="py-8" />}
        />
      </ProductPageCard>
    );
  }

  return (
    <section ref={section} id="questions" className="scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-medium text-ink">
            {t.productTitle}
            {waiting > 0 && (
              <StatusBadge value="pending" tone="warning" text={fmt(t.pendingBadge, { count: waiting })} className="ms-2 align-middle" />
            )}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">{t.productHint}</p>
        </div>
        <ViewLink
          to="/questions"
          className="inline-flex min-h-11 items-center rounded-full text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.openInbox}
        </ViewLink>
      </div>

      <div className="mt-3">
        <QuestionList
          list={list}
          context="product"
          compact
          label={t.productTitle}
          empty={<EmptyState icon={<IconQuestions aria-hidden />} title={t.productEmpty} description={t.productEmptyBody} className="py-8" />}
        />
      </div>
    </section>
  );
}

/**
 * The "new question" notification links to /products/:id?tab=questions, while
 * the dashboard's product page lives at /catalog/:id: this route hands the
 * link over, query and all.
 */
export function ProductLinkRedirect() {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  return <Navigate to={{ pathname: `/catalog/${productId ?? ""}`, search: location.search, hash: location.hash }} replace />;
}
