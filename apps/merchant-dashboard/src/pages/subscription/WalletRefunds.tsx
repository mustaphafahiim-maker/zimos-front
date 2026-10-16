import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type { WalletRefundQuote, WalletRefundRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMinorMoney } from "@/lib/format";
import { useT, fmt } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { REFUND_STRINGS, type RefundText } from "./refundStrings";
import { toMinor } from "./WalletSection";

const OPEN = ["requested", "approved"];
const PAYOUT_METHODS = ["instapay", "wallet"] as const;

/**
 * Getting unused prepaid balance back (billing/walletRefundService): the rule
 * in plain words, the most and the least that can be asked for now, the open
 * request with its status (cancellable while it waits), and the last ones.
 * Nothing for a store the API says isn't eligible. `onChanged` reads the
 * balance and its history again, since a request holds the amount off it.
 */
export function WalletRefunds({ onChanged }: { onChanged: () => void }) {
  const t = useT(REFUND_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const overview = useAsync(() => apiClient.getWalletRefunds(workspaceId), [workspaceId]);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = overview.data;
  if (!data || !data.eligible) return null;

  const q = data.quote;
  const open = data.requests.find((r) => OPEN.includes(r.status)) ?? null;
  const money = (minor: number) => formatMinorMoney(minor, q.currency);
  const reload = () => {
    void overview.refresh({ silent: true });
    onChanged();
  };

  async function cancel(request: WalletRefundRequest) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.cancelWalletRefund(workspaceId, request.id);
      toast.success(t.cancelled);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="refund-title" className="space-y-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <h3 id="refund-title" className="text-sm font-medium text-ink">
        {t.title}
      </h3>
      <p className="text-sm text-ink-soft">{fmt(t.rule, { share: `${q.ceilingBp / 100}%` })}</p>

      {q.debt > 0 && <Alert variant="danger">{t.debt}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Alert role="status" className="flex-1">
            {fmt(open.status === "approved" ? t.openApproved : t.openRequested, { amount: money(open.amount) })}
          </Alert>
          {open.status === "requested" && (
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void cancel(open)}>
              {t.cancel}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="tabular font-medium text-ink">{fmt(t.max, { amount: money(q.max) })}</p>
            <p className="tabular text-xs text-ink-soft">{fmt(t.min, { amount: money(q.min) })}</p>
          </div>
          <Button type="button" className="min-h-11" disabled={!q.canRequest} onClick={() => setAsking(true)}>
            {t.request}
          </Button>
          {!q.canRequest && q.debt === 0 && <p className="w-full text-xs text-ink-soft">{fmt(t.belowMin, { min: money(q.min) })}</p>}
        </div>
      )}

      {data.requests.length > 0 && <RefundHistory requests={data.requests} t={t} />}

      <Modal open={asking} onClose={() => setAsking(false)} title={t.dialogTitle}>
        {asking && (
          <RefundForm
            quote={q}
            onClose={() => setAsking(false)}
            onSent={() => {
              setAsking(false);
              toast.success(t.sent);
              reload();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function RefundHistory({ requests, t }: { requests: WalletRefundRequest[]; t: RefundText }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-ink-soft">{t.historyTitle}</h4>
      <ul className="divide-y divide-line rounded-[10px] border border-line">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2">
            <div className="min-w-0">
              <p className="tabular text-sm text-ink">
                {formatMinorMoney(r.amount, r.currency)} · {formatDate(r.createdAt)}
              </p>
              {r.status === "rejected" && r.adminNote && <p className="text-xs text-danger">{fmt(t.rejectedNote, { note: r.adminNote })}</p>}
            </div>
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                r.status === "paid" ? "bg-success-soft text-success" : r.status === "rejected" ? "bg-danger-soft text-danger" : "bg-accent-soft text-ink"
              )}
            >
              {t[`status_${r.status}` as keyof RefundText]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RefundForm({ quote, onClose, onSent }: { quote: WalletRefundQuote; onClose: () => void; onSent: () => void }) {
  const t = useT(REFUND_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const amountId = useId();
  const accountId = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState("");
  const [method, setMethod] = useState<(typeof PAYOUT_METHODS)[number]>("instapay");
  const [account, setAccount] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const min = formatMinorMoney(quote.min, quote.currency);
  const max = formatMinorMoney(quote.max, quote.currency);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amount = toMinor(text);
    if (amount === null || amount < quote.min || amount > quote.max) {
      setProblem(fmt(t.amountInvalid, { min, max }));
      return;
    }
    if (account.trim().length < 3) {
      setProblem(t.accountRequired);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await apiClient.requestWalletRefund(workspaceId, { amount, payoutMethod: method, payoutAccount: account.trim(), requestId });
      onSent();
    } catch (err) {
      setProblem(
        errorMessage(err, {
          REFUND_REQUEST_OPEN: t.errOpen,
          REFUND_AMOUNT_TOO_HIGH: fmt(t.errTooHigh, { max }),
          REFUND_AMOUNT_TOO_LOW: fmt(t.errTooLow, { min }),
          WALLET_DEBT_OUTSTANDING: t.debt,
          WALLET_NOT_ON_PLAN: t.errNotOnPlan,
          WALLET_DISABLED: t.errDisabled,
        })
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {problem && (
        <Alert variant="danger" role="alert">
          {problem}
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={amountId}>{t.amount}</Label>
        <Input id={amountId} inputMode="decimal" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} className="min-h-11" aria-describedby={`${amountId}-hint`} />
        <p id={`${amountId}-hint`} className="text-xs text-ink-soft">
          {fmt(t.amountHint, { min, max })}
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t.method}</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {PAYOUT_METHODS.map((m) => (
            <label
              key={m}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-sm",
                method === m ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
              )}
            >
              <input type="radio" name="refund-method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {t[`method_${m}` as keyof RefundText]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={accountId}>{t.account}</Label>
        <Input id={accountId} dir="ltr" value={account} onChange={(e) => setAccount(e.target.value)} className="min-h-11" maxLength={120} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
          {t.dialogCancel}
        </Button>
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? t.sending : t.send}
        </Button>
      </div>
    </form>
  );
}
