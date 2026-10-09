import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { inboxListConversations, type InboxConversation, type InboxConversationList, type InboxCounts } from "@store-builder/api-client";
import { AppOffNotice } from "@/components/AppOffNotice";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconInbox, IconPlus, IconWhatsApp } from "@/components/icons";
import { ListSkeleton } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { refreshWorkCounts } from "@/lib/workCounts";
import { ConversationList, type InboxScope, type InboxStatus } from "./ConversationList";
import { useChatLayer, useInboxPhone, useInboxSplit, usePolling } from "./inboxScreen";
import { TemplateSheet } from "./TemplateSheet";
import { Thread } from "./Thread";
import { useInboxLive } from "./useInboxLive";
import { BotSettingsLink } from "./WaBot";

const LIST_LIMIT = 30;
/** From here up the conversation header has room for its owner and the close button. */
const ROOMY_QUERY = "(min-width: 80rem)";

const STRINGS = {
  en: {
    title: "Messages",
    description: "Reply to your customers on WhatsApp.",
    notConnectedTitle: "WhatsApp isn't connected yet",
    notConnectedHint: "Connect your WhatsApp Business number in Settings to start chatting with customers here.",
    goConnect: "Connect WhatsApp",
    newMessage: "New message",
    selectConversation: "Pick a conversation to read it",
    selectHint: "The customer's orders and facts are one press away from the conversation.",
    conversation: "Conversation",
    closedToast: "Conversation closed.",
    reopenedToast: "Conversation reopened.",
  },
  ar: {
    title: "الرسايل",
    description: "رد على عملاءك على واتساب.",
    notConnectedTitle: "واتساب لسه مش مربوط",
    notConnectedHint: "اربط رقم واتساب بيزنس بتاعك من الإعدادات، وابدأ تكلّم عملاءك من هنا.",
    goConnect: "اربط واتساب",
    newMessage: "رسالة جديدة",
    selectConversation: "اختار محادثة عشان تقراها",
    selectHint: "أوردرات العميل وبياناته على بعد ضغطة من المحادثة.",
    conversation: "المحادثة",
    closedToast: "المحادثة اتقفلت.",
    reopenedToast: "المحادثة اتفتحت تاني.",
  },
} satisfies Messages;

/*
 * The first page of each view of the list, kept for the session: coming back
 * to the inbox shows the conversations at once and reads them again behind.
 */
const firstPages = new Map<string, InboxConversationList>();
const MAX_FIRST_PAGES = 24;

function rememberFirstPage(key: string, page: InboxConversationList) {
  firstPages.delete(key);
  firstPages.set(key, page);
  if (firstPages.size > MAX_FIRST_PAGES) firstPages.delete(firstPages.keys().next().value as string);
}

/** What `?conversation=` came with: set when the conversation was opened from the list, so «back» is a real step back. */
interface InboxLocationState {
  inboxFromList?: boolean;
}

export function InboxPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const phone = useInboxPhone();
  const integration = useCachedAsync(`inbox-integration:${workspaceId}`, () => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const [composing, setComposing] = useState(false);
  const connected = integration.data?.connected === true;

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the conversations: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={<BotSettingsLink />}
        primaryAction={
          connected ? (
            <Button className="gap-1.5 rounded-full px-5" aria-haspopup="dialog" onClick={() => setComposing(true)}>
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.newMessage}
            </Button>
          ) : undefined
        }
      />
      <AppOffNotice app="whatsapp" />
      <DataState
        loading={integration.loading}
        error={integration.data ? null : integration.error}
        onRetry={() => void integration.refresh()}
        skeleton={phone ? <ListSkeleton variant="card" rows={6} /> : <CardSkeleton lines={7} />}
      >
        {integration.data && !integration.data.connected ? (
          <EmptyState
            icon={<IconWhatsApp aria-hidden />}
            tone="attention"
            title={t.notConnectedTitle}
            description={t.notConnectedHint}
            action={
              <Button className="rounded-full px-5" onClick={() => navigate("/settings#whatsapp")}>
                {t.goConnect}
              </Button>
            }
          />
        ) : integration.data ? (
          <InboxView key={workspaceId} composing={composing} onComposing={setComposing} />
        ) : null}
      </DataState>
    </div>
  );
}

