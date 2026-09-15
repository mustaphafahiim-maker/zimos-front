import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label, cn } from "@store-builder/ui";
import { BadgeCheck, Check, Clock, Info, MessageCircle, Star, X } from "lucide-react";
import { reviewsList, reviewsModerate, type ReviewDTO, type ReviewStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Toggle } from "@store-builder/ui";
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
    unknownProduct: "Product",
    unknownCustomer: "Customer",
    approve: "Approve",
    reject: "Reject",
    toastApproved: "Review published on the product page.",
    toastRejected: "Review hidden.",
    permission: "You don't have permission to moderate reviews.",
    subscription: "This workspace needs an active subscription to make changes.",
    requestsTitle: "Review requests",
    requestsBody:
      "Only customers with a delivered order can leave a review. Submissions land here as pending reviews.",
    askToggle: "Ask for a review 2 days after delivery",
    askToggleHint: "Only for delivered COD orders, once per order.",
    notSavedHint: "This setting is not saved yet — automatic review requests are coming soon.",
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
    unknownProduct: "منتج",
    unknownCustomer: "عميل",
    approve: "اعتماد",
    reject: "رفض",
    toastApproved: "تم نشر التقييم في صفحة المنتج.",
    toastRejected: "تم إخفاء التقييم.",
    permission: "ليست لديك صلاحية لمراجعة التقييمات.",
    subscription: "تحتاج مساحة العمل إلى اشتراك نشط لإجراء التغييرات.",
    requestsTitle: "طلبات التقييم",
    requestsBody: "يمكن فقط للعملاء الذين استلموا طلبهم ترك تقييم. تصل التقييمات هنا بانتظار المراجعة.",
    askToggle: "اطلب تقييمًا بعد يومين من التسليم",
    askToggleHint: "لطلبات الدفع عند الاستلام المُسلَّمة فقط، مرة واحدة لكل طلب.",
    notSavedHint: "هذا الإعداد لا يُحفظ بعد — طلبات التقييم التلقائية قادمة قريبًا.",
  },
} satisfies Messages;

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
  // Always load the full list: KPIs need every status. The status filter is applied client-side.
  const list = useAsync(() => reviewsList(apiClient, workspaceId), [workspaceId]);
  // Product names by id (reviews already include product.name; this covers the filter and any missing join).
  const productsQ = useAsync(async () => {
    const { products } = await apiClient.listProducts(workspaceId, { limit: 200 });
    return new Map(products.map((p) => [p.id, p.name]));
  }, [workspaceId]);

  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [product, setProduct] = useState("all");
  const [rating, setRating] = useState("all");
  const [askForReview, setAskForReview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reviews = list.data ?? [];

  const productName = (r: ReviewDTO) => r.product?.name ?? productsQ.data?.get(r.productId) ?? t.unknownProduct;

  const products = useMemo(
    () =>
      Array.from(
        new Map(reviews.map((r) => [r.productId, r.product?.name ?? productsQ.data?.get(r.productId) ?? r.productId])).entries()
      ),
    [reviews, productsQ.data]
  );

  const kpis = useMemo(() => {
    const approved = reviews.filter((r) => r.status === "approved");
    const avg = approved.length ? approved.reduce((a, r) => a + r.rating, 0) / approved.length : 0;
    const five = approved.length ? Math.round((approved.filter((r) => r.rating === 5).length / approved.length) * 100) : 0;
    return { avg, approved: approved.length, pending: reviews.filter((r) => r.status === "pending").length, five, hasApproved: approved.length > 0 };
  }, [reviews]);

  const rows = reviews
    .filter((r) => (status === "all" || r.status === status) && (product === "all" || r.productId === product) && (rating === "all" || r.rating === Number(rating)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function formatReviewDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" });
  }

  function actionError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) return t.permission;
      if (err.status === 402 || err.code === "SUBSCRIPTION_REQUIRED") return t.subscription;
    }
    return getErrorMessage(err);
  }

  async function moderate(r: ReviewDTO, action: "approve" | "reject") {
    setBusy(r.id);
    try {
      const updated = await reviewsModerate(apiClient, workspaceId, r.id, action);
      list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: updated.status } : x)));
      toast.success(action === "approve" ? t.toastApproved : t.toastRejected);
    } catch (err) {
      toast.error(actionError(err));
      void list.refresh({ silent: true });
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
            kpis.hasApproved ? (
              <span className="flex flex-wrap items-center gap-2">
                <bdi className="tabular-nums">{kpis.avg.toFixed(1)}</bdi> <Stars rating={kpis.avg} />
              </span>
            ) : (
              "—"
            )
          }
          hint={t.kpiAverageHint}
        />
        <KpiCard label={t.kpiApproved} value={kpis.approved} hint={fmt(t.kpiApprovedHint, { n: reviews.length })} icon={<BadgeCheck />} />
        <KpiCard label={t.kpiPending} value={kpis.pending} hint={t.kpiPendingHint} icon={<Clock />} />
        <KpiCard label={t.kpiFive} value={kpis.hasApproved ? <bdi dir="ltr">{kpis.five}%</bdi> : "—"} hint={t.kpiFiveHint} icon={<Star />} />
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
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CLASS[r.status])}>
                          {STATUS_LABEL[locale][r.status]}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-2 text-sm text-ink" dir="auto">
                          {r.comment}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span dir="auto">{r.customer?.fullName || t.unknownCustomer}</span>
                        <span aria-hidden>·</span>
                        <Link to={`/catalog/${r.productId}`} className="text-primary hover:underline" dir="auto">
                          {productName(r)}
                        </Link>
                        {/* The backend only accepts reviews from customers with a delivered order. */}
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                          <BadgeCheck className="size-3" /> {t.verifiedPurchase}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{formatReviewDate(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      {r.status !== "approved" && (
                        <Button size="sm" variant="ghost" className="text-success" disabled={busy === r.id} onClick={() => moderate(r, "approve")}>
                          <Check /> {t.approve}
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy === r.id} onClick={() => moderate(r, "reject")}>
                          <X /> {t.reject}
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
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-soft px-2 py-1.5 text-[11px] text-warning">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden /> {t.notSavedHint}
          </p>
        </aside>
      </div>
    </div>
  );
}
