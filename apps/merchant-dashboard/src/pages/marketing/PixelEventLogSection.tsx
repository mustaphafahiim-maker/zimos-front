import { useCallback, useEffect, useRef, useState } from "react";
import { IconChecklist, IconRefresh } from "@/components/icons";
import { cn } from "@store-builder/ui";
import {
  trackingPixelsListEvents,
  type TrackingPixelEventDto,
  type TrackingPixelEventStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListRowCard, ListSkeleton } from "@/components/list";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    title: "Server event log",
    summary: "What your store sent to the ad platforms from the server",
    description: "The last {n} events your store sent to the ad platforms from the server, and whether each was accepted.",
    refresh: "Refresh",
    filter: "Filter events by result",
    all: "All",
    sent: "Accepted",
    failed: "Failed",
    emptyTitle: "No server events yet",
    emptyBody: "Events appear here once a pixel has the Conversions API turned on and the store gets visits or orders.",
    emptyFiltered: "No events with this result.",
    colEvent: "Event",
    colPixel: "Pixel",
    colResult: "Result",
    colWhen: "When",
    test: "Test",
    ev_purchase: "Purchase",
    ev_view_content: "Product view",
    ev_add_to_cart: "Add to cart",
    ev_begin_checkout: "Checkout started",
    ev_add_payment_info: "Payment method chosen",
    ev_lead: "Lead",
    ev_page_view: "Page view",
  },
  ar: {
    title: "سجل أحداث السيرفر",
    summary: "اللي متجرك بعته لمنصات الإعلانات من السيرفر",
    description: "آخر {n} حدث متجرك بعته لمنصات الإعلانات من السيرفر، وكل واحد اتقبل ولا لأ.",
    refresh: "حدّث",
    filter: "فلتر الأحداث بالنتيجة",
    all: "الكل",
    sent: "اتقبل",
    failed: "فشل",
    emptyTitle: "لسه مفيش أحداث من السيرفر",
    emptyBody: "الأحداث بتظهر هنا بعد ما تشغّل الـ Conversions API على بيكسل وييجي للمتجر زيارات أو أوردرات.",
    emptyFiltered: "مفيش أحداث بالنتيجة دي.",
    colEvent: "الحدث",
    colPixel: "البيكسل",
    colResult: "النتيجة",
    colWhen: "الوقت",
    test: "تجريبي",
    ev_purchase: "شرا",
    ev_view_content: "مشاهدة منتج",
    ev_add_to_cart: "إضافة للسلة",
    ev_begin_checkout: "بدء الأوردر",
    ev_add_payment_info: "اختيار وسيلة الدفع",
    ev_lead: "عميل محتمل",
    ev_page_view: "فتح صفحة",
  },
} satisfies Messages;

type Filter = "all" | TrackingPixelEventStatus;
const PAGE_SIZE = 50;

const PLATFORM_NAMES: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
  pinterest: "Pinterest",
  // The platforms that gained a server API in handoff 255.
  x: "X (Twitter)",
  reddit: "Reddit",
  microsoft: "Microsoft Ads",
};

