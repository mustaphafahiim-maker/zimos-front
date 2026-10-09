import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import { waBotSentOf, type InboxConversation, type WhatsappMessage } from "@store-builder/api-client";
import { DataState, SkeletonBar } from "@/components/DataState";
import {
  IconArrowLeft,
  IconCheck,
  IconCheckAll,
  IconClock,
  IconCopy,
  IconError,
  IconMoreActions,
  IconPhone,
  IconSend,
  IconSpinner,
  IconUndo,
  IconUser,
  IconUserAdd,
  type IconComponent,
} from "@/components/icons";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { refreshWorkCounts } from "@/lib/workCounts";
import { ChatAvatar } from "./ConversationList";
import { AssigneeButton, AssigneeSheet, CustomerButton, CustomerSheet, QuickRepliesButton, useCustomerPanel } from "./InboxExtras";
import { CHAT_TOOL, WINDOW_HOURS, dialNumber, entersSend, usePolling } from "./inboxScreen";
import { SuggestReplyButton } from "./SuggestReply";
import { TemplateSheet, useSendErrorText } from "./TemplateSheet";
import { useInboxLive } from "./useInboxLive";
import { BotBadge, BotToggle } from "./WaBot";

const MESSAGE_LIMIT = 50;
/** The message box grows with what is typed, up to about five lines. */
const COMPOSER_MAX = 144;

