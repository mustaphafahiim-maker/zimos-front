import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import { Panel, Td, Th } from "@/components/Panel";
import { DataState } from "@/components/DataState";
import { Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatMinorMoneyExact } from "@/lib/format";

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_fee: "Order fee",
  order_fee_reversal: "Fee given back",
  order_fee_recharge: "Fee charged again",
};

const PHASE: Record<string, { value: string; label: string }> = {
  ok: { value: "active", label: "OK" },
  low: { value: "pending", label: "Low" },
  overdraft: { value: "past_due", label: "In overdraft" },
  exhausted: { value: "failed", label: "Exhausted: not selling" },
};

/**
 * A store's prepaid balance (pay-per-order) and its ledger, read-only. The
 * balance moves only through orders and approved top-ups (Transfer proofs);
 * there is no adjustment by hand.
 */
export function StoreWalletPanel({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspaceWallet(workspaceId, { page, pageSize: PAGE_SIZE }), [workspaceId, page]);
  const w = data?.wallet;
  const entries = data?.ledger.entries ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.ledger.total / PAGE_SIZE)) : 1;

  return (
    <Panel
      title="Prepaid balance"
      description={w && !w.enabled ? "WALLET_ENABLED is off: no fee is charged and no top-up is taken." : "Pay per order: fees come from this balance."}
      className="mt-4"
      flush
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {w && (
          <>
            <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-ink-soft">Balance</dt>
                <dd className={cn("tabular text-lg font-semibold", w.balance < 0 ? "text-danger" : "text-ink")}>{formatMinorMoneyExact(w.balance, w.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Fee per order</dt>
                <dd className="tabular text-ink">{w.onFeePlan && w.fee !== null ? formatMinorMoneyExact(w.fee, w.currency) : "Not on pay per order"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Orders left</dt>
                <dd className="tabular text-ink">{w.onFeePlan ? `${w.ordersLeft ?? 0} (${w.ordersBeforeOverdraft ?? 0} before overdraft)` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">State</dt>
                <dd>{w.onFeePlan ? <Status value={PHASE[w.phase].value} label={PHASE[w.phase].label} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Topped up in total</dt>
                <dd className="tabular text-ink">{formatMinorMoneyExact(w.totalToppedUp, w.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">This month (Cairo)</dt>
                <dd className="tabular text-ink">
                  {formatMinorMoneyExact(w.month.fees, w.currency)} · {w.month.orders} orders
                </dd>
              </div>
            </dl>
            {entries.length === 0 ? (
              <p className="border-t border-line px-5 py-4 text-sm text-ink-soft">No movements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>When</Th>
                    <Th>What</Th>
                    <Th>Order / proof</Th>
                    <Th className="text-end">Amount</Th>
                    <Th className="text-end">Balance after</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <Td className="whitespace-nowrap text-sm">{formatDateTime(e.createdAt)}</Td>
                      <Td className="text-sm">{TYPE_LABEL[e.type] ?? e.type}</Td>
                      <Td className="text-sm">
                        {e.orderNumber ? (
                          <span className="font-mono">{e.orderNumber}</span>
                        ) : e.paymentProofId ? (
                          <Link to={`/payment-proofs/${e.paymentProofId}`} className="hover:text-primary">
                            Transfer proof
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className={cn("tabular text-end text-sm", e.amount > 0 ? "text-success" : "text-ink")}>
                        <span dir="ltr">
                          {e.amount > 0 ? "+" : ""}
                          {formatMinorMoneyExact(e.amount, e.currency)}
                        </span>
                      </Td>
                      <Td className="tabular text-end text-sm">{formatMinorMoneyExact(e.balanceAfter, e.currency)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-ink-soft">
                <span>
                  Page {page} of {pages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DataState>
    </Panel>
  );
}
