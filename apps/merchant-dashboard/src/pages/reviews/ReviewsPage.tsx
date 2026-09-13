import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label, cn } from "@store-builder/ui";
import { BadgeCheck, Camera, Check, Clock, MessageCircle, RotateCcw, Star, X } from "lucide-react";
import type { ProductReview } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(rating) ? "fill-accent text-accent" : "text-line")} />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listReviews(workspaceId), [workspaceId]);

  const [status, setStatus] = useState<"all" | ProductReview["status"]>("all");
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

  async function setSt(r: ProductReview, next: ProductReview["status"]) {
    setBusy(r.id);
    list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    try {
      await mockApi.setReviewStatus(workspaceId, r.id, next);
      toast.success(next === "approved" ? "Review published on the product page." : next === "rejected" ? "Review hidden." : "Review restored to pending.");
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Reviews" description="Moderate what customers say — approved reviews show on the product page and in your ads' social proof." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Average rating"
          value={
            <span className="flex items-center gap-2">
              {kpis.avg.toFixed(1)} <Stars rating={kpis.avg} />
            </span>
          }
          hint="Approved reviews only"
        />
        <KpiCard label="Approved" value={kpis.approved} hint={`${reviews.length} total received`} icon={<BadgeCheck />} />
        <KpiCard label="Pending moderation" value={kpis.pending} hint="Waiting for your decision" icon={<Clock />} />
        <KpiCard label="5-star share" value={`${kpis.five}%`} hint="Of approved reviews" icon={<Star />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-8 w-36 py-1">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">Product</Label>
              <Select value={product} onChange={(e) => setProduct(e.target.value)} className="h-8 w-48 py-1" dir="auto">
                <option value="all">All products</option>
                {products.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-soft">Rating</Label>
              <Select value={rating} onChange={(e) => setRating(e.target.value)} className="h-8 w-28 py-1">
                <option value="all">Any</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage="No reviews match these filters." onRetry={() => list.refresh()}>
            <div className="space-y-3">
              {rows.map((r) => (
                <article key={r.id} className={cn("rounded-[var(--radius-card)] border border-line bg-paper-raised p-4", r.status === "pending" && "border-accent/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={r.rating} />
                        {r.title && (
                          <p className="text-sm font-medium text-ink" dir="auto">
                            {r.title}
                          </p>
                        )}
                        <StatusBadge value={r.status} />
                      </div>
                      <p className="mt-2 text-sm text-ink" dir="auto">
                        {r.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span dir="auto">{r.customerName}</span>
                        <span>·</span>
                        <Link to={`/catalog/${r.productId}`} className="text-primary hover:underline" dir="auto">
                          {r.productName}
                        </Link>
                        {r.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                            <BadgeCheck className="size-3" /> Verified purchase
                          </span>
                        )}
                        {r.photos > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px]">
                            <Camera className="size-3" /> {r.photos} photo{r.photos > 1 ? "s" : ""}
                          </span>
                        )}
                        <span>·</span>
                        <span>{formatDate(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {r.status !== "approved" && (
                        <Button size="sm" variant="ghost" className="text-success" disabled={busy === r.id} onClick={() => setSt(r, "approved")}>
                          <Check /> Approve
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy === r.id} onClick={() => setSt(r, "rejected")}>
                          <X /> Reject
                        </Button>
                      )}
                      {r.status !== "pending" && (
                        <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setSt(r, "pending")}>
                          <RotateCcw /> Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </DataState>
        </div>

        <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
              <MessageCircle className="size-4" />
            </span>
            <p className="text-sm font-medium text-ink">Review requests</p>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Zimos sends a WhatsApp message after delivery asking for a 1–5 rating. Replies land here as pending reviews. Stores that ask get roughly 6× more reviews than stores that wait.
          </p>
          <div className="mt-4">
            <Toggle label="Ask for a review 2 days after delivery" description="Only for delivered COD orders, once per order." checked={askForReview} onChange={setAskForReview} />
          </div>
          <Link to="/automations" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">
            Edit the message in Automations →
          </Link>
        </aside>
      </div>
    </div>
  );
}