function InboxView({ composing, onComposing }: { composing: boolean; onComposing: (open: boolean) => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const phone = useInboxPhone();
  const split = useInboxSplit();
  const roomy = useMediaQuery(ROOMY_QUERY);
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // The open conversation lives in the address, so a link can point at one and «back» closes it.
  const selectedId = params.get("conversation");

  const [status, setStatus] = useState<InboxStatus>("open");
  // All / assigned to me / unread — and how many open conversations wait in each.
  const [scope, setScope] = useState<InboxScope>("all");
  const scopeParams = { assigned: scope === "mine" ? ("me" as const) : undefined, unread: scope === "unread" };
  // Bumped on any activity so the customer's orders are read again.
  const [activity, setActivity] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageKey = `${workspaceId}|${status}|${scope}|${search}`;
  const seed = useRef(firstPages.get(pageKey) ?? null).current;
  const [counts, setCounts] = useState<InboxCounts | null>(seed?.counts ?? null);
  const [conversations, setConversations] = useState<InboxConversation[]>(seed?.conversations ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(seed?.nextCursor ?? null);
  const [loading, setLoading] = useState(!seed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const reqId = useRef(0);
  const loadedBeyondFirstPage = useRef(false);

  // The request waits for the typing to pause; the field itself never does.
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Hand-rolled rather than useAsync: the poll must refresh the first page
  // without clearing the older pages the merchant already scrolled into.
  const loadFirstPage = useCallback(
    async (silent: boolean) => {
      const id = ++reqId.current;
      if (!silent) {
        const kept = firstPages.get(pageKey);
        if (kept) {
          // Seen before in this session: on screen at once, read again behind.
          loadedBeyondFirstPage.current = false;
          setConversations(kept.conversations);
          setNextCursor(kept.nextCursor);
          setCounts(kept.counts);
          setLoading(false);
        } else {
          setLoading(true);
        }
        setError(null);
      }
      try {
        const res = await inboxListConversations(apiClient, workspaceId, {
          ...scopeParams,
          status,
          search: search || undefined,
          limit: LIST_LIMIT,
        });
        if (id !== reqId.current) return;
        rememberFirstPage(pageKey, res);
        setCounts(res.counts);
        if (silent) {
          setConversations((prev) => {
            const fresh = new Set(res.conversations.map((c) => c.id));
            const older = prev.slice(LIST_LIMIT).filter((c) => !fresh.has(c.id));
            return [...res.conversations, ...older];
          });
          setNextCursor((prev) => (loadedBeyondFirstPage.current ? prev : res.nextCursor));
        } else {
          loadedBeyondFirstPage.current = false;
          setConversations(res.conversations);
          setNextCursor(res.nextCursor);
        }
        setError(null);
      } catch (err) {
        if (id === reqId.current && !silent) setError(err);
      } finally {
        if (id === reqId.current && !silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, status, search, scope]
  );

  useEffect(() => {
    void loadFirstPage(false);
  }, [loadFirstPage]);

  // The newest loader, for calls made later than the render they were written in (an Undo, a toast).
  const reload = useRef(loadFirstPage);
  useEffect(() => {
    reload.current = loadFirstPage;
  });

  usePolling(() => void loadFirstPage(true));
  // The live stream makes a new message show at once; the poll above stays as the safety net.
  useInboxLive(workspaceId, () => {
    void loadFirstPage(true);
    setActivity((n) => n + 1);
  });

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await inboxListConversations(apiClient, workspaceId, {
        ...scopeParams,
        status,
        search: search || undefined,
        limit: LIST_LIMIT,
        before: nextCursor,
      });
      loadedBeyondFirstPage.current = true;
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.conversations.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(res.nextCursor);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  // Remember the last known version so closing a conversation (which drops it
  // out of the "open" filter) does not yank the thread out from under the user.
  const lastSelected = useRef<InboxConversation | null>(null);
  if (selected) lastSelected.current = selected;
  const threadConversation = selectedId ? (selected ?? (lastSelected.current?.id === selectedId ? lastSelected.current : null)) : null;

  function patchConversation(id: string, patch: Partial<InboxConversation>) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (lastSelected.current?.id === id) lastSelected.current = { ...lastSelected.current, ...patch };
  }

  function openConversation(id: string) {
    if (id === selectedId) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("conversation", id);
        return next;
      },
      // From the list it is a step forward (the browser's «back» returns to the list);
      // from one conversation to another it replaces, so «back» is never a walk through all of them.
      selectedId ? { replace: true, state: location.state } : { state: { inboxFromList: true } satisfies InboxLocationState }
    );
  }

  function dropSelection() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("conversation");
        return next;
      },
      { replace: true }
    );
  }

  function closeConversation() {
    const fromList = (location.state as InboxLocationState | null)?.inboxFromList === true;
    // A real step back puts the list where it was left (lib/scrollRestore.ts).
    if (fromList) navigate(-1);
    else dropSelection();
  }

  // A link to a conversation that is not among the open ones: look once among
  // the closed ones (or the other way round) before giving up on it.
  // Only the conversation the page was opened on: one picked here came from the list, or is on its way into it.
  const linked = useRef(selectedId).current;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const probed = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || selectedId !== linked || loading || error || search || scope !== "all") return;
    if (conversations.some((c) => c.id === selectedId) || lastSelected.current?.id === selectedId) return;
    if (probed.current === selectedId) return;
    probed.current = selectedId;
    const wanted = selectedId;
    const other: InboxStatus = status === "open" ? "closed" : "open";
    void inboxListConversations(apiClient, workspaceId, { status: other, limit: LIST_LIMIT })
      .then((res) => {
        if (selectedRef.current !== wanted) return;
        const found = res.conversations.find((c) => c.id === wanted);
        if (found) {
          lastSelected.current = found;
          setStatus(other);
        } else {
          dropSelection();
        }
      })
      .catch(() => {
        if (selectedRef.current === wanted) dropSelection();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, linked, loading, error, conversations, status, scope, search, workspaceId]);

  /** Close a conversation or open it again — the same call for the header, the «…» menu and the menu of a row. */
  async function setConversationStatus(conversation: InboxConversation, next: InboxStatus, offerUndo: boolean): Promise<void> {
    setStatusBusy(conversation.id);
    try {
      const res = await apiClient.setWhatsappConversationStatus(workspaceId, conversation.id, next);
      patchConversation(conversation.id, { status: res.status });
      const message = res.status === "closed" ? t.closedToast : t.reopenedToast;
      if (offerUndo) toast.undo(message, () => setConversationStatus(conversation, next === "open" ? "closed" : "open", false));
      else toast.success(message);
      refreshWorkCounts();
      void reload.current(true);
    } catch (err) {
      if (!offerUndo) throw err;
      toast.error(getErrorMessage(err));
    } finally {
      setStatusBusy(null);
    }
  }

  function toggleStatus(conversation: InboxConversation) {
    void setConversationStatus(conversation, conversation.status === "open" ? "closed" : "open", true);
  }

  const threadOpen = threadConversation !== null;
  const layerRef = useRef<HTMLElement>(null);
  useChatLayer(layerRef, phone && threadOpen);

  return (
    <>
      <div
        data-slot="inbox"
        className={cn(
          "min-w-0",
          // From md up: one pane, as tall as the window allows; from lg, the list and the conversation side by side.
          "md:-mb-10 md:grid md:h-[calc(100dvh-15rem)] md:min-h-[28rem] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line",
          // 24rem is what the search and the open / closed switch need to share one line.
          "lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]"
        )}
      >
        <ConversationList
          // A tablet has one pane: the list makes room for the open conversation.
          className={cn("lg:border-e lg:border-line", threadOpen && "md:max-lg:hidden")}
          phone={phone}
          conversations={conversations}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onRetry={() => void loadFirstPage(false)}
          hasMore={Boolean(nextCursor)}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          search={search}
          status={status}
          onStatus={setStatus}
          scope={scope}
          onScope={setScope}
          counts={counts}
          onOpen={(c) => openConversation(c.id)}
          onToggleStatus={toggleStatus}
          onNewMessage={() => onComposing(true)}
        />

        {threadConversation ? (
          <section
            ref={layerRef}
            aria-label={t.conversation}
            data-slot="chat-thread"
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              // On a phone the conversation covers the screen, over the top bar and down to the dock; the keyboard
              // is followed by useChatLayer. It arrives from the side the list is not on.
              "max-md:fixed max-md:inset-0 max-md:z-[35] max-md:bg-paper max-md:pt-[env(safe-area-inset-top)] max-md:pb-[calc(4.5rem+max(0.75rem,env(safe-area-inset-bottom)))]",
              "[--sweep-inbox-from:1.5rem] motion-safe:max-md:animate-[sweep-inbox-push_var(--dur-move)_var(--ease-spring)_backwards] rtl:[--sweep-inbox-from:-1.5rem]"
            )}
          >
            <Thread
              key={threadConversation.id}
              conversation={threadConversation}
              activity={activity}
              single={!split}
              roomy={roomy}
              onBack={closeConversation}
              onPatch={(patch) => patchConversation(threadConversation.id, patch)}
              onActivity={() => void reload.current(true)}
              onToggleStatus={() => toggleStatus(threadConversation)}
              statusBusy={statusBusy === threadConversation.id}
            />
          </section>
        ) : (
          <section data-slot="chat-idle" className="hidden min-h-0 min-w-0 flex-col items-center justify-center gap-1.5 p-8 text-center lg:flex">
            <span aria-hidden className="mb-3 flex size-18 items-center justify-center rounded-[1.5rem] bg-primary-soft text-primary">
              <IconInbox className="size-10" weight="duotone" />
            </span>
            <p className="text-base font-semibold text-ink">{t.selectConversation}</p>
            <p className="max-w-xs text-sm leading-6 text-ink-soft">{t.selectHint}</p>
          </section>
        )}
      </div>

      <TemplateSheet
        open={composing}
        onClose={() => onComposing(false)}
        onSent={(conversationId) => {
          onComposing(false);
          // The new conversation is an open one, in the whole list: show that list, so it is there to open.
          setStatus("open");
          setScope("all");
          setSearchInput("");
          setSearch("");
          openConversation(conversationId);
          void reload.current(true);
        }}
      />
    </>
  );
}
