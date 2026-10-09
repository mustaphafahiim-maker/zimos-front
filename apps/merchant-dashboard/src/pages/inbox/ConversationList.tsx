import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import type { InboxConversation, InboxCounts } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconChat, IconCheck, IconCopy, IconInbox, IconPhone, IconPlus, IconSearch, IconSuccess, IconUndo, IconUser } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { dialNumber } from "./inboxScreen";

const STRINGS = {
  en: {
    listLabel: "Conversations",
    search: "Search name or phone",
    statusLabel: "Open or closed",
    open: "Open",
    closed: "Closed",
    scopeLabel: "Filter conversations",
    all: "All",
    mine: "Mine",
    unreadScope: "Unread",
    unread: "{count} unread",
    assignedTo: "With {name}",
    noConversations: "No conversations yet",
    noConversationsHint: "New customer messages show up here by themselves. You can also start one with an approved template.",
    newMessage: "New message",
    noResults: "No conversation matches this search",
    clearSearch: "Clear the search",
    noUnread: "Nothing unread — you are all caught up",
    noMine: "No conversation is assigned to you",
    noClosed: "No closed conversations",
    showAll: "Show all conversations",
    showOpen: "Show open conversations",
    menuLabel: "Actions for this conversation",
    menuOpen: "Open the conversation",
    menuCustomer: "Customer page",
    menuCall: "Call",
    menuCopy: "Copy the number",
    menuClose: "Close the conversation",
    menuReopen: "Reopen the conversation",
    copied: "The customer's number is copied",
    copyFailed: "We couldn't copy that. Try again.",
  },
  ar: {
    listLabel: "المحادثات",
    search: "دوّر بالاسم أو الرقم",
    statusLabel: "مفتوحة ولا مقفولة",
    open: "مفتوحة",
    closed: "مقفولة",
    scopeLabel: "فلتر المحادثات",
    all: "الكل",
    mine: "محادثاتي",
    unreadScope: "مش مقروءة",
    unread: "{count} مش مقروءة",
    assignedTo: "مع {name}",
    noConversations: "مفيش محادثات لسه",
    noConversationsHint: "رسايل العملاء الجديدة بتظهر هنا لوحدها. وتقدر تبدأ إنت محادثة بقالب متوافق عليه.",
    newMessage: "رسالة جديدة",
    noResults: "مفيش محادثة بالبحث ده",
    clearSearch: "امسح البحث",
    noUnread: "مفيش حاجة مش مقروءة — إنت مخلّص كله",
    noMine: "مفيش محادثة متسندة ليك",
    noClosed: "مفيش محادثات مقفولة",
    showAll: "شوف كل المحادثات",
    showOpen: "شوف المحادثات المفتوحة",
    menuLabel: "إجراءات المحادثة",
    menuOpen: "افتح المحادثة",
    menuCustomer: "صفحة العميل",
    menuCall: "اتصل",
    menuCopy: "انسخ الرقم",
    menuClose: "اقفل المحادثة",
    menuReopen: "افتح المحادثة تاني",
    copied: "رقم العميل اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
  },
} satisfies Messages;

export type InboxScope = "all" | "mine" | "unread";
export type InboxStatus = InboxConversation["status"];

/** The round mark of a customer: their first letter, or a figure when only the number is known. */
export function ChatAvatar({ name, className }: { name: string | null; className?: string }) {
  const letter = name?.trim() ? Array.from(name.trim())[0] : null;
  return (
    <span
      aria-hidden
      data-slot="chat-avatar"
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[15px] leading-none font-semibold text-primary", className)}
    >
      {letter ?? <IconUser className="size-[18px]" />}
    </span>
  );
}

/** How many messages wait unread, in the brand bead. */
function UnreadBead({ count, label }: { count: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      data-slot="chat-unread"
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-none font-semibold text-primary-foreground tabular-nums"
    >
      {fmt("{n}", { n: count })}
    </span>
  );
}

/** The list while it loads, inside the desktop pane: the shape of its rows. */
function PaneSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-1 p-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex min-h-[4.5rem] items-center gap-3 px-3">
          <SkeletonBar className="size-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <SkeletonBar className={cn("h-3.5", i % 2 ? "w-2/5" : "w-1/2")} />
              <SkeletonBar className="ms-auto h-2.5 w-10" />
            </div>
            <SkeletonBar className={cn("h-2.5", i % 3 ? "w-3/4" : "w-3/5")} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface ConversationListProps {
  /** A phone: the rows are cards in the page. Otherwise they are the lines of the pane. */
  phone: boolean;
  conversations: readonly InboxConversation[];
  selectedId: string | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** What is in the field now; the request behind it is the page's to delay. */
  searchInput: string;
  onSearchInput: (value: string) => void;
  /** The search the rows on screen answer to. */
  search: string;
  status: InboxStatus;
  onStatus: (status: InboxStatus) => void;
  scope: InboxScope;
  onScope: (scope: InboxScope) => void;
  counts: InboxCounts | null;
  onOpen: (conversation: InboxConversation) => void;
  onToggleStatus: (conversation: InboxConversation) => void;
  onNewMessage: () => void;
  className?: string;
}

