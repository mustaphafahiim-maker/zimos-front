import { useState } from "react";
import { Plus, Star } from "lucide-react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import { catalogCreateManualReview, type Review } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ImageUrlInput } from "../catalog/components/ImageUrlInput";

/**
 * Adding a review by hand (SPEC §7.7): a real review that reached the
 * merchant on WhatsApp, in comments or in person. It goes live at once and
 * never carries the "verified buyer" badge.
 */

const MAX_PHOTOS = 6;

const STRINGS = {
  en: {
    title: "Add a review",
    description:
      "For real reviews you received somewhere else — WhatsApp, comments, a phone call. It is shown without the “verified buyer” badge.",
    product: "Product",
    chooseProduct: "Choose a product",
    name: "Customer name",
    rating: "Rating",
    ratingOf: "{n} out of 5",
    comment: "What they said",
    photos: "Photos",
    addPhoto: "Add photo",
    publish: "Show in the store now",
    missing: "Choose the product and enter the customer's name.",
    cancel: "Cancel",
    add: "Add review",
    adding: "Adding…",
    added: "Review added.",
  },
  ar: {
    title: "إضافة تقييم",
    description:
      "للتقييمات الحقيقية التي وصلتك من مكان آخر — واتساب، تعليقات، مكالمة. يظهر بدون علامة «مشترٍ موثّق».",
    product: "المنتج",
    chooseProduct: "اختر منتجًا",
    name: "اسم العميل",
    rating: "التقييم",
    ratingOf: "{n} من 5",
    comment: "ماذا قال",
    photos: "الصور",
    addPhoto: "إضافة صورة",
    publish: "إظهاره في المتجر الآن",
    missing: "اختر المنتج واكتب اسم العميل.",
    cancel: "إلغاء",
    add: "إضافة التقييم",
    adding: "بنضيف…",
    added: "تمت إضافة التقييم.",
  },
} satisfies Messages;

export function AddReviewDialog({
  productId: fixedProductId,
  onClose,
  onAdded,
}: {
  /** Set when opened from a product: the picker is skipped. */
  productId?: string;
  onClose: () => void;
  onAdded: (review: Review) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const products = useAsync(
    () =>
      fixedProductId
        ? Promise.resolve(null)
        : apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }),
    [workspaceId, fixedProductId]
  );

  const [productId, setProductId] = useState(fixedProductId ?? "");
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!productId || !authorName.trim()) {
      setError(t.missing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const review = await catalogCreateManualReview<Review>(apiClient, workspaceId, {
        productId,
        authorName: authorName.trim(),
        rating,
        comment: comment.trim() || null,
        photos: photos.filter(Boolean),
        status: publish ? "approved" : "pending",
      });
      toast.success(t.added);
      onAdded(review);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? t.adding : t.add}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedProductId && (
          <div className="space-y-1.5">
            <Label htmlFor="review-product">{t.product}</Label>
            <Select
              id="review-product"
              value={productId}
              disabled={busy || products.loading}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">{t.chooseProduct}</option>
              {(products.data?.products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-name">{t.name}</Label>
            <Input
              id="review-name"
              maxLength={120}
              value={authorName}
              disabled={busy}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink">{t.rating}</legend>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={fmt(t.ratingOf, { n })}
                  aria-pressed={rating === n}
                  disabled={busy}
                  onClick={() => setRating(n)}
                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[0.5rem] hover:bg-paper"
                >
                  <Star className={cn("size-6", n <= rating ? "fill-accent text-accent" : "text-line-strong")} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="review-comment">{t.comment}</Label>
          <Textarea
            id="review-comment"
            dir="auto"
            maxLength={2000}
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t.photos}</p>
          {photos.map((url, index) => (
            <ImageUrlInput
              key={index}
              value={url}
              disabled={busy}
              onChange={(next) =>
                setPhotos((current) =>
                  next ? current.map((p, i) => (i === index ? next : p)) : current.filter((_, i) => i !== index)
                )
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={busy || photos.length >= MAX_PHOTOS || photos.some((p) => !p)}
            onClick={() => setPhotos((current) => [...current, ""])}
          >
            <Plus className="size-4" aria-hidden />
            {t.addPhoto}
          </Button>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={publish}
            disabled={busy}
            onChange={(e) => setPublish(e.target.checked)}
          />
          {t.publish}
        </label>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
