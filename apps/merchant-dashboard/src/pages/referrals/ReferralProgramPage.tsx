import { useState, type FormEvent } from "react";
import { HeartHandshake } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  merchantReferralsGet,
  merchantReferralsJoin,
  merchantReferralsRequestPayout,
  type MerchantReferrals,
  type ReferralPayoutMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Refer & earn",
    description: "Share ZIMOS with other sellers. When a store you brought in pays for its plan, you earn a share of every payment.",
    closedTitle: "The referral program opens soon",
    closedBody: "ZIMOS hasn't opened the program yet. Check back here.",
    joinTitle: "Earn {rate} of what they pay",
    joinBody: "Get your own link. Stores that sign up with it and pay for a plan earn you {rate} of each payment, for as long as they pay.",
    join: "Get my link",
    joining: "One moment…",
    linkTitle: "Your link",
    linkHint: "Or they enter your code in Settings → Billing: {code}",
    copy: "Copy link",
    rate: "Your share",
    signups: "Stores that used your code",
    owed: "Owed to you",
    paid: "Paid to you",
    none: "—",
    earningsTitle: "Earnings",
    earningsEmpty: "Nothing yet. You earn when a store that used your code pays for its plan.",
    paidAt: "Paid on",
    payment: "Store's payment",
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
    request: "Request payout",
    requesting: "Sending…",
    requested: "Request sent. ZIMOS will pay it and mark it here.",
    waiting: "Your request for {amount} is waiting to be paid.",
    nothingOwed: "Nothing is owed to you right now.",
    history: "Payout requests",
    p_requested: "Waiting",
    p_paid: "Paid",
    p_rejected: "Declined",
  },
  ar: {
    title: "اكسب من الإحالة",
    description: "رشّح ZIMOS لتجار تانيين. لما متجر جه عن طريقك يدفع باقته، تاخد نسبة من كل دفعة.",
    closedTitle: "برنامج الإحالة هيفتح قريب",
    closedBody: "ZIMOS لسه مفتحتش البرنامج. ارجع هنا بعدين.",
    joinTitle: "اكسب {rate} من اللي بيدفعوه",
    joinBody: "خد لينك خاص بيك. المتاجر اللي تسجّل بيه وتدفع باقة بتكسّبك {rate} من كل دفعة طول ما هي بتدفع.",
    join: "عايز اللينك بتاعي",
    joining: "لحظة…",
    linkTitle: "اللينك بتاعك",
    linkHint: "أو يكتبوا كودك في الإعدادات ← الفواتير: {code}",
    copy: "نسخ اللينك",
    rate: "نسبتك",
    signups: "متاجر استخدمت كودك",
    owed: "مستحق ليك",
    paid: "اتدفع ليك",
    none: "—",
    earningsTitle: "الأرباح",
    earningsEmpty: "لسه مفيش. بتكسب لما متجر استخدم كودك يدفع باقته.",
    paidAt: "تاريخ الدفع",
    payment: "دفعة المتجر",
    commission: "نصيبك",
    status: "الحالة",
    status_pending: "مستحق",
    status_marked_paid: "اتدفع",
    status_voided: "اترجع",
    payoutTitle: "اسحب أرباحك",
    payoutBody: "اطلب من ZIMOS تبعتلك المستحق. التحويل بيتم يدويًا وعادةً خلال أيام.",
    method: "طريقة التحويل",
    method_vodafone_cash: "فودافون كاش",
    method_instapay: "إنستاباي",
    method_bank_transfer: "تحويل بنكي",
    details: "الرقم أو بيانات الحساب",
    detailsHint: "رقم المحفظة أو عنوان إنستاباي أو الحساب البنكي اللي هيوصله الفلوس.",
    request: "اطلب السحب",
    requesting: "جارٍ الإرسال…",
    requested: "الطلب اتبعت. ZIMOS هتحوّل وتعلّم عليه هنا.",
    waiting: "طلبك بـ {amount} مستني التحويل.",
    nothingOwed: "مفيش مستحقات ليك دلوقتي.",
    history: "طلبات السحب",
    p_requested: "مستني",
    p_paid: "اتدفع",
    p_rejected: "مرفوض",
  },
} satisfies Messages;

const METHODS: ReferralPayoutMethod[] = ["vodafone_cash", "instapay", "bank_transfer"];
const pct = (bp: number | null) => (bp === null ? "—" : `${(bp / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`);
const sum = (rows: { currency: string; amount: number }[]) => rows.map((r) => formatMoney(r.amount, r.currency)).join(" + ");