/** Marketing → Tracking tools: what the server sent to the ad platforms. */
export function PixelEventLogSection({ reloadKey = 0 }: { reloadKey?: number }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<TrackingPixelEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [keep, setKeep] = useState(500);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const call = useRef(0);

  const load = useCallback(
    async (cursor: string | null, silent = false) => {
      const id = ++call.current;
      if (cursor) setLoadingMore(true);
      else if (!silent) setLoading(true);
      setError(null);
      try {
        const page = await trackingPixelsListEvents(apiClient, workspaceId, {
          limit: PAGE_SIZE,
          cursor,
          status: filter === "all" ? undefined : filter,
        });
        if (id !== call.current) return;
        setEvents((prev) => (cursor ? [...prev, ...page.events] : page.events));
        setNextCursor(page.nextCursor);
        setKeep(page.keep);
      } catch (err) {
        if (id === call.current) setError(err);
      } finally {
        if (id === call.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, filter]
  );

  useEffect(() => {
    void load(null, reloadKey > 0);
  }, [load, reloadKey]);

  const eventLabel = (name: string) => (t as Record<string, string>)[`ev_${name}`] ?? name;
  const compact = useIsCompact();

  const rows = events.map((e) => {
    const title = (
      <>
        <span>{eventLabel(e.eventName)}</span>
        {e.isTest && <span className="ms-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">{t.test}</span>}
      </>
    );
    const result = <StatusBadge value={e.status} tone={e.status === "sent" ? "success" : "danger"} text={e.status === "sent" ? t.sent : t.failed} />;
    const pixel = (
      <>
        {PLATFORM_NAMES[e.platform] ?? e.platform} · <bdi dir="ltr" className="font-mono text-xs">{e.pixelId}</bdi>
      </>
    );
    const when = <time dateTime={e.createdAt}>{formatRelativeTime(e.createdAt)}</time>;
    // The platform's own words, in whatever language it wrote them.
    const problem = e.error ? (
      <p dir="auto" className="text-xs leading-4 wrap-anywhere text-danger">
        {e.error}
      </p>
    ) : null;

    if (compact) {
      return (
        <li key={e.id}>
          <ListRowCard title={title} amount={<span className="text-[13px] font-normal text-ink-soft">{when}</span>} status={result} meta={pixel} footer={problem} />
        </li>
      );
    }
    return (
      <DeskRow key={e.id}>
        <div className="min-w-0">
          <p className="truncate text-sm leading-6 font-medium text-ink">{title}</p>
          {e.eventId && (
            <p dir="ltr" className="truncate text-start font-mono text-xs leading-5 text-ink-soft">
              {e.eventId}
            </p>
          )}
        </div>
        <p className="min-w-0 truncate text-sm text-ink">{pixel}</p>
        <div className="min-w-0">
          {result}
          {problem && <div className="mt-1 max-w-72">{problem}</div>}
        </div>
        <div className="text-end text-xs whitespace-nowrap text-ink-soft">{when}</div>
      </DeskRow>
    );
  });

  return (
    <AccordionSection
      title={t.title}
      summary={t.summary}
      icon={IconChecklist}
      persistKey="marketing:event-log"
      actions={
        <button
          type="button"
          aria-label={t.refresh}
          title={t.refresh}
          disabled={loading}
          onClick={() => void load(null)}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50 motion-safe:active:scale-[0.97] motion-reduce:transition-none"
        >
          <IconRefresh className={cn("size-5", loading && "animate-spin motion-reduce:animate-none")} aria-hidden />
        </button>
      }
    >
      <p className="text-[13px] leading-5 text-ink-soft">{fmt(t.description, { n: keep })}</p>
      <div className="mt-3 flex flex-col gap-3">
        <ChipRow
          label={t.filter}
          value={filter}
          onChange={setFilter}
          className="max-sm:mx-0"
          items={[
            { value: "all", label: t.all },
            { value: "sent", label: t.sent },
            { value: "failed", label: t.failed },
          ]}
        />
        <DataState loading={loading} error={error} onRetry={() => void load(null)} skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}>
          {events.length === 0 ? (
            <EmptyState
              icon={<IconChecklist aria-hidden />}
              title={filter === "all" ? t.emptyTitle : t.emptyFiltered}
              description={filter === "all" ? t.emptyBody : undefined}
            />
          ) : compact ? (
            <ul aria-label={t.title} className="flex flex-col gap-2.5">
              {rows}
            </ul>
          ) : (
            <DeskList
              columns="grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_max-content]"
              label={t.title}
              head={[{ label: t.colEvent }, { label: t.colPixel }, { label: t.colResult }, { label: t.colWhen, end: true }]}
            >
              {rows}
            </DeskList>
          )}
          <LoadMore hasMore={Boolean(nextCursor)} loading={loadingMore} onClick={() => void load(nextCursor)} />
        </DataState>
      </div>
    </AccordionSection>
  );
}
