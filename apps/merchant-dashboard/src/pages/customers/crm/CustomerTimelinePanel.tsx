import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconActivity, IconBellRinging, IconCash, IconClipboard, IconCoins, IconCourier, IconDocument, IconFailed, IconOrders, IconPacked, IconQuestions, IconShield, IconStar, IconStickyNote, IconUndo, IconUserAdd, IconWallet, type IconComponent } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import {
  customerTimelineGet,
  isInvalidCursorError,
  type CustomerTimelineEvent,
  type CustomerTimelineKind,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime, formatMoney, humanize, parseMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { pluralOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState, SkeletonBar } from "@/components/DataState";
import { ChipRow, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { LOYALTY_KIND_KEY, LOYALTY_STRINGS } from "@/pages/loyalty/loyaltyStrings";
import { STORE_CREDIT_KIND_KEY, STORE_CREDIT_STRINGS } from "@/pages/storeCredit/storeCreditStrings";
import { TIMELINE_STRINGS, type TimelineStrings } from "./timelineStrings";
import { UndeliveredLine } from "@/pages/orders/components/MessageDelivery";

type Filter = "all" | "orders" | "notes" | "reviews" | "wallet" | "other";

/** The kinds behind each chip; "all" asks for everything. */
const FILTER_KINDS: Record<Exclude<Filter, "all">, readonly CustomerTimelineKind[]> = {
  orders: ["order_placed", "order_shipped", "order_delivered", "order_cancelled", "return_requested", "refund", "message_undelivered"],
  notes: ["note", "followup"],
  reviews: ["review", "question"],
  wallet: ["loyalty", "store_credit"],
  other: ["quote", "privacy_request", "referral", "form"],
};

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/* The icon's disc. The kind's name beside it carries the meaning; the colour only helps. */
const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-paper-sunken text-ink-soft",
  info: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

const KIND_LOOK: Record<CustomerTimelineKind, { icon: IconComponent; tone: Tone }> = {
  order_placed: { icon: IconOrders, tone: "info" },
  order_shipped: { icon: IconCourier, tone: "info" },
  order_delivered: { icon: IconPacked, tone: "success" },
  order_cancelled: { icon: IconFailed, tone: "danger" },
  return_requested: { icon: IconUndo, tone: "warning" },
  refund: { icon: IconCash, tone: "warning" },
  note: { icon: IconStickyNote, tone: "neutral" },
  followup: { icon: IconBellRinging, tone: "neutral" },
  review: { icon: IconStar, tone: "info" },
  question: { icon: IconQuestions, tone: "info" },
  loyalty: { icon: IconCoins, tone: "neutral" },
  store_credit: { icon: IconWallet, tone: "neutral" },
  quote: { icon: IconDocument, tone: "neutral" },
  privacy_request: { icon: IconShield, tone: "neutral" },
  referral: { icon: IconUserAdd, tone: "info" },
  form: { icon: IconClipboard, tone: "neutral" },
  message_undelivered: { icon: IconFailed, tone: "danger" },
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const amount = (value: unknown): number => (typeof value === "string" || typeof value === "number" ? parseMoney(value) : 0);
/** The translated wording for a code, or the code itself when it is one this screen doesn't know. */
const worded = (t: TimelineStrings, prefix: string, code: string): string => (t as Record<string, string | undefined>)[`${prefix}${code}`] ?? code;

/** The words of both ledgers, read once per render and handed to the summaries. */
interface Wording {
  t: TimelineStrings;
  loyalty: Record<string, string>;
  credit: Record<string, string>;
}

function productLink(data: Record<string, unknown>): ReactNode {
  const name = text(data.product);
  const id = text(data.productId);
  if (!name) return null;
  if (!id) return <bdi key="product">{name}</bdi>;
  return (
    <Link key="product" to={`/catalog/${id}`} className="font-medium text-primary hover:underline">
      <bdi>{name}</bdi>
    </Link>
  );
}

/** A quoted piece of what someone typed, in its own direction. */
function quoted(key: string, value: string): ReactNode {
  return (
    <bdi key={key} dir="auto">
      {value}
    </bdi>
  );
}

/**
 * The one-line summary of an event, as pieces joined with " · ": what the
 * `data` of its kind says, in the merchant's words. Unknown kinds say nothing
 * beyond their name.
 */
function summaryOf(event: CustomerTimelineEvent, { t, loyalty, credit }: Wording): ReactNode[] {
  const d = event.data ?? {};
  const parts: ReactNode[] = [];
  const add = (piece: ReactNode) => {
    if (piece !== null && piece !== undefined && piece !== "" && piece !== false) parts.push(piece);
  };
  switch (event.kind) {
    case "order_placed":
      add(formatMoney(amount(d.total), text(d.currency) || undefined));
      if (text(d.paymentMethod)) add(humanize(text(d.paymentMethod)));
      if (d.isTest === true) add(t.testOrder);
      break;
    case "order_shipped":
    case "order_delivered":
      if (text(d.carrier)) add(<bdi key="carrier">{providerName(text(d.carrier))}</bdi>);
      if (text(d.waybill)) add(<bdi key="waybill">{fmt(t.waybill, { number: text(d.waybill) })}</bdi>);
      if (event.kind === "order_shipped" && /^https?:\/\//.test(text(d.trackingUrl))) {
        add(
          <a key="track" href={text(d.trackingUrl)} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
            {t.track}
          </a>
        );
      }
      break;
    case "order_cancelled":
      if (text(d.reason)) add(quoted("reason", worded(t, "cancel_", text(d.reason))));
      break;
    case "return_requested": {
      // "damaged: the box was open" — the reason's code, then what was typed with it.
      const [, code = "", detail = ""] = /^([a-z_]+)(?::\s*([\s\S]*))?$/.exec(text(d.reason)) ?? [];
      if (code) add(worded(t, "return_", code));
      else if (text(d.reason)) add(quoted("reason", text(d.reason)));
      if (detail) add(quoted("detail", detail));
      if (text(d.status)) add(worded(t, "returnStatus_", text(d.status)));
      break;
    }
    case "refund":
      add(formatMoney(amount(d.amount), text(d.currency) || undefined));
      if (text(d.status)) add(worded(t, "refundStatus_", text(d.status)));
      if (text(d.reason)) add(quoted("reason", text(d.reason)));
      break;
    case "note":
      if (d.pinned === true) add(t.notePinned);
      if (text(d.body)) add(quoted("body", text(d.body)));
      if (text(d.author)) add(<bdi key="author">{fmt(t.noteBy, { name: text(d.author) })}</bdi>);
      break;
    case "followup": {
      const due = text(d.dueAt);
      if (text(d.title)) add(quoted("title", text(d.title)));
      if (text(d.doneAt)) add(t.followupDone);
      else if (due && new Date(due).getTime() < Date.now()) add(t.followupOverdue);
      if (due) add(fmt(t.followupDue, { when: formatDateTime(due) }));
      if (text(d.assignee)) add(<bdi key="assignee">{fmt(t.followupFor, { name: text(d.assignee) })}</bdi>);
      break;
    }
    case "review":
      if (typeof d.rating === "number") add(fmt(t.rating, { n: d.rating }));
      add(productLink(d));
      if (text(d.comment)) add(quoted("comment", text(d.comment)));
      if (text(d.status)) add(worded(t, "reviewStatus_", text(d.status)));
      break;
    case "question":
      add(productLink(d));
      if (text(d.question)) add(quoted("question", text(d.question)));
      add(text(d.status) === "hidden" ? t.questionHidden : text(d.answer) ? t.questionAnswered : t.questionWaiting);
      break;
    case "loyalty": {
      const kind = text(d.kind);
      const key = (LOYALTY_KIND_KEY as Record<string, string | undefined>)[kind];
      add((key && loyalty[key]) || worded(t, "ledger_", kind));
      if (typeof d.points === "number" && d.points !== 0) {
        add(
          <bdi key="points" className="tabular-nums">
            {d.points > 0 ? "+" : "−"}
            {pluralOf(loyalty, "points", Math.abs(d.points))}
          </bdi>
        );
      }
      if (typeof d.balanceAfter === "number") add(fmt(t.balanceAfter, { amount: pluralOf(loyalty, "points", d.balanceAfter) }));
      break;
    }
    case "store_credit": {
      const kind = text(d.kind);
      const currency = text(d.currency) || undefined;
      const key = (STORE_CREDIT_KIND_KEY as Record<string, string | undefined>)[kind];
      const change = amount(d.amount);
      add((key && credit[key]) || worded(t, "ledger_", kind));
      if (change !== 0) {
        add(
          <bdi key="amount" className="tabular-nums">
            {change > 0 ? "+" : "−"}
            {formatMoney(Math.abs(change), currency)}
          </bdi>
        );
      }
      if (d.balanceAfter !== undefined && d.balanceAfter !== null) add(fmt(t.balanceAfter, { amount: formatMoney(amount(d.balanceAfter), currency) }));
      break;
    }
    case "quote":
      if (text(d.number)) add(<bdi key="number">{fmt(t.quoteNumber, { number: text(d.number) })}</bdi>);
      if (text(d.status)) add(worded(t, "quoteStatus_", text(d.status)));
      if (text(d.validUntil)) add(fmt(t.quoteValidUntil, { date: formatDate(text(d.validUntil)) }));
      break;
    case "privacy_request":
      if (text(d.kind)) add(worded(t, "privacy_", text(d.kind)));
      if (text(d.status)) add(worded(t, "privacyStatus_", text(d.status)));
      break;
    case "referral":
      if (text(d.friend)) add(<bdi key="friend">{fmt(t.referralFriend, { name: text(d.friend) })}</bdi>);
      if (text(d.status)) add(worded(t, "referralStatus_", text(d.status)));
      break;
    case "message_undelivered":
      // The line itself says what happened (the title); under it, which message it was.
      if (text(d.subject)) add(quoted("subject", text(d.subject)));
      break;
    case "form":
      if (text(d.form)) add(quoted("form", text(d.form)));
      if (text(d.message)) add(quoted("message", text(d.message)));
      break;
  }
  return parts;
}

/**
 * Customer page → «كل اللي حصل» (handoff 250): everything that happened with
 * this customer in one feed, newest first — an icon per kind, when («من
 * ساعتين», the full date on hover), a one-line summary and a link to the
 * order or the product. The chips narrow it; «عرض المزيد» pages back in time.
 *
 * It is the body of the page's «كل اللي حصل» section, read when the section
 * is opened: no pane of its own, the section around it is the pane.
 */
export function CustomerTimelinePanel({ customerId }: { customerId: string }) {
  const t = useT(TIMELINE_STRINGS);
  const loyalty = useT(LOYALTY_STRINGS);
  const credit = useT(STORE_CREDIT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useCursorList<CustomerTimelineEvent>(
    async (cursor) => {
      const page = await customerTimelineGet(apiClient, workspaceId, customerId, {
        limit: 30,
        cursor,
        kinds: filter === "all" ? undefined : FILTER_KINDS[filter],
      });
      return { items: page.events, nextCursor: page.next };
    },
    [workspaceId, customerId, filter],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filter_all },
    { value: "orders", label: t.filter_orders },
    { value: "notes", label: t.filter_notes },
    { value: "reviews", label: t.filter_reviews },
    { value: "wallet", label: t.filter_wallet },
    { value: "other", label: t.filter_other },
  ];
  const wording: Wording = { t, loyalty, credit };

  return (
    <div className="min-w-0 space-y-4">
      <ChipRow items={chips} value={filter} onChange={setFilter} label={t.filterLabel} />

      <DataState loading={list.loading} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton={<TimelineSkeleton />}>
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span
              aria-hidden
              data-slot="home-chip"
              data-tone="neutral"
              className="flex size-12 items-center justify-center rounded-2xl bg-paper-sunken text-ink-soft"
            >
              <IconActivity className="size-6" weight="duotone" />
            </span>
            <p className="text-sm leading-6 text-ink-soft">{filter === "all" ? t.empty : t.emptyFiltered}</p>
            {filter !== "all" && (
              <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setFilter("all")}>
                {t.showAll}
              </Button>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            <ol>
              {list.items.map((event, index) => {
                const look = (KIND_LOOK as Record<string, { icon: IconComponent; tone: Tone } | undefined>)[event.kind] ?? { icon: IconActivity, tone: "neutral" as Tone };
                const Icon = look.icon;
                const summary = summaryOf(event, wording);
                const last = index === list.items.length - 1;
                return (
                  // A shipment is both «اتشحن» and «اتسلّم»: the kind is part of the key.
                  <li key={`${event.kind}:${event.id}`} className={cn("relative flex gap-3", !last && "pb-5")}>
                    {/* The thread that joins one event to the next. */}
                    {!last && <span aria-hidden data-slot="customer-thread" className="absolute start-[1.125rem] top-10 bottom-1 w-px bg-line" />}
                    <span data-slot="customer-event" data-tone={look.tone} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TONE_CLASS[look.tone])}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="min-w-0 text-sm font-medium text-ink">
                          {event.kind === "message_undelivered" ? (
                            <UndeliveredLine channel={event.data?.channel} status={event.data?.status} reason={event.data?.reason} />
                          ) : (
                            ((t as Record<string, string | undefined>)[`kind_${event.kind}`] ?? t.kind_unknown)
                          )}
                          {event.orderId && event.orderNumber && (
                            <>
                              {" · "}
                              <Link to={`/orders/${event.orderId}`} className="font-medium text-primary hover:underline">
                                <bdi dir="ltr">{event.orderNumber}</bdi>
                              </Link>
                            </>
                          )}
                        </p>
                        <time dateTime={event.at} title={formatDateTime(event.at)} className="shrink-0 text-xs text-ink-soft">
                          {formatRelativeTime(event.at)}
                        </time>
                      </div>
                      {summary.length > 0 && (
                        <p className="mt-0.5 line-clamp-2 break-words text-sm text-ink-soft">
                          {summary.map((piece, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              {piece}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {/* A failed «عرض المزيد»: the events already shown stay, with the reason under them. */}
            {list.error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {errorMessage(list.error)}
              </p>
            ) : null}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </div>
        )}
      </DataState>
    </div>
  );
}

/** The feed while it loads: four events, each a disc and two lines. */
function TimelineSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 pb-5 last:pb-0">
          <SkeletonBar className="size-9 shrink-0" />
          <div className="min-w-0 flex-1 pt-1.5">
            <SkeletonBar className="w-2/5" />
            <SkeletonBar className="mt-2.5 h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
