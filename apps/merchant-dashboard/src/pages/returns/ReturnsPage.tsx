import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import type { Order, ReturnRequest, ReturnStatus } from "@store-builder/api-client";
import { returnDecide, type ReturnDecisionPayload } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconReturns, IconSearch, IconSliders } from "@/components/icons";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import {
  NO_RETURN_FILTERS,
  ReturnFilterSheet,
  countReturnFilters,
  matchesReturnFilters,
  useReturnFilterChips,
  type ReturnFilterState,
} from "./ReturnFilters";
import { ReturnQuickLook, type ReturnAction } from "./ReturnQuickLook";
import { ReturnDecisionSheet } from "./ReturnDecisionSheet";
import { RETURN_COLUMNS, ReturnRow } from "./ReturnRow";
import { ReturnSettingsSheet, useShopperReturnsSettings } from "./ReturnSettingsSheet";
import { RETURN_STATUSES, splitReason, useReturnLabels } from "./returnLabels";
import { ActiveFilters } from "./rowkit/ActiveFilters";
import { DeskList } from "./rowkit/DeskList";
import { useIsCompact, useIsPhone } from "./rowkit/useScreen";
import { useOrdersById, useReturnsList, type OrderEntry } from "./useReturnsData";

const STRINGS = {
  en: {
    title: "Returns",
    description: "Returns opened on delivered orders. Approving one settles it with the customer; putting the pieces back in stock is a separate step.",
    settings: "Returns from the customer",
    settingsOn: "On",
    settingsOff: "Off",
    searchLabel: "Search the returns",
    searchPlaceholder: "Order number, customer or reason",
    chipsLabel: "Returns by status",
    tabAll: "All",
    tabRequested: "Awaiting decision",
    tabApproved: "Approved",
    tabRejected: "Rejected",
    tabReceived: "Received",
    tabRefunded: "Refunded",
    colCustomer: "Customer",
    colReason: "Reason",
    colStatus: "Status",
    colAge: "Asked",
    colAction: "Next step",
    emptyRequested: "No returns are waiting for your decision.",
    emptyRequestedHow: "A return shows up here when a customer asks for one, or when you open one from a delivered order.",
    emptyAction: "See orders",
    emptyLetCustomers: "Let customers ask for a return",
    emptyApproved: "No approved returns are waiting to be restocked.",
    emptyRejected: "No returns have been rejected.",
    emptyReceived: "Nothing has been received back yet.",
    emptyRefunded: "No returns have been refunded.",
    emptyAll: "No returns yet. One can be opened from an order once it has been delivered.",
    emptyFiltered: "No return matches this search or these filters.",
    clearAll: "Clear the search and filters",
    searchAll: "Look in all returns",
    toastApproved: "Return approved. Restock the pieces when they arrive back.",
    showApproved: "Show approved",
    toastRejected: "Return rejected.",
    toastRestocked: "The returned pieces are back in stock.",
  },
  ar: {
    title: "المرتجعات",
    description: "المرتجعات المفتوحة على أوردرات اتسلّمت. الموافقة بتخلّص الموضوع مع العميل، ورجوع القطع للمخزون خطوة لوحدها.",
    settings: "مرتجع من العميل",
    settingsOn: "شغّال",
    settingsOff: "مقفول",
    searchLabel: "دوّر في المرتجعات",
    searchPlaceholder: "رقم الأوردر، العميل أو السبب",
    chipsLabel: "المرتجعات حسب الحالة",
    tabAll: "الكل",
    tabRequested: "مستنية قرارك",
    tabApproved: "مقبولة",
    tabRejected: "مرفوضة",
    tabReceived: "مستلمة",
    tabRefunded: "اتردّ تمنها",
    colCustomer: "العميل",
    colReason: "السبب",
    colStatus: "الحالة",
    colAge: "اتطلب",
    colAction: "الخطوة الجاية",
    emptyRequested: "مفيش مرتجعات مستنية قرارك.",
    emptyRequestedHow: "المرتجع بيظهر هنا لما العميل يطلبه، أو لما تفتحه إنت من صفحة أوردر اتسلّم.",
    emptyAction: "شوف الأوردرات",
    emptyLetCustomers: "خلّي العملاء يطلبوا مرتجع",
    emptyApproved: "مفيش مرتجعات مقبولة مستنية ترجع المخزون.",
    emptyRejected: "مفيش مرتجعات مرفوضة.",
    emptyReceived: "لسه مفيش مرتجع اتستلم.",
    emptyRefunded: "مفيش مرتجعات اتردّ تمنها.",
    emptyAll: "مفيش مرتجعات لسه. تقدر تفتح مرتجع من الأوردر بعد ما يتسلّم.",
    emptyFiltered: "مفيش مرتجع بالبحث أو الفلاتر دي.",
    clearAll: "امسح البحث والفلاتر",
    searchAll: "دوّر في كل المرتجعات",
    toastApproved: "اتقبل المرتجع. رجّع القطع للمخزون لما توصلك.",
    showApproved: "شوف المقبولة",
    toastRejected: "اترفض المرتجع.",
    toastRestocked: "القطع المرتجعة رجعت المخزون.",
  },
} satisfies Messages;

