import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, EyeOff, LayoutTemplate, RefreshCw, X } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  adminMarketplaceList,
  adminMarketplaceReview,
  adminMarketplaceTemplate,
  apiErrorCode,
  type AdminMarketplaceTemplate,
  type MarketplaceCategory,
  type MarketplaceReviewAction,
  type MarketplaceSubmissionStatus,
  type PageElement,
  type PageTree,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow, Drawer } from "@/components/Drawer";
import { FilterChips, TextAreaField } from "@/components/forms";
import { JsonBlock } from "@/components/Panel";
import { Modal } from "@/components/Modal";
import { StatusBadge, humanize, type Tone } from "@/components/StatusBadge";
import { CopyId } from "@/components/CopyId";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import { Pager } from "@/pages/BlocklistPage";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<MarketplaceSubmissionStatus, string> = {
  pending: "Pending review",
  approved: "Listed",
  rejected: "Needs changes",
  withdrawn: "Withdrawn",
};
const STATUS_TONE: Record<MarketplaceSubmissionStatus, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
};
const CATEGORY_LABEL: Record<MarketplaceCategory, string> = {
  ecommerce: "Selling products",
  lead_generation: "Collecting leads",
  webinar: "Webinar",
  digital_product: "Digital product",
  course: "Course",
  service: "Service",
  event: "Event",
  other: "Other",
};
const LANGUAGE_LABEL: Record<string, string> = { ar: "Arabic", en: "English", fr: "French" };

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/**
 * Marketplace review (handoff 192, templates.view / templates.manage): the
 * funnel templates merchants sent to the template marketplace, one status at
 * a time, the longest waiting first. A row opens the review drawer — the
 * card, every page laid out with its words and pictures, the links between
 * pages — where a reviewer approves it (listed for every store), rejects it
 * with a note the merchant sees, or unlists a listed one.
 */
export function MarketplaceReviewPage() {
  const { can } = useAuth();
  const canReview = can(P.TEMPLATES_MANAGE);
  const [status, setStatus] = useState<MarketplaceSubmissionStatus>("pending");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, loading, error, refresh, setData } = useAsync(
    () => adminMarketplaceList(apiClient, { status, page, limit: PAGE_SIZE }),
    [status, page]
  );

  const templates = data?.templates ?? [];
  const options = (Object.keys(STATUS_LABEL) as MarketplaceSubmissionStatus[]).map((value) => ({
    value,
    label: STATUS_LABEL[value],
    count: value === status && data ? data.total : undefined,
  }));

  return (
    <div>
      <PageHeader
        title="Marketplace review"
        description="Funnel templates merchants shared to the template marketplace. Approve one to list it for every store, or reject it with a note the merchant sees."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <FilterChips
        options={options}
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        className="mb-4"
      />

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {templates.length === 0 ? (
          <EmptyBlock message={status === "pending" ? "Nothing is waiting for review." : `No templates are ${STATUS_LABEL[status].toLowerCase()}.`} />
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id}>
                <QueueRow template={t} onOpen={() => setOpenId(t.id)} />
              </li>
            ))}
          </ul>
        )}
        {data && <Pager total={data.total} limit={PAGE_SIZE} offset={(page - 1) * PAGE_SIZE} onOffset={(o) => setPage(o / PAGE_SIZE + 1)} />}
      </DataState>

      <ReviewDrawer
        id={openId}
        canReview={canReview}
        onClose={() => setOpenId(null)}
        onReviewed={(id) => {
          // It left this status: drop it from the list in hand, then close.
          setData((prev) => ({ templates: (prev?.templates ?? []).filter((x) => x.id !== id), total: Math.max(0, (prev?.total ?? 1) - 1) }));
          setOpenId(null);
        }}
      />
    </div>
  );
}

