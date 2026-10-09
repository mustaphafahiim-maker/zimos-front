import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, buttonVariants } from "@store-builder/ui";
import {
  adminPaymentProofApprove,
  adminPaymentProofGet,
  adminPaymentProofReject,
  adminPaymentProofsList,
  apiErrorCode,
  type AdminPaymentProof,
  type AdminPaymentProofDetail,
  type AdminProofStatus,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { FilterChips, TextAreaField, TextField } from "@/components/forms";
import { Modal } from "@/components/Modal";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMinorMoneyExact, formatRelative, toMajorAmount, toMinorAmount } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

type Filter = AdminProofStatus | "all";
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];
const STATUS: Record<AdminProofStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};
const BLOCKER: Record<string, string> = {
  CHARGE_ALREADY_PAID: "The charge is already paid",
  CHARGE_REPRICED: "The charge was re-priced",
};
const PAGE_SIZE = 20;

function ProofStatus({ status }: { status: AdminProofStatus }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <StatusBadge tone={s.tone} dot>
      {s.label}
    </StatusBadge>
  );
}

const purposeLabel = (p: AdminPaymentProof) => (p.purpose === "topup" ? "Balance top-up" : "Subscription charge");

/**
 * Billing → Transfer proofs: the screenshots merchants sent for a subscription
 * charge or a balance top-up. Waiting ones come oldest first.
 */