/** ZIMOS's referral program for merchants (SPEC §20.4): link, sign-ups, earnings, payout requests. */
export function ReferralProgramPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const state = useAsync(() => merchantReferralsGet(apiClient), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<ReferralPayoutMethod>("vodafone_cash");
  const [details, setDetails] = useState("");

  async function run(action: () => Promise<MerchantReferrals>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      state.setData(await action());
      if (success) toast.success(success);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function requestPayout(e: FormEvent) {
    e.preventDefault();
    void run(() => merchantReferralsRequestPayout(apiClient, { method, details: details.trim() }), t.requested);
  }

  const data = state.data;
  const owed = (data?.totals ?? []).filter((x) => x.pending > 0).map((x) => ({ currency: x.currency, amount: x.pending }));
  const paid = (data?.totals ?? []).filter((x) => x.markedPaid > 0).map((x) => ({ currency: x.currency, amount: x.markedPaid }));
  const waiting = (data?.payouts ?? []).find((p) => p.status === "requested");

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} />
      <DataState loading={state.loading && !data} error={state.error} onRetry={() => void state.refresh()}>
        {data && !data.code && !data.program.open && <EmptyState icon={<HeartHandshake />} title={t.closedTitle} description={t.closedBody} />}

        {data && !data.code && data.program.open && (
          <EmptyState
            icon={<HeartHandshake />}
            title={fmt(t.joinTitle, { rate: pct(data.program.rateBp) })}
            description={fmt(t.joinBody, { rate: pct(data.program.rateBp) })}
            action={
              <Button className="min-h-11" disabled={busy} onClick={() => void run(() => merchantReferralsJoin(apiClient))}>
                {busy ? t.joining : t.join}
              </Button>
            }
          />
        )}

        {error && (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        )}

        {data?.code && (
          <div className="space-y-5">
            <Section title={t.linkTitle}>
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="min-w-0 flex-1 select-all break-all rounded-md border border-line bg-paper p-2 font-mono text-xs text-ink">
                  {data.code.link}
                </code>
                <CopyButton value={data.code.link} label={t.copy} />
              </div>
              <p className="mt-2 text-xs text-ink-soft">{fmt(t.linkHint, { code: data.code.code })}</p>
            </Section>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [t.rate, pct(data.code.rateBp)],
                [t.signups, String(data.signups ?? 0)],
                [t.owed, owed.length ? sum(owed) : t.none],
                [t.paid, paid.length ? sum(paid) : t.none],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-3">
                  <p className="text-xs text-ink-soft">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>

            <Section title={t.earningsTitle}>
              {(data.earnings ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">{t.earningsEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-start text-xs text-ink-soft">
                        <th className="py-2 text-start font-medium">{t.paidAt}</th>
                        <th className="py-2 text-start font-medium">{t.payment}</th>
                        <th className="py-2 text-start font-medium">{t.commission}</th>
                        <th className="py-2 text-start font-medium">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.earnings ?? []).map((e, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="py-2">{formatDate(e.paidAt)}</td>
                          <td className="py-2">{formatMoney(e.amountPaid, e.currency)}</td>
                          <td className="py-2 font-medium">{formatMoney(e.commission, e.currency)}</td>
                          <td className="py-2">{t[`status_${e.status}`]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title={t.payoutTitle} description={t.payoutBody}>
              {waiting ? (
                <p className="text-sm text-ink">{fmt(t.waiting, { amount: sum(waiting.amounts) })}</p>
              ) : owed.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.nothingOwed}</p>
              ) : (
                <form onSubmit={requestPayout} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                  <Field label={t.method}>
                    {({ id }) => (
                      <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as ReferralPayoutMethod)}>
                        {METHODS.map((m) => (
                          <option key={m} value={m}>
                            {t[`method_${m}`]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <TextField label={t.details} hint={t.detailsHint} dir="ltr" required minLength={5} maxLength={300} value={details} onChange={(e) => setDetails(e.target.value)} />
                  <Button type="submit" className="min-h-11" disabled={busy || details.trim().length < 5}>
                    {busy ? t.requesting : t.request}
                  </Button>
                </form>
              )}
              {(data.payouts ?? []).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-ink-soft">{t.history}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {(data.payouts ?? []).map((p) => (
                      <li key={p.id} className="flex flex-wrap gap-2">
                        <span className="text-ink-soft">{formatDate(p.createdAt)}</span>
                        <span>{sum(p.amounts)}</span>
                        <span>· {t[`method_${p.method}`]}</span>
                        <span className="font-medium">· {t[`p_${p.status}`]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          </div>
        )}
      </DataState>
    </div>
  );
}