/**
 * The conversations: one toolbar (search, open / closed), the three scopes as
 * chips with how many open conversations wait in each, then the rows. On a
 * phone a row is a card of the list kit; in the pane it is a line that lights
 * up when it is the open one. A press opens the conversation; right-click or
 * a long press gives the row's menu (customer page, call, copy, close).
 */
export function ConversationList({
  phone,
  conversations,
  selectedId,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  searchInput,
  onSearchInput,
  search,
  status,
  onStatus,
  scope,
  onScope,
  counts,
  onOpen,
  onToggleStatus,
  onNewMessage,
  className,
}: ConversationListProps) {
  const t = useT(STRINGS);
  const toast = useToast();
  const navigate = useViewNavigate();

  function copyNumber(phoneNumber: string) {
    void navigator.clipboard
      ?.writeText(phoneNumber)
      .then(() => toast.success(t.copied))
      .catch(() => toast.error(t.copyFailed));
  }

  function menuOf(c: InboxConversation): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconChat, onSelect: () => onOpen(c) }];
    if (c.customerId) {
      const customerId = c.customerId;
      items.push({ id: "customer", label: t.menuCustomer, icon: IconUser, onSelect: () => navigate(`/customers/${customerId}`) });
    }
    items.push({
      id: "call",
      label: t.menuCall,
      icon: IconPhone,
      separatorBefore: true,
      onSelect: () => {
        window.location.href = `tel:${dialNumber(c.phone)}`;
      },
    });
    items.push({ id: "copy", label: t.menuCopy, icon: IconCopy, onSelect: () => copyNumber(c.phone) });
    items.push({
      id: "status",
      label: c.status === "open" ? t.menuClose : t.menuReopen,
      icon: c.status === "open" ? IconCheck : IconUndo,
      separatorBefore: true,
      onSelect: () => onToggleStatus(c),
    });
    return items;
  }

  // The counts are of open conversations: beside a closed list they would say something else.
  const figure = (n: number | undefined) => (status === "open" ? (n ?? null) : undefined);
  const chips: ChipItem<InboxScope>[] = [
    { value: "all", label: t.all, count: figure(counts?.open) },
    { value: "mine", label: t.mine, count: figure(counts?.mine) },
    { value: "unread", label: t.unreadScope, count: figure(counts?.unread), tone: "attention" },
  ];

  let empty: ReactNode;
  if (search) {
    empty = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={t.noResults}
        action={
          <Button variant="outline" className="rounded-full px-5" onClick={() => onSearchInput("")}>
            {t.clearSearch}
          </Button>
        }
      />
    );
  } else if (scope !== "all") {
    empty = (
      <EmptyState
        icon={scope === "unread" ? <IconSuccess aria-hidden /> : <IconInbox aria-hidden />}
        tone={scope === "unread" ? "success" : "default"}
        title={scope === "unread" ? t.noUnread : t.noMine}
        action={
          <Button variant="outline" className="rounded-full px-5" onClick={() => onScope("all")}>
            {t.showAll}
          </Button>
        }
      />
    );
  } else if (status === "closed") {
    empty = (
      <EmptyState
        icon={<IconInbox aria-hidden />}
        title={t.noClosed}
        action={
          <Button variant="outline" className="rounded-full px-5" onClick={() => onStatus("open")}>
            {t.showOpen}
          </Button>
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={<IconInbox aria-hidden />}
        title={t.noConversations}
        description={t.noConversationsHint}
        action={
          <Button className="gap-1.5 rounded-full px-5" onClick={onNewMessage}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.newMessage}
          </Button>
        }
      />
    );
  }

  const rows = conversations.map((c) => {
    const name = c.customerName || null;
    const unread = c.unreadCount > 0;
    const unreadLabel = fmt(t.unread, { count: c.unreadCount });
    const when = (
      <time dateTime={c.lastMessageAt ?? undefined} title={c.lastMessageAt ? formatDateTime(c.lastMessageAt) : undefined}>
        {formatRelativeTime(c.lastMessageAt)}
      </time>
    );
    const owner = c.assignedTo ? (c.assignedTo.fullName ?? c.assignedTo.id) : null;
    const menu = menuOf(c);

    if (phone) {
      return (
        <li key={c.id}>
          <ContextMenu items={menu} label={t.menuLabel}>
            <ListRowCard
              leading={<ChatAvatar name={name} />}
              title={name ? <bdi>{name}</bdi> : <bdi dir="ltr">{c.phone}</bdi>}
              amount={<span className="text-xs font-normal text-ink-soft">{when}</span>}
              status={unread ? <UnreadBead count={c.unreadCount} label={unreadLabel} /> : c.status === "closed" ? <StatusBadge value="closed" tone="neutral" text={t.closed} /> : undefined}
              meta={
                <bdi className={cn(unread && "font-medium text-ink")}>{c.lastMessagePreview ?? (name ? c.phone : "")}</bdi>
              }
              footer={
                owner ? (
                  <span data-slot="chat-owner" className="inline-flex max-w-full items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                    <IconUser className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{fmt(t.assignedTo, { name: owner })}</span>
                  </span>
                ) : undefined
              }
              unread={unread}
              onOpen={() => onOpen(c)}
              aria-current={c.id === selectedId ? "true" : undefined}
            />
          </ContextMenu>
        </li>
      );
    }

    const current = c.id === selectedId;
    return (
      <li key={c.id}>
        <ContextMenu items={menu} label={t.menuLabel}>
          <button
            type="button"
            onClick={() => onOpen(c)}
            aria-current={current ? "true" : undefined}
            data-slot="chat-row"
            data-current={current ? "" : undefined}
            data-unread={unread ? "" : undefined}
            className={cn(
              "flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3 rounded-[1rem] px-3 py-2.5 text-start",
              "transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:active:scale-100",
              current ? "bg-primary-soft" : "hover:bg-paper-sunken"
            )}
          >
            <ChatAvatar name={name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-[15px] leading-[1.375rem] text-ink", unread ? "font-semibold" : "font-medium")}>
                  {name ? <bdi>{name}</bdi> : <bdi dir="ltr">{c.phone}</bdi>}
                </span>
                <span className="shrink-0 text-xs leading-5 text-ink-soft">{when}</span>
              </span>
              <span className="mt-0.5 flex min-h-5 items-center gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-5", unread ? "font-medium text-ink" : "text-ink-soft")}>
                  <bdi>{c.lastMessagePreview ?? (name ? c.phone : "")}</bdi>
                </span>
                {unread && <UnreadBead count={c.unreadCount} label={unreadLabel} />}
              </span>
              {owner && (
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-4 text-ink-soft">
                  <IconUser className="size-3 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{fmt(t.assignedTo, { name: owner })}</span>
                </span>
              )}
            </span>
          </button>
        </ContextMenu>
      </li>
    );
  });

  return (
    <div data-slot="chat-list" className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div data-slot="chat-list-head" className="flex shrink-0 flex-col gap-3 md:border-b md:border-line md:p-3">
        <ListToolbar search={{ value: searchInput, onChange: onSearchInput, placeholder: t.search, label: t.search }}>
          {/* The small switch (36px with a mouse, 44px under a thumb) sits in the middle of the toolbar's 44px line. */}
          <div className="flex h-11 items-center">
            <Segmented
              size="sm"
              value={status}
              onChange={onStatus}
              label={t.statusLabel}
              options={[
                { value: "open", label: t.open },
                { value: "closed", label: t.closed },
              ]}
            />
          </div>
        </ListToolbar>
        <ChipRow items={chips} value={scope} onChange={onScope} label={t.scopeLabel} collapseEmpty={false} countsLoading={status === "open" && counts === null} />
      </div>

      <div data-slot="chat-list-body" className="min-h-0 flex-1 max-md:mt-3 md:overflow-y-auto md:overscroll-contain">
        <DataState
          loading={loading}
          // A refresh that failed behind rows already on screen leaves them there.
          error={conversations.length === 0 ? error : null}
          onRetry={onRetry}
          skeleton={phone ? <ListSkeleton variant="card" rows={6} /> : <PaneSkeleton />}
        >
          {conversations.length === 0 ? (
            <div className="md:p-3">{empty}</div>
          ) : (
            <ul aria-label={t.listLabel} className={phone ? "flex flex-col gap-2.5" : "flex flex-col gap-1 p-2"}>
              {rows}
            </ul>
          )}
          <div className="md:pb-3">
            <LoadMore hasMore={hasMore} loading={loadingMore} onClick={onLoadMore} />
          </div>
        </DataState>
      </div>
    </div>
  );
}
