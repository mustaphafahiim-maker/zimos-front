import { useId, useState, type FormEvent } from "react";
import { IconCoins, IconHourglass, IconPayout, IconPercent, IconReferrals, IconStore, IconWallet } from "@/components/icons";
import { Alert, Button, Card, Input, Label, cn } from "@store-builder/ui";
import {
  merchantReferralsGet,
  merchantReferralsJoin,
  merchantReferralsRequestPayout,
  type MerchantReferrals,
  type ReferralPayoutMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { CopyButton } from "@/components/CopyButton";
import { CardSkeleton, DataState, TilesSkeleton } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { FilterChoice, ListRowCard } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Refer & earn",
    description: "Share ZIMOS with other sellers. When a store you brought in pays for its plan, you earn a share of every payment.",
    closedTitle: "The referral program opens soon",
    closedBody: "ZIMOS hasn't opened the program yet. When it does, your link will be waiting for you here.",
    joinTitle: "Earn {rate} of what they pay",
    joinBody: "Get your own link. Stores that sign up with it and pay for a plan earn you {rate} of each payment, for as long as they pay.",
    join: "Get my link",
    joining: "One moment…",
    linkTitle: "Your link",
    linkBody: "Send it to a seller. A store that signs up with it counts for you.",
    linkHint: "Or they write your code in Settings → Billing:",
    copy: "Copy the link",
    copyCode: "Copy the code",
    rate: "Your share",
    rateHint: "Of every payment",
    signups: "Stores that used your code",
    signupsHint: "Signed up through you",
    owed: "Owed to you",
    owedHint: "Not sent to you yet",
    paid: "Paid to you",
    paidHint: "Already sent to you",
    none: "—",
    earningsTitle: "Earnings",
    earningsBody: "One line for each payment a store you brought in made.",
    earningsEmpty: "Nothing yet. You earn when a store that used your code pays for its plan.",
    paidAt: "Paid on",
    payment: "Store's payment",
    paymentOf: "Store paid {amount}",
    commission: "Your share",
    status: "Status",
    status_pending: "Owed",
    status_marked_paid: "Paid",
    status_voided: "Reversed",
    payoutTitle: "Get paid",
    payoutBody: "Ask ZIMOS to send you what is owed. Payments are sent by hand, usually within a few days.",
    method: "Send it by",
    method_vodafone_cash: "Vodafone Cash",
    method_instapay: "InstaPay",
    method_bank_transfer: "Bank transfer",
    details: "Number or account details",
    detailsHint: "The wallet number, InstaPay address or bank account the money goes to.",
    detailsShort: "Write the full number or account the money should go to.",
    request: "Request payout",
    requestOf: "Request {amount}",
    requesting: "Sending…",
    requested: "Request sent. ZIMOS will pay it and mark it here.",
    waiting: "Your request for {amount} is waiting to be paid.",
    nothingOwed: "Nothing is owed to you right now.",
    ready: "{amount} is owed to you and ready to request.",
    history: "Payout requests",
    p_requested: "Waiting",
    p_paid: "Paid",
    p_rejected: "Declined",
    cancel: "Cancel",
  },
  ar: {
    title: "اكسب من الإحالة",
    description: "رشّح ZIMOS لتجار تانيين. لما متجر جه عن طريقك يدفع باقته، تاخد نسبة من كل دفعة.",
    closedTitle: "برنامج الإحالة هيفتح قريب",
    closedBody: "ZIMOS لسه مفتحتش البرنامج. أول ما يفتح، اللينك بتاعك هيبقى مستنيك هنا.",
    joinTitle: "اكسب {rate} من اللي بيدفعوه",
    joinBody: "خد لينك خاص بيك. المتاجر اللي تسجّل بيه وتدفع باقة بتكسّبك {rate} من كل دفعة طول ما هي بتدفع.",
    join: "عايز اللينك بتاعي",
    joining: "لحظة…",
    linkTitle: "اللينك بتاعك",
    linkBody: "ابعته لتاجر. المتجر اللي يسجّل بيه بيتحسب ليك.",
    linkHint: "أو يكتبوا كودك في الإعدادات ← الفواتير:",
    copy: "انسخ اللينك",
    copyCode: "انسخ الكود",
    rate: "نسبتك",
    rateHint: "من كل دفعة",
    signups: "متاجر استخدمت كودك",
    signupsHint: "سجّلوا عن طريقك",
    owed: "مستحق ليك",
    owedHint: "لسه ما اتحوّلش",
    paid: "اتدفع ليك",
    paidHint: "اتحوّل ليك خلاص",
    none: "—",
    earningsTitle: "الأرباح",
    earningsBody: "سطر لكل دفعة دفعها متجر جه عن طريقك.",
    earningsEmpty: "لسه مفيش. بتكسب لما متجر استخدم كودك يدفع باقته.",
    paidAt: "تاريخ الدفع",
    payment: "دفعة المتجر",
    paymentOf: "المتجر دفع {amount}",
    commission: "نصيبك",
    status: "الحالة",
    status_pending: "مستحق",
    status_marked_paid: "اتدفع",
    status_voided: "اترجع",
    payoutTitle: "اسحب أرباحك",
    payoutBody: "اطلب من ZIMOS تبعتلك المستحق. التحويل بيتم يدوي وعادةً خلال أيام.",
    method: "طريقة التحويل",
    method_vodafone_cash: "فودافون كاش",
    method_instapay: "إنستاباي",
    method_bank_transfer: "تحويل بنكي",
    details: "الرقم أو بيانات الحساب",
    detailsHint: "رقم المحفظة أو عنوان إنستاباي أو الحساب البنكي اللي هتوصله الفلوس.",
    detailsShort: "اكتب الرقم أو الحساب اللي الفلوس تتحوّل عليه كامل.",
    request: "اطلب السحب",
    requestOf: "اسحب {amount}",
    requesting: "بنبعت…",
    requested: "طلب السحب اتبعت. ZIMOS هتحوّل وتعلّم عليه هنا.",
    waiting: "طلب السحب بـ {amount} مستني التحويل.",
    nothingOwed: "مفيش مستحقات ليك دلوقتي.",
    ready: "المستحق ليك {amount} — جاهز تسحبه.",
    history: "طلبات السحب",
    p_requested: "مستني",
    p_paid: "اتدفع",
    p_rejected: "مرفوض",
    cancel: "إلغاء",
  },
} satisfies Messages;

