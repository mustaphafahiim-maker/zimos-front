import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconCash } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ON_ACCOUNT_LIMITS,
  onAccountSettingsSave,
  onAccountStatementGet,
  type OnAccountOrder,
  type OnAccountStatement,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors, isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { formatDate, formatMoney, majorToMinor, minorToMajorInput, parseMoney } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { SkeletonBar } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { parseWhole, toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { canManageCustomers, canRecordPayments } from "./b2bAccess";
import { B2B_STRINGS } from "./b2bStrings";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

/** How many orders show before «اعرض كل الأوردرات»: the customer page has more below this card. */
const FIRST_ORDERS = 5;

/**
 * The customer page's «الدفع الآجل» card (handoff 229): whether this customer
 * may order now and pay later, their credit limit and terms
 * (customers.manage), what they owe, what is late and what is left of the
 * limit, and their on-account orders with due dates and «سجّل دفعة»
 * (orders.manage). A role without customers.view gets no card.
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerOnAccountCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(B2B_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const statement = useAsync(() => onAccountStatementGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const data = statement.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(statement.error)) return null;

  if (!data) {
    return (
      <CustomerCard frame={frame} title={t.onAccountTitle} description={t.onAccountHint}>
        {statement.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{errorMessage(statement.error)}</p>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void statement.refresh()}>
              {common.retry}
            </Button>
          </div>
        ) : (
          <div role="status" aria-busy="true">
            <span className="sr-only">{common.loading}</span>
            <div aria-hidden>
              <SkeletonBar className="h-5 w-56" />
              <SkeletonBar className="mt-3 w-2/5" />
            </div>
          </div>
        )}
      </CustomerCard>
    );
  }

  const role = currentWorkspace?.role;
  const canEdit = canManageCustomers(role);
  const canRecord = canRecordPayments(role);
  // Limits and sums are in the store's currency; each order carries its own.
  const currency = data.orders[0]?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
  const money = (n: number | string) => formatMoney(n, currency);
  const owed = parseMoney(data.owed);
  const overdue = parseMoney(data.overdue);
  const hasBalance = data.enabled || owed > 0 || data.orders.length > 0;
  const shown = all ? data.orders : data.orders.slice(0, FIRST_ORDERS);
  const paying = payingId ? data.orders.find((o) => o.id === payingId) : undefined;

  const orderLink = (o: OnAccountOrder): ReactNode => (
    <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
      <bdi dir="ltr">{o.orderNumber}</bdi>
    </Link>
  );
  const dueDate = (o: OnAccountOrder): ReactNode => (
    <span className="flex flex-wrap items-center gap-2">
      <span className={cn("whitespace-nowrap", o.overdue ? "font-medium text-danger" : "text-ink")}>{formatDate(o.paymentDueAt)}</span>
      {/* Never the colour alone: the word says it too. */}
      {o.overdue && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
    </span>
  );
  const left = (o: OnAccountOrder): ReactNode =>
    parseMoney(o.due) > 0 ? (
      <span className={cn("font-medium whitespace-nowrap tabular-nums", o.overdue ? "text-danger" : "text-ink")}>{formatMoney(o.due, o.currency)}</span>
    ) : (
      <StatusBadge value="paid" text={t.paid} />
    );
  const payButton = (o: OnAccountOrder, className?: string): ReactNode =>
    canRecord && parseMoney(o.due) > 0 ? (
      <Button type="button" variant="outline" size="sm" className={cn("min-h-11", className)} onClick={() => setPayingId(o.id)}>
        <IconCash className="size-4" aria-hidden />
        {t.recordPayment}
      </Button>
    ) : null;

  const columns: Column<OnAccountOrder>[] = [
    {
      key: "order",
      header: t.colOrder,
      cell: (o) => (
        <span className="flex min-w-0 flex-col whitespace-nowrap">
          {orderLink(o)}
          <span className="text-xs font-normal text-ink-soft">{fmt(t.orderedOn, { date: formatDate(o.createdAt) })}</span>
        </span>
      ),
    },
    { key: "due", header: t.colDue, cell: dueDate },
    {
      key: "total",
      header: t.colTotal,
      align: "end",
      cell: (o) => <span className="whitespace-nowrap text-ink-soft tabular-nums">{formatMoney(o.totalAmount, o.currency)}</span>,
    },
    { key: "left", header: t.colLeft, align: "end", cell: left },
    ...(canRecord
      ? [{ key: "pay", header: <span className="sr-only">{t.recordPayment}</span>, align: "end" as const, cell: (o: OnAccountOrder) => payButton(o) }]
      : []),
  ];

  return (
    <CustomerCard
      frame={frame}
      title={t.onAccountTitle}
      description={t.onAccountHint}
      // The folded line of the customer page: what they owe, and what of it is late.
      summary={hasBalance ? [`${t.statOwed}: ${money(owed)}`, overdue > 0 ? `${t.statOverdue}: ${money(overdue)}` : null].filter(Boolean).join(" · ") : undefined}
      flush
    >
      <TermsForm
        // The saved terms are the form's starting point: a save (here or elsewhere) starts it again.
        key={`${data.enabled}:${data.creditLimit}:${data.paymentTermsDays}`}
        data={data}
        currency={currency}
        canEdit={canEdit}
        onSave={async (body) => {
          const next = await onAccountSettingsSave(apiClient, workspaceId, customerId, body);
          statement.setData(next);
          toast.success(next.enabled !== data.enabled ? (next.enabled ? t.onAccountSavedOn : t.onAccountSavedOff) : t.onAccountSaved);
        }}
      />

      {hasBalance && (
        <>
          {!data.enabled && owed > 0 && (
            <div className="px-4 pb-3">
              <Alert>{t.offButOwes}</Alert>
            </div>
          )}
          <dl className={cn("grid gap-3 border-t border-line px-4 py-4 text-sm", data.enabled ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Stat label={t.statOwed} value={money(owed)} />
            <Stat label={t.statOverdue} value={money(overdue)} danger={overdue > 0} />
            {data.enabled && <Stat label={t.statAvailable} value={data.available === null ? t.noLimit : money(data.available)} />}
          </dl>

          <h3 className="px-4 pb-2 text-xs font-semibold text-ink-soft">{t.ordersTitle}</h3>
          {data.orders.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-soft">{t.ordersEmpty}</p>
          ) : (
            <>
              {/* Phones: one block per order, the payment button full width under it. */}
              <ul className="divide-y divide-line border-t border-line md:hidden">
                {shown.map((o) => (
                  <li key={o.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {orderLink(o)}
                        <p className={cn("mt-0.5 text-xs", o.overdue ? "font-medium text-danger" : "text-ink-soft")}>
                          {fmt(t.dueOn, { date: formatDate(o.paymentDueAt) })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {parseMoney(o.due) > 0 ? (
                          <span className={cn("font-medium whitespace-nowrap tabular-nums", o.overdue ? "text-danger" : "text-ink")}>
                            {fmt(t.leftShort, { amount: formatMoney(o.due, o.currency) })}
                          </span>
                        ) : (
                          left(o)
                        )}
                        {o.overdue && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
                      </div>
                    </div>
                    {payButton(o, "mt-2 w-full")}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <DataTable columns={columns} rows={shown} rowKey={(o) => o.id} minWidth="38rem" phoneCards={false} />
              </div>
              {data.orders.length > FIRST_ORDERS && (
                <div className="border-t border-line px-2 py-1">
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                    {all ? t.showFewerOrders : fmt(t.showAllOrders, { n: data.orders.length })}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <RecordPaymentDialog
        target={paying ? { orderId: paying.id, orderNumber: paying.orderNumber, due: paying.due, currency: paying.currency } : null}
        onClose={() => setPayingId(null)}
        onRecorded={() => statement.refresh({ silent: true })}
        onStale={() => statement.refresh({ silent: true })}
      />
    </CustomerCard>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-[0.5rem] bg-paper px-3 py-2">
      <dt className={cn("text-xs", danger ? "font-medium text-danger" : "text-ink-soft")}>{label}</dt>
      <dd className={cn("font-semibold tabular-nums", danger ? "text-danger" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** The switch, the credit limit and the terms. The limit and terms show once the switch is on. */
function TermsForm({
  data,
  currency,
  canEdit,
  onSave,
}: {
  data: OnAccountStatement;
  currency: string;
  canEdit: boolean;
  onSave: (body: { enabled: boolean; creditLimit: number | null; paymentTermsDays: number }) => Promise<void>;
}) {
  const t = useT(B2B_STRINGS);
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const switchHint = useId();
  const savedLimit = data.creditLimit === null ? null : parseMoney(data.creditLimit);
  const savedDays = data.paymentTermsDays ?? ON_ACCOUNT_LIMITS.termsDaysDefault;
  const [enabled, setEnabled] = useState(data.enabled);
  const [limit, setLimit] = useState(savedLimit === null ? "" : minorToMajorInput(savedLimit));
  const [days, setDays] = useState(String(savedDays));
  const [limitError, setLimitError] = useState<string | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limitMinor = limit.trim() === "" ? null : majorToMinor(toAsciiDigits(limit));
  const daysNumber = parseWhole(days, 0, ON_ACCOUNT_LIMITS.termsDaysMax);
  const dirty = enabled !== data.enabled || (enabled && (limitMinor !== savedLimit || daysNumber !== savedDays));
  useReportDirty(dirty);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    // Switching it off keeps the limit and terms as they were, for the day it is switched on again.
    let body = { enabled: false, creditLimit: savedLimit, paymentTermsDays: savedDays };
    if (enabled) {
      const limitProblem =
        limitMinor !== null && !(Number.isFinite(limitMinor) && limitMinor >= 0 && limitMinor <= ON_ACCOUNT_LIMITS.creditLimitMax) ? t.creditLimitError : null;
      const daysProblem = daysNumber === null ? fmt(t.termsError, { min: 0, max: ON_ACCOUNT_LIMITS.termsDaysMax }) : null;
      setLimitError(limitProblem);
      setDaysError(daysProblem);
      if (limitProblem || daysProblem || daysNumber === null) return;
      body = { enabled: true, creditLimit: limitMinor, paymentTermsDays: daysNumber };
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave(body);
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.creditLimit) setLimitError(t.creditLimitError);
      if (fields.paymentTermsDays) setDaysError(fmt(t.termsError, { min: 0, max: ON_ACCOUNT_LIMITS.termsDaysMax }));
      if (!fields.creditLimit && !fields.paymentTermsDays) setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 px-4 pb-4">
      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink has-[:disabled]:cursor-default">
          <input
            type="checkbox"
            role="switch"
            className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
            checked={enabled}
            disabled={!canEdit || saving}
            aria-describedby={switchHint}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setFailure(null);
            }}
          />
          {t.onAccountEnable}
        </label>
        <p id={switchHint} className="text-xs text-ink-soft">
          {t.onAccountEnableHint}
        </p>
      </div>

      {enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label={t.creditLimit}
            currency={currency}
            value={limit}
            disabled={!canEdit || saving}
            placeholder={t.noLimit}
            onChange={(v) => {
              setLimit(v);
              setLimitError(null);
            }}
            error={limitError ?? undefined}
            hint={t.creditLimitHint}
          />
          <Field label={t.terms} error={daysError ?? undefined} hint={t.termsHint}>
            {({ id, ...aria }) => (
              <div className="relative">
                <Input
                  id={id}
                  {...aria}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  value={days}
                  disabled={!canEdit || saving}
                  onChange={(e) => {
                    setDays(e.target.value);
                    setDaysError(null);
                  }}
                  className={cn("pe-14", daysError && "border-danger focus-visible:ring-danger/30")}
                />
                <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">{t.termsUnit}</span>
              </div>
            )}
          </Field>
        </div>
      )}

      {failure && <Alert variant="danger">{failure}</Alert>}
      {canEdit ? (
        dirty && (
          <div className="flex justify-end">
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? common.saving : common.save}
            </Button>
          </div>
        )
      ) : (
        <p className="text-xs text-ink-soft">{t.viewOnly}</p>
      )}
    </form>
  );
}
