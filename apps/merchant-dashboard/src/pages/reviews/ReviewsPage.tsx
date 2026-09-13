import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label, cn } from "@store-builder/ui";
import { ArrowRight, BadgeCheck, Camera, Check, Clock, MessageCircle, RotateCcw, Star, X } from "lucide-react";
import type { ProductReview } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Toggle } from "@/components/Toggle";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Reviews",
    description: "Moderate what customers say — approved reviews show on the product page and in your ads' social proof.",
    ratingAria: "{rating} out of 5",
    kpiAverage: "Average rating",
    kpiAverageHint: "Approved reviews only",
    kpiApproved: "Approved",
    kpiApprovedHint: "{n} total received",
    kpiPending: "Pending moderation",
    kpiPendingHint: "Waiting for your decision",
    kpiFive: "5-star share",
    kpiFiveHint: "Of approved reviews",
    product: "Product",
    allProducts: "All products",
    rating: "Rating",
    anyRating: "Any",
    nStars: "{n} stars",
    oneStar: "1 star",
    empty: "No reviews match these filters.",
    verifiedPurchase: "Verified purchase",
    photos: "{n} photos",
    onePhoto: "1 photo",
    approve: "Approve",
    reject: "Reject",
    restore: "Restore",
    toastApproved: "Review published on the product page.",
    toastRejected: "Review hidden.",
    toastPending: "Review restored to pending.",
    requestsTitle: "Review requests",
    requestsBody:
      "ZIMOS sends a WhatsApp message after delivery asking for a 1–5 rating. Replies land here as pending reviews. Stores that ask get roughly 6× more reviews than stores that wait.",
    askToggle: "Ask for a review 2 days after delivery",
    askToggleHint: "Only for delivered COD orders, once per order.",
    editInAutomations: "Edit the message in Automations",
  },
  ar: {
    title: "التقييمات",
    description: "راجع آراء العملاء — التقييمات المعتمدة تظهر في صفحة المنتج وكدليل اجتماعي في إعلاناتك.",
    ratingAria: "{rating} من 5",
    kpiAverage: "متوسط التقييم",
    kpiAverageHint: "التقييمات المعتمدة فقط",
    kpiApproved: "معتمدة",
    kpiApprovedHint: "{n} تقييم مستلم إجمالًا",
    kpiPending: "بانتظار المراجعة",
    kpiPendingHint: "في انتظار قرارك",
    kpiFive: "نسبة الخمس نجوم",
    kpiFiveHint: "من التقييمات المعتمدة",
    product: "المنتج",
    allProducts: "كل المنتجات",
    rating: "التقييم",
    anyRating: "أي تقييم",
    nStars: "{n} نجوم",
    oneStar: "نجمة واحدة",
    empty: "لا توجد تقييمات تطابق هذه الفلاتر.",
    verifiedPurchase: "شراء مؤكَّد",
    photos: "{n} صور",
    onePhoto: "صورة واحدة",
    approve: "اعتماد",
    reject: "رفض",
    restore: "استرجاع",
    toastApproved: "تم نشر التقييم في صفحة المنتج.",
    toastRejected: "تم إخفاء التقييم.",
    toastPending: "تمت إعادة التقييم إلى قيد المراجعة.",
    requestsTitle: "طلبات التقييم",
    requestsBody:
      "ZIMOS ترسل رسالة WhatsApp بعد التسليم تطلب تقييمًا من 1 إلى 5. تصل الردود هنا كتقييمات بانتظار المراجعة. المتاجر التي تطلب التقييم تحصل على تقييمات أكثر بنحو 6 أضعاف من المتاجر التي تنتظر.",
    askToggle: "اطلب تقييمًا بعد يومين من التسليم",
    askToggleHint: "لطلبات الدفع عند الاستلام المُسلَّمة فقط، مرة واحدة لكل طلب.",
    editInAutomations: "عدّل الرسالة من الأتمتة",
  },
} satisfies Messages;

type ReviewStatus = ProductReview["status"];

