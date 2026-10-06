import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Star, X } from "lucide-react";
import { Alert, Button, Card, cn } from "@store-builder/ui";
import type { Review, ReviewStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { ImportReviewsButton } from "./ImportReviewsDialog";
import { DataState } from "@/components/DataState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import {
  AddReviewButton,
  DeleteManualReviewButton,
  ManualReviewBadge,
  ReviewPhotos,
  reviewAuthor,
  type ReviewRow,
} from "./ManualReviewParts";

/** "" is the All tab — the backend simply omits the status filter. */
type StatusFilter = "" | ReviewStatus;

const STRINGS = {
  en: {
    title: "Reviews",
    description:
      "A customer can review a product once it has been delivered to them. Nothing reaches your storefront until you approve it.",
    filterLabel: "Filter reviews by status",
    tabPending: "Pending",
    tabApproved: "Approved",
    tabRejected: "Rejected",
    tabAll: "All",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    emptyPending: "Nothing is waiting for moderation.",
    emptyApproved: "No reviews have been approved yet.",
    emptyRejected: "No reviews have been rejected.",
    emptyAll: "No reviews yet. They arrive once a customer who received a product writes one.",
    ratingAria: "{n} out of 5",
    unknownProduct: "Deleted product",
    unknownCustomer: "Unnamed customer",
    noComment: "Rated without a comment.",
    approve: "Approve",
    reject: "Reject",
    saving: "Saving…",
    toastApproved: "Review approved — it is live on your storefront.",
    toastRejected: "Review rejected — it stays hidden.",
    onlyImported: "Imported reviews only",
    clearImported: "Imported reviews only — remove this filter",
    emptyImported: "No imported reviews here. Reviews come in with a product imported from an AliExpress, Etsy, CJ or YouCan link.",
  },
  ar: {
    title: "التقييمات",
    description:
      "يستطيع العميل تقييم المنتج بعد استلامه. لا يظهر أي تقييم في متجرك قبل أن توافق عليه.",
    filterLabel: "تصفية التقييمات حسب الحالة",
    tabPending: "قيد المراجعة",
    tabApproved: "مقبولة",
    tabRejected: "مرفوضة",
    tabAll: "الكل",
    statusPending: "قيد المراجعة",
    statusApproved: "مقبول",
    statusRejected: "مرفوض",
    emptyPending: "لا يوجد ما ينتظر المراجعة.",
    emptyApproved: "لم تتم الموافقة على أي تقييم بعد.",
    emptyRejected: "لا توجد تقييمات مرفوضة.",
    emptyAll: "لا توجد تقييمات بعد. تصل بمجرد أن يكتب عميل استلم منتجًا تقييمه.",
    ratingAria: "{n} من 5",
    unknownProduct: "منتج محذوف",
    unknownCustomer: "عميل بدون اسم",
    noComment: "قيّم بدون تعليق.",
    approve: "قبول",
    reject: "رفض",
    saving: "جارٍ الحفظ…",
    toastApproved: "تم قبول التقييم — أصبح ظاهرًا في متجرك.",
    toastRejected: "تم رفض التقييم — سيبقى مخفيًا.",
    onlyImported: "المستوردة بس",
    clearImported: "المستوردة بس — شيل الفلتر ده",
    emptyImported: "مفيش تقييمات مستوردة هنا. التقييمات بتيجي مع المنتج لما تستورده من لينك علي إكسبريس أو إتسي أو CJ أو يوكان.",
  },
} satisfies Messages;

