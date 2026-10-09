import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { customerReferralsList, type CustomerReferral, type CustomerReferralStatus } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconOrders, IconSearch, IconUser, IconUserAdd } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { referralRewardText } from "./referralText";
import { REFERRAL_STATUS_KEY, REFERRAL_STATUS_TONE, REFERRAL_STRINGS, REFERRAL_VOID_KEY, type ReferralStrings } from "./referralStrings";

type Filter = "all" | CustomerReferralStatus;
const PAGE = 50;

/** The first page of each status, as last read: coming back to the list shows it at once and refreshes behind. */
const seen = new Map<string, { rows: CustomerReferral[]; total: number }>();

const COLUMNS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_max-content_max-content_max-content_max-content]";
const LINK =
  "rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** «مستني التوصيل» / «اتكافئ» / «اتلغى», and under a cancelled one, why. */
export function InviteStatus({ invite, t }: { invite: Pick<CustomerReferral, "status" | "voidReason">; t: ReferralStrings }) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
      <StatusBadge value={invite.status} tone={REFERRAL_STATUS_TONE[invite.status]} text={t[REFERRAL_STATUS_KEY[invite.status]]} />
      {invite.status === "void" && invite.voidReason && <span className="text-xs text-ink-soft">{t[REFERRAL_VOID_KEY[invite.voidReason]] ?? invite.voidReason}</span>}
    </span>
  );
}

/** One fact of the preview: what it is, then the fact. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * Every invite of the store (handoff 222): who invited whom, the friend's
 * order, where the invite stands and what was given — by status, fifty at a
 * time. A row opens its preview; the people and the order are one tap from
 * there, and in the row's menu.
 *
 * `emptyAction` is the one thing to do while there is no invite at all (turn
 * the programme on, when it is off).
 */
