import { useState } from "react";
import { Button } from "@store-builder/ui";
import { catalogDeleteManualReview, type CatalogReviewExtras, type Review } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { AddReviewDialog } from "./AddReviewDialog";

/** The Reviews page's pieces for reviews the merchant added by hand. */

const STRINGS = {
  en: {
    add: "Add review",
    manual: "Added by you",
    imported: "Imported",
    delete: "Delete",
    deleting: "Deleting…",
    confirm: "Delete this review? This cannot be undone.",
    deleted: "Review deleted.",
  },
  ar: {
    add: "إضافة تقييم",
    manual: "أضفته أنت",
    imported: "مستورد",
    delete: "حذف",
    deleting: "جارٍ الحذف…",
    confirm: "حذف هذا التقييم؟ لا يمكن التراجع.",
    deleted: "تم حذف التقييم.",
  },
} satisfies Messages;

export type ReviewRow = Review & CatalogReviewExtras;

export const isManualReview = (review: Review) => (review as ReviewRow).source === "manual";
/** Added by the merchant — typed in or imported (reviews/import): named, deletable, never "verified". */
const isMerchantAdded = (review: Review) => isManualReview(review) || (review as ReviewRow).source === "import";

/** Who wrote it: the typed name for a manual review, else the customer. */
export function reviewAuthor(review: Review, fallback: string): string {
  const row = review as ReviewRow;
  return (isMerchantAdded(review) ? row.authorName : review.customer?.fullName) || fallback;
}

/** The header button and its dialog. */
export function AddReviewButton({ onAdded }: { onAdded: (review: Review) => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {t.add}
      </Button>
      {open && (
        <AddReviewDialog
          onClose={() => setOpen(false)}
          onAdded={(review) => {
            setOpen(false);
            onAdded(review);
          }}
        />
      )}
    </>
  );
}

export function ManualReviewBadge({ review }: { review: Review }) {
  const t = useT(STRINGS);
  if (!isMerchantAdded(review)) return null;
  return isManualReview(review) ? (
    <StatusBadge value="manual" tone="neutral" text={t.manual} />
  ) : (
    <StatusBadge value="import" tone="neutral" text={t.imported} />
  );
}

export function ReviewPhotos({ review }: { review: Review }) {
  const photos = (review as ReviewRow).photos ?? [];
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" loading="lazy" className="size-16 rounded-[0.5rem] border border-line object-cover" />
        </a>
      ))}
    </div>
  );
}

export function DeleteManualReviewButton({ review, onDeleted }: { review: Review; onDeleted: (id: string) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  if (!isMerchantAdded(review)) return null;

  async function remove() {
    if (busy || !window.confirm(t.confirm)) return;
    setBusy(true);
    try {
      await catalogDeleteManualReview(apiClient, workspaceId, review.id);
      toast.success(t.deleted);
      onDeleted(review.id);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" className="ms-auto text-danger hover:bg-danger-soft" disabled={busy} onClick={() => void remove()}>
      {busy ? t.deleting : t.delete}
    </Button>
  );
}