export function ReviewsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  // Pending first: this page is a moderation queue before it is an archive.
  // ?status= and ?source=import come from the product link import (handoff 180).
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>(() => {
    const asked = searchParams.get("status");
    return asked === "all" ? "" : asked === "approved" || asked === "rejected" ? asked : "pending";
  });
  // The API filters by status only; the list is not paged, so the source is filtered here.
  const onlyImported = searchParams.get("source") === "import";

  const list = useAsync(
    () => apiClient.listReviews(workspaceId, { status: status || undefined }),
    [workspaceId, status]
  );
  const reviews = (list.data ?? []).filter((r) => !onlyImported || (r as ReviewRow).source === "import");

  const tabs: ReadonlyArray<FilterTab<StatusFilter>> = [
    { value: "pending", label: t.tabPending },
    { value: "approved", label: t.tabApproved },
    { value: "rejected", label: t.tabRejected },
    { value: "", label: t.tabAll },
  ];

  const emptyMessage = {
    pending: t.emptyPending,
    approved: t.emptyApproved,
    rejected: t.emptyRejected,
    "": t.emptyAll,
  }[status];

  /** A moderated row keeps its joined product/customer (the PATCH response has
   * neither) and leaves the list when it no longer matches the active filter. */
  function applyModeration(updated: Review) {
    list.setData((prev) => {
      const rows = prev ?? [];
      if (status && updated.status !== status) return rows.filter((r) => r.id !== updated.id);
      return rows.map((r) =>
        r.id === updated.id ? { ...r, ...updated, product: r.product, customer: r.customer } : r
      );
    });
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <ImportReviewsButton onImported={() => list.refresh({ silent: true })} />
            <AddReviewButton onAdded={() => list.refresh({ silent: true })} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs tabs={tabs} value={status} onChange={setStatus} label={t.filterLabel} />
        {onlyImported && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("source");
              setSearchParams(next, { replace: true });
            }}
            aria-label={t.clearImported}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] bg-primary-soft px-3 text-sm font-medium text-primary-dark hover:bg-primary-soft/70"
          >
            {t.onlyImported}
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        empty={reviews.length === 0}
        emptyMessage={onlyImported ? t.emptyImported : emptyMessage}
        onRetry={() => list.refresh()}
      >
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onModerated={applyModeration}
              onDeleted={(id) => list.setData((prev) => (prev ?? []).filter((r) => r.id !== id))}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function ReviewCard({
  review,
  onModerated,
  onDeleted,
}: {
  review: Review;
  onModerated: (review: Review) => void;
  onDeleted: (id: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusText = {
    pending: t.statusPending,
    approved: t.statusApproved,
    rejected: t.statusRejected,
  }[review.status];

  async function moderate(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const updated = await apiClient.moderateReview(workspaceId, review.id, action);
      toast.success(action === "approve" ? t.toastApproved : t.toastRejected);
      onModerated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {review.product ? (
            <Link
              to={`/catalog/${review.product.id}`}
              className="font-medium text-ink hover:text-primary"
            >
              {review.product.name}
            </Link>
          ) : (
            <span className="font-medium text-ink-soft">{t.unknownProduct}</span>
          )}
          <p className="mt-0.5 text-sm text-ink-soft">
            {reviewAuthor(review, t.unknownCustomer)} · {formatDate(review.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Stars rating={review.rating} label={fmt(t.ratingAria, { n: review.rating })} />
          <StatusBadge value={review.status} text={statusText} />
          <ManualReviewBadge review={review} />
        </div>
      </div>

      {/* dir="auto" — a shopper's comment is in their language, not the
          dashboard's, so let the browser decide its direction. */}
      <p
        dir={review.comment ? "auto" : undefined}
        className={cn("text-sm", review.comment ? "text-ink" : "text-ink-soft italic")}
      >
        {review.comment || t.noComment}
      </p>

      <ReviewPhotos review={review} />

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => moderate("approve")}
          disabled={busy !== null || review.status === "approved"}
        >
          {busy === "approve" ? t.saving : t.approve}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => moderate("reject")}
          disabled={busy !== null || review.status === "rejected"}
        >
          {busy === "reject" ? t.saving : t.reject}
        </Button>
        <DeleteManualReviewButton review={review} onDeleted={onDeleted} />
      </div>
    </Card>
  );
}

/** Five stars, `rating` of them filled. One label for the whole group so a
 * screen reader reads "4 out of 5", not five separate icons. */
function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            "size-4",
            n <= rating ? "fill-accent text-accent" : "text-line-strong"
          )}
        />
      ))}
    </span>
  );
}
