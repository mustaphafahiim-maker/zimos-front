import { useState } from "react";
import { Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { CommissionListStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CommissionTotals,
  LedgerTable,
  MerchantsTable,
} from "@/components/referrals";
import { PAYOUT_OPTIONS, describeDiscount } from "@/lib/referrals";
import { Pager } from "@/pages/BlocklistPage";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatBp } from "@/lib/format";

type StatusFilter = "all" | CommissionListStatus;

/**
 * An agent's own view: their codes, the merchants who entered them, and the
 * commission each of those merchants' payments suggests. Read-only — codes
 * are set up by the Zimos team, and payouts are marked there too.
 */
export function MyReferralsPage() {
  const mine = useAsync(() => adminApi.getMyReferrals(), []);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState({ key: status, offset: 0 });
  const offset = page.key === status ? page.offset : 0;
  const ledger = useAsync(
    () => adminApi.listMyCommissions({ status: status === "all" ? undefined : status, offset }),
    [status, offset]
  );

  const agent = mine.data?.agent;

  return (
    <div>
      <PageHeader
        title="My referrals"
        description="Your referral codes, the merchants who used them, and the commission suggested for each of their payments."
      />

      <DataState loading={mine.loading && !mine.data} error={mine.error} onRetry={() => void mine.refresh()}>
        {agent && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">My codes</h2>
              {agent.codes.length === 0 ? (
                <EmptyBlock message="You don't have a referral code yet. The Zimos team sets them up." />
              ) : (
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Code</Th>
                        <Th>Merchant discount</Th>
                        <Th>Your commission</Th>
                        <Th className="text-end">Merchants</Th>
                        <Th>Suggested commission</Th>
                        <Th>Status</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agent.codes.map((c) => (
                        <TableRow key={c.id}>
                          <Td>
                            <Mono>{c.code}</Mono>
                            {c.label && <span className="block text-xs text-ink-soft">{c.label}</span>}
                          </Td>
                          <Td className="text-sm">{describeDiscount(c)}</Td>
                          <Td className="text-sm">{formatBp(c.effectiveCommissionRateBp)} of each payment</Td>
                          <Td className="text-end text-sm">{c.merchantsReferred}</Td>
                          <Td>
                            <CommissionTotals totals={c.commission} empty="No payments yet" />
                          </Td>
                          <Td>
                            <StatusBadge tone={c.active ? "success" : "neutral"} dot>
                              {c.active ? "Active" : "Inactive"}
                            </StatusBadge>
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Panel>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Merchants who used my codes</h2>
              {mine.data!.merchants.length === 0 ? (
                <EmptyBlock message="No merchant has entered one of your codes yet." />
              ) : (
                <MerchantsTable merchants={mine.data!.merchants} linkWorkspaces={false} />
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Payments and commission</h2>
                <FilterChips options={PAYOUT_OPTIONS} value={status} onChange={setStatus} />
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                A suggested commission is recorded for every payment a referred merchant makes, renewals included.
                Payouts are arranged with the Zimos team, who mark each one paid here.
              </p>
              <DataState loading={ledger.loading && !ledger.data} error={ledger.error} onRetry={() => void ledger.refresh()}>
                {ledger.data && ledger.data.totals.length > 0 && (
                  <div className="mb-3">
                    <CommissionTotals totals={ledger.data.totals} />
                  </div>
                )}
                {(ledger.data?.commissions.length ?? 0) === 0 ? (
                  <EmptyBlock message={status === "all" ? "No payments yet." : "No rows match this filter."} />
                ) : (
                  <LedgerTable rows={ledger.data!.commissions} />
                )}
                {ledger.data && (
                  <Pager
                    total={ledger.data.total}
                    limit={ledger.data.limit}
                    offset={offset}
                    onOffset={(next) => setPage({ key: status, offset: next })}
                  />
                )}
              </DataState>
            </section>
          </div>
        )}
      </DataState>
    </div>
  );
}
