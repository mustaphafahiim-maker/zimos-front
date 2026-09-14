import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleCheck, Download, FileText, PauseCircle, PlayCircle, Undo2 } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, humanize, type Tone } from "@/components/StatusBadge";
import { downloadCsv, escapeHtml, useAction } from "@/components/controls";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney, formatMoneyCompact, formatPercent, formatRelative } from "@/lib/format";
import { controlApi, type FinanceSummary } from "@/mock/controlApi";
import type { Invoice, InvoiceStatus, Payout, PayoutStatus } from "@/mock/controlTypes";

const INVOICE_TONE: Record<InvoiceStatus, Tone> = { paid: "success", open: "warning", refunded: "info", void: "neutral" };
const PAYOUT_TONE: Record<PayoutStatus, Tone> = { pending: "warning", approved: "primary", held: "danger", paid: "success" };
const TABS = ["overview", "invoices", "payouts", "refunds"] as const;
type Tab = (typeof TABS)[number];

export function openInvoiceWindow(inv: Invoice, platformName = "ZIMOS") {
  const w = window.open("", "_blank", "noopener=no,width=820,height=900");
  if (!w) return false;
  const e = escapeHtml;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${e(inv.number)}</title>
<style>body{font-family:system-ui,sans-serif;color:#0b1b3f;margin:40px}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:10px;border-bottom:1px solid #ddd;text-align:start}.muted{color:#667}.total{font-size:20px;font-weight:700}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#eef;font-size:12px;text-transform:uppercase}
@media print{button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px">Print / Save PDF</button>
<h1>${e(platformName)}</h1><p class="muted">Tax invoice</p>
<p><strong>Invoice</strong> ${e(inv.number)} <span class="badge">${e(inv.status)}</span><br>
<strong>Issued</strong> ${e(formatDate(inv.issuedAt))}<br><strong>Billed to</strong> ${e(inv.workspaceName)} (${e(inv.workspaceId)})</p>
<table><thead><tr><th>Description</th><th>Period</th><th>Amount</th></tr></thead><tbody>
<tr><td>${e(inv.planName)} plan subscription</td><td>${e(formatDate(inv.periodStart))} – ${e(formatDate(inv.periodEnd))}</td><td>${e(formatMoney(inv.amount))}</td></tr>
</tbody></table><p class="total" style="text-align:end">Total ${e(formatMoney(inv.amount))}</p>
${inv.paidAt ? `<p class="muted">Paid ${e(formatDate(inv.paidAt))}</p>` : ""}</body></html>`);
  w.document.close();
  return true;
}

export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.getFinance(), []);

  return (
    <div>
      <PageHeader title="Finance" description="Platform revenue, invoices, fees collected, refunds and merchant payouts." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
            <div className="scroll-thin overflow-x-auto border-b border-line">
              <TabsList variant="line" className="h-10">
                {TABS.map((t) => <TabsTrigger key={t} value={t} className="px-3">{humanize(t)}</TabsTrigger>)}
              </TabsList>
            </div>
            <TabsContent value="overview" className="pt-4"><FinanceOverview data={data} /></TabsContent>
            <TabsContent value="invoices" className="pt-4"><InvoicesTab data={data} onChange={(inv) => setData((p) => (p ? { ...p, invoices: p.invoices.map((x) => (x.id === inv.id ? inv : x)) } : p))} onRefresh={() => void refresh({ silent: true })} /></TabsContent>
            <TabsContent value="payouts" className="pt-4"><PayoutsTab data={data} onChange={(po) => setData((p) => (p ? { ...p, payouts: p.payouts.map((x) => (x.id === po.id ? po : x)) } : p))} /></TabsContent>
            <TabsContent value="refunds" className="pt-4"><RefundsTab data={data} /></TabsContent>
          </Tabs>
        )}
      </DataState>
    </div>
  );
}

function FinanceOverview({ data }: { data: FinanceSummary }) {
  const collected = data.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" value={formatMoneyCompact(data.mrr)} hint={formatMoney(data.mrr)} />
        <KpiCard label="ARR" value={formatMoneyCompact(data.arr)} hint="MRR × 12" />
        <KpiCard label="ARPU" value={formatMoney(data.arpu)} hint={`${data.payingCount} paying workspaces`} />
        <KpiCard label="Churn" value={formatPercent(data.churnRate)} hint={`${data.canceledCount} canceled`} />
        <KpiCard label="Transaction fees (30d)" value={formatMoneyCompact(data.transactionFees30d)} hint="From plan transaction fee × GMV" />
        <KpiCard label="COD fees (30d)" value={formatMoneyCompact(data.codFees30d)} hint="From plan COD fee × GMV" />
        <KpiCard label="Invoices collected" value={formatMoneyCompact(collected)} hint={`${data.invoices.filter((i) => i.status === "open").length} open`} to="/finance?tab=invoices" />
        <KpiCard label="Refunded" value={formatMoney(data.refundsTotal)} hint={`${data.refunds.length} refunds`} to="/finance?tab=refunds" />
      </div>
      <p className="text-xs text-ink-soft">All figures derive from mock subscriptions (BACKEND: GET /admin/finance/summary).</p>
    </div>
  );
}

function InvoicesTab({ data, onChange, onRefresh }: { data: FinanceSummary; onChange: (i: Invoice) => void; onRefresh: () => void }) {
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [markPaid, setMarkPaid] = useState<Invoice | null>(null);
  const [refunding, setRefunding] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [blocked, setBlocked] = useState(false);
  const rows = useMemo(() => data.invoices.filter((i) => filter === "all" || i.status === filter), [data.invoices, filter]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips value={filter} onChange={setFilter} options={(["all", "paid", "open", "refunded"] as const).map((s) => ({ value: s, label: humanize(s), count: s === "all" ? data.invoices.length : data.invoices.filter((i) => i.status === s).length }))} />
        <Button variant="outline" size="sm" onClick={() => downloadCsv("zimos-invoices.csv", ["number", "workspace", "plan", "amount", "status", "issued", "paid"], rows.map((i) => [i.number, i.workspaceName, i.planName, i.amount, i.status, i.issuedAt, i.paidAt]))}>
          <Download /> Export CSV
        </Button>
      </div>
      {blocked && <p className="mb-3 text-sm text-danger">Your browser blocked the invoice window — allow pop-ups for this site.</p>}
      {rows.length === 0 ? (
        <EmptyBlock message="No invoices." />
      ) : (
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent"><Th>Invoice</Th><Th>Workspace</Th><Th>Amount</Th><Th>Status</Th><Th>Issued</Th><Th className="text-end">Actions</Th></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <Td className="font-medium">{i.number}<span className="block text-xs text-ink-soft">{i.planName}</span></Td>
                    <Td><Link to={`/workspaces/${i.workspaceId}`} className="hover:text-primary">{i.workspaceName}</Link></Td>
                    <Td className="tabular">{formatMoney(i.amount)}</Td>
                    <Td><StatusBadge tone={INVOICE_TONE[i.status]} dot>{humanize(i.status)}</StatusBadge></Td>
                    <Td className="text-ink-soft">{formatDate(i.issuedAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setBlocked(!openInvoiceWindow(i))}><FileText /> Download</Button>
                        {i.status === "open" && <Button size="sm" variant="outline" onClick={() => setMarkPaid(i)}><CircleCheck /> Mark paid</Button>}
                        {i.status === "paid" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => { setAmount(String(i.amount)); setReason(""); setRefunding(i); }}><Undo2 /> Refund</Button>}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
      <ConfirmDialog open={!!markPaid} title={`Mark ${markPaid?.number ?? ""} paid?`} description="Use when payment arrived outside the gateway (bank transfer, InstaPay)." confirmLabel="Mark paid" onCancel={() => setMarkPaid(null)}
        onConfirm={async () => { if (!markPaid) return; onChange(await controlApi.markInvoicePaid(markPaid.id)); setMarkPaid(null); }} />
      <ConfirmDialog open={!!refunding} title={`Refund ${refunding?.number ?? ""}?`} description="The refund is sent to the original payment method." confirmLabel="Refund" destructive
        confirmDisabled={!reason.trim() || !(Number(amount) > 0)} onCancel={() => setRefunding(null)}
        onConfirm={async () => { if (!refunding) return; onChange(await controlApi.refundInvoice(refunding.id, Number(amount), reason)); setRefunding(null); onRefresh(); }}>
        <div className="space-y-3">
          <TextField label="Amount (EGP)" type="number" min={1} max={refunding?.amount} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
      </ConfirmDialog>
    </div>
  );
}

function PayoutsTab({ data, onChange }: { data: FinanceSummary; onChange: (p: Payout) => void }) {
  const [holding, setHolding] = useState<Payout | null>(null);
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  const queue = data.payouts;
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => downloadCsv("zimos-payouts.csv", ["workspace", "cod_collected", "fees", "amount", "status", "requested"], queue.map((p) => [p.workspaceName, p.codCollected, p.fees, p.amount, p.status, p.requestedAt]))}>
          <Download /> Export CSV
        </Button>
      </div>
      {queue.length === 0 ? (
        <EmptyBlock message="No payouts in the queue." />
      ) : (
        <Panel flush title="Merchant payouts queue" description="Weekly COD remittances after carrier settlement.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent"><Th>Workspace</Th><Th>COD collected</Th><Th>Fees</Th><Th>Payout</Th><Th>Status</Th><Th className="text-end">Actions</Th></TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((p) => (
                  <TableRow key={p.id}>
                    <Td><Link to={`/workspaces/${p.workspaceId}?tab=payments`} className="font-medium hover:text-primary">{p.workspaceName}</Link><span className="block text-xs text-ink-soft">{formatRelative(p.requestedAt)}{p.note ? ` · ${p.note}` : ""}</span></Td>
                    <Td className="tabular">{formatMoney(p.codCollected)}</Td>
                    <Td className="tabular text-ink-soft">−{formatMoney(p.fees)}</Td>
                    <Td className="tabular font-medium">{formatMoney(p.amount)}</Td>
                    <Td><StatusBadge tone={PAYOUT_TONE[p.status]} dot>{humanize(p.status)}</StatusBadge></Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {(p.status === "pending" || p.status === "held") && (
                          <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => void run(p.id, () => controlApi.decidePayout(p.id, "approved", ""), "Payout approved.").then((r) => r && onChange(r))}>
                            <PlayCircle /> Approve
                          </Button>
                        )}
                        {p.status === "pending" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => { setNote(""); setHolding(p); }}><PauseCircle /> Hold</Button>}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
      <ConfirmDialog open={!!holding} title={`Hold payout to ${holding?.workspaceName ?? ""}?`} description="Funds stay on the platform until released." confirmLabel="Hold payout" destructive confirmDisabled={!note.trim()} onCancel={() => setHolding(null)}
        onConfirm={async () => { if (!holding) return; onChange(await controlApi.decidePayout(holding.id, "held", note)); setHolding(null); }}>
        <label htmlFor="hold-note" className="text-sm font-medium text-ink">Reason <span className="text-danger">*</span></label>
        <Textarea id="hold-note" className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

function RefundsTab({ data }: { data: FinanceSummary }) {
  if (data.refunds.length === 0) return <EmptyBlock message="No refunds issued yet. Refund a paid invoice from the Invoices tab." />;
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => downloadCsv("zimos-refunds.csv", ["invoice", "workspace", "amount", "reason", "created", "by"], data.refunds.map((r) => [r.invoiceNumber, r.workspaceName, r.amount, r.reason, r.createdAt, r.createdBy]))}>
          <Download /> Export CSV
        </Button>
      </div>
      <Panel flush>
        <ul className="divide-y divide-line">
          {data.refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="font-medium text-ink">{r.invoiceNumber}</span>
              <span className="text-ink-soft">{r.workspaceName}</span>
              <span className="text-ink-soft">“{r.reason}” · {r.createdBy} · {formatRelative(r.createdAt)}</span>
              <span className="tabular ms-auto font-medium">{formatMoney(r.amount)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
