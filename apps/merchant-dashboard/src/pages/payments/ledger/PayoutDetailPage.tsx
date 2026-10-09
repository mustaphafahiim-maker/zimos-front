import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { paymentPayoutGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { DataState, PageSkeleton } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { LEDGER_PATH, LEDGER_STRINGS, PAYOUT_STATUS_TONE } from "./ledgerStrings";
import { LedgerMoney, TransactionsTable } from "./TransactionsTable";

function Row({ label, hint, strong = false, children }: { label: string; hint?: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="min-w-0 text-sm text-ink-soft">
        <span className={strong ? "font-semibold text-ink" : undefined}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-5">{hint}</span>}
      </dt>
      <dd className={strong ? "shrink-0 text-[15px] font-semibold text-ink" : "shrink-0 text-sm font-medium text-ink"}>{children}</dd>
    </div>
  );
}

/**
 * /payments/payouts/:payoutId (handoff 384): one payout — its amount, status,
 * arrival date and the gateway's own id — how it adds up (payments, refunds,
 * fees, lines that are not ZIMOS's), and the payments and refunds in it.
 */
export function PayoutDetailPage() {
  const t = useT(LEDGER_STRINGS);
  const workspaceId = useWorkspaceId();
  const { payoutId = "" } = useParams();
  const detail = useAsync(() => paymentPayoutGet(apiClient, workspaceId, payoutId), [workspaceId, payoutId]);
  const data = detail.data;
  const back = { to: `${LEDGER_PATH}?tab=payouts`, label: t.payoutBack };

  return (
    <DataState
      loading={detail.loading && !data}
      error={data ? null : detail.error}
      onRetry={() => void detail.refresh()}
      skeleton={<PageSkeleton />}
    >
      {data && (
        <div className="min-w-0">
          <PageHeader
            title={fmt(t.payoutTitle, { amount: formatMoney(data.payout.amount, data.payout.currency) })}
            titleBadge={
              <span className="inline-flex flex-wrap items-center gap-1">
                <StatusBadge
                  value={data.payout.status}
                  tone={PAYOUT_STATUS_TONE[data.payout.status] ?? "neutral"}
                  text={t[`payout_${data.payout.status}`] ?? data.payout.status}
                />
                {data.payout.mode === "test" && <StatusBadge value="test" tone="warning" text={t.test} />}
              </span>
            }
            back={back}
          />

          <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
            <div className="grid gap-[var(--bento-gap)] lg:grid-cols-2">
              <Section title={providerName(data.payout.gateway)}>
                <dl className="divide-y divide-line">
                  <Row label={t.colAmount}>
                    <LedgerMoney minor={data.payout.amount} currency={data.payout.currency} signed />
                  </Row>
                  <Row label={t.arrival}>{data.payout.arrivalDate ? formatDate(data.payout.arrivalDate) : "—"}</Row>
                  {data.payout.externalId && (
                    <Row label={t.gatewayId}>
                      <span className="inline-flex max-w-full items-center gap-2">
                        <bdi dir="ltr" className="min-w-0 truncate font-mono text-xs">
                          {data.payout.externalId}
                        </bdi>
                        <CopyButton value={data.payout.externalId} label={t.copyId} iconOnly />
                      </span>
                    </Row>
                  )}
                </dl>
              </Section>

              <Section title={t.summary}>
                <dl className="divide-y divide-line">
                  <Row label={t.sumPayments}>
                    <LedgerMoney minor={data.summary.paymentsAmount} currency={data.payout.currency} />
                  </Row>
                  <Row label={t.sumRefunds}>
                    <LedgerMoney minor={data.summary.refundsAmount} currency={data.payout.currency} signed />
                  </Row>
                  <Row label={t.sumFees}>
                    <LedgerMoney minor={data.summary.fees} currency={data.payout.currency} />
                  </Row>
                  {data.summary.unmatchedCount > 0 && (
                    <Row label={t.sumUnmatched} hint={t.sumUnmatchedHint}>
                      <LedgerMoney minor={data.summary.unmatchedAmount} currency={data.payout.currency} signed />
                    </Row>
                  )}
                  <Row label={t.sumTotal} strong>
                    <LedgerMoney minor={data.payout.amount} currency={data.payout.currency} signed />
                  </Row>
                </dl>
              </Section>
            </div>

            <section className="min-w-0">
              <h2 className="mb-2 px-1 text-sm font-semibold text-ink">
                {t.paymentsIn} · <span className="tabular-nums">{data.payments.length}</span>
              </h2>
              {data.payments.length > 0 ? <TransactionsTable rows={data.payments} withPayout={false} /> : <p className="px-1 text-sm text-ink-soft">{t.noneIn}</p>}
            </section>
            <section className="min-w-0">
              <h2 className="mb-2 px-1 text-sm font-semibold text-ink">
                {t.refundsIn} · <span className="tabular-nums">{data.refunds.length}</span>
              </h2>
              {data.refunds.length > 0 ? <TransactionsTable rows={data.refunds} withPayout={false} /> : <p className="px-1 text-sm text-ink-soft">{t.noneIn}</p>}
            </section>
          </div>
        </div>
      )}
    </DataState>
  );
}