/** "all" is the whole list; the others are the statuses a return moves through. */
type StatusTab = "all" | ReturnStatus;

const TABS: readonly StatusTab[] = ["all", ...RETURN_STATUSES];
/** Requested first: this page is a decision queue before it is an archive. */
const DEFAULT_TAB: StatusTab = "requested";

function isTab(value: string | null): value is StatusTab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

/** Lower case, and Arabic-Indic digits as Latin ones: «١٠٢٤» finds #1024. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function orderOf(entry: OrderEntry | undefined): Order | null {
  return entry?.status === "ready" ? entry.order : null;
}

/** «أحمد علي · #1024», as far as the order has arrived. */
function whoOf(entry: OrderEntry | undefined): string {
  const order = orderOf(entry);
  return [order?.contactSnapshot?.fullName?.trim(), order?.orderNumber].filter(Boolean).join(" · ");
}

/**
 * /returns — the returns queue: what waits for a decision first, the rest one
 * chip away. The list is read whole and filtered here, so the chips can say
 * how many each status holds; a row opens Quick Look, and its ONE button is
 * the move its status allows (approve → restock). The shopper-returns setting
 * waits behind the header button.
 *
 * `?status=` keeps the chosen chip (absent = awaiting a decision), so coming
 * back from an order lands where the merchant left.
 */
