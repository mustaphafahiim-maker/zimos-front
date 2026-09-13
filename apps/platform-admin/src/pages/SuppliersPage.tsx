import { useMemo, useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow, Drawer } from "@/components/Drawer";
import { FilterChips, SearchInput, TextAreaField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { countryName } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import type { Supplier, SupplierStatus } from "@/mock/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

type Filter = "all" | SupplierStatus;

export function SuppliersPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listSuppliers(), []);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Supplier | null>(null);
  const [reason, setReason] = useState("");
  const [approving, setApproving] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);
  const selected = rows.find((s) => s.id === selectedId) ?? null;
  const replace = (s: Supplier) => setData((prev) => (prev ?? []).map((x) => (x.id === s.id ? s : x)));

  const filtered = rows.filter((s) => {
    const q = query.trim().toLowerCase();
    return (filter === "all" || s.status === filter) && (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  });

  const options = (
    [
      ["pending", "Pending"],
      ["approved", "Approved"],
      ["rejected", "Rejected"],
      ["all", "All"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? rows.length : rows.filter((s) => s.status === value).length }));

  async function approve(s: Supplier) {
    setApproving(true);
    try {
      replace(await adminApi.approveSupplier(s.id));
      toast.success(`${s.name} approved.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Moderation queue for wholesale suppliers applying to the marketplace." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={filter} onChange={setFilter} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search supplier or email" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={filter === "pending" && !query ? "The moderation queue is empty." : "No suppliers match these filters."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Supplier</Th>
                  <Th>Location</Th>
                  <Th>Categories</Th>
                  <Th className="text-end">Products</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th className="text-end">Actions</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                    <Td>
                      <span className="block font-medium">{s.name}</span>
                      <span className="text-xs text-ink-soft">{s.contactName}</span>
                    </Td>
                    <Td className="text-ink-soft">
                      {s.city}, {countryName(s.country)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {s.categories.map((c) => (
                          <StatusBadge key={c} tone="neutral">
                            {c}
                          </StatusBadge>
                        ))}
                      </div>
                    </Td>
                    <Td className="tabular text-end">{formatNumber(s.productsCount)}</Td>
                    <Td className="text-ink-soft">{formatRelative(s.submittedAt)}</Td>
                    <Td>
                      <Status value={s.status} />
                    </Td>
                    <Td className="text-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(s.id);
                        }}
                      >
                        Review
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? ""}
        description={selected ? `Submitted ${formatDateTime(selected.submittedAt)}` : undefined}
        footer={
          selected && (
            <>
              {selected.status !== "rejected" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setReason("");
                    setRejecting(selected);
                  }}
                >
                  <CircleX /> Reject
                </Button>
              )}
              {selected.status !== "approved" && (
                <Button onClick={() => void approve(selected)} disabled={approving}>
                  <CircleCheck /> {approving ? "Approving…" : "Approve"}
                </Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Status value={selected.status} />
              {selected.reviewedAt && (
                <span className="text-xs text-ink-soft">
                  by {selected.reviewedBy} · {formatRelative(selected.reviewedAt)}
                </span>
              )}
            </div>
            {selected.rejectionReason && (
              <div className="rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
                <p className="font-medium">Rejection reason</p>
                <p>{selected.rejectionReason}</p>
              </div>
            )}
            <p className="text-sm text-ink">{selected.description}</p>
            <dl>
              <DetailRow label="Contact">{selected.contactName}</DetailRow>
              <DetailRow label="Email">{selected.email}</DetailRow>
              <DetailRow label="Phone">{selected.phone}</DetailRow>
              <DetailRow label="Location">
                {selected.city}, {countryName(selected.country)}
              </DetailRow>
              <DetailRow label="Categories">{selected.categories.join(", ")}</DetailRow>
              <DetailRow label="Products submitted">{formatNumber(selected.productsCount)}</DetailRow>
            </dl>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!rejecting}
        title={`Reject ${rejecting?.name ?? ""}?`}
        description="The reason is sent to the supplier so they can fix and resubmit."
        confirmLabel="Reject supplier"
        destructive
        confirmDisabled={!reason.trim()}
        onCancel={() => setRejecting(null)}
        onConfirm={async () => {
          if (!rejecting) return;
          replace(await adminApi.rejectSupplier(rejecting.id, reason));
          toast.success(`${rejecting.name} rejected.`);
          setRejecting(null);
        }}
      >
        <TextAreaField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change before approval?" />
      </ConfirmDialog>
    </div>
  );
}
