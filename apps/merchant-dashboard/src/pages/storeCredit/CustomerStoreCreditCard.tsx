import { useId, useState, type FormEvent } from "react";
import { IconMinus, IconPlus } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  STORE_CREDIT_ADJUST_MAX,
  STORE_CREDIT_NOTE_MAX,
  isApiErrorCode,
  storeCreditCustomerAdjust,
  storeCreditCustomerGet,
  type StoreCreditAccount,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, parseMoney } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { SkeletonBar } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { BalanceHistory, type BalanceHistoryRow } from "@/pages/customers/BalanceHistory";
import { toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { STORE_CREDIT_KIND_KEY, STORE_CREDIT_STRINGS } from "./storeCreditStrings";

/** The kinds whose note a member of staff typed; the rest carry the system's own remarks. */
const STAFF_NOTE_KINDS = new Set(["grant", "adjust", "refund_credit"]);

/**
 * The customer page's «رصيد المتجر» card: the money the
 * customer holds at the store, every change of it, and «إضافة رصيد» /
 * «خصم رصيد» for staff (refunds.manage).
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerStoreCreditCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(STORE_CREDIT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const account = useAsync(() => storeCreditCustomerGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  const [dialog, setDialog] = useState<"add" | "take" | null>(null);

  const data = account.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(account.error)) return null;

  if (!data) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint}>
        {account.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{errorMessage(account.error)}</p>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void account.refresh()}>
              {common.retry}
            </Button>
          </div>
        ) : (
          <div role="status" aria-busy="true">
            <span className="sr-only">{common.loading}</span>
            <div aria-hidden>
              <SkeletonBar className="h-7 w-32" />
              <SkeletonBar className="mt-3 w-2/5" />
            </div>
          </div>
        )}
      </CustomerCard>
    );
  }

  const balance = parseMoney(data.balance);
  const money = (n: number | string) => formatMoney(n, data.currency);
  const rows: BalanceHistoryRow[] = data.history.map((row) => {
    const change = parseMoney(row.amount);
    return {
      id: row.id,
      what: t[STORE_CREDIT_KIND_KEY[row.kind]] ?? row.kind,
      orderId: row.orderId,
      note: STAFF_NOTE_KINDS.has(row.kind) ? row.note : null,
      change,
      changeText: formatMoney(Math.abs(change), row.currency || data.currency),
      afterText: formatMoney(row.balanceAfter, row.currency || data.currency),
      createdAt: row.createdAt,
    };
  });

  return (
    <CustomerCard
      frame={frame}
      title={t.cardTitle}
      description={t.cardHint}
      // The folded line of the customer page: the balance.
      summary={money(balance)}
      flush
      actions={
        <>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog("add")}>
            <IconPlus className="size-4" aria-hidden />
            {t.addCredit}
          </Button>
          {balance > 0 && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog("take")}>
              <IconMinus className="size-4" aria-hidden />
              {t.takeCredit}
            </Button>
          )}
        </>
      }
    >
      <p className="px-4 pb-4 text-3xl font-semibold tabular-nums text-ink">{money(balance)}</p>
      <h3 className="px-4 pb-2 text-xs font-semibold text-ink-soft">{t.history}</h3>
      <BalanceHistory rows={rows} empty={t.historyEmpty} />

      <CreditDialog
        mode={dialog}
        account={data}
        onClose={() => setDialog(null)}
        onSave={async (body) => {
          await storeCreditCustomerAdjust(apiClient, workspaceId, customerId, body);
          await account.refresh({ silent: true });
        }}
      />
    </CustomerCard>
  );
}

function CreditDialog({
  mode,
  account,
  onClose,
  onSave,
}: {
  /** null while closed. */
  mode: "add" | "take" | null;
  account: StoreCreditAccount;
  onClose: () => void;
  onSave: (body: { amount: number; note: string }) => Promise<void>;
}) {
  const t = useT(STORE_CREDIT_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The dialog keeps its last wording while it closes; each opening starts empty.
  const [shown, setShown] = useState<"add" | "take">("add");
  const [openedFor, setOpenedFor] = useState<"add" | "take" | null>(null);
  if (mode !== openedFor) {
    setOpenedFor(mode);
    if (mode) {
      setShown(mode);
      setAmount("");
      setNote("");
      setAmountError(null);
      setNoteError(null);
      setFailure(null);
    }
  }

  const adding = shown === "add";
  const balance = parseMoney(account.balance);
  const money = (n: number) => formatMoney(n, account.currency);
  const minor = majorToMinor(toAsciiDigits(amount));
  const valid = Number.isFinite(minor) && minor >= 1 && minor <= STORE_CREDIT_ADJUST_MAX;
  const next = valid ? balance + (adding ? minor : -minor) : null;
  const tooMuch = fmt(t.tooMuch, { balance: money(balance) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const amountProblem = !valid ? t.amountError : !adding && minor > balance ? tooMuch : null;
    const noteProblem = note.trim() ? null : t.noteError;
    setAmountError(amountProblem);
    setNoteError(noteProblem);
    if (amountProblem || noteProblem) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({ amount: adding ? minor : -minor, note: note.trim() });
      onClose();
      toast.success(fmt(adding ? t.added : t.taken, { amount: money(minor) }));
    } catch (err) {
      // The balance moved meanwhile (spent on an order): less can come off than this page showed.
      if (isApiErrorCode(err, "STORE_CREDIT_NOT_ENOUGH")) setAmountError(tooMuch);
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      title={adding ? t.addTitle : t.takeTitle}
      description={fmt(t.dialogDescription, { balance: money(balance) })}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.saving : adding ? t.addSave : t.takeSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <MoneyInput
          label={t.amount}
          required
          currency={account.currency}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setAmountError(null);
          }}
          error={amountError ?? undefined}
          hint={next !== null && next >= 0 ? fmt(t.newBalance, { balance: money(next) }) : undefined}
        />
        <Field label={t.note} required error={noteError ?? undefined} hint={t.noteHint}>
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              maxLength={STORE_CREDIT_NOTE_MAX}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
            />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