function Thumb({ url, className }: { url: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? (
    <img src={url} alt="" onError={() => setBroken(true)} className={cn("rounded-[10px] border border-line object-cover", className)} />
  ) : (
    <div aria-hidden className={cn("flex items-center justify-center rounded-[10px] bg-primary-soft text-primary", className)}>
      <LayoutTemplate className="size-5" />
    </div>
  );
}

function QueueRow({ template: t, onOpen }: { template: AdminMarketplaceTemplate; onOpen: () => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 sm:flex-row sm:items-center">
      <Thumb url={t.thumbnailUrl} className="size-16 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words font-semibold text-ink" dir="auto">
            {t.name}
          </h2>
          <StatusBadge tone={STATUS_TONE[t.status]} dot>
            {STATUS_LABEL[t.status]}
          </StatusBadge>
        </div>
        <p className="text-sm text-ink-soft">
          <span dir="auto">by {t.authorName}</span> · {CATEGORY_LABEL[t.category]} · {plural(t.stepCount, "page", "pages")}
          {t.status === "approved" && ` · used ${plural(t.usesCount, "time", "times")}`}
        </p>
        <p className="text-xs text-ink-soft">
          Sent {formatDateTime(t.createdAt)} · {t.status === "pending" ? "waiting " : "updated "}
          <span title={formatDateTime(t.updatedAt)}>{formatRelative(t.updatedAt)}</span>
        </p>
        {t.reviewNote && (
          <p className="line-clamp-2 text-sm text-ink">
            <span className="text-ink-soft">Note: </span>
            <bdi>{t.reviewNote}</bdi>
          </p>
        )}
      </div>
      <Button variant={t.status === "pending" ? "default" : "outline"} className="shrink-0" onClick={onOpen}>
        {t.status === "pending" ? "Review" : "Open"}
      </Button>
    </article>
  );
}

function ReviewDrawer({
  id,
  canReview,
  onClose,
  onReviewed,
}: {
  id: string | null;
  canReview: boolean;
  onClose: () => void;
  onReviewed: (id: string) => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const detail = useAsync(() => (id ? adminMarketplaceTemplate(apiClient, id) : Promise.resolve(null)), [id]);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [noting, setNoting] = useState<"reject" | "unlist" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = detail.data;
  const page = t ? (t.pages.find((p) => p.key === pageKey) ?? t.pages[0] ?? null) : null;
  const close = () => {
    setPageKey(null);
    setError(null);
    onClose();
  };

  async function review(action: MarketplaceReviewAction, note?: string) {
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      await adminMarketplaceReview(apiClient, t.id, { action, note: note || undefined });
      toast.success(action === "approve" ? `“${t.name}” is listed.` : action === "reject" ? `“${t.name}” was sent back with your note.` : `“${t.name}” is no longer listed.`);
      setNoting(null);
      setPageKey(null);
      onReviewed(t.id);
    } catch (err) {
      const code = apiErrorCode(err);
      setError(
        code === "SUBMISSION_WITHDRAWN"
          ? "The author withdrew this template, so there is nothing to review."
          : code === "VALIDATION_ERROR"
            ? "Write what the merchant should change."
            : getErrorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  const actions: ReactNode =
    !t || !canReview ? null : t.status === "pending" ? (
      <>
        <Button variant="outline" disabled={busy} onClick={() => setNoting("reject")}>
          <X /> Reject…
        </Button>
        <Button disabled={busy} onClick={() => void review("approve")}>
          <Check /> {busy ? "Approving…" : "Approve"}
        </Button>
      </>
    ) : t.status === "approved" ? (
      <Button variant="outline" disabled={busy} onClick={() => setNoting("unlist")}>
        <EyeOff /> Unlist…
      </Button>
    ) : t.status === "rejected" ? (
      <Button variant="outline" disabled={busy} onClick={() => void review("approve")}>
        <Check /> {busy ? "Approving…" : "Approve anyway"}
      </Button>
    ) : null;

  return (
    <>
      <Drawer
        open={id !== null}
        onClose={close}
        title={t?.name ?? "Template"}
        description={t ? `${STATUS_LABEL[t.status]} · by ${t.authorName}` : undefined}
        className="max-w-3xl"
        footer={
          actions ?? (t && !canReview && t.status !== "withdrawn" ? <p className="text-sm text-ink-soft">Your role can see the queue but not review it.</p> : null)
        }
      >
        <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()}>
          {t && (
            <div className="space-y-5">
              {error && <Alert variant="danger">{error}</Alert>}
              {t.status === "withdrawn" && <Alert>The author withdrew this template. It is out of the marketplace and can't be reviewed.</Alert>}
              <div className="flex flex-col gap-4 sm:flex-row">
                <Thumb url={t.thumbnailUrl} className="aspect-[16/9] w-full shrink-0 sm:w-56" />
                <dl className="min-w-0 flex-1">
                  <DetailRow label="Store">
                    <span className="flex flex-wrap items-center gap-2">
                      {can(P.WORKSPACES_VIEW) ? (
                        <Link to={`/workspaces/${t.workspaceId}`} className="font-medium text-primary hover:underline">
                          Open store
                        </Link>
                      ) : null}
                      <CopyId value={t.workspaceId} />
                    </span>
                  </DetailRow>
                  <DetailRow label="Kind">{CATEGORY_LABEL[t.category]}</DetailRow>
                  <DetailRow label="Language">{t.language ? LANGUAGE_LABEL[t.language] ?? t.language : "—"}</DetailRow>
                  <DetailRow label="Pages">{plural(t.stepCount, "page", "pages")}</DetailRow>
                  <DetailRow label="Sent">{formatDateTime(t.createdAt)}</DetailRow>
                  {t.reviewedAt && <DetailRow label="Last reviewed">{formatDateTime(t.reviewedAt)}</DetailRow>}
                  {t.status === "approved" && <DetailRow label="Used">{plural(t.usesCount, "time", "times")}</DetailRow>}
                </dl>
              </div>
              {t.description && (
                <p className="whitespace-pre-line text-sm text-ink" dir="auto">
                  {t.description}
                </p>
              )}
              {t.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Search words">
                  {t.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-ink" dir="auto">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              {t.reviewNote && (
                <div className="rounded-[10px] border border-line bg-paper px-3 py-2 text-sm">
                  <p className="text-xs font-medium text-ink-soft">Note the merchant sees</p>
                  <p className="whitespace-pre-line text-ink" dir="auto">
                    {t.reviewNote}
                  </p>
                </div>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">Pages</h3>
                {t.pages.length > 1 && (
                  <FilterChips
                    // The name isolated (FSI…PDI) so an Arabic name doesn't pull the number to its far side.
                    options={t.pages.map((p, i) => ({ value: p.key, label: `${i + 1}. \u2068${p.name}\u2069` }))}
                    value={page?.key ?? ""}
                    onChange={setPageKey}
                  />
                )}
                {page && (
                  <>
                    <p className="text-xs text-ink-soft">
                      {humanize(t.steps.find((s) => s.key === page.key)?.stepType ?? "page")} · goes on to{" "}
                      {t.edges
                        .filter((e) => e.fromStepKey === page.key)
                        .map((e) => t.pages.find((p) => p.key === e.toStepKey)?.name ?? e.toStepKey)
                        .join(", ") || "nothing (last page)"}
                    </p>
                    <PagePreview tree={page.builderData} />
                    <details className="text-sm">
                      <summary className="cursor-pointer text-ink-soft hover:text-ink">Page data (JSON)</summary>
                      <JsonBlock value={page.builderData} className="mt-2" />
                    </details>
                  </>
                )}
              </section>
            </div>
          )}
        </DataState>
      </Drawer>

      <NoteDialog
        key={noting ?? "closed"}
        action={noting}
        busy={busy}
        error={noting ? error : null}
        onCancel={() => {
          setNoting(null);
          setError(null);
        }}
        onConfirm={(note) => void review(noting ?? "reject", note)}
      />
    </>
  );
}

/** The note for a rejection (required) or an unlisting (optional), shown to the merchant. */
function NoteDialog({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: "reject" | "unlist" | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const reject = action === "reject";
  return (
    <Modal
      open={action !== null}
      onClose={() => !busy && onCancel()}
      title={reject ? "Reject this template" : "Unlist this template"}
      description={
        reject
          ? "The merchant sees your note under “Needs changes” and can fix the funnel and send it again."
          : "It leaves the marketplace for every store. Funnels already copied from it stay with their stores."
      }
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={reject ? "destructive" : "default"}
            disabled={busy}
            onClick={() => {
              if (reject && !note.trim()) return setMissing(true);
              onConfirm(note.trim());
            }}
          >
            {busy ? "Saving…" : reject ? "Reject" : "Unlist"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextAreaField
          label={reject ? "What should the merchant change?" : "Note for the merchant (optional)"}
          required={reject}
          rows={4}
          maxLength={1000}
          dir="auto"
          value={note}
          error={missing && !note.trim() ? "Write what the merchant should change." : undefined}
          hint="Up to 1,000 characters. Write it in the merchant's language."
          onChange={(e) => {
            setNote(e.target.value);
            setMissing(false);
          }}
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- preview --

const TEXT_KEYS = ["text", "title", "heading", "headline", "subtitle", "subheading", "label", "quote", "author", "content", "html", "caption", "description", "body", "name", "question", "answer", "q", "a", "badge", "buttonLabel", "placeholder"];
const IMAGE_KEYS = ["src", "image", "imageUrl", "poster", "logo", "avatar", "background", "backgroundImage"];
const isImageUrl = (v: string) => /^(https?:)?\/\/|^\/uploads\//i.test(v) && /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(v);
const plainText = (v: string) => v.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Every word and picture an element shows, two levels into its lists (items, slides, questions). */
function contentOf(el: PageElement): { texts: string[]; images: string[] } {
  const texts: string[] = [];
  const images: string[] = [];
  const read = (obj: Record<string, unknown>, depth: number) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && value.trim()) {
        if (IMAGE_KEYS.includes(key) || isImageUrl(value)) {
          if (isImageUrl(value) || /^https?:\/\//i.test(value)) images.push(value);
        } else if (TEXT_KEYS.includes(key)) {
          const text = plainText(value);
          if (text) texts.push(text);
        }
      } else if (depth < 2 && Array.isArray(value)) {
        for (const item of value) {
          // A plain list (features, steps) is an array of strings.
          if (typeof item === "string" && item.trim()) (isImageUrl(item) ? images : texts).push(isImageUrl(item) ? item : plainText(item));
          else if (item && typeof item === "object") read(item as Record<string, unknown>, depth + 1);
        }
      } else if (depth < 2 && value && typeof value === "object") {
        read(value as Record<string, unknown>, depth + 1);
      }
    }
  };
  read(el.props ?? {}, 0);
  return { texts: [...new Set(texts)], images: [...new Set(images)] };
}

/**
 * The page laid out section by section — columns side by side where there is
 * room — with each element's words and pictures, so a reviewer reads what
 * shoppers would. (The storefront render needs the store's own staff
 * session, which the console doesn't have.)
 */
function PagePreview({ tree }: { tree: PageTree | null }) {
  const sections = tree?.sections ?? [];
  if (sections.length === 0) return <EmptyBlock message="This page is empty." />;
  return (
    <ol className="space-y-2">
      {sections.map((section, i) => (
        <li key={section.id ?? i} className="rounded-[10px] border border-line bg-paper p-3">
          <p className="mb-2 text-xs font-medium text-ink-soft">Section {i + 1}</p>
          <div className="space-y-2">
            {(section.rows ?? []).map((row, r) => (
              <div key={row.id ?? r} className="flex flex-wrap gap-2">
                {(row.columns ?? []).map((col, c) => (
                  <div
                    key={col.id ?? c}
                    className="min-w-[12rem] flex-1 space-y-2 rounded-md bg-paper-raised p-2"
                    style={{ flexBasis: `${((col.span ?? 12) / 12) * 100 - 2}%` }}
                  >
                    {(col.elements ?? []).map((el, e) => (
                      <ElementPreview key={el.id ?? e} element={el} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ElementPreview({ element }: { element: PageElement }) {
  const { texts, images } = contentOf(element);
  const type = element.type;
  return (
    <div className="space-y-1">
      <span className="inline-block rounded bg-paper-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">{type}</span>
      {texts.slice(0, 8).map((text, i) =>
        type === "heading" && i === 0 ? (
          <p key={i} className="font-semibold text-ink" dir="auto">
            {text}
          </p>
        ) : type === "button" || type === "upsell_accept_button" || type === "text_link" ? (
          <span key={i} className="me-1 inline-block rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" dir="auto">
            {text}
          </span>
        ) : (
          <p key={i} className="line-clamp-4 text-sm text-ink" dir="auto">
            {text}
          </p>
        )
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.slice(0, 6).map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer noopener" title={src}>
              <img src={src} alt="" loading="lazy" className="h-20 max-w-40 rounded border border-line object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