const STRINGS = {
  en: {
    back: "Back to conversations",
    viewCustomer: "Customer profile",
    call: "Call {name}",
    more: "More for this conversation",
    copyNumber: "Copy the number",
    copied: "The customer's number is copied",
    copyFailed: "We couldn't copy that. Try again.",
    assign: "Assign the conversation",
    closeConversation: "Close",
    reopenConversation: "Reopen",
    closeLong: "Close the conversation",
    reopenLong: "Reopen the conversation",
    messagesLabel: "Messages with {name}",
    loadOlder: "Load older messages",
    noMessages: "No messages yet.",
    today: "Today",
    yesterday: "Yesterday",
    template: "Template: {name}",
    status_sent: "Sent",
    status_delivered: "Delivered",
    status_read: "Read",
    status_failed: "Failed",
    status_received: "Received",
    failedWithError: "Failed: {error}",
    typeMessage: "Type a message…",
    send: "Send",
    sending: "Sending…",
    windowClosed: "The {n}-hour window is closed. WhatsApp only lets you message this customer with an approved template until they reply.",
    sendTemplate: "Send template",
  },
  ar: {
    back: "رجوع للمحادثات",
    viewCustomer: "صفحة العميل",
    call: "اتصل بـ {name}",
    more: "كمان للمحادثة دي",
    copyNumber: "انسخ الرقم",
    copied: "رقم العميل اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
    assign: "أسند المحادثة",
    closeConversation: "اقفل",
    reopenConversation: "افتح تاني",
    closeLong: "اقفل المحادثة",
    reopenLong: "افتح المحادثة تاني",
    messagesLabel: "الرسايل مع {name}",
    loadOlder: "اعرض رسايل أقدم",
    noMessages: "مفيش رسايل لسه.",
    today: "النهارده",
    yesterday: "امبارح",
    template: "قالب: {name}",
    status_sent: "اتبعتت",
    status_delivered: "وصلت",
    status_read: "اتقرت",
    status_failed: "فشلت",
    status_received: "مستلمة",
    failedWithError: "فشلت: {error}",
    typeMessage: "اكتب رسالة…",
    send: "ابعت",
    sending: "بنبعت…",
    windowClosed: "فترة الـ {n} ساعة خلصت. واتساب مش هيسمحلك تبعت للعميل ده غير بقالب متوافق عليه لحد ما يرد.",
    sendTemplate: "ابعت قالب",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** A message that left the box and is on its way to the server. */
interface Pending {
  key: number;
  body: string;
}

/** The day a message belongs to, in the reader's own calendar. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, t: Strings): string {
  const now = new Date();
  if (dayKey(iso) === dayKey(now.toISOString())) return t.today;
  const before = new Date(now);
  before.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(before.toISOString())) return t.yesterday;
  return formatDate(iso);
}

function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric", minute: "2-digit" }).format(d);
}

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const MENU_ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

interface MenuRow {
  id: string;
  label: string;
  icon: IconComponent;
  onSelect: () => void;
}

/** The conversation while its messages load: bubbles on both sides, in the shape of a chat. */
function ThreadSkeleton() {
  const bones: Array<["start" | "end", string]> = [
    ["start", "w-52"],
    ["end", "w-40"],
    ["start", "w-64"],
    ["start", "w-36"],
    ["end", "w-56"],
  ];
  return (
    <div className="space-y-3">
      {bones.map(([side, width], i) => (
        <div key={i} className={cn("flex", side === "end" && "justify-end")}>
          <SkeletonBar className={cn("h-11 max-w-[70%] rounded-[1.25rem]", width)} />
        </div>
      ))}
    </div>
  );
}

export interface ThreadProps {
  conversation: InboxConversation;
  /** Bumped by the inbox on any activity, so the customer's orders are read again. */
  activity: number;
  /** One pane (a phone or a tablet): the header carries the way back to the list. */
  single: boolean;
  /** Room in the header for the owner and the close button; otherwise they wait in «…». */
  roomy: boolean;
  onBack: () => void;
  onPatch: (patch: Partial<InboxConversation>) => void;
  onActivity: () => void;
  /** Close it, or open it again: the inbox makes the call (the list's menu shares it). */
  onToggleStatus: () => void;
  statusBusy: boolean;
}

/**
 * One conversation: who it is with and what can be done to it, the messages,
 * and the box to answer in — or, once WhatsApp's 24-hour window has closed,
 * the way to send an approved template. The customer's facts and orders, the
 * owner of the conversation and the saved replies each open in a sheet over
 * it, so the messages never leave the screen.
 */
export function Thread({ conversation, activity, single, roomy, onBack, onPatch, onActivity, onToggleStatus, statusBusy }: ThreadProps) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const toast = useToast();
  const navigate = useViewNavigate();
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const olderLoaded = useRef(false);
  const panel = useCustomerPanel(conversation.id, activity);

  const loadLatest = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const res = await apiClient.listWhatsappMessages(workspaceId, conversation.id, {
          limit: MESSAGE_LIMIT,
        });
        setMessages((prev) => {
          if (!silent) return res.messages;
          // Merge on id: a poll re-sends the tail, and a status change (sent →
          // delivered → read) arrives as an update to a message already here.
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of res.messages) byId.set(m.id, m);
          return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        if (!silent || !olderLoaded.current) setOlderCursor(res.nextCursor);
        setError(null);
        // The GET marks the conversation read server-side.
        onPatch({ unreadCount: 0 });
        // …so the unread figure on the dock and the side menu is due a fresh read too.
        if (!silent) refreshWorkCounts();
      } catch (err) {
        if (!silent) setError(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // onPatch is recreated every render; depending on it would re-fetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, conversation.id]
  );

  useEffect(() => {
    void loadLatest(false);
  }, [loadLatest]);

  usePolling(() => void loadLatest(true));
  useInboxLive(workspaceId, (event) => {
    if (!event.conversationId || event.conversationId === conversation.id) void loadLatest(true);
  });

  // Keep the view pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

  async function loadOlder() {
    if (!olderCursor) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const res = await apiClient.listWhatsappMessages(workspaceId, conversation.id, {
        limit: MESSAGE_LIMIT,
        before: olderCursor,
      });
      olderLoaded.current = true;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...res.messages.filter((m) => !seen.has(m.id)), ...prev];
      });
      setOlderCursor(res.nextCursor);
      // Hold the reading position steady as content is prepended.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function afterSend() {
    stickToBottom.current = true;
    await loadLatest(true);
    onActivity();
  }

  function copyNumber() {
    void navigator.clipboard
      ?.writeText(conversation.phone)
      .then(() => toast.success(t.copied))
      .catch(() => toast.error(t.copyFailed));
  }

  const name = conversation.customerName || conversation.phone;
  const isOpen = conversation.status === "open";
  const customerId = conversation.customerId;

  const menu: MenuRow[][] = [
    [
      ...(customerId ? [{ id: "customer", label: t.viewCustomer, icon: IconUser, onSelect: () => navigate(`/customers/${customerId}`) }] : []),
      { id: "copy", label: t.copyNumber, icon: IconCopy, onSelect: copyNumber },
    ],
    roomy
      ? []
      : [
          { id: "assign", label: t.assign, icon: IconUserAdd, onSelect: () => setAssignOpen(true) },
          { id: "status", label: isOpen ? t.closeLong : t.reopenLong, icon: isOpen ? IconCheck : IconUndo, onSelect: onToggleStatus },
        ],
  ].filter((group) => group.length > 0);

  // Messages by day, each day under its own small heading.
  const days: Array<{ key: string; at: string; items: WhatsappMessage[] }> = [];
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(m);
    else days.push({ key, at: m.createdAt, items: [m] });
  }

  return (
    <>
      <header data-slot="chat-head" className="flex min-h-14 shrink-0 items-center gap-1.5 border-b border-line bg-paper-raised px-2 py-1.5 sm:gap-2 sm:px-3">
        {single && (
          <button type="button" onClick={onBack} aria-label={t.back} title={t.back} className={cn(CHAT_TOOL, "text-ink")}>
            <IconArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
          </button>
        )}
        <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", !single && "ps-1")}>
          <ChatAvatar name={conversation.customerName} className="max-sm:hidden" />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] leading-5 font-semibold text-ink">
              <bdi>{name}</bdi>
            </h2>
            <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
              <bdi dir="ltr" className="min-w-0 truncate tabular-nums">
                {conversation.phone}
              </bdi>
              {customerId && (
                <ViewLink
                  to={`/customers/${customerId}`}
                  className="hidden shrink-0 rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary 2xl:inline"
                >
                  {t.viewCustomer}
                </ViewLink>
              )}
            </p>
          </div>
        </div>

        <a
          href={`tel:${dialNumber(conversation.phone)}`}
          aria-label={fmt(t.call, { name })}
          title={fmt(t.call, { name })}
          data-slot="contact-call"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-9"
        >
          {/* A phone is not a direction: it is never mirrored. */}
          <IconPhone className="size-5 pointer-fine:size-[18px]" weight="fill" aria-hidden />
        </a>
        {roomy && <AssigneeButton conversation={conversation} onClick={() => setAssignOpen(true)} className="max-w-36" />}
        <CustomerButton panel={panel} onClick={() => setCustomerOpen(true)} />
        {roomy && (
          <Button
            type="button"
            variant="outline"
            aria-busy={statusBusy || undefined}
            disabled={statusBusy}
            onClick={onToggleStatus}
            className="h-11 shrink-0 gap-1.5 rounded-full px-3.5 text-[13px] pointer-fine:h-9"
          >
            {statusBusy ? (
              <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
            ) : isOpen ? (
              <IconCheck className="size-4" weight="bold" aria-hidden />
            ) : (
              <IconUndo className="size-4" weight="bold" aria-hidden />
            )}
            {isOpen ? t.closeConversation : t.reopenConversation}
          </Button>
        )}
        <DirectionProvider direction={dir}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" aria-label={t.more} title={t.more} className={CHAT_TOOL} />}>
              <IconMoreActions className="size-5" weight="bold" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-56 rounded-[1.125rem] p-1.5">
              {menu.map((group, index) => (
                <Fragment key={group[0]?.id ?? index}>
                  {index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                  {group.map((row) => {
                    const RowIcon = row.icon;
                    return (
                      <DropdownMenuItem key={row.id} onClick={row.onSelect} className={MENU_ITEM}>
                        <RowIcon className="size-[18px]" aria-hidden />
                        <span className="min-w-0 flex-1">{row.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </DirectionProvider>
      </header>

      <BotToggle conversation={conversation} onChange={(botPaused) => onPatch({ botPaused } as Partial<InboxConversation>)} />

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        data-slot="chat-scroll"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper px-3 py-4 sm:px-4"
      >
        <DataState loading={loading} error={error} onRetry={() => void loadLatest(false)} skeleton={<ThreadSkeleton />}>
          {olderCursor && (
            <div className="mb-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                aria-busy={loadingOlder || undefined}
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
                className="relative h-11 rounded-full px-5 text-[13px] pointer-fine:h-9"
              >
                <span className={cn(loadingOlder && "invisible")}>{t.loadOlder}</span>
                {loadingOlder && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
                  </span>
                )}
              </Button>
            </div>
          )}
          {messages.length === 0 && pending.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-soft">{t.noMessages}</p>
          ) : (
            <div role="log" aria-label={fmt(t.messagesLabel, { name })} className="flex flex-col gap-2">
              {days.map((day) => (
                <Fragment key={day.key}>
                  <p className="my-1 flex justify-center">
                    <span data-slot="chat-day" className="rounded-full bg-paper-sunken px-3 py-1 text-xs leading-4 font-medium text-ink-soft">
                      {dayLabel(day.at, t)}
                    </span>
                  </p>
                  {day.items.map((m) => (
                    <Bubble key={m.id} message={m} />
                  ))}
                </Fragment>
              ))}
              {pending.map((p) => (
                <PendingBubble key={p.key} body={p.body} />
              ))}
            </div>
          )}
        </DataState>
      </div>

      <Composer
        conversation={conversation}
        onSent={afterSend}
        onPending={(p) => {
          stickToBottom.current = true;
          setPending((prev) => [...prev, p]);
        }}
        onSettled={(key) => setPending((prev) => prev.filter((p) => p.key !== key))}
        onTemplate={() => setTemplateOpen(true)}
      />

      <CustomerSheet open={customerOpen} onOpenChange={setCustomerOpen} conversation={conversation} panel={panel} />
      <AssigneeSheet
        open={assignOpen}
        onOpenChange={setAssignOpen}
        conversation={conversation}
        onAssigned={(assignedTo) => {
          onPatch({ assignedTo });
          onActivity();
        }}
      />
      <TemplateSheet
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        to={conversation.phone}
        onSent={() => {
          setTemplateOpen(false);
          void afterSend();
        }}
      />
    </>
  );
}

const BUBBLE = "max-w-[84%] rounded-[1.25rem] px-3.5 py-2 text-[15px] leading-6 text-ink sm:max-w-[72%]";
const BUBBLE_OUT = "rounded-ee-md bg-primary-soft";
const BUBBLE_IN = "rounded-es-sm bg-paper-raised ring-1 ring-line";

function Bubble({ message: m }: { message: WhatsappMessage }) {
  const t = useT(STRINGS);
  const out = m.direction === "out";
  const failed = m.status === "failed";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div data-slot="chat-bubble" data-dir={m.direction} data-failed={failed ? "" : undefined} className={cn(BUBBLE, out ? BUBBLE_OUT : BUBBLE_IN, failed && "ring-1 ring-danger/50")}>
        {waBotSentOf(m) && <BotBadge />}
        {m.templateName && <p className="mb-0.5 text-xs leading-4 font-medium text-ink-soft">{fmt(t.template, { name: m.templateName })}</p>}
        <p className="break-words whitespace-pre-wrap" dir="auto">
          {m.body ?? (m.type !== "text" ? `[${m.type}]` : "")}
        </p>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] leading-4 text-ink-soft tabular-nums">
          <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>
            {clockTime(m.createdAt)}
          </time>
          {out && <StatusTick status={m.status} error={m.error} />}
        </div>
        {/* Why it failed is said in words under the message: a tooltip is no use under a thumb. */}
        {out && failed && (
          <p role="alert" className="mt-1 text-xs leading-4 font-medium text-danger" dir="auto">
            {m.error ? fmt(t.failedWithError, { error: m.error }) : t.status_failed}
          </p>
        )}
      </div>
    </div>
  );
}

/** A message on its way: already in the conversation, with a clock where the ticks will be. */
function PendingBubble({ body }: { body: string }) {
  const t = useT(STRINGS);
  return (
    <div className="flex justify-end">
      <div data-slot="chat-bubble" data-dir="out" data-pending="" className={cn(BUBBLE, BUBBLE_OUT, "opacity-75")}>
        <p className="break-words whitespace-pre-wrap" dir="auto">
          {body}
        </p>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] leading-4 text-ink-soft">
          <span role="img" aria-label={t.sending} title={t.sending} className="inline-flex">
            <IconClock className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusTick({ status, error }: { status: WhatsappMessage["status"]; error: string | null }) {
  const t = useT(STRINGS);
  const label =
    status === "failed"
      ? error
        ? fmt(t.failedWithError, { error })
        : t.status_failed
      : t[`status_${status}` as const];
  const icon =
    status === "failed" ? (
      <IconError className="size-3.5 text-danger" aria-hidden />
    ) : status === "read" ? (
      <IconCheckAll className="size-3.5 text-primary" weight="bold" aria-hidden />
    ) : status === "delivered" ? (
      <IconCheckAll className="size-3.5" aria-hidden />
    ) : status === "sent" ? (
      <IconCheck className="size-3.5" aria-hidden />
    ) : (
      <IconClock className="size-3.5" aria-hidden />
    );
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      {icon}
    </span>
  );
}

function Composer({
  conversation,
  onSent,
  onPending,
  onSettled,
  onTemplate,
}: {
  conversation: InboxConversation;
  onSent: () => Promise<void>;
  onPending: (message: Pending) => void;
  onSettled: (key: number) => void;
  onTemplate: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const sendError = useSendErrorText();
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);

  // The box is as tall as what is in it, up to a few lines; after that it scrolls.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, COMPOSER_MAX)}px`;
  }, [text]);

  async function sendText(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    // The message is in the conversation the moment it is sent; the server's copy replaces it.
    const key = ++seq.current;
    setText("");
    onPending({ key, body });
    try {
      await apiClient.sendWhatsappMessage(workspaceId, { to: conversation.phone, text: body });
      await onSent();
    } catch (err) {
      // Nothing typed is lost: the words go back in the box, unless something new is already there.
      setText((current) => current || body);
      toast.error(sendError(err));
      // The window may have closed since the list was fetched; refresh so the
      // composer swaps itself for the template notice.
      if (err instanceof ApiError && err.code === "WHATSAPP_WINDOW_CLOSED") await onSent();
    } finally {
      onSettled(key);
    }
  }

  if (!conversation.canReply) {
    return (
      <div data-slot="chat-composer" data-closed="" className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-paper-raised px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <p data-slot="chat-window-note" className="flex min-w-0 flex-1 items-start gap-2 rounded-[1rem] bg-accent-soft px-3 py-2 text-[13px] leading-5 text-accent-dark">
          <IconClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{fmt(t.windowClosed, { n: WINDOW_HOURS })}</span>
        </p>
        <Button type="button" aria-haspopup="dialog" onClick={onTemplate} className="h-11 shrink-0 gap-1.5 rounded-full px-5">
          <IconSend className="size-4 rtl:-scale-x-100" weight="bold" aria-hidden />
          {t.sendTemplate}
        </Button>
      </div>
    );
  }

  return (
    <div data-slot="chat-composer" className="flex shrink-0 items-end gap-1 border-t border-line bg-paper-raised px-2 py-2 sm:gap-1.5 sm:px-3">
      {/* The tools stand beside the form, not in it: their sheets hold forms of their own. */}
      <QuickRepliesButton onPick={setText} draft={text} />
      <SuggestReplyButton conversationId={conversation.id} onSuggest={setText} />
      <form onSubmit={sendText} className="flex min-w-0 flex-1 items-end gap-2">
        <Textarea
          ref={boxRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && entersSend()) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={t.typeMessage}
          aria-label={t.typeMessage}
          rows={1}
          dir="auto"
          data-slot="chat-box"
          className="max-h-36 min-h-11 flex-1 resize-none rounded-[1.375rem] px-4 py-2.5 text-base leading-6 md:text-[15px]"
          maxLength={4096}
        />
        <Button type="submit" aria-label={t.send} title={t.send} disabled={!text.trim()} className="size-11 shrink-0 rounded-full p-0">
          <IconSend className="size-5 rtl:-scale-x-100" weight="fill" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