export function PaymentProofsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wanted = params.get("status");
  const status: Filter = FILTERS.some((f) => f.value === wanted) ? (wanted as Filter) : "pending";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, loading, error, refresh } = useAsync(() => adminPaymentProofsList(apiClient, { status, page, pageSize: PAGE_SIZE }), [status, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const go = (next: { status?: Filter; page?: number }) => {
    const out = new URLSearchParams();
    out.set("status", next.status ?? status);
    if ((next.page ?? 1) > 1) out.set("page", String(next.page));
    setParams(out, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Transfer proofs"
        description="Transfer screenshots merchants sent for a subscription charge or a balance top-up."
        actions={
          <>
            <Link to="/payment-methods" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Payment methods
            </Link>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <FilterChips options={FILTERS} value={status} onChange={(value) => go({ status: value })} />
      </div>
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && data.proofs.length === 0 ? (
          <EmptyBlock message={status === "pending" ? "No transfer proof is waiting for review." : "No transfer proofs here."} />
        ) : (
          data && (
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Store</Th>
                    <Th>Method</Th>
                    <Th>Sent to</Th>
                    <Th>Sender</Th>
                    <Th className="text-end">Amount</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.proofs.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/payment-proofs/${p.id}`)}>
                      <Td>
                        <Link to={`/payment-proofs/${p.id}`} className="block font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
                          {p.workspace.name}
                        </Link>
                        <span className="text-xs text-ink-soft">{purposeLabel(p)}</span>
                      </Td>
                      <Td>{p.method.labelEn}</Td>
                      <Td className="font-mono text-xs">{p.receivingNumber ?? "—"}</Td>
                      <Td className="font-mono text-xs">{p.senderPhone}</Td>
                      <Td className="tabular text-end">{formatMinorMoneyExact(p.requestedAmount, p.currency)}</Td>
                      <Td>
                        {formatDate(p.createdAt)}
                        <span className="block text-xs text-ink-soft">{formatRelative(p.createdAt)}</span>
                      </Td>
                      <Td>
                        <ProofStatus status={p.status} />
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-sm">
                  <span className="text-ink-soft">
                    Page {data.page} of {pages} · {data.total} proofs
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          )
        )}
      </DataState>
    </div>
  );
}

/** One proof: the screenshot, what it is for, and Approve / Reject while it waits. */
export function PaymentProofDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminPaymentProofGet(apiClient, id), [id]);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const back = { to: "/payment-proofs", label: "Transfer proofs" };

  if (loading || error || !data) {
    return (
      <div>
        <PageHeader title="Transfer proof" back={back} />
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          <EmptyBlock message="This transfer proof was not found." />
        </DataState>
      </div>
    );
  }

  const { proof, invoice, wallet, approvalBlockers, image } = data;
  const topup = proof.purpose === "topup";
  const money = (n: number) => formatMinorMoneyExact(n, proof.currency);
  const waiting = proof.status === "pending";

  return (
    <div>
      <PageHeader
        title={`${proof.workspace.name} — ${purposeLabel(proof)}`}
        titleBadge={<ProofStatus status={proof.status} />}
        description={`Sent ${formatDateTime(proof.createdAt)}${proof.submittedBy ? ` by ${proof.submittedBy.fullName} (${proof.submittedBy.email})` : ""}`}
        back={back}
        actions={
          waiting ? (
            <>
              <Button variant="outline" onClick={() => setDialog("reject")}>
                Reject
              </Button>
              <Button onClick={() => setDialog("approve")} disabled={approvalBlockers.length > 0}>
                Approve
              </Button>
            </>
          ) : undefined
        }
      />

      {approvalBlockers.length > 0 && waiting && (
        <Alert variant="danger" className="mb-4">
          {approvalBlockers.map((b) => BLOCKER[b] ?? b).join(" · ")} — it can't be approved. Reject it with a note.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Screenshot">
          {image && !imageFailed ? (
            <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={image.url}
                alt={`Transfer screenshot from ${proof.workspace.name}`}
                className="max-h-[70vh] w-full rounded-[10px] border border-line bg-paper object-contain"
                onError={() => setImageFailed(true)}
              />
            </a>
          ) : (
            <div className="space-y-3">
              <EmptyBlock message={image ? "The picture's link ran out (it lasts 5 minutes)." : "No picture is stored for this proof."} />
              {image && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setImageFailed(false);
                    void refresh({ silent: true });
                  }}
                >
                  Load it again
                </Button>
              )}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Transfer">
            <dl>
              <DetailRow label="Store">
                <Link to={`/workspaces/${proof.workspace.id}?tab=subscription`} className="font-medium text-primary hover:underline">
                  {proof.workspace.name}
                </Link>
                <span className="ms-2 text-xs text-ink-soft">{proof.workspace.slug}</span>
              </DetailRow>
              <DetailRow label="For">{purposeLabel(proof)}</DetailRow>
              <DetailRow label="Method">{proof.method.labelEn}</DetailRow>
              <DetailRow label="Sent to">{proof.receivingNumber ? <Mono>{proof.receivingNumber}</Mono> : "—"}</DetailRow>
              <DetailRow label="Sender">
                <Mono>{proof.senderPhone}</Mono>
              </DetailRow>
              <DetailRow label={topup ? "Asked" : "Amount asked"}>
                <span className="tabular font-semibold">{money(proof.requestedAmount)}</span>
              </DetailRow>
              {proof.receivedAmount != null && (
                <DetailRow label="Amount received">
                  <span className="tabular">{money(proof.receivedAmount)}</span>
                </DetailRow>
              )}
              {proof.reviewedAt && (
                <DetailRow label="Reviewed">
                  {formatDateTime(proof.reviewedAt)}
                  {proof.reviewedBy && <span className="ms-2 text-xs text-ink-soft">{proof.reviewedBy.fullName}</span>}
                </DetailRow>
              )}
              {proof.reviewNote && <DetailRow label="Reason (the merchant sees it)">“{proof.reviewNote}”</DetailRow>}
            </dl>
          </Panel>

          {topup ? (
            <Panel title="Balance">
              <dl>
                <DetailRow label="Balance now">
                  {wallet ? (
                    <span className={wallet.balance < 0 ? "tabular font-semibold text-danger" : "tabular font-semibold"}>
                      {formatMinorMoneyExact(wallet.balance, wallet.currency)}
                    </span>
                  ) : (
                    "—"
                  )}
                </DetailRow>
              </dl>
              <p className="mt-2 text-xs text-ink-soft">Approving credits what actually arrived, whatever was asked.</p>
            </Panel>
          ) : (
            <Panel title="Charge">
              {invoice ? (
                <dl>
                  <DetailRow label="Status">
                    <StatusBadge tone={invoice.status === "paid" ? "success" : invoice.status === "pending" ? "warning" : "danger"}>{invoice.status}</StatusBadge>
                  </DetailRow>
                  <DetailRow label="Amount due">
                    <span className="tabular">{formatMinorMoneyExact(invoice.amountDue, invoice.currency)}</span>
                  </DetailRow>
                  <DetailRow label="Period">
                    {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
                  </DetailRow>
                  <DetailRow label="Paid on">{invoice.paidAt ? formatDateTime(invoice.paidAt) : "—"}</DetailRow>
                </dl>
              ) : (
                <EmptyBlock message="The charge is no longer there." />
              )}
            </Panel>
          )}
        </div>
      </div>

      {dialog === "approve" && (
        <ApproveDialog
          detail={data}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setData(next);
            setDialog(null);
            toast.success(next.alreadyApproved ? "It was already approved." : topup ? "Approved. The balance is credited." : "Approved. The charge is paid.");
          }}
        />
      )}
      {dialog === "reject" && (
        <RejectDialog
          proofId={proof.id}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setData(next);
            setDialog(null);
            toast.success(next.alreadyRejected ? "It was already rejected." : "Rejected. The merchant sees your note.");
          }}
        />
      )}
    </div>
  );
}

function ApproveDialog({
  detail,
  onClose,
  onDone,
}: {
  detail: AdminPaymentProofDetail;
  onClose: () => void;
  onDone: (next: AdminPaymentProofDetail) => void;
}) {
  const { proof } = detail;
  const topup = proof.purpose === "topup";
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = Number(amount);
  const minor = amount.trim() !== "" && Number.isFinite(typed) ? toMinorAmount(typed, proof.currency) : null;

  async function approve() {
    if (minor === null || minor <= 0) return setError(topup ? "Enter the amount that arrived. If nothing arrived, reject the proof with a note." : "Enter the amount received.");
    setBusy(true);
    setError(null);
    try {
      onDone(await adminPaymentProofApprove(apiClient, proof.id, minor));
    } catch (err) {
      const code = apiErrorCode(err);
      setError(
        code === "RECEIVED_AMOUNT_MISMATCH"
          ? "The amount received must equal the amount asked — reject the proof with a note"
          : code === "RECEIVED_AMOUNT_REQUIRED"
            ? "Enter the amount that arrived. If nothing arrived, reject the proof with a note."
            : (BLOCKER[code ?? ""] ?? getErrorMessage(err))
      );
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={topup ? "Approve the top-up" : "Approve the transfer"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink">
          {topup ? "Asked" : "Amount asked"}: <strong className="tabular">{formatMinorMoneyExact(proof.requestedAmount, proof.currency)}</strong>
          {topup && detail.wallet && (
            <span className="ms-2 text-ink-soft">· Balance now: {formatMinorMoneyExact(detail.wallet.balance, detail.wallet.currency)}</span>
          )}
        </p>
        <TextField
          label={topup ? `Amount that actually arrived (${proof.currency})` : `Amount received (${proof.currency})`}
          type="number"
          min={0}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={
            topup
              ? "Any amount above 0 — it is what gets credited."
              : `Must equal the amount asked (${toMajorAmount(proof.requestedAmount, proof.currency)}). Check it in the bank or wallet, not on the screenshot.`
          }
        />
        {topup && minor !== null && minor > 0 && (
          <p className="text-sm text-ink" data-testid="topup-credit-line">
            {formatMinorMoneyExact(minor, proof.currency)} will be added to the balance
          </p>
        )}
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

function RejectDialog({ proofId, onClose, onDone }: { proofId: string; onClose: () => void; onDone: (next: AdminPaymentProofDetail) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reject() {
    const text = note.trim();
    if (text.length < 3 || text.length > 1000) return setError("Write the reason, 3 to 1000 characters.");
    setBusy(true);
    setError(null);
    try {
      onDone(await adminPaymentProofReject(apiClient, proofId, text));
    } catch (err) {
      setError(apiErrorCode(err) === "PROOF_ALREADY_REVIEWED" ? "This proof was already approved." : getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Reject the transfer proof"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void reject()} disabled={busy}>
            {busy ? "Rejecting…" : "Reject"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextAreaField label="Reason (the merchant sees it)" required rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