const STATUS_LABEL: Record<Locale, Record<ReviewStatus, string>> = {
  en: { pending: "Pending", approved: "Approved", rejected: "Rejected" },
  ar: { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" },
};

const STATUS_CLASS: Record<ReviewStatus, string> = {
  pending: "bg-warning-soft text-warning border-warning/30",
  approved: "bg-primary-soft text-primary border-primary/25",
  rejected: "bg-danger-soft text-danger border-danger/25",
};

const STATUS_OPTIONS: ReviewStatus[] = ["pending", "approved", "rejected"];

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  const t = useT(STRINGS);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={fmt(t.ratingAria, { rating: rating.toFixed(1) })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(rating) ? "fill-warning text-warning" : "text-line")} />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale, intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listReviews(workspaceId), [workspaceId]);

  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [product, setProduct] = useState("all");
  const [rating, setRating] = useState("all");
  const [askForReview, setAskForReview] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reviews = list.data ?? [];
  const products = useMemo(() => Array.from(new Map(reviews.map((r) => [r.productId, r.productName])).entries()), [reviews]);

  const kpis = useMemo(() => {
    const approved = reviews.filter((r) => r.status === "approved");
    const avg = approved.length ? approved.reduce((a, r) => a + r.rating, 0) / approved.length : 0;
    const five = approved.length ? Math.round((approved.filter((r) => r.rating === 5).length / approved.length) * 100) : 0;
    return { avg, approved: approved.length, pending: reviews.filter((r) => r.status === "pending").length, five };
  }, [reviews]);

  const rows = reviews
    .filter((r) => (status === "all" || r.status === status) && (product === "all" || r.productId === product) && (rating === "all" || r.rating === Number(rating)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function formatReviewDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" });
  }

  async function setSt(r: ProductReview, next: ReviewStatus) {
    setBusy(r.id);
    list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    try {
      await mockApi.setReviewStatus(workspaceId, r.id, next);
      toast.success(next === "approved" ? t.toastApproved : next === "rejected" ? t.toastRejected : t.toastPending);
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t.kpiAverage}
          value={
            <span className="flex flex-wrap items-center gap-2">
              <bdi className="tabular-nums">{kpis.avg.toFixed(1)}</bdi> <Stars rating={kpis.avg} />
            </span>
          }
          hint={t.kpiAverageHint}
        />
        <KpiCard label={t.kpiApproved} value={kpis.approved} hint={fmt(t.kpiApprovedHint, { n: reviews.length })} icon={<BadgeCheck />} />
        <KpiCard label={t.kpiPending} value={kpis.pending} hint={t.kpiPendingHint} icon={<Clock />} />
        <KpiCard label={t.kpiFive} value={<bdi dir="ltr">{kpis.five}%</bdi>} hint={t.kpiFiveHint} icon={<Star />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">{c.status}</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-8 w-36 py-1" aria-label={c.status}>
                <option value="all">{c.all}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[locale][s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">{t.product}</Label>
              <Select value={product} onChange={(e) => setProduct(e.target.value)} className="h-8 w-48 py-1" dir="auto" aria-label={t.product}>
                <option value="all">{t.allProducts}</option>
                {products.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">{t.rating}</Label>
              <Select value={rating} onChange={(e) => setRating(e.target.value)} className="h-8 w-32 py-1" aria-label={t.rating}>
                <option value="all">{t.anyRating}</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t.oneStar : fmt(t.nStars, { n })}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
            <div className="space-y-3">
              {rows.map((r) => (
                <article key={r.id} className={cn("rounded-2xl border border-line bg-paper-raised p-4", r.status === "pending" && "border-warning/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={r.rating} />
                        {r.title && (
                          <p className="text-sm font-semibold text-ink" dir="auto">
                            {r.title}
                          </p>
                        )}
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CLASS[r.status])}>
                          {STATUS_LABEL[locale][r.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-ink" dir="auto">
                        {r.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span dir="auto">{r.customerName}</span>
                        <span aria-hidden>·</span>
                        <Link to={`/catalog/${r.productId}`} className="text-primary hover:underline" dir="auto">
                          {r.productName}
                        </Link>
                        {r.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                            <BadgeCheck className="size-3" /> {t.verifiedPurchase}
                          </span>
                        )}
                        {r.photos > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px]">
                            <Camera className="size-3" /> {r.photos === 1 ? t.onePhoto : fmt(t.photos, { n: r.photos })}
                          </span>
                        )}
                        <span aria-hidden>·</span>
                        <span>{formatReviewDate(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      {r.status !== "approved" && (
                        <Button size="sm" variant="ghost" className="text-success" disabled={busy === r.id} onClick={() => setSt(r, "approved")}>
                          <Check /> {t.approve}
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy === r.id} onClick={() => setSt(r, "rejected")}>
                          <X /> {t.reject}
                        </Button>
                      )}
                      {r.status !== "pending" && (
                        <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setSt(r, "pending")}>
                          <RotateCcw /> {t.restore}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </DataState>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-paper-raised p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
              <MessageCircle className="size-4" />
            </span>
            <p className="text-sm font-semibold text-ink">{t.requestsTitle}</p>
          </div>
          <p className="mt-2 text-xs text-ink-soft">{t.requestsBody}</p>
          <div className="mt-4">
            <Toggle label={t.askToggle} description={t.askToggleHint} checked={askForReview} onChange={setAskForReview} />
          </div>
          <Link to="/automations" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {t.editInAutomations}
            <ArrowRight className="size-3 rtl:rotate-180" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