export function InvitesTable({ emptyAction }: { emptyAction?: ReactNode }) {
  const t = useT(REFERRAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const compact = useIsCompact();
  const headingId = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<CustomerReferral[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  // The row being previewed stays here while the preview closes, so it does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  // The answer of an older filter must not land on a newer one.
  const call = useRef(0);

  useEffect(() => {
    const id = ++call.current;
    const key = `${workspaceId}:${filter}`;
    const cached = seen.get(key);
    if (cached) {
      setRows(cached.rows);
      setTotal(cached.total);
    }
    setLoading(!cached);
    setError(null);
    customerReferralsList(apiClient, workspaceId, { status: filter === "all" ? undefined : filter, limit: PAGE })
      .then((page) => {
        if (id !== call.current) return;
        seen.set(key, { rows: page.referrals, total: page.total });
        setRows(page.referrals);
        setTotal(page.total);
      })
      .catch((err) => {
        // A refresh that failed behind rows already on screen leaves them there.
        if (id === call.current && !cached) setError(err);
      })
      .finally(() => {
        if (id === call.current) setLoading(false);
      });
  }, [workspaceId, filter, nonce]);

  async function loadMore() {
    const id = call.current;
    setLoadingMore(true);
    try {
      const page = await customerReferralsList(apiClient, workspaceId, { status: filter === "all" ? undefined : filter, limit: PAGE, offset: rows.length });
      if (id !== call.current) return;
      // A new invite may have pushed a row onto this page since the first one was read.
      setRows((prev) => [...prev, ...page.referrals.filter((row) => !prev.some((other) => other.id === row.id))]);
      setTotal(page.total);
    } catch (err) {
      if (id === call.current) setError(err);
    } finally {
      setLoadingMore(false);
    }
  }

  // The API counts the status on screen only: its chip carries the figure, the others none.
  const figure = (value: Filter) => (value === filter && !loading ? total : undefined);
  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll, count: figure("all") },
    { value: "pending", label: t.status_pending, count: figure("pending"), tone: "attention" },
    { value: "rewarded", label: t.status_rewarded, count: figure("rewarded"), tone: "success" },
    { value: "void", label: t.status_void, count: figure("void") },
  ];

  const nameOf = (who: CustomerReferral["referrer"]) => who?.name || t.noName;
  const pageOf = (row: CustomerReferral) => (row.order ? `/orders/${row.order.id}` : row.referrer ? `/customers/${row.referrer.id}` : "/customers");

  function menuFor(row: CustomerReferral): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const inviter = row.referrer;
    const friend = row.friend;
    const order = row.order;
    if (order) items.push({ id: "order", label: t.menuOrder, icon: IconOrders, onSelect: () => navigate(`/orders/${order.id}`) });
    if (inviter) items.push({ id: "inviter", label: t.menuInviter, icon: IconUser, onSelect: () => navigate(`/customers/${inviter.id}`) });
    if (friend) items.push({ id: "friend", label: t.menuFriend, icon: IconUserAdd, onSelect: () => navigate(`/customers/${friend.id}`) });
    if (order) items.push({ id: "copy", label: t.menuCopy, icon: IconCopy, separatorBefore: true, onSelect: () => copy(order.orderNumber, t.copied) });
    return items;
  }

  const person = (who: CustomerReferral["referrer"]) =>
    who ? (
      <ViewLink to={`/customers/${who.id}`} className={LINK}>
        <bdi>{nameOf(who)}</bdi>
      </ViewLink>
    ) : (
      "—"
    );

  const rewardOf = (row: CustomerReferral) => (row.reward ? referralRewardText(row.reward, row.order?.currency ?? "EGP", t) : null);

  const list = rows.map((row) => {
    const menu = menuFor(row);
    const onPeek = () => setPeek({ id: row.id, open: true });
    const peekLabel = fmt(t.peek, { name: nameOf(row.referrer) });
    const keys = rowKeyProps(onPeek, () => navigate(pageOf(row)));
    const reward = rewardOf(row);
    const current = peek?.open === true && peek.id === row.id;

    if (compact) {
      return (
        <li key={row.id}>
          <ContextMenu items={menu} label={t.menuLabel}>
            <ListRowCard
              title={<bdi>{nameOf(row.referrer)}</bdi>}
              amount={reward ? <bdi>{reward}</bdi> : undefined}
              status={<StatusBadge value={row.status} tone={REFERRAL_STATUS_TONE[row.status]} text={t[REFERRAL_STATUS_KEY[row.status]]} />}
              meta={row.friend ? <bdi>{fmt(t.invited, { name: nameOf(row.friend) })}</bdi> : undefined}
              footer={
                <>
                  {row.status === "void" && row.voidReason && (
                    <span className="text-xs leading-5 text-ink-soft">{t[REFERRAL_VOID_KEY[row.voidReason]] ?? row.voidReason}</span>
                  )}
                  {row.order && (
                    <span className="text-xs leading-5 text-ink-soft tabular-nums">
                      <bdi dir="ltr">{row.order.orderNumber}</bdi> · <bdi dir="ltr">{formatMoney(row.order.totalAmount, row.order.currency)}</bdi>
                    </span>
                  )}
                  <span className="text-xs leading-5 text-ink-soft">{formatDate(row.createdAt)}</span>
                </>
              }
              onOpen={onPeek}
              openLabel={peekLabel}
              aria-haspopup="dialog"
              {...keys}
            />
          </ContextMenu>
        </li>
      );
    }

    return (
      <DeskRow key={row.id} onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
        <div className="min-w-0 truncate text-[15px] leading-6">{person(row.referrer)}</div>
        <div className="min-w-0 truncate">{person(row.friend)}</div>
        <div className="min-w-0">
          {row.order ? (
            <span className="inline-flex flex-col">
              <ViewLink to={`/orders/${row.order.id}`} className={LINK}>
                <bdi dir="ltr">{row.order.orderNumber}</bdi>
              </ViewLink>
              <span className="text-xs leading-5 text-ink-soft tabular-nums">
                <bdi dir="ltr">{formatMoney(row.order.totalAmount, row.order.currency)}</bdi>
              </span>
            </span>
          ) : (
            "—"
          )}
        </div>
        <div>
          <InviteStatus invite={row} t={t} />
        </div>
        <div className="font-medium whitespace-nowrap text-ink tabular-nums">{reward ? <bdi>{reward}</bdi> : "—"}</div>
        <div className="text-end text-xs whitespace-nowrap text-ink-soft">{formatDate(row.createdAt)}</div>
      </DeskRow>
    );
  });

  const peeked = peek ? (rows.find((row) => row.id === peek.id) ?? null) : null;
  const peekedReward = peeked ? rewardOf(peeked) : null;

  return (
    <section aria-labelledby={headingId} className="space-y-3 pt-2">
      <div className="min-w-0 px-1">
        <h2 id={headingId} className="text-base font-semibold text-ink">
          {t.invitesTitle}
        </h2>
        <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{total > 0 ? `${t.invitesHint} ${pluralOf(t, "total", total)}` : t.invitesHint}</p>
      </div>

      <ChipRow items={chips} value={filter} onChange={setFilter} label={t.chipsLabel} collapseEmpty={false} />

      <DataState loading={loading} error={rows.length === 0 ? error : null} onRetry={() => setNonce((n) => n + 1)} skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}>
        {rows.length === 0 ? (
          filter === "all" ? (
            <EmptyState icon={<IconUserAdd aria-hidden />} title={t.invitesEmptyTitle} description={t.invitesEmptyHint} action={emptyAction} />
          ) : (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.invitesNoMatch}
              action={
                <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setFilter("all")}>
                  {t.showAll}
                </Button>
              }
            />
          )
        ) : compact ? (
          <ul aria-label={t.invitesTitle} className="flex flex-col gap-2.5">
            {list}
          </ul>
        ) : (
          <DeskList
            columns={COLUMNS}
            label={t.invitesTitle}
            head={[{ label: t.colInviter }, { label: t.colFriend }, { label: t.colOrder }, { label: t.colStatus }, { label: t.colReward }, { label: t.colDate, end: true }]}
          >
            {list}
          </DeskList>
        )}
        <LoadMore hasMore={rows.length < total} loading={loadingMore} onClick={() => void loadMore()} />
      </DataState>

      <QuickLook
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        title={peeked ? <bdi>{fmt(t.qlTitle, { name: nameOf(peeked.referrer) })}</bdi> : ""}
        subtitle={peeked?.friend ? <bdi>{fmt(t.invited, { name: nameOf(peeked.friend) })}</bdi> : undefined}
        status={peeked ? <StatusBadge value={peeked.status} tone={REFERRAL_STATUS_TONE[peeked.status]} text={t[REFERRAL_STATUS_KEY[peeked.status]]} /> : undefined}
        to={peeked ? pageOf(peeked) : "/customers"}
        openLabel={peeked?.order ? t.openOrder : t.openCustomer}
      >
        {peeked && (
          <div className="space-y-4">
            {peeked.status === "void" && peeked.voidReason && (
              <p data-slot="invite-void" className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm leading-6 text-ink">
                {t[REFERRAL_VOID_KEY[peeked.voidReason]] ?? peeked.voidReason}
              </p>
            )}
            <dl>
              <Fact label={t.colInviter}>{person(peeked.referrer)}</Fact>
              <Fact label={t.colFriend}>{person(peeked.friend)}</Fact>
              <Fact label={t.colOrder}>
                {peeked.order ? (
                  <ViewLink to={`/orders/${peeked.order.id}`} className={LINK}>
                    <bdi dir="ltr">{peeked.order.orderNumber}</bdi>
                  </ViewLink>
                ) : (
                  <span className="font-normal text-ink-soft">{t.qlNoOrder}</span>
                )}
              </Fact>
              {peeked.order && (
                <Fact label={t.qlTotal}>
                  <bdi dir="ltr" className="tabular-nums">
                    {formatMoney(peeked.order.totalAmount, peeked.order.currency)}
                  </bdi>
                </Fact>
              )}
              <Fact label={t.colReward}>{peekedReward ? <bdi>{peekedReward}</bdi> : <span className="font-normal text-ink-soft">{t.qlNoReward}</span>}</Fact>
              <Fact label={t.qlInvitedOn}>{formatDate(peeked.createdAt)}</Fact>
              {peeked.rewardedAt && <Fact label={t.qlRewardedOn}>{formatDate(peeked.rewardedAt)}</Fact>}
            </dl>
          </div>
        )}
      </QuickLook>
    </section>
  );
}