export function ReturnsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  const toast = useToast();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const rawTab = params.get("status");
  const tab: StatusTab = isTab(rawTab) ? rawTab : DEFAULT_TAB;
  function selectTab(next: StatusTab) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === DEFAULT_TAB) out.delete("status");
        else out.set("status", next);
        return out;
      },
      { replace: true }
    );
  }

  const list = useReturnsList();
  const { returns, applyUpdate } = list;
  const settings = useShopperReturnsSettings();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReturnFilterState>(NO_RETURN_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The return being looked at, and the one being rejected. Each stays here while its sheet closes,
  // so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  // Approve and reject both ask first (handoff 372): a message for the customer, whether to tell them, the shipping of an exchange.
  const [deciding, setDeciding] = useState<{ id: string; action: "approve" | "reject"; open: boolean } | null>(null);
  const [busy, setBusy] = useState<Record<string, ReturnAction>>({});

  const filtered = useMemo(() => returns.filter((ret) => matchesReturnFilters(ret, filters)), [returns, filters]);
  const counts = useMemo(() => {
    const tally: Record<ReturnStatus, number> = { requested: 0, approved: 0, rejected: 0, received: 0, refunded: 0 };
    for (const ret of filtered) if (ret.status in tally) tally[ret.status] += 1;
    return tally;
  }, [filtered]);
  const inTab = useMemo(() => (tab === "all" ? filtered : filtered.filter((ret) => ret.status === tab)), [filtered, tab]);
  // Only the orders behind the rows of this chip are asked for: the same requests the page always made.
  const orderIds = useMemo(() => [...new Set(inTab.map((ret) => ret.orderId))], [inTab]);
  const orders = useOrdersById(orderIds);

  const query = fold(search.trim());
  const visible = query
    ? inTab.filter((ret) => {
        const order = orderOf(orders[ret.orderId]);
        const { code, detail } = splitReason(ret.reason);
        const haystack = [order?.orderNumber, order?.contactSnapshot?.fullName, order?.contactSnapshot?.phone, labels.reason(code), detail];
        return haystack.some((part) => part && fold(part).includes(query));
      })
    : inTab;

  const activeFilters = countReturnFilters(filters);
  const narrowed = query !== "" || activeFilters > 0;
  const filterChips = useReturnFilterChips(filters, setFilters);

  function clearAll() {
    setSearch("");
    setFilters(NO_RETURN_FILTERS);
  }

  /** Sends one of the three moves and merges the answer into the row. Throws when the server says no. */
  async function act(ret: ReturnRequest, action: ReturnAction) {
    setBusy((prev) => ({ ...prev, [ret.id]: action }));
    try {
      const updated =
        action === "restock"
          ? await apiClient.restockReturn(workspaceId, ret.id)
          : await apiClient.moderateReturn(workspaceId, ret.id, action);
      applyUpdate(updated);
      if (action === "approve" && tab === "requested") {
        // The row has just left this chip for «مقبولة», where its next step (restock) is: the toast is the way after it.
        toast.notify("success", t.toastApproved, { action: { label: t.showApproved, onClick: () => selectTab("approved") } });
      } else {
        toast.success(action === "approve" ? t.toastApproved : action === "reject" ? t.toastRejected : t.toastRestocked);
      }
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[ret.id];
        return next;
      });
    }
  }

  /** Restock answers in a toast: there is no dialog to hold a refusal. */
  function run(ret: ReturnRequest, action: "restock") {
    void act(ret, action).catch((err: unknown) => toast.error(getErrorMessage(err)));
  }

  /** A decision asks first. Quick Look steps aside for the question: two sheets are never stacked. */
  function askDecision(ret: ReturnRequest, action: "approve" | "reject") {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setDeciding({ id: ret.id, action, open: true });
  }

  /** Sends the decision with its message and merges the answer into the row. Throws when the server says no. */
  async function decide(ret: ReturnRequest, payload: ReturnDecisionPayload) {
    const updated = await returnDecide(apiClient, workspaceId, ret.id, payload);
    applyUpdate(updated);
    if (payload.action === "approve" && tab === "requested") {
      toast.notify("success", t.toastApproved, { action: { label: t.showApproved, onClick: () => selectTab("approved") } });
    } else {
      toast.success(payload.action === "approve" ? t.toastApproved : t.toastRejected);
    }
  }

  const peeked = peek ? (returns.find((ret) => ret.id === peek.id) ?? null) : null;
  const decided = deciding ? (returns.find((ret) => ret.id === deciding.id) ?? null) : null;

  // While the list is on its way a chip holds its place with a dash (null), instead of folding behind «كمان» as an empty one.
  const figure = (count: number) => (list.loading ? null : count);
  const chips: ChipItem<StatusTab>[] = [
    { value: "all", label: t.tabAll, count: figure(filtered.length) },
    { value: "requested", label: t.tabRequested, count: figure(counts.requested), tone: "attention" },
    { value: "approved", label: t.tabApproved, count: figure(counts.approved) },
    { value: "rejected", label: t.tabRejected, count: figure(counts.rejected) },
    { value: "received", label: t.tabReceived, count: figure(counts.received) },
    { value: "refunded", label: t.tabRefunded, count: figure(counts.refunded) },
  ];

  const emptyByTab: Record<StatusTab, string> = {
    all: t.emptyAll,
    requested: t.emptyRequested,
    approved: t.emptyApproved,
    rejected: t.emptyRejected,
    received: t.emptyReceived,
    refunded: t.emptyRefunded,
  };

  const empty = narrowed ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptyFiltered}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={clearAll}>
            {t.clearAll}
          </Button>
          {tab !== "all" && (
            <Button variant="outline" className="rounded-full px-5" onClick={() => selectTab("all")}>
              {t.searchAll}
            </Button>
          )}
        </div>
      }
    />
  ) : tab === "requested" ? (
    // The decision queue, when clear, says how a return gets here and where to start one.
    <EmptyState
      icon={<IconReturns aria-hidden />}
      tone="success"
      title={t.emptyRequested}
      description={t.emptyRequestedHow}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild className="rounded-full px-5">
            <Link to="/orders">{t.emptyAction}</Link>
          </Button>
          {settings.data && !settings.data.enabled && (
            <Button variant="outline" className="rounded-full px-5" onClick={() => setSettingsOpen(true)}>
              {t.emptyLetCustomers}
            </Button>
          )}
        </div>
      }
    />
  ) : (
    <EmptyState icon={<IconReturns aria-hidden />} title={emptyByTab[tab]} />
  );

  const rows = visible.map((ret) => (
    <ReturnRow
      key={ret.id}
      ret={ret}
      entry={orders[ret.orderId]}
      compact={compact}
      busy={busy[ret.id] ?? null}
      current={peek?.open === true && peek.id === ret.id}
      onPeek={() => setPeek({ id: ret.id, open: true })}
      onApprove={() => askDecision(ret, "approve")}
      onReject={() => askDecision(ret, "reject")}
      onRestock={() => run(ret, "restock")}
    />
  ));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the queue: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={
          <Button variant="outline" className="h-11 gap-2 rounded-full px-3 sm:px-4" onClick={() => setSettingsOpen(true)}>
            <IconSliders className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t.settings}</span>
            {settings.data && (
              <StatusBadge
                value={settings.data.enabled ? "on" : "off"}
                tone={settings.data.enabled ? "success" : "neutral"}
                text={settings.data.enabled ? t.settingsOn : t.settingsOff}
                className="max-sm:hidden"
              />
            )}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <ListToolbar
          search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
          filters={{ count: activeFilters, onOpen: () => setFiltersOpen(true) }}
        />
        <ChipRow items={chips} value={tab} onChange={selectTab} label={t.chipsLabel} countsLoading={list.loading} />
        <ActiveFilters filters={filterChips} onClearAll={() => setFilters(NO_RETURN_FILTERS)} />

        <DataState
          loading={list.loading}
          // A refresh that failed behind rows already on screen leaves them there.
          error={returns.length === 0 ? list.error : null}
          onRetry={() => void list.refresh()}
          skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
        >
          {visible.length === 0 ? (
            empty
          ) : compact ? (
            <ul aria-label={t.title} className="flex flex-col gap-2.5">
              {rows}
            </ul>
          ) : (
            <DeskList
              columns={RETURN_COLUMNS}
              label={t.title}
              head={[
                { label: t.colCustomer },
                { label: t.colReason },
                { label: t.colStatus },
                { label: t.colAge },
                { label: t.colAction, end: true },
              ]}
            >
              {rows}
            </DeskList>
          )}
        </DataState>
      </div>

      <ReturnFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} value={filters} onChange={setFilters} matching={visible.length} />

      <ReturnQuickLook
        ret={peeked}
        entry={peeked ? orders[peeked.orderId] : undefined}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        busy={peeked ? (busy[peeked.id] ?? null) : null}
        onApprove={() => {
          if (peeked) askDecision(peeked, "approve");
        }}
        onReject={() => {
          if (peeked) askDecision(peeked, "reject");
        }}
        onRestock={() => {
          if (peeked) run(peeked, "restock");
        }}
        onPhotosExpired={() => void list.refresh({ silent: true })}
        onUpdated={applyUpdate}
      />

      <ReturnDecisionSheet
        ret={decided}
        action={deciding?.action ?? "approve"}
        open={Boolean(deciding?.open)}
        who={decided ? whoOf(orders[decided.orderId]) || undefined : undefined}
        currency={decided ? orderOf(orders[decided.orderId])?.currency : undefined}
        onClose={() => setDeciding((current) => (current ? { ...current, open: false } : current))}
        onConfirm={async (payload) => {
          if (!decided) return;
          await decide(decided, payload);
          setDeciding((current) => (current ? { ...current, open: false } : current));
        }}
      />

      <ReturnSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </div>
  );
}
