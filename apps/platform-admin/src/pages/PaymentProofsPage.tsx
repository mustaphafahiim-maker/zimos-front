import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatMinorMoney, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";
import { PROOF_STATUS_LABEL } from "@/lib/paymentProofs";

type Filter = "pending" | "approved" | "rejected" | "all";
const PAGE_SIZE = 20;

/** Merchants' transfer proofs: the waiting ones oldest first, to be checked against the money that arrived. */
export function PaymentProofsPage() {
  const [status, setStatus] = useState<Filter>("pending");
  const [page, setPage] = useState({ status, offset: 0 });
  const offset = page.status === status ? page.offset : 0;
  const { data, loading, error, refresh } = useAsync(
    () => adminApi.listPaymentProofs({ status, page: offset / PAGE_SIZE + 1, pageSize: PAGE_SIZE }),
    [status, offset]
  );
  const proofs = data?.proofs ?? [];

  return (
    <div>
      <PageHeader
        title="Transfer proofs"
        description="Merchants who paid by InstaPay or a wallet. Check the money arrived before approving."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <FilterChips
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: "Waiting" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "all", label: "All" },
        ]}
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {proofs.length === 0 ? (
          <EmptyBlock message={status === "pending" ? "No transfer is waiting for review." : "No proofs match."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Store</Th>
                  <Th>For</Th>
                  <Th>Method</Th>
                  <Th>Sender</Th>
                  <Th className="text-end">Amount asked</Th>
                  <Th>Sent</Th>
                  <Th>Status</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((p) => (
                  <TableRow key={p.id}>
                    <Td>
                      <Link to={`/payment-proofs/${p.id}`} className="font-medium text-ink hover:text-primary">
                        {p.workspace.name ?? "Deleted store"}
                      </Link>
                    </Td>
                    <Td className="text-sm">{p.purpose === "invoice" ? "Subscription invoice" : "Balance top-up"}</Td>
                    <Td className="text-sm">{p.method.labelEn ?? p.method.code}</Td>
                    <Td className="font-mono text-sm">
                      <span dir="ltr">{p.senderPhone}</span>
                    </Td>
                    <Td className="tabular text-end text-sm">{formatMinorMoney(p.requestedAmount, p.currency)}</Td>
                    <Td className="whitespace-nowrap text-sm">
                      <span title={formatDateTime(p.createdAt)}>{formatRelative(p.createdAt)}</span>
                    </Td>
                    <Td>
                      <Status value={p.status === "approved" ? "active" : p.status === "rejected" ? "failed" : "pending"} label={PROOF_STATUS_LABEL[p.status]} />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        {data && <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onOffset={(next) => setPage({ status, offset: next })} />}
      </DataState>
    </div>
  );
}
