import { useState } from "react";
import { Button, cn } from "@store-builder/ui";
import type { MerchantInvoice, WorkspaceBilling } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMinorMoney } from "@/lib/format";
import { useT, fmt } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { OnlinePaymentPanel, PaymentReturn } from "./billingParts";
import type { ReturnHint } from "./billingText";
import { SUBSCRIPTION_STRINGS, type SubscriptionText } from "./subscriptionStrings";

const PAGE_SIZE = 10;

/**
 * The store's charges, newest first, a page at a time; above them the Pay
 * button (when the platform has online payment on and something is due) and,
 * back from Fawaterak, what became of the payment.
 */
export function InvoicesTab({
  billing,
  returned,
  onReturnDone,
  onPaid,
}: {
  billing: WorkspaceBilling | null;
  returned: { paymentId: string; hint: ReturnHint } | null;
  onReturnDone: () => void;
  onPaid: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const invoices = useAsync(() => apiClient.listBillingInvoices(workspaceId, { page, pageSize: PAGE_SIZE }), [workspaceId, page]);
  const pages = invoices.data ? Math.max(1, Math.ceil(invoices.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      {returned && (
        <PaymentReturn
          key={returned.paymentId}
          paymentId={returned.paymentId}
          hint={returned.hint}
          onSettled={() => {
            onPaid();
            void invoices.refresh({ silent: true });
          }}
          onDone={onReturnDone}
        />
      )}
      {billing?.onlinePayment?.enabled && billing.nextCharge && <OnlinePaymentPanel billing={billing} />}

      <DataState
        loading={invoices.loading && !invoices.data}
        error={invoices.error}
        empty={invoices.data?.invoices.length === 0}
        emptyMessage={t.noInvoices}
        onRetry={() => void invoices.refresh()}
      >
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
          {invoices.data?.invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} t={t} />
          ))}
        </ul>
        {pages > 1 && (
          <nav className="mt-3 flex items-center justify-between gap-3" aria-label={t.invoicesTab}>
            <Button type="button" variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t.previous}
            </Button>
            <span className="text-sm text-ink-soft">{fmt(t.pageOf, { page, pages })}</span>
            <Button type="button" variant="outline" className="min-h-10" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t.next}
            </Button>
          </nav>
        )}
      </DataState>
    </div>
  );
}

function InvoiceRow({ invoice, t }: { invoice: MerchantInvoice; t: SubscriptionText }) {
  const status =
    invoice.status === "paid" ? t.statusPaid : invoice.status === "pending" ? t.statusPending : t.statusFailed;
  const amount = invoice.status === "paid" && invoice.amountPaid != null ? invoice.amountPaid : invoice.amountDue;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{formatDate(invoice.paidAt ?? invoice.createdAt)}</p>
        <p className="text-xs text-ink-soft">
          {t.invoicePeriod}: {fmt(t.periodRange, { start: formatDate(invoice.periodStart), end: formatDate(invoice.periodEnd) })}
        </p>
      </div>
      <div className="text-end">
        <p className="tabular text-sm font-medium text-ink">{formatMinorMoney(amount, invoice.currency)}</p>
        {invoice.discountAmount > 0 && (
          <p className="text-xs text-ink-soft">{fmt(t.discountLine, { discount: formatMinorMoney(invoice.discountAmount, invoice.currency) })}</p>
        )}
        <span
          className={cn(
            "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
            invoice.status === "paid"
              ? "bg-success-soft text-success"
              : invoice.status === "pending"
                ? "bg-accent-soft text-ink"
                : "bg-danger-soft text-danger"
          )}
        >
          {status}
        </span>
      </div>
    </li>
  );
}