const METHODS: ReferralPayoutMethod[] = ["vodafone_cash", "instapay", "bank_transfer"];
/** Basis points as a share, in the language's own digits: 1000 → «١٠٪». */
const pct = (bp: number | null) =>
  bp === null ? "—" : new Intl.NumberFormat(getIntlLocale(), { style: "percent", maximumFractionDigits: 2 }).format(bp / 10000);
const sum = (rows: { currency: string; amount: number }[]) => rows.map((r) => formatMoney(r.amount, r.currency)).join(" + ");

const EARNING_TONE = { pending: "warning", marked_paid: "success", voided: "neutral" } as const;
const PAYOUT_TONE = { requested: "warning", paid: "success", rejected: "danger" } as const;

/** The page while it loads: the link card, four figures, the earnings. */
function ReferralsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <CardSkeleton lines={2} />
      <TilesSkeleton />
      <CardSkeleton lines={4} />
    </div>
  );
}

/** ZIMOS's referral program for merchants (SPEC §20.4): link, sign-ups, earnings, payout requests. */
export function ReferralProgramPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const detailsId = useId();
  // Shown at once from the last visit, refreshed behind.
  const state = useCachedAsync("referrals:me", () => merchantReferralsGet(apiClient), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<ReferralPayoutMethod>("vodafone_cash");
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  async function run(action: () => Promise<MerchantReferrals>, success?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      state.setData(await action());
      if (success) toast.success(success);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function requestPayout(e: FormEvent) {
    e.preventDefault();
    if (details.trim().length < 5) {
      setDetailsError(true);
      document.getElementById(detailsId)?.focus();
      return;
    }
    const sent = await run(() => merchantReferralsRequestPayout(apiClient, { method, details: details.trim() }), t.requested);
    if (sent) setPayoutOpen(false);
  }

  const data = state.data;
  const owed = (data?.totals ?? []).filter((x) => x.pending > 0).map((x) => ({ currency: x.currency, amount: x.pending }));
  const paid = (data?.totals ?? []).filter((x) => x.markedPaid > 0).map((x) => ({ currency: x.currency, amount: x.markedPaid }));
  const waiting = (data?.payouts ?? []).find((p) => p.status === "requested");
  const earnings = data?.earnings ?? [];
  const payouts = data?.payouts ?? [];
  const canRequest = Boolean(data?.code) && !waiting && owed.length > 0;

  const openPayout = () => {
    setError(null);
    setDetailsError(false);
    setPayoutOpen(true);
  };
  const requestButton = canRequest ? (
    <Button className="min-h-11 rounded-full px-5" onClick={openPayout}>
      <IconPayout weight="bold" className="size-4" aria-hidden />
      {fmt(t.requestOf, { amount: sum(owed) })}
    </Button>
  ) : undefined;

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} primaryAction={requestButton} />
      <DataState
        loading={state.loading && !data}
        error={data ? null : state.error}
        onRetry={() => void state.refresh()}
        skeleton={<ReferralsSkeleton />}
      >
        {data && !data.code && !data.program.open && (
          <EmptyState icon={<IconHourglass aria-hidden />} title={t.closedTitle} description={t.closedBody} tone="attention" />
        )}

        {data && !data.code && data.program.open && (
          <EmptyState
            icon={<IconReferrals aria-hidden />}
            title={fmt(t.joinTitle, { rate: pct(data.program.rateBp) })}
            description={fmt(t.joinBody, { rate: pct(data.program.rateBp) })}
            action={
              <Button className="min-h-11 rounded-full px-5" disabled={busy} onClick={() => void run(() => merchantReferralsJoin(apiClient))}>
                {busy ? t.joining : t.join}
              </Button>
            }
          />
        )}

        {error && !payoutOpen && (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        )}

        {data?.code && (
          <div className="flex flex-col gap-[var(--bento-gap)]">
            {/* The link first: it is what the merchant came to copy. */}
            <Card className="gap-0 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-ink">{t.linkTitle}</h2>
              <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{t.linkBody}</p>
              <div
                data-slot="referral-link"
                className="mt-3 flex min-h-12 items-center gap-2 rounded-[0.875rem] border border-line bg-paper py-1 ps-3.5 pe-1.5"
              >
                <bdi dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[13px] leading-6 text-ink select-all">
                  {data.code.link}
                </bdi>
                <CopyButton value={data.code.link} label={t.copy} className="shrink-0" labelClassName="max-sm:sr-only" />
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-ink-soft">
                {t.linkHint}
                <bdi dir="ltr" className="font-mono text-sm font-semibold text-ink select-all">
                  {data.code.code}
                </bdi>
                <CopyButton value={data.code.code} label={t.copyCode} iconOnly />
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4">
              <KpiCard label={t.rate} value={pct(data.code.rateBp)} hint={t.rateHint} icon={<IconPercent />} />
              <KpiCard label={t.signups} value={formatCount(data.signups ?? 0)} hint={t.signupsHint} icon={<IconStore />} />
              <KpiCard label={t.owed} value={owed.length ? sum(owed) : t.none} hint={t.owedHint} icon={<IconWallet />} />
              <KpiCard label={t.paid} value={paid.length ? sum(paid) : t.none} hint={t.paidHint} icon={<IconCoins />} />
            </div>

            {/* Getting paid: one sentence saying where things stand, and the one button when there is something to ask for. */}
            <Section title={t.payoutTitle} description={t.payoutBody}>
              {waiting ? (
                <p className="flex items-start gap-2 text-sm leading-6 text-ink" role="status">
                  <IconHourglass className="mt-1 size-4 shrink-0 text-accent-dark" aria-hidden />
                  <span>{fmt(t.waiting, { amount: sum(waiting.amounts) })}</span>
                </p>
              ) : owed.length === 0 ? (
                <p className="text-sm leading-6 text-ink-soft">{t.nothingOwed}</p>
              ) : (
                <p className="text-sm leading-6 text-ink">{fmt(t.ready, { amount: sum(owed) })}</p>
              )}
            </Section>

            <Section title={t.earningsTitle} description={t.earningsBody}>
              {earnings.length === 0 ? (
                <p className="text-sm leading-6 text-ink-soft">{t.earningsEmpty}</p>
              ) : (
                <>
                  {/* A phone reads cards: the share and its date first, the status and the store's payment under them. */}
                  <ul className="flex flex-col gap-2.5 md:hidden">
                    {earnings.map((e, i) => (
                      <li key={i}>
                        <ListRowCard
                          title={formatDate(e.paidAt)}
                          amount={<bdi>{formatMoney(e.commission, e.currency)}</bdi>}
                          status={<StatusBadge value={e.status} tone={EARNING_TONE[e.status]} text={t[`status_${e.status}`]} />}
                          meta={fmt(t.paymentOf, { amount: formatMoney(e.amountPaid, e.currency) })}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="-mx-4 -mb-4 overflow-x-auto max-md:hidden">
                    <table className="w-full min-w-[32rem] text-sm">
                      <thead>
                        <tr className="border-y border-line text-xs text-ink-soft">
                          <th scope="col" className="px-4 py-2.5 text-start font-medium">{t.paidAt}</th>
                          <th scope="col" className="px-4 py-2.5 text-start font-medium">{t.payment}</th>
                          <th scope="col" className="px-4 py-2.5 text-start font-medium">{t.commission}</th>
                          <th scope="col" className="px-4 py-2.5 text-start font-medium">{t.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.map((e, i) => (
                          <tr key={i} className="h-[3.25rem] border-b border-line last:border-0">
                            <td className="px-4 text-ink">{formatDate(e.paidAt)}</td>
                            <td className="px-4 text-ink-soft tabular-nums">
                              <bdi>{formatMoney(e.amountPaid, e.currency)}</bdi>
                            </td>
                            <td className="px-4 font-semibold text-ink tabular-nums">
                              <bdi>{formatMoney(e.commission, e.currency)}</bdi>
                            </td>
                            <td className="px-4">
                              <StatusBadge value={e.status} tone={EARNING_TONE[e.status]} text={t[`status_${e.status}`]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>

            {payouts.length > 0 && (
              <AccordionSection
                title={t.history}
                icon={IconPayout}
                badge={
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-paper-sunken px-1.5 text-xs leading-none font-semibold text-ink-soft tabular-nums">
                    {formatCount(payouts.length)}
                  </span>
                }
                summary={payouts[0] ? `${formatDate(payouts[0].createdAt)} · ${t[`p_${payouts[0].status}`]}` : undefined}
                persistKey="referrals:payouts"
                flush
              >
                <ul className="divide-y divide-line">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                      <span className="min-w-0">
                        <bdi className="block text-sm font-semibold text-ink tabular-nums">{sum(p.amounts)}</bdi>
                        <span className="block text-xs leading-5 text-ink-soft">
                          {formatDate(p.createdAt)} · {t[`method_${p.method}`]}
                        </span>
                      </span>
                      <StatusBadge value={p.status} tone={PAYOUT_TONE[p.status]} text={t[`p_${p.status}`]} />
                    </li>
                  ))}
                </ul>
              </AccordionSection>
            )}
          </div>
        )}
      </DataState>

      <Sheet
        open={payoutOpen}
        onOpenChange={(next) => {
          if (!busy) setPayoutOpen(next);
        }}
        title={owed.length ? fmt(t.requestOf, { amount: sum(owed) }) : t.request}
        description={t.payoutBody}
        size="sm"
        footer={
          <>
            <Button type="button" variant="ghost" className="rounded-full px-4 text-ink-soft hover:text-ink" disabled={busy} onClick={() => setPayoutOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
              {busy ? t.requesting : t.request}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={(e) => void requestPayout(e)} className="space-y-4" noValidate>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t.method}</p>
            <FilterChoice
              label={t.method}
              options={METHODS.map((m) => ({ value: m, label: t[`method_${m}`] }))}
              value={method}
              onChange={(value) => {
                if (value) setMethod(value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={detailsId}>{t.details}</Label>
            <Input
              id={detailsId}
              dir="ltr"
              required
              minLength={5}
              maxLength={300}
              inputMode={method === "vodafone_cash" ? "tel" : "text"}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="send"
              value={details}
              disabled={busy}
              aria-invalid={detailsError ? true : undefined}
              aria-describedby={`${detailsId}-note`}
              onChange={(e) => {
                setDetails(e.target.value);
                if (detailsError) setDetailsError(false);
              }}
              className={cn("min-h-11 text-base md:text-base", detailsError && "border-danger")}
            />
            {detailsError ? (
              <p id={`${detailsId}-note`} role="alert" className="text-[13px] leading-5 font-medium text-danger">
                {t.detailsShort}
              </p>
            ) : (
              <p id={`${detailsId}-note`} className="text-xs leading-5 text-ink-soft">
                {t.detailsHint}
              </p>
            )}
          </div>
        </form>
      </Sheet>
    </div>
  );
}
